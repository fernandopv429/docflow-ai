// ============================================================
// Formatação da peça feita POR CÓDIGO (não pela IA).
// A IA passa a devolver apenas o CONTEÚDO em HTML simples
// (<p>, <strong>, <h2>, <ul>...). Aqui aplicamos o padrão
// visual do escritório: Arial 12pt, justificado, títulos em
// negrito/caixa alta. Isso deixa o prompt muito menor (mais
// rápido) e impede que a IA bagunce a formatação.
// ============================================================

import { valorPorExtenso, formatarReais } from './valorPorExtenso';

// Espaçamento: 1 linha em branco entre parágrafos (18pt ≈ 1 linha de 12pt),
// 2 linhas em branco antes de cada título e 1 linha depois dele.
const ESTILO_PARAGRAFO = 'font-family:Arial,sans-serif;font-size:12pt;line-height:1.5;text-align:justify;margin:0 0 18pt;';
const ESTILO_TITULO = 'font-family:Arial,sans-serif;font-size:12pt;line-height:1.5;text-align:left;font-weight:bold;margin:36pt 0 18pt;';
const ESTILO_ITEM = 'font-family:Arial,sans-serif;font-size:12pt;line-height:1.5;text-align:justify;margin:0 0 12pt;';
const ESTILO_SUBITEM = 'font-family:Arial,sans-serif;font-size:12pt;line-height:1.5;text-align:left;margin:0 0 6pt;padding-left:18pt;';
const ESTILO_CITACAO = 'font-family:Arial,sans-serif;font-size:12pt;font-style:italic;line-height:1.5;text-align:justify;margin:18pt 0 18pt;padding-left:36pt;';
const ESTILO_ENDERECAMENTO = 'font-family:Arial,sans-serif;font-size:12pt;line-height:1.5;text-align:left;font-weight:bold;margin:0 0 18pt;';

// Substitui, POR CÓDIGO, TODO o bloco de fecho da petição — a IA não escreve
// mais nenhuma parte dele (ver CONTRATO DE SAÍDA no prompt principal). Isso
// elimina de vez os erros que já vimos ao deixar a IA escrever isso de
// cabeça: data do fecho anterior à própria rescisão, valor da causa que não
// batia com a soma dos pedidos, e "por extenso" divergente do número.
// Estratégia: remove qualquer resquício dessas linhas que a IA tenha escrito
// por engano (defesa extra, caso ela não obedeça a instrução) e reconstrói o
// bloco inteiro do zero, no formato e ordem do modelo padrão do escritório:
// "Dá-se à causa..." → "Pede deferimento." → "São Paulo, [data]." → assinatura.
const ESTILO_FECHO = 'font-family:Arial,sans-serif;font-size:12pt;line-height:1.5;text-align:center;margin:0 0 12pt;';

export function aplicarFechoDeterministico(html, { valorCausa } = {}) {
  let out = String(html || '');
  const dataHoje = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });

  // Remove qualquer parágrafo de fecho que a IA tenha escrito por engano,
  // apesar da instrução (defesa extra — evita duplicar linhas).
  out = out.replace(/<p[^>]*>\s*(?:<[^>]+>\s*)*S[ãa]o Paulo,[\s\S]*?<\/p>/gi, '');
  out = out.replace(/<p[^>]*>\s*(?:<[^>]+>\s*)*D[áa]-se[\s\S]*?<\/p>/gi, '');
  out = out.replace(/<p[^>]*>\s*(?:<[^>]+>\s*)*Pede\s+deferimento[\s\S]*?<\/p>/gi, '');
  out = out.replace(/<p[^>]*>\s*(?:<[^>]+>\s*)*FERNANDO\s+ANDRADE\s+VIEIRA[\s\S]*?<\/p>\s*(?:<p[^>]*>\s*(?:<[^>]+>\s*)*OAB\/SP[\s\S]*?<\/p>)?/gi, '');

  const linhas = [];
  if (valorCausa != null && Number.isFinite(valorCausa)) {
    const frase = `Dá-se à causa o valor estimativo de R$ ${formatarReais(valorCausa)} (${valorPorExtenso(valorCausa)}), para todos os fins legais, sem prejuízo da apuração definitiva em sede de liquidação de sentença.`;
    linhas.push(`<p style="${ESTILO_FECHO}"><strong>${frase}</strong></p>`);
  }
  linhas.push(`<p style="${ESTILO_FECHO}">Pede deferimento.</p>`);
  linhas.push(`<p style="${ESTILO_FECHO}">São Paulo, ${dataHoje}.</p>`);
  linhas.push(`<p style="${ESTILO_FECHO}"><strong>FERNANDO ANDRADE VIEIRA</strong></p>`);
  linhas.push(`<p style="${ESTILO_FECHO}">OAB/SP 320.825</p>`);

  return `${out.trim()}\n${linhas.join('\n')}`;
}

// Remove qualquer item do rol de pedidos que tenha ficado com valor R$ 0,00
// — já vimos a IA tentar "mesclar sem duplicar" dois itens (seguindo a regra
// de bis in idem) mas deixar uma linha zerada em vez de omitir a linha por
// completo. Uma petição não deve "pedir" uma verba de valor zero — a linha
// inteira é removida por código, sem depender da IA acertar isso sozinha.
export function removerPedidosZerados(html) {
  return String(html || '').replace(/<li[^>]*>(?:(?!<\/li>)[\s\S])*?R\$\s?0[,.]00(?:(?!<\/li>)[\s\S])*?<\/li>\s*/gi, '');
}

// Extrai um ESQUELETO em texto do modelo padrão (títulos e início dos
// parágrafos), usado como referência de estrutura no prompt — em vez de
// mandar todo o HTML pesado para a IA.
export function esqueletoDoModelo(html, limite = 18000) {
  const texto = String(html || '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(style|script)[\s\S]*?<\/\1>/gi, '')
    .replace(/<\/(p|div|h[1-6]|li|tr)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/[ \t]{2,}/g, ' ');
  const linhas = texto
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => (l.length > 300 ? `${l.slice(0, 300)}…` : l));
  return linhas.join('\n').slice(0, limite);
}

// Aplica o padrão visual ao HTML de conteúdo devolvido pela IA.
export function aplicarFormatacaoPadrao(htmlConteudo) {
  const doc = new DOMParser().parseFromString(`<div id="raiz">${htmlConteudo || ''}</div>`, 'text/html');
  const raiz = doc.getElementById('raiz');

  // O modelo do escritório não usa linhas divisórias entre seções.
  raiz.querySelectorAll('hr').forEach((el) => el.remove());

  raiz.querySelectorAll('h1,h2,h3,h4,h5,h6').forEach((el) => {
    const p = doc.createElement('p');
    p.setAttribute('style', ESTILO_TITULO);
    p.innerHTML = `<strong>${el.innerHTML}</strong>`;
    el.replaceWith(p);
  });

  raiz.querySelectorAll('p').forEach((el) => {
    if (!el.getAttribute('style')) el.setAttribute('style', ESTILO_PARAGRAFO);
  });

  raiz.querySelectorAll('li').forEach((el) => {
    // Sub-itens (reflexos de um pedido) ficam recuados e mais próximos entre si.
    const aninhado = Boolean(el.parentElement?.closest('li'));
    el.setAttribute('style', aninhado ? ESTILO_SUBITEM : ESTILO_ITEM);
  });

  // Quadros/tabelas isolados do texto (1 linha em branco acima e abaixo).
  raiz.querySelectorAll('table').forEach((el) => {
    el.setAttribute('style', `${el.getAttribute('style') || ''}margin:18pt 0 18pt;`);
  });

  // Citações (doutrina, lei, ementas) isoladas do texto principal, recuadas
  // e com 1 linha em branco antes e depois.
  raiz.querySelectorAll('blockquote').forEach((el) => {
    const p = doc.createElement('p');
    p.setAttribute('style', ESTILO_CITACAO);
    p.innerHTML = el.innerHTML.replace(/<\/?(p|div)[^>]*>/gi, ' ').trim();
    el.replaceWith(p);
  });

  // Endereçamento (primeiro parágrafo, "AO MM. JUÍZO...") em destaque.
  const primeiro = raiz.querySelector('p');
  if (primeiro && /^AO\s|EXCELENT/i.test(primeiro.textContent.trim())) {
    primeiro.setAttribute('style', ESTILO_ENDERECAMENTO);
  }

  return raiz.innerHTML;
}