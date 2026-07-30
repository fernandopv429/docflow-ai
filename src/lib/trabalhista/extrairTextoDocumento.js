import { base44 } from '@/api/base44Client';
import mammoth from 'mammoth';

// Extrai o texto integral de um documento anexado no chat (PDF, imagem,
// DOCX ou TXT) para que a entrevista em arquivo seja tratada como texto.
export async function extrairTextoDocumento(file, fileUrl) {
  const nome = (file?.name || '').toLowerCase();
  if (nome.endsWith('.txt')) {
    return (await file.text()) || '';
  }
  if (nome.endsWith('.docx')) {
    const arrayBuffer = await file.arrayBuffer();
    const { value } = await mammoth.extractRawText({ arrayBuffer });
    return value || '';
  }
  // PDF e imagens: extração pela integração (OCR/parse no servidor)
  const r = await base44.integrations.Core.ExtractDataFromUploadedFile({
    file_url: fileUrl,
    json_schema: {
      type: 'object',
      properties: {
        texto_completo: {
          type: 'string',
          description: 'Transcrição integral e fiel de todo o texto do documento, sem resumir nem omitir dados',
        },
      },
    },
  });
  if (r?.status === 'success') {
    const out = r.output;
    return (Array.isArray(out) ? out.map((o) => o?.texto_completo).join('\n\n') : out?.texto_completo) || '';
  }
  return '';
}