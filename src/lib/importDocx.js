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

  if (onProgress) onProgress('Analisando documento...');

  const outline = await base44.integrations.Core.InvokeLLM({
    prompt: `Analise o documento anexo e retorne:
- title: o primeiro titulo/cabecalho do documento (ou "Documento Importado")
- total_paginas: numero aproximado de paginas do documento`,
    file_urls: [file_url],
    response_json_schema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        total_paginas: { type: 'number' },
      },
    },
    model: 'claude_sonnet_4_6',
  });

  const outlineData = outline.response || outline;
  const totalPaginas = Math.max(1, Math.round(outlineData.total_paginas || 1));

  if (totalPaginas <= 4) {
    if (onProgress) onProgress('Convertendo documento...');
    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `Converta o documento anexo INTEIRO para HTML, do primeiro ao ultimo paragrafo, incluindo assinaturas e rodapes.

${REGRAS}

Retorne:
- content_html: conteudo COMPLETO em HTML, fiel ao original, sem nenhuma alteracao ou omissao de texto`,
      file_urls: [file_url],
      response_json_schema: {
        type: 'object',
        properties: { content_html: { type: 'string' } },
      },
      model: 'claude_sonnet_4_6',
    });
    const data = result.response || result;
    return {
      title: outlineData.title || 'Documento Importado',
      content: data.content_html || '',
      variables: [],
    };
  }

  const PAGINAS_POR_PARTE = 4;
  const totalPartes = Math.ceil(totalPaginas / PAGINAS_POR_PARTE);
  const partesHtml = [];

  for (let i = 0; i < totalPartes; i++) {
    const inicio = i * PAGINAS_POR_PARTE + 1;
    const fim = Math.min((i + 1) * PAGINAS_POR_PARTE, totalPaginas);
    if (onProgress) onProgress(`Convertendo paginas ${inicio}-${fim} de ${totalPaginas}...`);

    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `O documento anexo tem ${totalPaginas} paginas. Converta para HTML APENAS o conteudo das paginas ${inicio} a ${fim}.
${i === 0 ? 'Comece do inicio absoluto do documento.' : `Comece EXATAMENTE onde a pagina ${inicio} inicia, sem repetir conteudo anterior.`}
${fim === totalPaginas ? 'Va ate o final absoluto do documento, incluindo assinaturas.' : `Pare no final da pagina ${fim}.`}

${REGRAS}

Retorne:
- content_html: o HTML COMPLETO desse trecho, fiel ao original, sem omissoes`,
      file_urls: [file_url],
      response_json_schema: {
        type: 'object',
        properties: { content_html: { type: 'string' } },
      },
      model: 'claude_sonnet_4_6',
    });
    const data = result.response || result;
    partesHtml.push(data.content_html || '');
  }

  return {
    title: outlineData.title || 'Documento Importado',
    content: partesHtml.join('\n'),
    variables: [],
  };
}
