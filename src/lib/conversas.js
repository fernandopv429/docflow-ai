import { base44 } from '@/api/base44Client';

export function listarConversas() {
  return base44.entities.Conversa.list('-updated_date', 100);
}

export function carregarConversa(id) {
  return base44.entities.Conversa.get(id);
}

export function tituloDaConversa(messages) {
  const primeira = (messages || []).find((m) => m.role === 'user' && m.text?.trim());
  return (primeira?.text || 'Nova entrevista').trim().slice(0, 70);
}

export async function salvarConversa(id, dados) {
  if (id) return base44.entities.Conversa.update(id, dados);
  return base44.entities.Conversa.create(dados);
}

export function excluirConversa(id) {
  return base44.entities.Conversa.delete(id);
}