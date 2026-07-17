import { base44 } from '@/api/base44Client';

export async function importDocxAsTemplate(file) {
  const { file_url } = await base44.integrations.Core.UploadFile({ file });

  const result = await base44.integrations.Core.InvokeLLM({
    prompt: `Você é um assistente especializado em criar templates de documentos. Analise o documento anexo e converta-o em um template reutilizável, PRESERVANDO FIELMENTE o design, layout, timbrado, cabeçalhos e formatação original do documento.

INSTRUÇÕES:
1. PRESERVE toda a estrutura visual e formatação original do documento - incluindo timbrado, cabeçalhos, tabelas, negritos, espaçamentos, alinhamentos
2. Substitua APENAS informações específicas (nomes, CPF, RG, CNPJ, datas, valores, endereços, e-mails, etc.) por variáveis no formato {{NOME_DA_VARIAVEL}}
3. Use nomes descritivos em PORTUGUÊS e MAIÚSCULAS com underscores (ex: {{NOME_RECLAMANTE}}, {{CPF_RECLAMANTE}})
4. Se houver timbrado/cabeçalho do escritório, PRESERVE-O (não transforme em variável)
5. Use HTML para reproduzir a formatação: <h1>, <h2>, <p>, <strong>, <ul>/<li>, <table>, mantendo alinhamentos com style="text-align: center/right/justify"

Retorne:
- title: título do template
- content_html: conteúdo COMPLETO em HTML reproduzindo fielmente o documento original, com as variáveis {{VARIÁVEL}} inseridas
- variables: lista de todas as variáveis com name e description`,
    file_urls: [file_url],
    response_json_schema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        content_html: { type: 'string' },
        variables: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              description: { type: 'string' },
            },
          },
        },
      },
    },
    model: 'claude_sonnet_4_6',
  });

  const data = result.response || result;
  return {
    title: data.title || 'Documento Importado',
    content: data.content_html || '',
    variables: data.variables || [],
  };
}