import { base44 } from '@/api/base44Client';

// Uma minuta formatada (aplicarFormatacaoPadrao adiciona style inline em cada
// <p>) costuma passar de 50KB de HTML — grande demais para salvar com
// segurança embutido no documento da Conversa junto com o array de mensagens
// (que já cresce a cada geração/auditoria). Isso fazia o campo `doc_html`
// falhar ao salvar silenciosamente após algumas interações — a minuta
// "sumia da lateral" enquanto as mensagens (pequenas) continuavam salvando
// normalmente. Mesma solução já usada para o Template do escritório
// (templateContent.js): acima do limite, hospeda como arquivo e guarda só a URL.
const MAX_INLINE_SIZE = 50000;

async function packDocHtml(doc_html) {
  if (!doc_html || doc_html.length <= MAX_INLINE_SIZE) {
    return { doc_html: doc_html || '', doc_html_url: '' };
  }
  const file = new File([doc_html], 'minuta.html', { type: 'text/html' });
  const { file_url } = await base44.integrations.Core.UploadFile({ file });
  return { doc_html: '', doc_html_url: file_url };
}

async function loadDocHtml(conversa) {
  if (conversa?.doc_html_url) {
    try {
      const res = await fetch(conversa.doc_html_url);
      return await res.text();
    } catch (e) {
      return conversa?.doc_html || '';
    }
  }
  return conversa?.doc_html || '';
}

export function listarConversas() {
  return base44.entities.Conversa.list('-updated_date', 100);
}

export async function carregarConversa(id) {
  const conversa = await base44.entities.Conversa.get(id);
  const doc_html = await loadDocHtml(conversa);
  return { ...conversa, doc_html };
}

export function tituloDaConversa(messages) {
  const primeira = (messages || []).find((m) => m.role === 'user' && m.text?.trim());
  return (primeira?.text || 'Nova entrevista').trim().slice(0, 70);
}

export async function salvarConversa(id, dados) {
  const { doc_html, doc_html_url } = await packDocHtml(dados.doc_html);
  const payload = { ...dados, doc_html, doc_html_url };
  if (id) return base44.entities.Conversa.update(id, payload);
  return base44.entities.Conversa.create(payload);
}

export function excluirConversa(id) {
  return base44.entities.Conversa.delete(id);
}