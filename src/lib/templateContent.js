// Retorna o HTML completo de um Template (busca o arquivo hospedado se houver).
export async function loadTemplateContent(template) {
  if (template?.content_url) {
    const res = await fetch(template.content_url);
    return await res.text();
  }
  return template?.content || '';
}
