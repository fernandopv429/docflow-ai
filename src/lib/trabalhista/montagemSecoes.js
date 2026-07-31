// Montagem da minuta por SEÇÕES, mantendo o texto-padrão fixo.
// A IA não reescreve a peça inteira: ela devolve apenas um PLANO
// (quais seções remover, quais textos substituir e quais capítulos
// acrescentar). O código aplica o plano no HTML do modelo padrão,
// preservando 100% da formatação e do boilerplate.

const BLOCK_SEL = 'p, h1, h2, h3, h4, h5, h6, table, ul, ol';

function ehTitulo(el) {
  const txt = (el.textContent || '').trim();
  if (!txt || txt.length > 120) return false;
  if (/^H[1-6]$/.test(el.tagName)) return true;
  const letras = txt.replace(/[^A-Za-zÀ-ÿ]/g, '');
  if (!letras) return false;
  const maiusculas = letras === letras.toUpperCase();
  const negrito =
    !!el.querySelector('b, strong') ||
    /font-weight:\s*(bold|[6-9]00)/i.test(el.getAttribute('style') || '');
  return maiusculas && (negrito || txt.length < 90);
}

export function dividirSecoes(html) {
  const doc = new DOMParser().parseFromString(html || '', 'text/html');
  const blocos = [...doc.body.querySelectorAll(BLOCK_SEL)].filter(
    (el) => el.tagName === 'TABLE' || !el.closest('table')
  );
  const secoes = [];
  let atual = null;
  for (const el of blocos) {
    if (!atual || ehTitulo(el)) {
      atual = { indice: secoes.length, titulo: (el.textContent || '').trim().slice(0, 120), nodes: [el] };
      secoes.push(atual);
    } else {
      atual.nodes.push(el);
    }
  }
  return { doc, secoes };
}

export function resumoSecoes(secoes, limite = 900) {
  return secoes
    .map((s) => {
      const texto = s.nodes.map((n) => n.textContent || '').join(' ').replace(/\s+/g, ' ').trim();
      return `[${s.indice}] ${s.titulo || '(sem título)'}\n${texto.slice(0, limite)}`;
    })
    .join('\n\n');
}

// A IA nunca deve substituir um {{TOKEN}} diretamente: quem preenche/estima
// esses valores é o código (montarPeca, a partir de mathUtils/valoresIA).
// Isso evita números divergentes/hallucinados quando o mesmo token aparece
// em mais de um lugar da peça (ex.: valor da causa no rol de pedidos x no
// fecho) — sem esse filtro, a IA pode substituir só uma ocorrência com um
// valor inventado, deixando a peça inconsistente entre si.
const TOKEN_RE = /\{\{\s*[A-Z0-9_]+\s*\}\}/;

function substituirTextos(doc, subs) {
  const aplicadas = [];
  const faltaram = [];
  for (const s of subs || []) {
    if (!s?.de || s.para == null || s.de === s.para) continue;
    if (TOKEN_RE.test(s.de)) continue; // reservado ao montador determinístico
    const alvos = [];
    const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      if (walker.currentNode.nodeValue.includes(s.de)) alvos.push(walker.currentNode);
    }
    for (const node of alvos) {
      const partes = node.nodeValue.split(s.de);
      const frag = doc.createDocumentFragment();
      partes.forEach((parte, i) => {
        if (i) {
          const mark = doc.createElement('mark');
          mark.className = 'ai-filled-field';
          if (s.campo) mark.setAttribute('data-ai-field', s.campo);
          mark.textContent = s.para;
          frag.appendChild(mark);
        }
        if (parte) frag.appendChild(doc.createTextNode(parte));
      });
      node.parentNode.replaceChild(frag, node);
    }
    (alvos.length ? aplicadas : faltaram).push(s.de);
  }
  return { aplicadas, faltaram };
}

export function aplicarPlano(html, plano) {
  const { doc, secoes } = dividirSecoes(html);
  const remover = new Set((plano?.remover_secoes || []).map(Number));
  for (const secao of secoes) {
    if (remover.has(secao.indice)) secao.nodes.forEach((n) => n.remove());
  }
  const relatorio = substituirTextos(doc, plano?.substituicoes);
  for (const nova of plano?.secoes_novas || []) {
    const ref = secoes[Number(nova.depois_da_secao)];
    const ancora = ref?.nodes?.filter((n) => n.isConnected).at(-1);
    const bloco = doc.createElement('div');
    bloco.className = 'ai-filled-field';
    bloco.innerHTML = nova.html || '';
    if (ancora) ancora.after(bloco);
    else doc.body.appendChild(bloco);
  }
  const estilos = [...doc.head.querySelectorAll('style')].map((s) => s.outerHTML).join('');
  return { html: estilos + doc.body.innerHTML, relatorio };
}

// Seções OPCIONAIS do modelo e a flag do caso que as sustenta. A poda é
// DETERMINÍSTICA (não depende do "achismo" do LLM): se a flag for falsa, a
// seção é removida; caso contrário permanece. Súmula 331 permanece SEMPRE que
// houver tomadora. Seções não listadas aqui são sempre mantidas.
const SECOES_OPCIONAIS = [
  { re: /S[ÚU]MULA\s*331|RESPONSABILIDADE\s+SUBSIDI/i, flag: 'tem_tomadora' },
  { re: /GRATIFICA[ÇC][ÃA]O\s+DE\s+FUN[ÇC][ÃA]O/i, flag: 'tem_gratificacao' },
  { re: /AC[ÚU]MULO\s+DE\s+FUN[ÇC][ÃA]O/i, flag: 'tem_acumulo' },
  { re: /DESVIO\s+DE\s+FUN[ÇC][ÃA]O/i, flag: 'tem_desvio' },
  { re: /ASSIDUIDADE/i, flag: 'tem_assiduidade' },
  { re: /ADICIONAL\s+NOTURNO/i, flag: 'tem_adic_noturno' },
  { re: /DESCARACTERIZA[ÇC][ÃA]O.*12\s*X?\s*36/i, flag: 'escala_12x36' },
  { re: /PERICULOSIDADE/i, flag: 'tem_periculosidade' },
  { re: /INTEGRA[ÇC][ÃA]O\s+DOS\s+VALORES\s+REMUNERADOS\s+FORA/i, flag: 'tem_integracao_por_fora' },
  { re: /HORAS\s+EXTRAS\s+DE\s+100%|FOLGAS\s+TRABALHADAS\s+E\s+FERIADOS/i, flag: 'tem_ft' },
  { re: /VALE\s+TRANSPORTE\s+NAS\s+FOLGAS/i, flag: 'tem_ft' },
  { re: /AUX[ÍI]LIO\s+ALIMENTA[ÇC][ÃA]O\s+NAS\s+FOLGAS/i, flag: 'tem_ft' },
];

// Remove as seções opcionais cuja flag de suporte é falsa. Determinístico.
export function podarPorFlags(html, flags = {}) {
  const { doc, secoes } = dividirSecoes(html);
  for (const secao of secoes) {
    const tit = (secao.titulo || '').toUpperCase();
    for (const { re, flag } of SECOES_OPCIONAIS) {
      if (re.test(tit) && !flags[flag]) {
        secao.nodes.forEach((n) => n.remove());
        break;
      }
    }
  }
  const estilos = [...doc.head.querySelectorAll('style')].map((s) => s.outerHTML).join('');
  return estilos + doc.body.innerHTML;
}

// Dentro de "DAS HORAS EXTRAS", o modelo traz quadros sinóticos e
// jurisprudência sobre a INVALIDADE da escala 4x2/6x2 — conteúdo que só faz
// sentido quando a escala relatada NÃO é 12x36 (nas 6 peças de referência do
// escritório, todas 12x36, esse bloco nunca aparece; a tese de 12x36 tem sua
// PRÓPRIA seção "DA DESCARACTERIZAÇÃO..."). Diferente do applyConditionals
// (que faz recorte de TEXTO e quebraria a paginação do docx aqui, pois o
// bloco cruza fronteiras de <section> de página), esta remoção é feita por
// DOM (node.remove()), o que é seguro independente de página: só os elementos
// de conteúdo (<p>/<table>) são removidos, nunca os wrappers de <section>.
export function podarEscala4x2SeNaoAplicavel(html, escala12x36) {
  if (!escala12x36) return html; // só remove quando a escala do caso é 12x36
  const doc = new DOMParser().parseFromString(html || '', 'text/html');
  const blocos = [...doc.body.querySelectorAll(BLOCK_SEL)].filter(
    (el) => el.tagName === 'TABLE' || !el.closest('table')
  );
  const startIdx = blocos.findIndex((el) => (el.textContent || '').includes('Na escala 4x2 temos'));
  const endIdx = blocos.findIndex((el) => (el.textContent || '').includes('Para comprovação das alegações'));
  if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) return html; // marcadores não achados: não mexe (seguro)
  for (let i = startIdx; i < endIdx; i++) blocos[i].remove();
  const estilos = [...doc.head.querySelectorAll('style')].map((s) => s.outerHTML).join('');
  return estilos + doc.body.innerHTML;
}

export const PLANO_SCHEMA = {
  type: 'object',
  required: ['substituicoes'],
  properties: {
    remover_secoes: {
      type: 'array',
      items: { type: 'number' },
      description: 'Índices das seções do modelo que NÃO se aplicam a este caso',
    },
    substituicoes: {
      type: 'array',
      description: 'Trechos do modelo a substituir pelos dados reais do caso',
      items: {
        type: 'object',
        required: ['de', 'para'],
        properties: {
          de: { type: 'string', description: 'Trecho EXATO como aparece no modelo (copiado literalmente)' },
          para: { type: 'string', description: 'Texto correto para o caso atual' },
          campo: { type: 'string', description: 'Nome do dado (ex.: nome_reclamante, salario)' },
        },
      },
    },
    secoes_novas: {
      type: 'array',
      description: 'Capítulos que faltam no modelo e são necessários neste caso',
      items: {
        type: 'object',
        required: ['depois_da_secao', 'html'],
        properties: {
          depois_da_secao: { type: 'number' },
          html: { type: 'string', description: 'HTML simples (<p><b>TÍTULO</b></p><p>texto...</p>)' },
        },
      },
    },
  },
};