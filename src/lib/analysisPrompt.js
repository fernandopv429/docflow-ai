// Builds the InvokeLLM request for document analysis, shared by the
// editor panel and the generation screen.
export function buildAnalysisRequest({ variables, skill, webSearch, searchSites, fileUrls }) {
  const schema = {
    type: 'object',
    properties: Object.fromEntries(variables.map((v) => [v.name, { type: 'string' }])),
  };

  const varList = variables
    .map((v) => {
      let line = `- ${v.name}: ${v.description || 'sem descrição'}`;
      if (v.example) line += ` (exemplo de formato esperado: "${v.example}")`;
      return line;
    })
    .join('\n');

  const skillBlock = skill?.trim()
    ? `\n\nINSTRUÇÕES ESPECÍFICAS DESTE TEMPLATE (siga rigorosamente):\n${skill.trim()}`
    : '';

  const webBlock = webSearch
    ? `\n\nBUSCA NA INTERNET: você pode buscar na internet informações complementares que não estejam nos documentos (ex: dados públicos, endereços, razão social por CNPJ).${
        searchSites?.trim() ? ` Priorize as informações destes sites: ${searchSites.trim()}` : ''
      }`
    : '';

  const prompt = `Você é um assistente especializado em análise de documentos. Analise os documentos enviados (PDFs ou imagens de documentos como CNH, RG, contratos, etc.) e extraia os valores para as seguintes variáveis:\n\n${varList}${skillBlock}${webBlock}\n\nPara cada variável, encontre o valor correspondente no documento. Quando houver um exemplo de formato esperado, retorne o valor no mesmo formato do exemplo. Se um valor não for encontrado, retorne uma string vazia. Responda apenas com o objeto JSON.`;

  const request = {
    prompt,
    file_urls: fileUrls,
    response_json_schema: schema,
  };

  if (webSearch) {
    request.add_context_from_internet = true;
    request.model = 'gemini_3_flash';
  }

  return request;
}