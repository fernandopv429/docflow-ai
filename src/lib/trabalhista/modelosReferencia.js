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
// Conversa (chat) para coletar dados da entrevista de forma
// incremental e decidir quando gerar a minuta.
// ============================================================
const CHAT_SCHEMA = {
  type: 'object',
  properties: {
    reply: { type: 'string', description: 'Resposta conversacional para o usuário, em português' },
    atributos: {
      type: 'object',
      properties: {
        funcao: { type: 'string' },
        tipo_dispensa: {
          type: 'string',
          enum: [
            'sem_justa_causa',
            'rescisao_indireta',
            'nulidade_pedido_demissao',
            'reversao_justa_causa',
            'acordo',
          ],
        },
        rito: { type: 'string', enum: ['ordinario', 'sumarissimo'] },
        tem_tomadora: { type: 'boolean' },
        teses: { type: 'array', items: { type: 'string' } },
      },
    },
    pronto_para_gerar: {
      type: 'boolean',
      description: 'true quando o usuário pediu a minuta OU já há fatos essenciais suficientes',
    },
  },
  required: ['reply'],
};

function resumoModelos(modelos) {
  return (modelos || [])
    .map(
      (m) =>
        `- ${m.titulo} [modalidade=${m.tipo_dispensa || '-'}, rito=${m.rito || '-'}, teses: ${(m.teses || []).slice(0, 6).join(', ')}]`
    )
    .join('\n');
}

function formatarTranscript(transcript) {
  return (transcript || [])
    .map((m) => `${m.role === 'user' ? 'ADVOGADO' : 'ASSISTENTE'}: ${m.text}`)
    .join('\n\n');
}

export function buildChatPrompt({ transcript, modelos }) {
  return `Você é um assistente jurídico trabalhista que conversa com um advogado para reunir as informações de uma ENTREVISTA e, ao final, gerar uma petição inicial a partir de um modelo de referência.

CONVERSE em português, de forma objetiva e cordial (estilo chat). Seu papel AGORA é entender o caso e coletar o que falta — NÃO redija a petição nesta etapa (o sistema cuida da redação quando você sinalizar).

Peça, quando ainda não informado, os dados NECESSÁRIOS para uma petição completa: qualificação do reclamante (nome, nacionalidade, estado civil, RG, CPF, PIS, CTPS/Série, data de nascimento, filiação, endereço); reclamada(s) com razão social e CNPJ (e a tomadora, se houver); local de prestação dos serviços (define a competência); função e sindicato/CCT aplicável; datas de admissão e rescisão; salário e a maior remuneração na função (para dano moral e cálculos); jornada/escala; modalidade de rescisão; e as verbas/teses pretendidas. Faça poucas perguntas por vez e sinalize claramente o que ainda falta.

Extraia em "atributos" o que já for possível inferir da conversa. Defina "pronto_para_gerar" como true SOMENTE quando o advogado pedir a minuta ou quando já houver fatos essenciais suficientes. Não invente dados.

MODELOS DE REFERÊNCIA DISPONÍVEIS (o sistema escolherá automaticamente o mais aderente aos atributos):
${resumoModelos(modelos)}

CONVERSA ATÉ AGORA:
${formatarTranscript(transcript)}

Responda APENAS com o objeto JSON.`;
}

export async function conversarEntrevista({ transcript, fileUrls, modelos }) {
  const req = {
    prompt: buildChatPrompt({ transcript, modelos }),
    model: 'claude_sonnet_4_6',
    response_json_schema: CHAT_SCHEMA,
  };
  if (fileUrls?.length) req.file_urls = fileUrls;
  return base44.integrations.Core.InvokeLLM(req);
}

// ============================================================
// Consulta de CNPJ na Receita Federal (BrasilAPI) — determinística.
// Usada sempre que houver CNPJ, para preencher a qualificação das
// reclamadas com dados oficiais (sem alucinação da IA).
// ============================================================
const CNPJ_RE = /\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/g;

export function extrairCnpjs(texto) {
  const encontrados = new Set();
  for (const m of (texto || '').matchAll(CNPJ_RE)) {
    const d = m[0].replace(/\D/g, '');
    if (d.length === 14) encontrados.add(d);
  }
  return [...encontrados];
}

function formatarCnpj(digits) {
  return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
}

export async function consultarCnpj(cnpj) {
  const digits = (cnpj || '').replace(/\D/g, '');
  if (digits.length !== 14) return { cnpj, erro: 'CNPJ inválido (precisa de 14 dígitos)' };
  try {
    const resp = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${digits}`);
    if (resp.status === 404) return { cnpj: formatarCnpj(digits), erro: 'não encontrado na Receita' };
    if (!resp.ok) return { cnpj: formatarCnpj(digits), erro: `erro HTTP ${resp.status}` };
    const d = await resp.json();
    const cep = (d.cep || '').replace(/\D/g, '');
    const endereco = [
      `${d.descricao_tipo_de_logradouro || ''} ${d.logradouro || ''}`.trim(),
      d.numero,
      d.complemento,
      d.bairro,
      [d.municipio, d.uf].filter(Boolean).join('/'),
    ]
      .filter(Boolean)
      .join(', ');
    return {
      cnpj: formatarCnpj(digits),
      razao_social: d.razao_social || '',
      endereco,
      cep: cep.length === 8 ? `${cep.slice(0, 5)}-${cep.slice(5)}` : cep,
      situacao: d.descricao_situacao_cadastral || '',
    };
  } catch (e) {
    return { cnpj: formatarCnpj(digits), erro: 'falha de rede ao consultar a Receita' };
  }
}

export async function enriquecerCnpjs(cnpjs) {
  const unicos = [
    ...new Set((cnpjs || []).map((c) => (c || '').replace(/\D/g, '')).filter((d) => d.length === 14)),
  ];
  if (!unicos.length) return [];
  return Promise.all(unicos.map(consultarCnpj));
}

function blocoReceita(dados) {
  if (!dados?.length) return '';
  const linhas = dados.map((d) =>
    d.erro
      ? `- CNPJ ${d.cnpj}: ${d.erro} — use o marcador [CNPJ - confirmar].`
      : `- ${d.razao_social} — CNPJ ${d.cnpj}, ${d.endereco}, CEP ${d.cep} (situação cadastral: ${d.situacao}).`
  );
  return `\n\nDADOS OFICIAIS DAS RECLAMADAS (verificados na Receita Federal via BrasilAPI — USE ESTES dados exatos na qualificação das reclamadas, com a razão social e o endereço oficiais):\n${linhas.join('\n')}`;
}

// ============================================================
// Passo 2: gerar a minuta usando o modelo como referência
// ============================================================
export const PROMPT_SISTEMA_PETICAO = `Você é um assistente jurídico especializado em Direito do Trabalho brasileiro, vinculado ao escritório FAV Advogados. A partir da entrevista do cliente, elabore o TEXTO COMPLETO da petição inicial trabalhista seguindo rigorosamente as regras abaixo.

IDENTIDADE DO ESCRITÓRIO (imutável):
- Advogado: Dr. Fernando Andrade Vieira — OAB/SP nº 320.825
- E-mail: trabalhista@favadvogados.com.br

CABEÇALHO:
- Iniciar direto com o Juízo/Vara/Região. NÃO incluir nome do escritório, logo ou qualquer texto antes disso.

QUALIFICAÇÃO DO RECLAMANTE (ordem obrigatória):
nome completo, nacionalidade, estado civil, função, RG, CPF, PIS, CTPS nº, Série nº, nascido em [data], filho de [filiação], residente e domiciliado em [endereço completo].

RECLAMADAS:
- Usar sempre a razão social oficial e o CNPJ, com endereço completo. Se o CNPJ/endereço não constar da entrevista, inserir marcador [CNPJ - confirmar] / [ENDEREÇO - confirmar].

COMPETÊNCIA TERRITORIAL:
- Identificar o local de prestação de serviços (art. 651 CLT) e indicar a Vara do Trabalho e o TRT correspondentes; se não houver Vara na cidade, indicar o foro vinculado.

CONVENÇÃO COLETIVA (CCT):
- Aplicar a CCT vigente conforme a função e a localidade, identificar o sindicato profissional correto e referenciar as cláusulas ao longo da peça.

TÓPICOS FIXOS (sempre presentes, nesta ordem):
1. Da Competência Processual
2. Da Não Limitação ao Valor da Causa – Estimativa de Valores
3. Do Juízo 100% Digital
4. Da Extinção do Feito sem Julgamento de Mérito
5. Da Justiça Gratuita
6. Do Contrato de Trabalho
7. Do Dano Moral
8. Da Súmula 331 do C. TST
[aqui entram os tópicos conexos aplicáveis ao caso]
... Das Multas Convencionais
... Do FGTS + Multa de 40%
... Do Aviso Prévio Indenizado
... Das Verbas Rescisórias
... Da Multa do Artigo 477 da CLT
... Da Multa do Artigo 467 da CLT
... Dos Honorários Advocatícios – Sucumbência
... Dos Juros de Mora e da Correção Monetária
... Do Desconto do Imposto de Renda
... Da Previdência Social
... Da Expedição de Ofícios
... Dos Pedidos

TÓPICOS CONEXOS À CAUSA DE PEDIR (incluir APENAS os aplicáveis):
Do Desvio de Função; Da Jornada de Trabalho; Das Horas Extras; Da Descaracterização da Jornada 12x36; Do Artigo 71 da CLT (intervalo intrajornada); Do Adicional Noturno e Hora Noturna Reduzida; Do Descanso Semanal Remunerado; Dos Minutos que Antecedem e Sucedem a Jornada; Dos 10 Minutos de Descanso (cláusula CCT); Das Diferenças do Adicional de Periculosidade nas Horas Extras; Das Horas Extras de 100% (folgas/feriados); Da Integração de Valores Remunerados Fora da Folha; Da Ausência de Concessão do Vale-Transporte nas Folgas; Da Ausência de Concessão do Auxílio Alimentação nas Folgas.

DANO MORAL:
- Manter os parágrafos padrão do tópico e acrescentar ao menos um elemento específico do caso concreto. Valor: 10x a maior remuneração do reclamante na função.

CÁLCULOS E VALOR DA CAUSA:
- Calcular todos os pedidos conforme a CLT e a legislação vigente. Discriminar valor principal + cada reflexo (aviso prévio, DSRs, férias+1/3, 13º, FGTS+40%) + total estimado por pedido.
- A somatória total NÃO pode ultrapassar R$ 400.000,00. O valor da causa é a somatória total.

REVISÃO FINAL (garantir antes de responder):
- Cada causa de pedir tem pedido correspondente; CNPJ, endereço, competência e CCT confirmados ou marcados; total ≤ R$ 400.000,00.

REGRAS DE DADOS:
- Use SOMENTE dados da entrevista/documentos do caso atual. Onde faltar um dado, insira marcador entre colchetes (ex.: [SALÁRIO], [DATA DE ADMISSÃO]). NÃO invente fatos nem valores. NÃO narre etapas, verificações ou alterações.`;

export function buildGeracaoPrompt({ texto, attrs, modelo, dadosReceita }) {
  return `${PROMPT_SISTEMA_PETICAO}

Use o MODELO DE REFERÊNCIA abaixo (uma peça correta já aprovada pelo escritório) como guia de ESTRUTURA, ORDEM DOS TÓPICOS, TESES e FUNDAMENTAÇÃO JURÍDICA (súmulas e artigos). NÃO copie dados pessoais, nomes de partes, CPF, endereços ou valores do modelo — ele é de OUTRO processo e serve apenas como forma e argumentação.

=== MODELO DE REFERÊNCIA: ${modelo.titulo} ===
Rito: ${modelo.rito || '-'} | Modalidade: ${TIPO_DISPENSA_LABELS[modelo.tipo_dispensa] || modelo.tipo_dispensa || '-'} | Comarca: ${modelo.comarca_uf || '-'} (${modelo.regiao_trt || '-'})
Esqueleto de tópicos (base — ajuste os tópicos conexos ao caso):
${(modelo.secoes || []).map((s) => `- ${s}`).join('\n')}

Referência de teses e fundamentos:
${modelo.conteudo || modelo.resumo || ''}
=== FIM DO MODELO ===

=== ENTREVISTA / CASO ATUAL ===
${texto || '(ver documentos anexados)'}

Atributos detectados: função=${attrs?.funcao || '-'}, modalidade=${attrs?.tipo_dispensa || '-'}, rito=${attrs?.rito || '-'}, tomadora=${attrs?.tem_tomadora ? 'sim' : 'não'}.
=== FIM DA ENTREVISTA ===${blocoReceita(dadosReceita)}

FORMATO DE SAÍDA: retorne APENAS o HTML do corpo da petição (sem <html>, <head> ou <body>), pronto para formatação. Use <h2> para o título de cada tópico (ex.: <h2>DAS HORAS EXTRAS</h2>) e <p style="text-align: justify"> para os parágrafos. Comece direto pelo endereçamento ao Juízo (sem nome/letreiro do escritório antes). Inclua a qualificação das partes, os fatos, o direito (um tópico por tese cabível, seguindo a ordem), os cálculos/valor da causa e o fecho com a assinatura do Dr. Fernando Andrade Vieira — OAB/SP nº 320.825. Ao final, acrescente exatamente:
<p><em>⚠️ Minuta gerada por IA a partir de modelo de referência — revisão obrigatória pelo advogado responsável.</em></p>`;
}

export async function gerarPeca({ texto, fileUrls, attrs, modelo }) {
  // Consulta determinística dos CNPJs (do texto + os que a IA extraiu dos docs)
  const cnpjs = [...extrairCnpjs(texto), ...((attrs && attrs.cnpjs) || [])];
  const dadosReceita = await enriquecerCnpjs(cnpjs);

  const req = {
    prompt: buildGeracaoPrompt({ texto, attrs, modelo, dadosReceita }),
    model: 'claude_sonnet_4_6',
  };
  const urls = [...(fileUrls || [])];
  if (modelo.arquivo_url) urls.push(modelo.arquivo_url);
  if (urls.length) req.file_urls = urls;
  const resultado = await base44.integrations.Core.InvokeLLM(req);
  return { html: typeof resultado === 'string' ? resultado : String(resultado || ''), dadosReceita };
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
