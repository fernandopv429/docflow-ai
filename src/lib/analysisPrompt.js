// Builds the InvokeLLM request for document analysis, shared by the
// editor panel and the generation screen.
export function buildAnalysisRequest({ variables, skill, webSearch, searchSites, fileUrls, pastedText }) {
  const schema = {
    type: 'object',
    properties: {
      ...Object.fromEntries(variables.map((v) => [v.name, { type: 'string' }])),
      _fontes: {
        type: 'string',
        description:
          'Relatório das fontes usadas: documentos enviados, texto colado e cada site/URL consultado na internet, indicando o que foi extraído de cada fonte.',
      },
    },
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
    ? `\n\nBUSCA NA INTERNET: você DEVE buscar na internet informações complementares e atualizadas que não estejam nos documentos (ex: dados públicos, endereços, razão social por CNPJ, valores e índices vigentes).${
        searchSites?.trim()
          ? `\nCONSULTE OBRIGATORIAMENTE estas URLs/sites definidos pelo usuário e extraia deles as informações mais recentes disponíveis:\n${searchSites.trim()}\nAo preencher variáveis que dependam de dados atualizados, use os valores encontrados nesses sites em vez de valores desatualizados dos documentos.`
          : ''
      }`
    : '';

  const textBlock = pastedText?.trim()
    ? `\n\nTEXTO FORNECIDO PELO USUÁRIO PARA ANÁLISE:\n"""\n${pastedText.trim()}\n"""`
    : '';

  const prompt = `Você é um assistente especializado em análise de documentos. Analise os documentos enviados (PDFs ou imagens de documentos como CNH, RG, contratos, etc.) e/ou o texto fornecido, e extraia os valores para as seguintes variáveis:\n\n${varList}${skillBlock}${webBlock}${textBlock}\n\nPara cada variável, encontre o valor correspondente nos documentos ou no texto fornecido. Quando houver um exemplo de formato esperado, retorne o valor no mesmo formato do exemplo. Se um valor não for encontrado, retorne uma string vazia.

No campo "_fontes", escreva um relatório curto (em português) listando cada fonte que você usou: documentos enviados, texto colado e, se buscou na internet, cada site/URL consultado com o que foi extraído dele. Se não buscou na internet, diga isso explicitamente. Responda apenas com o objeto JSON.`;

  const request = {
    prompt,
    response_json_schema: schema,
  };

  if (fileUrls?.length) request.file_urls = fileUrls;

  if (webSearch) {
    request.add_context_from_internet = true;
    request.model = 'gemini_3_flash';
  }

  return request;
}