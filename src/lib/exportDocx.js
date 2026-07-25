import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  AlignmentType,
  UnderlineType,
  Header,
  Footer,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  PageNumber,
  ImageRun,
} from 'docx';
import { applyConditionals } from './variables';
import { removeTextLetterhead } from './removeTextLetterhead';
import { TIMBRADO } from './timbrado';
import { sessionTrace } from './sessionTrace';

// ---------- Utilitarios de parsing HTML -> docx ----------

function getAlignment(el) {
  const style = (el.getAttribute && el.getAttribute('style')) || '';
  if (style.includes('text-align: center')) return AlignmentType.CENTER;
  if (style.includes('text-align: right')) return AlignmentType.RIGHT;
  if (style.includes('text-align: justify')) return AlignmentType.JUSTIFIED;
  return AlignmentType.LEFT;
}

function cssValues(el) {
  const values = {};
  const raw = (el?.getAttribute && el.getAttribute('style')) || '';
  raw.split(';').forEach((part) => {
    const index = part.indexOf(':');
    if (index > -1) values[part.slice(0, index).trim().toLowerCase()] = part.slice(index + 1).trim();
  });
  return values;
}

function pt(value) {
  const match = String(value || '').match(/-?[\d.]+/);
  return match ? Number(match[0]) : undefined;
}

function inlineStyle(el, inherited = {}) {
  const css = cssValues(el);
  const size = pt(css['font-size']);
  return {
    ...inherited,
    font: css['font-family']?.replace(/["']/g, '').split(',')[0] || inherited.font || 'Arial',
    size: size ? Math.round(size * 2) : inherited.size || 24,
    bold: /bold|[6-9]00/.test(css['font-weight'] || '') || inherited.bold || false,
    italics: css['font-style'] === 'italic' || inherited.italics || false,
    underline: (css['text-decoration'] || '').includes('underline') || inherited.underline || false,
    color: css.color?.replace('#', '') || inherited.color,
  };
}

function processInlineNodes(node, style = {}) {
  const runs = [];
  for (const child of node.childNodes) {
    if (child.nodeType === Node.TEXT_NODE) {
      if (child.textContent) runs.push(new TextRun({
        text: child.textContent,
        font: style.font || 'Arial',
        size: style.size || 24,
        bold: style.bold || false,
        italics: style.italics || false,
        color: style.color,
        underline: style.underline ? { type: UnderlineType.SINGLE } : undefined,
      }));
    } else if (child.nodeType === Node.ELEMENT_NODE) {
      const tag = child.tagName.toLowerCase();
      const next = inlineStyle(child, style);
      if (tag === 'strong' || tag === 'b') next.bold = true;
      if (tag === 'em' || tag === 'i') next.italics = true;
      if (tag === 'u') next.underline = true;
      if (tag === 'br') { runs.push(new TextRun({ break: 1 })); continue; }
      runs.push(...processInlineNodes(child, next));
    }
  }
  return runs;
}

function buildTable(tableEl) {
  const rows = [];
  const htmlRows = tableEl.querySelectorAll('tr');
  htmlRows.forEach((tr) => {
    const cells = [];
    const htmlCells = tr.querySelectorAll('th, td');
    htmlCells.forEach((cellEl) => {
      const isHeader = cellEl.tagName.toLowerCase() === 'th';
      const runs = processInlineNodes(cellEl, isHeader ? { bold: true } : {});
      cells.push(new TableCell({
        children: [new Paragraph({ children: runs, alignment: getAlignment(cellEl) })],
        margins: { top: 60, bottom: 60, left: 100, right: 100 },
      }));
    });
    if (cells.length) rows.push(new TableRow({ children: cells }));
  });
  if (!rows.length) return null;
  return new Table({
    rows,
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
      left: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
      right: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
      insideVertical: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
    },
  });
}

function isPageBreak(el) {
  const style = (el.getAttribute && el.getAttribute('style')) || '';
  return style.includes('page-break-after') || style.includes('page-break-before');
}

function processBlock(block, out, state) {
  const tag = block.tagName ? block.tagName.toLowerCase() : '';
  const css = cssValues(block);

  if (tag === 'section' && block.classList?.contains('docx')) {
    if (state.pageCount > 0) out.push(new Paragraph({ pageBreakBefore: true, children: [] }));
    state.pageCount += 1;
  } else if (isPageBreak(block)) {
    out.push(new Paragraph({ pageBreakBefore: true, children: [] }));
  }

  if (tag === 'table') {
    const table = buildTable(block);
    if (table) out.push(table);
    return;
  }
  if (tag === 'ul' || tag === 'ol') {
    for (const li of block.children) {
      out.push(new Paragraph({
        children: processInlineNodes(li, inlineStyle(li)),
        ...(tag === 'ul' ? { bullet: { level: 0 } } : { numbering: { reference: 'doc-numbering', level: 0 } }),
      }));
    }
    return;
  }
  if (['div', 'section', 'article'].includes(tag) && block.children?.length) {
    for (const child of block.children) processBlock(child, out, state);
    return;
  }

  const heading = ['h1', 'h2', 'h3'].includes(tag);
  const runs = processInlineNodes(block, inlineStyle(block, { bold: heading }));
  const firstLine = pt(css['text-indent']);
  const left = pt(css['margin-left']);
  const right = pt(css['margin-right']);
  const lineHeight = Number.parseFloat(css['line-height']);
  out.push(new Paragraph({
    children: runs,
    alignment: getAlignment(block) === AlignmentType.LEFT ? AlignmentType.JUSTIFIED : getAlignment(block),
    indent: {
      ...(firstLine ? { firstLine: Math.round(firstLine * 20) } : {}),
      ...(left ? { left: Math.round(left * 20) } : {}),
      ...(right ? { right: Math.round(right * 20) } : {}),
    },
    spacing: { after: 0, ...(lineHeight ? { line: Math.round(lineHeight * 240) } : {}) },
  }));
}

// ---------- Timbrado: cabecalho e rodape ----------

const LOGO_PRIMEIRA_PAGINA = 'https://media.base44.com/images/public/6a5a44d24aa52c9fbdd61b1a/4f1847ac3_image.png';
const LOGO_PAGINAS_INTERNAS = 'https://media.base44.com/images/public/6a5a44d24aa52c9fbdd61b1a/fec36cb66_image.png';

async function carregarImagemBytes(url) {
  const response = await fetch(url, { cache: 'force-cache' });
  if (!response.ok) throw new Error(`Falha ao carregar timbrado: HTTP ${response.status}`);
  return new Uint8Array(await response.arrayBuffer());
}

function buildHeader(logoBytes, width, height, alignment = AlignmentType.CENTER) {
  return new Header({
    children: [
      new Paragraph({
        alignment,
        children: logoBytes ? [new ImageRun({ data: logoBytes, transformation: { width, height }, type: 'png' })] : [new TextRun({ text: TIMBRADO.escritorio, bold: true, font: 'Arial', size: 20 })],
      }),
      new Paragraph({ children: [], border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '000000', space: 4 } } }),
    ],
  });
}

function buildFooter() {
  return new Footer({
    children: [
      new Paragraph({
        border: { top: { style: BorderStyle.SINGLE, size: 4, color: '888888', space: 4 } },
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: `${TIMBRADO.rodape.email}  |  ${TIMBRADO.rodape.oab}`, font: 'Arial', size: 16, color: '555555' })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({ text: 'Página ', font: 'Arial', size: 14, color: '888888' }),
          new TextRun({ children: [PageNumber.CURRENT], font: 'Arial', size: 14, color: '888888' }),
          new TextRun({ text: ' de ', font: 'Arial', size: 14, color: '888888' }),
          new TextRun({ children: [PageNumber.TOTAL_PAGES], font: 'Arial', size: 14, color: '888888' }),
        ],
      }),
    ],
  });
}

// ---------- Export principal ----------

export async function exportToDocx(html, variables, title) {
  let processed = html || '';

  // Remove cercas de código markdown e tags de envelope que a IA possa ter incluído
  processed = processed.replace(/```[a-z]*\n?/gi, '');
  processed = processed.replace(/<\/?(?:html|head|body|!doctype)[^>]*>/gi, '').trim();
  processed = removeTextLetterhead(processed);

  if (variables) {
    // 1) Resolve blocos condicionais primeiro, usando as entradas booleanas como flags
    const flags = {};
    for (const [key, value] of Object.entries(variables)) {
      if (typeof value === 'boolean') flags[key] = value;
    }
    processed = applyConditionals(processed, flags);

    // 2) Substituição simples {{TOKEN}} apenas para valores de texto
    Object.entries(variables).forEach(([key, value]) => {
      if (typeof value === 'boolean') return; // já consumido pelos condicionais acima
      processed = processed.split(`{{${key}}}`).join(value || '');
    });
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(processed, 'text/html');
  const children = [];

  const state = { pageCount: 0 };
  for (const block of doc.body.children) {
    processBlock(block, children, state);
  }

  const logos = await Promise.allSettled([
    carregarImagemBytes(LOGO_PRIMEIRA_PAGINA),
    carregarImagemBytes(LOGO_PAGINAS_INTERNAS),
  ]);
  const logoPrimeiraPagina = logos[0].status === 'fulfilled' ? logos[0].value : null;
  const logoPaginasInternas = logos[1].status === 'fulfilled' ? logos[1].value : null;
  logos.forEach((result, index) => {
    if (result.status === 'rejected') sessionTrace({
      level: 'warn', category: 'Exportação', status: 'AVISO',
      title: `Logomarca ${index + 1} indisponível — usando cabeçalho textual`,
      details: { mensagem: result.reason?.message || String(result.reason) },
    });
  });
  const firstHeader = buildHeader(logoPrimeiraPagina, 220, 44);
  const defaultHeader = buildHeader(logoPaginasInternas, 100, 86, AlignmentType.RIGHT);
  const footer = buildFooter();

  const docx = new Document({
    numbering: {
      config: [{
        reference: 'doc-numbering',
        levels: [{ level: 0, format: 'decimal', text: '%1.', alignment: AlignmentType.START }],
      }],
    },
    sections: [{
      properties: {
        titlePage: true,
        page: {
          margin: {
            top: 2438,
            right: 1701,
            bottom: 1276,
            left: 1701,
            header: 708,
            footer: 708,
          },
        },
      },
      headers: { first: firstHeader, default: defaultHeader },
      footers: { first: footer, default: footer },
      children,
    }],
  });

  const blob = await Packer.toBlob(docx);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${title || 'documento'}.docx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}