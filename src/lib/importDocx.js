let mammothPromise = null;

function loadMammoth() {
  if (window.mammoth) return Promise.resolve(window.mammoth);
  if (!mammothPromise) {
    mammothPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.8.0/mammoth.browser.min.js';
      script.onload = () => resolve(window.mammoth);
      script.onerror = () => {
        mammothPromise = null;
        reject(new Error('Falha ao carregar o conversor de DOCX'));
      };
      document.head.appendChild(script);
    });
  }
  return mammothPromise;
}

export async function importDocxAsTemplate(file) {
  const mammoth = await loadMammoth();

  const arrayBuffer = await file.arrayBuffer();

  const result = await mammoth.convertToHtml(
    { arrayBuffer },
    {
      styleMap: [
        "p[style-name='Title'] => h1:fresh",
        "p[style-name='Heading 1'] => h1:fresh",
        "p[style-name='Heading 2'] => h2:fresh",
        "p[style-name='Heading 3'] => h3:fresh",
      ],
    }
  );

  const html = result.value || '';

  // Extract title from first heading or use filename
  let title = file.name.replace(/\.docx$/i, '');
  const titleMatch = html.match(/<h[1-3][^>]*>(.*?)<\/h[1-3]>/i);
  if (titleMatch) {
    const headingText = titleMatch[1].replace(/<[^>]*>/g, '').trim();
    if (headingText) title = headingText;
  }

  return {
    title,
    content: html,
    variables: [],
  };
}