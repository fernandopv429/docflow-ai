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

// Texto integral (anonimizado) do modelo: busca do arquivo hospedado (conteudo_url)
// e cai para a prévia inline / resumo se não houver.
export async function carregarTextoModelo(modelo) {
  if (modelo?.conteudo_url) {
    try {
      const r = await fetch(modelo.conteudo_url);
      if (r.ok) return await r.text();
    } catch (e) {
      /* cai para o fallback */
    }
  }
  return modelo?.conteudo || modelo?.resumo || '';
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
        cnpjs: {
          type: 'array',
          items: { type: 'string' },
          description: 'CNPJs das reclamadas mencionados na conversa OU encontrados nos documentos anexados',
        },
        ceps: {
          type: 'array',
          items: { type: 'string' },
          description: 'CEPs mencionados na conversa OU encontrados nos documentos (endereço do reclamante, local de prestação, reclamadas)',
        },
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
// Consulta de CEP (ViaCEP, com fallback BrasilAPI) — determinística.
// Completa o endereço do reclamante e do local de prestação (competência).
// ============================================================
const CEP_LABEL_RE = /CEP:?\s*(\d{5}-?\d{3})/gi;
const CEP_DASH_RE = /\b\d{5}-\d{3}\b/g;

export function extrairCeps(texto) {
  const encontrados = new Set();
  const t = texto || '';
  for (const m of t.matchAll(CEP_LABEL_RE)) {
    const d = m[1].replace(/\D/g, '');
    if (d.length === 8) encontrados.add(d);
  }
  for (const m of t.matchAll(CEP_DASH_RE)) {
    const d = m[0].replace(/\D/g, '');
    if (d.length === 8) encontrados.add(d);
  }
  return [...encontrados];
}

export async function consultarCep(cep) {
  const digits = (cep || '').replace(/\D/g, '');
  if (digits.length !== 8) return { cep, erro: 'CEP inválido (precisa de 8 dígitos)' };
  const fmt = `${digits.slice(0, 5)}-${digits.slice(5)}`;
  // 1) ViaCEP (traz município + código IBGE)
  try {
    const resp = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
    if (resp.ok) {
      const d = await resp.json();
      if (!d.erro) {
        return {
          cep: fmt,
          logradouro: d.logradouro || '',
          bairro: d.bairro || '',
          municipio: d.localidade || '',
          uf: d.uf || '',
          ibge: d.ibge || '',
        };
      }
    }
  } catch (e) {
    // segue para o fallback
  }
  // 2) Fallback BrasilAPI
  try {
    const resp = await fetch(`https://brasilapi.com.br/api/cep/v1/${digits}`);
    if (resp.ok) {
      const d = await resp.json();
      return {
        cep: fmt,
        logradouro: d.street || '',
        bairro: d.neighborhood || '',
        municipio: d.city || '',
        uf: d.state || '',
        ibge: '',
      };
    }
  } catch (e) {
    // ignora
  }
  return { cep: fmt, erro: 'não encontrado' };
}

export async function enriquecerCeps(ceps) {
  const unicos = [
    ...new Set((ceps || []).map((c) => (c || '').replace(/\D/g, '')).filter((d) => d.length === 8)),
  ];
  if (!unicos.length) return [];
  return Promise.all(unicos.map(consultarCep));
}

function blocoCeps(dados) {
  if (!dados?.length) return '';
  const linhas = dados.map((d) =>
    d.erro
      ? `- CEP ${d.cep}: ${d.erro} — confirme o endereço.`
      : `- CEP ${d.cep}: ${[d.logradouro, d.bairro, [d.municipio, d.uf].filter(Boolean).join('/')].filter(Boolean).join(', ')}.`
  );
  return `\n\nENDEREÇOS VERIFICADOS POR CEP (ViaCEP — use para completar logradouro/bairro/município/UF na qualificação; o município orienta a Vara do Trabalho e o UF o TRT da competência):\n${linhas.join('\n')}`;
}

// ============================================================
// Configuração das integrações (liga/desliga cada tool). Singleton.
// ============================================================
export const CONFIG_INTEGRACOES_PADRAO = {
  cnpj_ativo: true,
  cep_ativo: true,
  datajud_ativo: false,
  datajud_tribunal: 'trt2',
  datajud_size: 5,
};

export async function carregarConfigIntegracoes() {
  try {
    const lista = await base44.entities.IntegracaoConfig.list('-updated_date', 1);
    return { ...CONFIG_INTEGRACOES_PADRAO, ...(lista?.[0] || {}) };
  } catch (e) {
    return { ...CONFIG_INTEGRACOES_PADRAO };
  }
}

// ============================================================
// Consulta ao DataJud (CNJ) — jurisprudência/processos por tema.
// Vai por FUNÇÃO DE BACKEND (base44.functions.invoke('datajud')),
// porque o DataJud não libera CORS para o navegador.
// A busca é montada por palavras-chave/contexto da entrevista.
// ============================================================
export function montarTermosDatajud(attrs) {
  const termos = [...((attrs && attrs.teses) || [])];
  if (!termos.length && attrs?.funcao) termos.push(attrs.funcao);
  return [...new Set(termos.map((t) => (t || '').trim()).filter(Boolean))].slice(0, 4);
}

export async function consultarDatajud({ termo, tribunal = 'trt2', size = 5 }) {
  try {
    const resp = await base44.functions.invoke('datajud', { termo, tribunal, size });
    const data = resp?.data ?? resp;
    const hits = data?.hits || data?.processos || [];
    return { termo, hits: Array.isArray(hits) ? hits : [] };
  } catch (e) {
    return { termo, erro: 'indisponível' };
  }
}

export async function enriquecerDatajud(attrs, config) {
  if (!config?.datajud_ativo) return [];
  const termos = montarTermosDatajud(attrs);
  if (!termos.length) return [];
  return Promise.all(
    termos.map((termo) =>
      consultarDatajud({
        termo,
        tribunal: config.datajud_tribunal || 'trt2',
        size: config.datajud_size || 5,
      })
    )
  );
}

function blocoDatajud(resultados) {
  const comHits = (resultados || []).filter((r) => r && !r.erro && r.hits?.length);
  if (!comHits.length) return '';
  const linhas = comHits.map((r) => {
    const exemplos = r.hits.slice(0, 3).map((h) => {
      const numero = h.numero || h.numeroProcesso || '?';
      const classe = h.classe || (h.classe && h.classe.nome) || '-';
      const assuntos = (h.assuntos || []).map((a) => (typeof a === 'string' ? a : a.nome)).slice(0, 2);
      return `${numero} — ${classe}${assuntos.length ? ` (${assuntos.join(', ')})` : ''}`;
    });
    return `- Tema "${r.termo}": ${exemplos.join('; ')}`;
  });
  return `\n\nCONTEXTO JURISPRUDENCIAL (DataJud/CNJ — mostra que o tema é recorrente no tribunal; use só como reforço argumentativo, NÃO cite números de processo específicos sem conferência humana):\n${linhas.join('\n')}`;
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

export function buildGeracaoPrompt({ texto, attrs, modelo, textoModelo, dadosReceita, dadosCep, dadosDatajud }) {
  return `${PROMPT_SISTEMA_PETICAO}

REGRA PRINCIPAL — SIGA O MODELO À RISCA: sua tarefa é PREENCHER o MODELO DE REFERÊNCIA abaixo, NÃO reescrevê-lo. Mantenha EXATAMENTE os mesmos tópicos, na mesma ORDEM, com os MESMOS textos-padrão e a MESMA fundamentação jurídica (súmulas e artigos), reproduzindo o texto fixo do modelo praticamente palavra por palavra. Altere SOMENTE os dados do caso atual (partes, datas, função, salário, valores, fatos concretos) e inclua ou exclua apenas os TÓPICOS CONEXOS conforme o caso exigir. NÃO parafraseie, NÃO resuma e NÃO crie uma redação nova para as partes padrão. Onde o modelo tiver marcadores como [RECLAMANTE], [CPF], [CNPJ], [DATA DE ADMISSÃO], substitua pelos dados do caso; se um dado faltar, mantenha um marcador claro entre colchetes. Os dados pessoais são SEMPRE os do caso atual — nunca reaproveite partes/valores de outro processo do modelo.

=== MODELO DE REFERÊNCIA: ${modelo.titulo} ===
Rito: ${modelo.rito || '-'} | Modalidade: ${TIPO_DISPENSA_LABELS[modelo.tipo_dispensa] || modelo.tipo_dispensa || '-'} | Comarca: ${modelo.comarca_uf || '-'} (${modelo.regiao_trt || '-'})
Esqueleto de tópicos (base — ajuste os tópicos conexos ao caso):
${(modelo.secoes || []).map((s) => `- ${s}`).join('\n')}

TEXTO DO MODELO (anonimizado — reproduza FIELMENTE, preenchendo os marcadores [ ] com os dados do caso atual):
${textoModelo || modelo.conteudo || modelo.resumo || ''}
=== FIM DO MODELO ===

=== ENTREVISTA / CASO ATUAL ===
${texto || '(ver documentos anexados)'}

Atributos detectados: função=${attrs?.funcao || '-'}, modalidade=${attrs?.tipo_dispensa || '-'}, rito=${attrs?.rito || '-'}, tomadora=${attrs?.tem_tomadora ? 'sim' : 'não'}.
=== FIM DA ENTREVISTA ===${blocoReceita(dadosReceita)}${blocoCeps(dadosCep)}${blocoDatajud(dadosDatajud)}

FORMATO DE SAÍDA: retorne APENAS o HTML do corpo da petição (sem <html>, <head> ou <body>), pronto para formatação. Use <h2> para o título de cada tópico (ex.: <h2>DAS HORAS EXTRAS</h2>) e <p style="text-align: justify"> para os parágrafos. Comece direto pelo endereçamento ao Juízo (sem nome/letreiro do escritório antes). Inclua a qualificação das partes, os fatos, o direito (um tópico por tese cabível, seguindo a ordem e reproduzindo o texto-padrão do modelo), os cálculos/valor da causa e o fecho com a assinatura do Dr. Fernando Andrade Vieira — OAB/SP nº 320.825. Ao final, acrescente exatamente:
<p><em>⚠️ Minuta gerada por IA a partir de modelo de referência — revisão obrigatória pelo advogado responsável.</em></p>`;
}

export async function gerarPeca({ texto, fileUrls, attrs, modelo }) {
  const config = await carregarConfigIntegracoes();

  // Consultas externas, cada uma condicionada ao seu toggle na configuração.
  const cnpjs = config.cnpj_ativo ? [...extrairCnpjs(texto), ...((attrs && attrs.cnpjs) || [])] : [];
  const ceps = config.cep_ativo ? [...extrairCeps(texto), ...((attrs && attrs.ceps) || [])] : [];
  const [dadosReceita, dadosCep, dadosDatajud] = await Promise.all([
    enriquecerCnpjs(cnpjs),
    enriquecerCeps(ceps),
    enriquecerDatajud(attrs, config),
  ]);

  const textoModelo = await carregarTextoModelo(modelo);

  const req = {
    prompt: buildGeracaoPrompt({ texto, attrs, modelo, textoModelo, dadosReceita, dadosCep, dadosDatajud }),
    model: 'claude_sonnet_4_6',
  };
  // Anexa apenas os documentos da ENTREVISTA. O DOCX original do modelo NÃO é
  // enviado à IA (contém dados pessoais reais de outro processo); usamos o
  // texto anonimizado (textoModelo) como base.
  const urls = [...(fileUrls || [])];
  if (urls.length) req.file_urls = urls;
  const resultado = await base44.integrations.Core.InvokeLLM(req);
  return {
    html: typeof resultado === 'string' ? resultado : String(resultado || ''),
    dadosReceita,
    dadosCep,
    dadosDatajud,
  };
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
