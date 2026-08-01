// ============================================================
// Formatação da peça feita POR CÓDIGO (não pela IA).
// A IA passa a devolver apenas o CONTEÚDO em HTML simples
// (<p>, <strong>, <h2>, <ul>...). Aqui aplicamos o padrão
// visual do escritório: Arial 12pt, justificado, títulos em
// negrito/caixa alta. Isso deixa o prompt muito menor (mais
// rápido) e impede que a IA bagunce a formatação.
// ============================================================

const ESTILO_PARAGRAFO = 'font-family:Arial,sans-serif;font-size:12pt;line-height:1.5;text-align:justify;margin:0 0 12pt;';
const ESTILO_TITULO = 'font-family:Arial,sans-serif;font-size:12pt;line-height:1.5;text-align:left;font-weight:bold;margin:18pt 0 10pt;';
const ESTILO_ENDERECAMENTO = 'font-family:Arial,sans-serif;font-size:12pt;line-height:1.5;text-align:left;font-weight:bold;margin:0 0 18pt;';

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