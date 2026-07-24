import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
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
import { TIMBRADO } from './timbrado';
import { applyConditionals } from './variables';
import { removeTextLetterhead } from './removeTextLetterhead';

// ---------- Utilitarios de parsing HTML -> docx ----------

function getAlignment(el) {
  const style = (el.getAttribute && el.getAttribute('style')) || '';
  if (style.includes('text-align: center')) return AlignmentType.CENTER;
  if (style.includes('text-align: right')) return AlignmentType.RIGHT;
  if (style.includes('text-align: justify')) return AlignmentType.JUSTIFIED;
  return AlignmentType.LEFT;
}

function processInlineNodes(node, style = {}) {
  const runs = [];
  for (const child of node.childNodes) {
    if (child.nodeType === Node.TEXT_NODE) {
      const text = child.textContent;
      if (text) {
        runs.push(new TextRun({
          text,
          bold: style.bold || false,
          italics: style.italic || false,
          underline: style.underline ? { type: UnderlineType.SINGLE } : undefined,
        }));
      }
    } else if (child.nodeType === Node.ELEMENT_NODE) {
      const tag = child.tagName.toLowerCase();
      const newStyle = { ...style };
      if (tag === 'strong' || tag === 'b') newStyle.bold = true;
      if (tag === 'em' || tag === 'i') newStyle.italic = true;
      if (tag === 'u') newStyle.underline = true;
      if (tag === 'br') { runs.push(new TextRun({ break: 1 })); continue; }
      runs.push(...processInlineNodes(child, newStyle));
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

function processBlock(block, out) {
  const tag = block.tagName ? block.tagName.toLowerCase() : '';

  if (isPageBreak(block)) {
    out.push(new Paragraph({ children: [new TextRun({ break: 0 })], pageBreakBefore: true }));
    return;
  }

  if (tag === 'table') {
    const t = buildTable(block);
    if (t) { out.push(t); out.push(new Paragraph({ children: [] })); }
    return;
  }

  if (tag === 'ul') {
    for (const li of block.children) {
      out.push(new Paragraph({ children: processInlineNodes(li), bullet: { level: 0 } }));
    }
    return;
  }

  if (tag === 'ol') {
    for (const li of block.children) {
      out.push(new Paragraph({ children: processInlineNodes(li), numbering: { reference: 'doc-numbering', level: 0 } }));
    }
    return;
  }

  if (tag === 'div' || tag === 'section' || tag === 'article') {
    // Container: processa filhos recursivamente para nao perder conteudo/paginas
    if (block.children && block.children.length) {
      for (const child of block.children) processBlock(child, out);
      return;
    }
  }

  const runs = processInlineNodes(block);
  const alignment = getAlignment(block);

  if (tag === 'h1') {
    out.push(new Paragraph({ heading: HeadingLevel.HEADING_1, children: runs, alignment }));
  } else if (tag === 'h2') {
    out.push(new Paragraph({ heading: HeadingLevel.HEADING_2, children: runs, alignment }));
  } else if (tag === 'h3') {
    out.push(new Paragraph({ heading: HeadingLevel.HEADING_3, children: runs, alignment }));
  } else {
    // Peças jurídicas: parágrafos comuns saem justificados (como no modelo do escritório)
    out.push(new Paragraph({
      children: runs,
      alignment: alignment === AlignmentType.LEFT ? AlignmentType.JUSTIFIED : alignment,
      spacing: { after: 120 },
    }));
  }
}

// ---------- Timbrado: cabecalho e rodape ----------

async function buildFirstPageHeader() {
  const logoUrl = 'https://media.base44.com/images/public/6a5a44d24aa52c9fbdd61b1a/4f1847ac3_image.png';
  const logoBytes = await fetch(logoUrl).then((response) => response.arrayBuffer());

  return new Header({
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 80 },
        children: [
          new ImageRun({
            data: logoBytes,
            transformation: { width: 312, height: 62 },
            type: 'png',
          }),
        ],
      }),
      new Paragraph({
        children: [],
        spacing: { after: 120 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '000000', space: 4 } },
      }),
    ],
  });
}

async function buildNextPagesHeader() {
  const logoUrl = 'https://media.base44.com/images/public/6a5a44d24aa52c9fbdd61b1a/442397987_image.png';
  const logoBytes = await fetch(logoUrl).then((response) => response.arrayBuffer());

  return new Header({
    children: [
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        children: [
          new ImageRun({
            data: logoBytes,
            transformation: { width: 95, height: 81 },
            type: 'png',
          }),
        ],
      }),
    ],
  });
}

async function buildFirstPageFooter() {
  const footerUrl = 'https://media.base44.com/images/public/6a5a44d24aa52c9fbdd61b1a/b8db9dec4_image.png';
  const footerBytes = await fetch(footerUrl).then((response) => response.arrayBuffer());

  return new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new ImageRun({
            data: footerBytes,
            transformation: { width: 720, height: 40 },
            type: 'png',
          }),
        ],
      }),
    ],
  });
}

function buildFooter() {
  const contato = [TIMBRADO.site, TIMBRADO.email, TIMBRADO.telefone].filter(Boolean).join('   |   ');
  return new Footer({
    children: [
      new Paragraph({
        border: { top: { style: BorderStyle.SINGLE, size: 4, color: '888888', space: 4 } },
        alignment: AlignmentType.CENTER,
        spacing: { before: 40 },
        children: [new TextRun({ text: contato, size: 16, color: '555555' })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: TIMBRADO.cidades || '', size: 13, color: '888888' })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 40 },
        children: [
          new TextRun({ text: 'Página ', size: 14, color: '999999' }),
          new TextRun({ children: [PageNumber.CURRENT], size: 14, color: '999999' }),
          new TextRun({ text: ' de ', size: 14, color: '999999' }),
          new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 14, color: '999999' }),
        ],
      }),
    ],
  });
}

// ---------- Export principal ----------

export async function exportToDocx(html, variables, title, opts = {}) {
  const { comTimbrado = true } = opts;
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

  for (const block of doc.body.children) {
    processBlock(block, children);
  }

  const firstPageHeader = await buildFirstPageHeader();
  const nextPagesHeader = await buildNextPagesHeader();
  const firstPageFooter = await buildFirstPageFooter();
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
        titlePage: comTimbrado,
        page: {
          // Margens padrão de petição (3cm sup/esq, 2cm inf/dir) + espaço p/ timbrado
          margin: {
            top: comTimbrado ? 1985 : 1701,
            bottom: comTimbrado ? 1418 : 1134,
            left: 1701,
            right: 1134,
            header: 567,
            footer: 567,
          },
        },
      },
      headers: comTimbrado ? { first: firstPageHeader, default: nextPagesHeader } : undefined,
      footers: comTimbrado ? { first: firstPageFooter, default: footer } : undefined,
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