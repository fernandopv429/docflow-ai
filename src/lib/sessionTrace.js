export function sessionTrace({ level = 'info', category, title, status, durationMs, details }) {
  console[level]({
    __docflowTrace: true,
    category,
    title,
    status,
    durationMs,
    details,
  });
}

// Bug de plataforma (Base44 InvokeLLM): com response_json_schema, respostas
// via modelos Claude vêm ENVELOPADAS em {"response": {...}} (o SDK/axios NÃO
// desembrulha isso), enquanto respostas via modelos Gemini vêm PLANAS. Nenhum
// chamador deste código espera o envelope — por isso toda chamada de IA que
// usa Claude com schema estava retornando objetos "vazios" para quem lia os
// campos esperados no nível raiz (estimarVerbasPorHora, o plano de adaptação,
// e até o auditor de coerência, cujos alertas nunca chegavam ao chat).
// Desembrulha aqui, uma vez só, para todos os chamadores.
function desembrulharRespostaIA(output) {
  if (
    output &&
    typeof output === 'object' &&
    !Array.isArray(output) &&
    Object.keys(output).length === 1 &&
    output.response &&
    typeof output.response === 'object'
  ) {
    return output.response;
  }
  return output;
}

export async function traceAiCall(title, input, call) {
  const startedAt = Date.now();
  sessionTrace({ category: 'IA', title: `${title} — entrada`, status: 'INÍCIO', details: input });
  try {
    const output = desembrulharRespostaIA(await call());
    sessionTrace({
      category: 'IA',
      title: `${title} — saída`,
      status: 'SUCESSO',
      durationMs: Date.now() - startedAt,
      details: output,
    });
    return output;
  } catch (error) {
    sessionTrace({
      level: 'error',
      category: 'IA',
      title: `${title} — erro`,
      status: 'ERRO',
      durationMs: Date.now() - startedAt,
      details: { message: error.message, stack: error.stack },
    });
    throw error;
  }
}