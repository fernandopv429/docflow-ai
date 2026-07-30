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

function substituirTextos(doc, subs) {
  const aplicadas = [];
  const faltaram = [];
  for (const s of subs || []) {
    if (!s?.de || s.para == null || s.de === s.para) continue;
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