import { base44 } from '@/api/base44Client';
import { traceAiCall } from '@/lib/sessionTrace';

// Redação INTEGRAL da peça pela IA (Claude Sonnet), com validador pós-geração:
// se sobrar qualquer placeholder ([preencher: ...], {{TOKEN}} ou [COLCHETE]),
// dispara UMA rodada de correção automática antes de devolver o documento.

const PLACEHOLDER_RES = [
  /\[preencher:[^\]]*\]/gi,
  /\{\{[^}]*\}\}/g,
  /\[[A-ZÀ-Ý0-9][^\]]{2,60}\]/g,
];

export function assertNoPlaceholders(html) {
  const encontrados = new Set();
  const texto = String(html || '');
  for (const re of PLACEHOLDER_RES) {
    for (const m of texto.matchAll(re)) encontrados.add(m[0].trim());
  }
  return [...encontrados].slice(0, 30);
}

async function chamar(prompt, fileUrls, label) {
  const request = { prompt, model: 'claude_sonnet_4_6' };
  if (fileUrls?.length) request.file_urls = fileUrls;
  const r = await traceAiCall(label, request, () => base44.integrations.Core.InvokeLLM(request));
  return typeof r === 'string' ? r : String(r?.response || r || '');
}

export async function redigirPecaIntegral({ prompt, fileUrls, onTool }) {
  const notify = (msg) => { try { onTool?.(msg); } catch (e) { /* ignora */ } };
  notify('Redigindo a petição inicial completa (texto corrido, sem placeholders)...');
  let html = await chamar(prompt, fileUrls, 'Redação integral da petição');

  let pendentes = assertNoPlaceholders(html);
  if (pendentes.length) {
    notify(`Placeholders detectados (${pendentes.slice(0, 6).join(', ')}) — acionando correção automática...`);
    const correcao = `${prompt}

ATENÇÃO — CORREÇÃO OBRIGATÓRIA. A versão anterior da peça continha os seguintes trechos PROIBIDOS: ${pendentes.join(' | ')}.
Reescreva a petição INTEIRA eliminando TODOS eles: substitua cada um pelo dado real da entrevista/documentos ou, quando o dado não existir, REDIJA a frase sem o elemento faltante (reformule o período) e, para valores, use a estimativa calculada conforme a CCT e o salário. É PROIBIDO qualquer colchete, chave, "preencher", "a apurar" ou espaço em branco.

Responda APENAS com o HTML final da petição.`;
    html = await chamar(correcao, fileUrls, 'Correção automática de placeholders');
    pendentes = assertNoPlaceholders(html);
    if (pendentes.length) notify(`Ainda restaram trechos a revisar manualmente: ${pendentes.slice(0, 6).join(', ')}`);
  }
  return { html, pendentes };
}