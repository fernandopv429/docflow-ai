import { base44 } from '@/api/base44Client';

export async function importDocxAsTemplate(file) {
  const { file_url } = await base44.integrations.Core.UploadFile({ file });

  const result = await base44.integrations.Core.InvokeLLM({
    prompt: `Converta o documento anexo para HTML, preservando FIELMENTE todo o conteúdo e formatação original.

REGRAS:
1. NÃO remova, altere ou substitua NADA do conteúdo original - mantenha TODO o texto exatamente como está
2. NÃO crie variáveis nem substitua dados por placeholders
3. Preserve timbrado, cabeçalhos, tabelas, negritos, espaçamentos, alinhamentos e toda a estrutura
4. Use HTML: <h1>, <h2>, <p>, <strong>, <ul>/<li>, <table>, mantendo alinhamentos com style="text-align: center/right/justify"
5. O título deve ser o primeiro título ou cabeçalho do documento, ou "Documento Importado" se não houver

Retorne:
- title: título do documento
- content_html: conteúdo COMPLETO em HTML, fiel ao original, sem nenhuma alteração de texto`,
    file_urls: [file_url],
    response_json_schema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        content_html: { type: 'string' },
      },
    },
    model: 'claude_sonnet_4_6',
  });

  const data = result.response || result;
  return {
    title: data.title || 'Documento Importado',
    content: data.content_html || '',
    variables: [],
  };
}