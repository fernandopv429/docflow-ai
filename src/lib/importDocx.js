import * as mammoth from 'mammoth/mammoth.browser';

export async function importDocxAsTemplate(file, { onProgress } = {}) {
  if (onProgress) onProgress('Lendo documento...');

  const arrayBuffer = await file.arrayBuffer();

  if (onProgress) onProgress('Convertendo DOCX para HTML...');

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
  let title = 'Documento Importado';
  const titleMatch = html.match(/<h[1-3][^>]*>(.*?)<\/h[1-3]>/i);
  if (titleMatch) {
    title = titleMatch[1].replace(/<[^>]*>/g, '').trim() || file.name.replace(/\.docx$/i, '');
  } else {
    title = file.name.replace(/\.docx$/i, '');
  }

  return {
    title,
    content: html,
    variables: [],
  };
}