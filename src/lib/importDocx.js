import { base44 } from '@/api/base44Client';

let docxPreviewPromise = null;

// Replaces heavy base64 inline images in an HTML string with uploaded file URLs
export async function sanitizeContentImages(html) {
  if (!html || !html.includes('data:')) return html;
  const div = document.createElement('div');
  div.innerHTML = html;
  await uploadInlineImages(div);
  return div.innerHTML;
}

// Replaces heavy base64 inline images with uploaded file URLs so the content can be saved
async function uploadInlineImages(rootElement) {
  const imgs = Array.from(rootElement.querySelectorAll('img[src^="data:"]'));
  for (const img of imgs) {
    const res = await fetch(img.src);
    const blob = await res.blob();
    const ext = (blob.type.split('/')[1] || 'png').split('+')[0];
    const file = new File([blob], `imagem.${ext}`, { type: blob.type });
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    img.src = file_url;
  }
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.onload = resolve;
    script.onerror = () => reject(new Error('Falha ao carregar o conversor de DOCX'));
    document.head.appendChild(script);
  });
}

function loadDocxPreview() {
  if (window.docx) return Promise.resolve(window.docx);
  if (!docxPreviewPromise) {
    docxPreviewPromise = (async () => {
      if (!window.JSZip) {
        await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js');
      }
      await loadScript('https://cdn.jsdelivr.net/npm/docx-preview@0.3.2/dist/docx-preview.min.js');
      return window.docx;
    })().catch((err) => {
      docxPreviewPromise = null;
      throw err;
    });
  }
  return docxPreviewPromise;
}

export async function importDocxAsTemplate(file) {
  const docx = await loadDocxPreview();

  const arrayBuffer = await file.arrayBuffer();

  // Render into a hidden container to capture the full HTML (headers, footers, images)
  const container = document.createElement('div');
  const styleContainer = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '-99999px';
  container.style.top = '0';
  document.body.appendChild(container);

  try {
    await docx.renderAsync(arrayBuffer, container, styleContainer, {
      inWrapper: true,
      renderHeaders: true,
      renderFooters: true,
      renderFootnotes: true,
      experimental: true,
      ignoreLastRenderedPageBreak: false,
    });

    // Upload embedded images (base64) and replace with lightweight URLs
    await uploadInlineImages(container);

    // Combine the generated styles with the rendered document HTML
    const html = styleContainer.innerHTML + container.innerHTML;

    return {
      title: file.name.replace(/\.docx$/i, ''),
      content: html,
      variables: [],
    };
  } finally {
    document.body.removeChild(container);
  }
}