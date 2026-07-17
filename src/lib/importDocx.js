let docxPreviewPromise = null;

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