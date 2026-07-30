import { base44 } from '@/api/base44Client';
import { traceAiCall } from '@/lib/sessionTrace';

// ============================================================
// EXPERTISE DA CCT: extrai VALORES NORMATIVOS estruturados das cláusulas
// de CCT já consultadas (node HTTP), para preencher lacunas da entrevista —
// como a especialista faz manualmente (ex.: o salário não vem no formulário
// cru → usa o PISO da categoria/região; benefícios "SIM" sem valor → usa o
// valor da CCT; adicionais/multas convencionais em % da norma coletiva).
// A IA aqui só LÊ as cláusulas e extrai números; não inventa.
// ============================================================
const VALORES_SCHEMA = {
  type: 'object',
  properties: {
    piso_salarial: { type: 'number', description: 'Piso/salário normativo MENSAL da função (R$). Ex.: 2148.22' },
    auxilio_alimentacao_dia: { type: 'number', description: 'Valor DIÁRIO do auxílio/vale-alimentação (R$)' },
    vale_refeicao_dia: { type: 'number', description: 'Valor DIÁRIO do vale-refeição (R$), se distinto' },
    vale_transporte_dia: { type: 'number', description: 'Valor de UMA condução/vale-transporte (R$), se previsto' },
    adicional_periculosidade_pct: { type: 'number', description: 'Pontos percentuais. Ex.: 30' },
    adicional_noturno_pct: { type: 'number', description: 'Pontos percentuais. Ex.: 20' },
    adicional_he_pct: { type: 'number', description: 'Adicional de horas extras. Ex.: 60' },
    multa_convencional_pct: { type: 'number', description: 'Multa por descumprimento (% sobre salário normativo). Ex.: 3' },
    gratificacao_funcao_pct: { type: 'number', description: 'Gratificação de função (ex.: 10 p/ condutor)' },
    clausula_multa_ref: { type: 'string', description: 'Nº/título da cláusula da multa convencional' },
    observacoes: { type: 'string', description: 'Ressalvas de leitura (ex.: "piso por hora", "valor por acordo")' },
  },
};

export async function derivarValoresCct({ caso = {}, attrs = {}, dadosCct } = {}) {
  const clausulas = (dadosCct && dadosCct.clausulas) || [];
  if (!clausulas.length) return {};
  const funcao = caso.funcao || attrs.funcao || '';
  const metaTitulo = dadosCct?.meta?.titulo || '';
  const trechos = clausulas
    .slice(0, 12)
    .map((c, i) => {
      const ref = c.clausula_ref || '';
      const tit = c.clausula_titulo || '';
      const txt = (c.conteudo || c.texto || c.trecho || '').toString().replace(/\s+/g, ' ').slice(0, 700);
      return `[${i + 1}] ${ref} ${tit}: ${txt}`;
    })
    .join('\n');

  const prompt = `Você é um analista de Convenções Coletivas de Trabalho (CCT). A partir SOMENTE das cláusulas abaixo (CCT já filtrada por categoria e vigência${metaTitulo ? ` — ${metaTitulo}` : ''}), extraia os VALORES NORMATIVOS aplicáveis à função "${funcao || 'informada'}".

CLÁUSULAS:
${trechos}

Regras:
- NÃO invente. Se um valor não constar EXPLICITAMENTE nas cláusulas, OMITA o campo.
- piso_salarial: o menor salário/piso MENSAL previsto para a função (somente número, ex.: 2148.22). Se houver mais de um piso, use o da função "${funcao || ''}"; na dúvida, o menor da categoria.
- Adicionais em PONTOS PERCENTUAIS (periculosidade ex.: 30; adicional noturno ex.: 20; horas extras ex.: 60; multa convencional ex.: 3).
- Valores de auxílio/vale por DIA quando a cláusula especificar valor diário.
- Responda APENAS o objeto JSON.`;

  const request = { prompt, model: 'gemini_3_flash', response_json_schema: VALORES_SCHEMA };
  const r = await traceAiCall('Derivação de valores normativos da CCT', request, () =>
    base44.integrations.Core.InvokeLLM(request)
  );
  const out = {};
  for (const [k, v] of Object.entries(r || {})) {
    if (v === null || v === undefined || v === '') continue;
    out[k] = v;
  }
  return out;
}
