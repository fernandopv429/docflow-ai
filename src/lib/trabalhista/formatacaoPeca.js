// ============================================================
// Formatação da peça feita POR CÓDIGO (não pela IA).
// A IA passa a devolver apenas o CONTEÚDO em HTML simples
// (<p>, <strong>, <h2>, <ul>...). Aqui aplicamos o padrão
// visual do escritório: Arial 12pt, justificado, títulos em
// negrito/caixa alta. Isso deixa o prompt muito menor (mais
// rápido) e impede que a IA bagunce a formatação.
// ============================================================

import { valorPorExtenso, formatarReais } from './valorPorExtenso';

const ESTILO_PARAGRAFO = 'font-family:Arial,sans-serif;font-size:12pt;line-height:1.5;text-align:justify;margin:0 0 12pt;';
const ESTILO_TITULO = 'font-family:Arial,sans-serif;font-size:12pt;line-height:1.5;text-align:left;font-weight:bold;margin:18pt 0 10pt;';
const ESTILO_ENDERECAMENTO = 'font-family:Arial,sans-serif;font-size:12pt;line-height:1.5;text-align:left;font-weight:bold;margin:0 0 18pt;';

// Substitui, POR CÓDIGO, dois fatos que a IA repetidamente errava ao
// escrever de cabeça: (1) a data do fecho — já vimos minutas datadas ANTES
// da própria rescisão que elas narram; (2) a frase "Dá-se à causa..." — já
// vimos o valor não bater com a soma real dos pedidos, e o "por extenso"
// divergir do número. Ambos passam a ser gerados 100% deterministicamente
// (data real do sistema; valorPorExtenso.js para o extenso), eliminando a
// dependência de a IA acertar esses dois fatos por conta própria.
export function aplicarFechoDeterministico(html, { valorCausa } = {}) {
  let out = String(html || '');
  const dataHoje = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });

  // Data do fecho: substitui o parágrafo "São Paulo, ..." (a vírgula logo
  // após "Paulo" só ocorre nesse parágrafo — endereços têm "São Paulo/SP"
  // ou "São Paulo (Zona Norte)", nunca "São Paulo," direto).
  const reDataP = /<p[^>]*>\s*(?:<[^>]+>\s*)*S[ãa]o Paulo,[\s\S]*?<\/p>/i;
  const novaData = `<p>São Paulo, ${dataHoje}.</p>`;
  if (reDataP.test(out)) {
    out = out.replace(reDataP, novaData);
  } else {
    const reDataTxt = /S[ãa]o Paulo,\s*[^.<\n]*\.?/i;
    out = reDataTxt.test(out) ? out.replace(reDataTxt, `São Paulo, ${dataHoje}.`) : `${out}\n${novaData}`;
  }

  // Valor da causa: substitui o parágrafo "Dá-se..." inteiro pela soma real
  // dos itens do rol de pedidos (array `pedidos` retornado pela IA junto do
  // HTML), com o "por extenso" calculado por código — nunca pela IA.
  if (valorCausa != null && Number.isFinite(valorCausa)) {
    const frase = `Dá-se à causa o valor estimativo de R$ ${formatarReais(valorCausa)} (${valorPorExtenso(valorCausa)}), para todos os fins legais, sem prejuízo da apuração definitiva em sede de liquidação de sentença.`;
    const reValorP = /<p[^>]*>\s*(?:<[^>]+>\s*)*D[áa]-se[\s\S]*?<\/p>/i;
    if (reValorP.test(out)) {
      out = out.replace(reValorP, `<p><strong>${frase}</strong></p>`);
    } else {
      out += `\n<p><strong>${frase}</strong></p>`;
    }
  }

  return out;
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
    el.setAttribute('style', ESTILO_PARAGRAFO.replace('margin:0 0 12pt;', 'margin:0 0 6pt;'));
  });

  // Endereçamento (primeiro parágrafo, "AO MM. JUÍZO...") em destaque.
  const primeiro = raiz.querySelector('p');
  if (primeiro && /^AO\s|EXCELENT/i.test(primeiro.textContent.trim())) {
    primeiro.setAttribute('style', ESTILO_ENDERECAMENTO);
  }

  return raiz.innerHTML;
}