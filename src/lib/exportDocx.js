import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  ImageRun,
  Header,
  Footer,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  HeadingLevel,
  AlignmentType,
  UnderlineType,
  PageBreak,
} from 'docx';

async function fetchLogo() {
  try {
    const res = await fetch('/timbrado-logo.png');
    if (!res.ok) return null;
    return await res.arrayBuffer();
  } catch {
    return null;
  }
}

function buildHeader(logoData) {
  const children = [];
  if (logoData) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new ImageRun({
            data: logoData,
            type: 'png',
            transformation: { width: 187, height: 37 },
          }),
        ],
      })
    );
  } else {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({ text: 'FERNANDO VIEIRA ADVOGADOS', bold: true, size: 22 }),
        ],
      })
    );
  }
  children.push(new Paragraph({ children: [] }));
  return new Header({ children });
}

function buildFooter() {
  return new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        border: {
          top: { style: BorderStyle.SINGLE, size: 4, color: '999999', space: 4 },
        },
        children: [
          new TextRun({
            text: 'Fernando Vieira Advogados  |  OAB/SP 320.825  |  trabalhista@favadvogados.com.br',
            size: 16,
            color: '555555',
          }),
        ],
      }),
    ],
  });
}

export async function exportToDocx(html, variables, title) {
  let processed = html || '';

  if (variables) {
    Object.entries(variables).forEach(([key, value]) => {
      processed = processed.split(`{{${key}}}`).join(value || '');
    });
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(processed, 'text/html');
  const paragraphs = [];

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
        const inlineCss = child.getAttribute && (child.getAttribute('style') || '');
        if (inlineCss.includes('underline')) newStyle.underline = true;
        if (inlineCss.includes('font-weight: bold') || inlineCss.includes('font-weight:bold')) newStyle.bold = true;
        runs.push(...processInlineNodes(child, newStyle));
      }
    }
    return runs;
  }

  function getAlignment(el) {
    const style = el.getAttribute('style') || '';
    if (style.includes('text-align: center') || style.includes('text-align:center')) return AlignmentType.CENTER;
    if (style.includes('text-align: right') || style.includes('text-align:right')) return AlignmentType.RIGHT;
    if (style.includes('text-align: justify') || style.includes('text-align:justify')) return AlignmentType.JUSTIFIED;
    return AlignmentType.LEFT;
  }

  function isPageBreak(el) {
    const style = el.getAttribute('style') || '';
    return style.includes('page-break-after') || style.includes('page-break-before') || el.classList.contains('page-break');
  }

  function buildTable(tableEl) {
    const rows = [];
    for (const tr of tableEl.querySelectorAll('tr')) {
      const cells = [];
      for (const td of tr.querySelectorAll('td, th')) {
        const isHeader = td.tagName.toLowerCase() === 'th';
        const cellRuns = processInlineNodes(td, isHeader ? { bold: true } : {});
        cells.push(
          new TableCell({
            width: { size: 0, type: WidthType.AUTO },
            children: [
              new Paragraph({
                alignment: getAlignment(td),
                children: cellRuns.length ? cellRuns : [new TextRun({ text: '' })],
              }),
            ],
          })
        );
      }
      if (cells.length) rows.push(new TableRow({ children: cells }));
    }
    if (!rows.length) return null;
    return new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows,
    });
  }

  function processBlock(block) {
    const tag = block.tagName.toLowerCase();

    if (tag === 'div' && isPageBreak(block)) {
      paragraphs.push(new Paragraph({ children: [new PageBreak()] }));
      for (const inner of block.children) processBlock(inner);
      return;
    }

    if (tag === 'table') {
      const table = buildTable(block);
      if (table) {
        paragraphs.push(table);
        paragraphs.push(new Paragraph({ children: [] }));
      }
      return;
    }

    if (tag === 'div' || tag === 'section' || tag === 'article') {
      if (block.children.length) {
        for (const inner of block.children) processBlock(inner);
      } else {
        const runs = processInlineNodes(block);
        if (runs.length) paragraphs.push(new Paragraph({ children: runs, alignment: getAlignment(block) }));
      }
      return;
    }

    const runs = processInlineNodes(block);
    const alignment = getAlignment(block);

    if (tag === 'h1') {
      paragraphs.push(new Paragraph({ heading: HeadingLevel.HEADING_1, children: runs, alignment }));
    } else if (tag === 'h2') {
      paragraphs.push(new Paragraph({ heading: HeadingLevel.HEADING_2, children: runs, alignment }));
    } else if (tag === 'h3') {
      paragraphs.push(new Paragraph({ heading: HeadingLevel.HEADING_3, children: runs, alignment }));
    } else if (tag === 'ul') {
      for (const li of block.children) {
        const liRuns = processInlineNodes(li);
        paragraphs.push(new Paragraph({ children: liRuns, bullet: { level: 0 } }));
      }
    } else if (tag === 'ol') {
      for (const li of block.children) {
        const liRuns = processInlineNodes(li);
        paragraphs.push(new Paragraph({ children: liRuns, numbering: { reference: 'doc-numbering', level: 0 } }));
      }
    } else {
      paragraphs.push(new Paragraph({ children: runs, alignment }));
    }
  }

  for (const block of doc.body.children) {
    processBlock(block);
  }

  const logoData = await fetchLogo();

  const docx = new Document({
    numbering: {
      config: [{
        reference: 'doc-numbering',
        levels: [{ level: 0, format: 'decimal', text: '%1.', alignment: AlignmentType.START }],
      }],
    },
    sections: [{
      properties: {
        page: {
          margin: { top: 1700, bottom: 1200, left: 1440, right: 1440 },
        },
      },
      headers: { default: buildHeader(logoData) },
      footers: { default: buildFooter() },
      children: paragraphs,
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
