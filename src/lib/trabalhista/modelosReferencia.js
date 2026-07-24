import { base44 } from '@/api/base44Client';
import mammoth from 'mammoth';
import { TIPO_DISPENSA_LABELS } from './tokens';

// ============================================================
// Anonimização (mesma lógica usada no cadastro dos modelos)
// Remove dados pessoais para que a IA nunca reaproveite dados
// de partes de outros processos.
// ============================================================
export function anonimizarTexto(txt) {
  if (!txt) return '';
  let t = txt;
  t = t.replace(/[\w.\-]+@[\w.\-]+\.\w+/g, '[EMAIL]');
  t = t.replace(/\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/g, '[CNPJ]');
  t = t.replace(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, '[CPF]');
  t = t.replace(/\bCEP:?\s*\d{5}-?\d{3}\b/gi, 'CEP: [CEP]');
  t = t.replace(/\b\d{5}-\d{3}\b/g, '[CEP]');
  t = t.replace(/(PIS:?\s*)[\d.\-]+/gi, '$1[PIS]');
  t = t.replace(/(S[ée]rie:?\s*)[\d.\-]+/gi, '$1[SERIE]');
  t = t.replace(/(CTPS:?\s*)[\d.\-]+/gi, '$1[CTPS]');
  t = t.replace(/(RG\s*(?:\/CPF\s*)?(?:n[ºo]\.?)?\s*)[\d.\-Xx]+/g, '$1[RG]');
  t = t.replace(/(nascid[oa] em\s*)\d{2}\/\d{2}\/\d{4}/gi, '$1[DATA_NASC]');
  return t;
}

// ============================================================
// Matching determinístico: pontua cada modelo contra os
// atributos extraídos da entrevista.
// ============================================================
const norm = (s) =>
  (s || '').toString().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export function pontuarModelo(modelo, attrs = {}) {
  let score = 0;
  const motivos = [];

  if (attrs.tipo_dispensa && modelo.tipo_dispensa === attrs.tipo_dispensa) {
    score += 5;
    motivos.push('Mesma modalidade de rescisão');
  }

  if (attrs.funcao && modelo.funcao) {
    const a = norm(attrs.funcao);
    const m = norm(modelo.funcao);
    const mesmaFuncao =
      (a && (m.includes(a) || a.includes(m))) ||
      (a.includes('controlador') && m.includes('controlador')) ||
      (a.includes('porteiro') && m.includes('porteiro'));
    if (mesmaFuncao) {
      score += 2;
      motivos.push('Mesma função');
    }
  }

  if (attrs.rito && modelo.rito === attrs.rito) {
    score += 1;
    motivos.push('Mesmo rito');
  }

  if (attrs.tem_tomadora === true && modelo.tem_tomadora === true) {
    score += 2;
    motivos.push('Tem tomadora (Súm. 331 TST)');
  }

  const modeloTeses = (modelo.teses || []).map(norm);
  for (const t of attrs.teses || []) {
    const nt = norm(t);
    if (nt && modeloTeses.some((x) => x.includes(nt) || nt.includes(x))) {
      score += 1;
      motivos.push(`Tese: ${t}`);
    }
  }

  return { score, motivos };
}

export function rankearModelos(modelos, attrs) {
  return (modelos || [])
    .map((modelo) => ({ modelo, ...pontuarModelo(modelo, attrs) }))
    .sort((a, b) => b.score - a.score);
}

export async function listarModelosAtivos() {
  const todos = await base44.entities.ModeloReferencia.list('-updated_date', 100);
  return todos.filter((m) => m.ativo !== false);
}

// ============================================================
// Passo 1: extrair atributos estruturados da entrevista (IA)
// ============================================================
const ATTRS_SCHEMA = {
  type: 'object',
  properties: {
    funcao: {
      type: 'string',
      description: 'Função/cargo do trabalhador (ex.: Porteiro, Controlador de acesso)',
    },
    tipo_dispensa: {
      type: 'string',
      enum: [
        'sem_justa_causa',
        'rescisao_indireta',
        'nulidade_pedido_demissao',
        'reversao_justa_causa',
        'acordo',
      ],
      description: 'Modalidade de rescisão mais aderente ao relato',
    },
    rito: { type: 'string', enum: ['ordinario', 'sumarissimo'] },
    tem_tomadora: {
      type: 'boolean',
      description: 'Existe empresa tomadora de serviços (terceirização)?',
    },
    teses: {
      type: 'array',
      items: { type: 'string' },
      description: 'Teses/verbas com suporte no relato',
    },
    resumo_caso: { type: 'string', description: 'Resumo objetivo dos fatos relevantes' },
  },
};

export async function extrairAtributos({ texto, fileUrls }) {
  const req = {
    prompt: `Você é um advogado trabalhista. Leia a ENTREVISTA/relato abaixo (e os documentos anexados, se houver) e extraia os atributos estruturados que servirão para escolher o modelo de petição mais adequado.

ENTREVISTA:
"""
${texto || '(sem texto colado; baseie-se nos documentos anexados)'}
"""

Regras:
- tipo_dispensa: escolha a modalidade mais aderente ao relato.
- teses: liste apenas as que têm suporte no relato (ex.: "Horas extras", "Adicional noturno", "Intervalo intrajornada", "Folgas trabalhadas/DSR", "Rescisão indireta", "Reversão da justa causa", "Adicional de periculosidade", "Adicional de insalubridade", "Dano moral", "Acúmulo de função", "Responsabilidade subsidiária").
- Não invente fatos. Responda APENAS com o objeto JSON.`,
    model: 'claude_sonnet_4_6',
    response_json_schema: ATTRS_SCHEMA,
  };
  if (fileUrls?.length) req.file_urls = fileUrls;
  return base44.integrations.Core.InvokeLLM(req);
}

// ============================================================
// Passo 2: gerar a minuta usando o modelo como referência
// ============================================================
export function buildGeracaoPrompt({ texto, attrs, modelo }) {
  return `Você é um advogado trabalhista sênior. Redija uma MINUTA de PETIÇÃO INICIAL trabalhista completa, em português, pronta para revisão humana.

Use o MODELO DE REFERÊNCIA abaixo como guia de ESTRUTURA, ORDEM DAS SEÇÕES, TESES e FUNDAMENTAÇÃO JURÍDICA (súmulas e artigos). NÃO copie dados pessoais, nomes de partes, CPF, endereços ou valores do modelo — esses dados são de OUTRO processo e servem apenas como forma e argumentação.

Todos os DADOS DO CASO devem vir EXCLUSIVAMENTE da entrevista e dos documentos anexados do caso atual. Onde faltar um dado (nome, CPF, datas, valores), insira um marcador entre colchetes, ex.: [NOME DO RECLAMANTE], [CPF], [DATA DE ADMISSÃO], [SALÁRIO]. Não invente fatos nem valores. Inclua apenas as seções/teses cabíveis ao caso atual.

=== MODELO DE REFERÊNCIA: ${modelo.titulo} ===
Rito: ${modelo.rito || '-'} | Modalidade: ${TIPO_DISPENSA_LABELS[modelo.tipo_dispensa] || modelo.tipo_dispensa || '-'} | Comarca: ${modelo.comarca_uf || '-'} (${modelo.regiao_trt || '-'})
Esqueleto de seções (nesta ordem):
${(modelo.secoes || []).map((s) => `- ${s}`).join('\n')}

Referência de teses e fundamentos:
${modelo.conteudo || modelo.resumo || ''}
=== FIM DO MODELO ===

=== ENTREVISTA / CASO ATUAL ===
${texto || '(ver documentos anexados)'}

Atributos detectados: função=${attrs?.funcao || '-'}, modalidade=${attrs?.tipo_dispensa || '-'}, rito=${attrs?.rito || '-'}, tomadora=${attrs?.tem_tomadora ? 'sim' : 'não'}.
=== FIM DA ENTREVISTA ===

FORMATO DE SAÍDA: retorne APENAS o HTML do corpo da petição (sem <html>, <head> ou <body>). Use <h2> para títulos de seção (ex.: <h2>DAS HORAS EXTRAS</h2>) e <p style="text-align: justify"> para os parágrafos. Inclua: endereçamento ao juízo, qualificação das partes (com marcadores para dados pessoais), dos fatos, do direito (uma seção por tese cabível, seguindo o esqueleto), dos pedidos e o fecho. Ao final, acrescente exatamente:
<p><em>⚠️ Minuta gerada por IA a partir de modelo de referência — revisão obrigatória pelo advogado responsável.</em></p>`;
}

export async function gerarPeca({ texto, fileUrls, attrs, modelo }) {
  const req = {
    prompt: buildGeracaoPrompt({ texto, attrs, modelo }),
    model: 'claude_sonnet_4_6',
  };
  const urls = [...(fileUrls || [])];
  if (modelo.arquivo_url) urls.push(modelo.arquivo_url);
  if (urls.length) req.file_urls = urls;
  return base44.integrations.Core.InvokeLLM(req);
}

// ============================================================
// Importação de um .docx real para enriquecer um modelo
// (extrai texto, anonimiza e devolve para salvar no registro)
// ============================================================
export async function extrairTextoDocx(file) {
  const arrayBuffer = await file.arrayBuffer();
  const { value } = await mammoth.extractRawText({ arrayBuffer });
  return anonimizarTexto(value || '');
}
