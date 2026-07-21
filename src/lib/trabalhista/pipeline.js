import { base44 } from '@/api/base44Client';
import { buildLaudoPrompt, buildAuditorPrompt, AUDITORIA_SCHEMA } from './prompts';

// Passo 2 do fluxo: análise documental (issue-spotting) → laudo técnico
export async function analisarDocumentos(caso) {
  await base44.entities.CasoTrabalhista.update(caso.id, { analise_status: 'em_andamento' });
  const laudo = await base44.integrations.Core.InvokeLLM({
    prompt: buildLaudoPrompt(caso),
    model: 'claude_sonnet_4_6',
    file_urls: caso.document_urls?.length ? caso.document_urls : undefined,
  });
  await base44.entities.CasoTrabalhista.update(caso.id, {
    analise_laudo: laudo,
    analise_status: 'concluida',
    status: 'em_analise',
  });
  return laudo;
}

// Passo 3 do fluxo: auditoria estruturada com Especialista #58
export async function auditarCaso(caso) {
  const [especialistas, templates] = await Promise.all([
    base44.entities.EspecialistaConfig.filter({ numero: '58', ativo: true }),
    base44.entities.Template.list('-updated_date', 100),
  ]);
  const esp = especialistas[0];
  const resultado = await base44.integrations.Core.InvokeLLM({
    prompt: buildAuditorPrompt({ caso, promptSistema: esp?.prompt_sistema, templates }),
    model: esp?.modelo_ia || 'claude_sonnet_4_6',
    file_urls: caso.document_urls?.length ? caso.document_urls : undefined,
    response_json_schema: AUDITORIA_SCHEMA,
  });
  await base44.entities.CasoTrabalhista.update(caso.id, {
    analise_json: resultado,
    status_final_auditoria: resultado.status_final,
    auditado_em: new Date().toISOString(),
    status: 'auditado',
  });
  return resultado;
}