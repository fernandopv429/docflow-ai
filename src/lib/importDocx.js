import { base44 } from '@/api/base44Client';

const REGRAS = `REGRAS CRITICAS:
1. NAO remova, altere, resuma ou substitua NADA do conteudo original - mantenha TODO o texto exatamente como esta, palavra por palavra
2. NAO crie variaveis nem substitua dados por placeholders
3. NAO pule paragrafos, itens numerados, tabelas ou secoes - o conteudo completo deve estar presente
4. Preserve cabecalhos, tabelas, negritos, sublinhados, italicos, listas numeradas, espacamentos, alinhamentos e toda a estrutura
5. Use HTML: <h1>, <h2>, <p>, <strong>, <u>, <em>, <ol>/<ul>/<li>, <table>, mantendo alinhamentos com style="text-align: center/right/justify"
6. Para quebras de pagina do original, insira <div style="page-break-after: always"></div>`;

export async function importDocxAsTemplate(file, { onProgress } = {}) {
  const { file_url } = await base44.integrations.Core.UploadFile({ file });

  // Step 1: Extract raw text content, segmented by pages
  if (onProgress) onProgress('Extraindo conteudo do documento...');
  const extractResult = await base44.integrations.Core.InvokeLLM({
    prompt: `Extraia TODO o texto do documento anexo, segmentado por paginas.

Para cada pagina do documento, retorne o texto completo exatamente como aparece, incluindo:
- Texto de paragrafos (inteiros, sem resumir)
- Texto de tabelas (use | para separar colunas, uma linha por linha da tabela)
- Titulos e cabecalhos
- Marque alinhamento quando relevante: [CENTRO], [DIREITA], [JUSTIFICADO]
- Inclua assinaturas, rodapes e tudo que estiver no documento

NAO omita NADA. Se o documento for longo, divida em quantas paginas forem necessarias — cada pagina como um item separado do array. E preferivel ter muitas paginas pequenas do que poucas paginas que truncam.

Retorne:
- title: primeiro titulo ou cabecalho do documento (ou "Documento Importado")
- pages: array de strings, cada string contendo o texto completo de uma pagina`,
    file_urls: [file_url],
    response_json_schema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        pages: {
          type: 'array',
          items: { type: 'string' },
        },
      },
    },
    model: 'claude_sonnet_4_6',
  });

  const extractData = extractResult.response || extractResult;
  const title = extractData.title || 'Documento Importado';
  const pages = extractData.pages || [];

  if (pages.length === 0) {
    return { title, content: '', variables: [] };
  }

  // Step 2: Convert each page to HTML individually (prevents truncation on long docs)
  const htmlParts = [];
  for (let i = 0; i < pages.length; i++) {
    if (onProgress) onProgress(`Convertendo pagina ${i + 1} de ${pages.length}...`);
    const convertResult = await base44.integrations.Core.InvokeLLM({
      prompt: `Converta o texto abaixo para HTML, preservando a formatacao e estrutura original.

TEXTO DA PAGINA ${i + 1}:
${pages[i]}

${REGRAS}

Retorne:
- html: o HTML COMPLETO desta pagina, fiel ao texto acima, sem omissoes`,
      response_json_schema: {
        type: 'object',
        properties: {
          html: { type: 'string' },
        },
      },
      model: 'claude_sonnet_4_6',
    });

    const convertData = convertResult.response || convertResult;
    htmlParts.push(convertData.html || '');
  }

  return {
    title,
    content: htmlParts.join('\n'),
    variables: [],
  };
}