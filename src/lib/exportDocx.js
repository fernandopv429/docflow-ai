import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  UnderlineType
} from 'docx';

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
        if (tag === 'span' && (child.className === 'var-filled' || child.className === 'var-pending')) {
          // It's a variable span — just get its text content
          runs.push(...processInlineNodes(child, newStyle));
        } else {
          runs.push(...processInlineNodes(child, newStyle));
        }
      }
    }
    return runs;
  }

  function getAlignment(el) {
    const style = el.getAttribute('style') || '';
    if (style.includes('text-align: center')) return AlignmentType.CENTER;
    if (style.includes('text-align: right')) return AlignmentType.RIGHT;
    if (style.includes('text-align: justify')) return AlignmentType.JUSTIFIED;
    return AlignmentType.LEFT;
  }

  for (const block of doc.body.children) {
    const tag = block.tagName.toLowerCase();
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

  const docx = new Document({
    numbering: {
      config: [{
        reference: 'doc-numbering',
        levels: [{ level: 0, format: 'decimal', text: '%1.', alignment: AlignmentType.START }],
      }],
    },
    sections: [{ properties: {}, children: paragraphs }],
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