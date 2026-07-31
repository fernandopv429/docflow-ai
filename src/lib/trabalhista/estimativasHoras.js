import { base44 } from '@/api/base44Client';
import { traceAiCall } from '@/lib/sessionTrace';
import { mesesContrato } from './mathUtils';

// ============================================================
// Passo DEDICADO de estimativa das verbas "por hora" (horas extras,
// intervalo, adicional noturno, 10 minutos, periculosidade nas HE, minutos
// residuais, domingos/feriados 100%, multas convencionais).
//
// Por que um passo separado (e não dentro do "plano" geral)? Essas verbas
// dependem de CONTAGEM DE HORAS que nenhuma fórmula fixa reproduz com
// segurança (nem o próprio escritório usa fórmula rígida — a advogada
// estima por julgamento, a partir do relato). Pedir isso como só mais um
// item dentro do prompt grande do "plano" fazia a IA esquecer/omitir. Um
// passo focado, com schema estreito e SÓ os campos aplicáveis ao caso
// (marcados como obrigatórios), é mais confiável.
// ============================================================

// Monta o schema só com os campos que fazem sentido para ESTE caso (evita
// pedir "adicional noturno" quando não há trabalho noturno, por exemplo).
function construirSchema(flags) {
  const properties = {};
  // Sem "required" no schema (mesmo padrão do CASO_SCHEMA do parser, já
  // validado em produção com muitos campos): a obrigatoriedade é reforçada
  // no TEXTO do prompt, não no JSON Schema — evita risco de o wrapper de
  // structured output rejeitar/travar com muitos campos number obrigatórios.
  const add = (campo, descricao) => {
    properties[campo] = { type: 'number', description: descricao };
  };

  add('horas_extras', 'Valor PRINCIPAL das horas extras habituais excedentes da 8ª diária/44ª semanal (ou da descaracterização da escala), já com o adicional convencional. R$.');
  add('intervalo_art71', 'Valor PRINCIPAL das horas do intervalo intrajornada suprimido (art. 71 CLT), com o adicional. R$.');
  add('minutos_residuais', 'Valor PRINCIPAL dos minutos que antecedem/sucedem a jornada (troca de uniforme, preleção etc.), com o adicional. R$.');
  add('dez_minutos', 'Valor PRINCIPAL da não concessão dos 10 minutos de descanso a cada hora trabalhada (cláusula ~33ª da CCT de vigilância), a título de hora extra. R$.');
  add('multas_convencionais', 'Valor das multas convencionais por descumprimento de cláusulas da CCT (ex.: 3% do salário normativo, por mês ou conforme as infrações apuradas). R$.');

  if (flags.tem_adic_noturno) {
    add('adicional_noturno', 'Valor PRINCIPAL das diferenças do adicional noturno (20%) e da hora noturna reduzida (art. 73 CLT), de todo o período. R$.');
  }
  if (flags.tem_periculosidade) {
    add('periculosidade_he', 'Valor PRINCIPAL da diferença do adicional de periculosidade que deveria incidir sobre as horas extras/noturnas. R$.');
  }
  if (flags.tem_ft) {
    add('domingos_feriados_100', 'Valor PRINCIPAL do adicional de 100% pelos domingos/folgas/feriados trabalhados sem compensação (Súm. 146 TST). R$.');
  }
  return { type: 'object', properties };
}

export async function estimarVerbasPorHora({ caso = {}, attrs = {}, flags = {}, dadosCct } = {}) {
  const schema = construirSchema(flags);
  if (!Object.keys(schema.properties).length) return {};

  const salario = Number(caso.salario) || null;
  const meses = mesesContrato(caso.data_admissao, caso.data_rescisao);
  if (!salario || !meses) return {}; // sem base numérica mínima, não arrisca estimar

  const clausulasCct = (dadosCct?.clausulas || [])
    .slice(0, 6)
    .map((c) => `- ${c.clausula_ref || ''} ${c.clausula_titulo || ''}: ${(c.conteudo || c.texto || '').toString().slice(0, 300)}`)
    .join('\n');

  const prompt = `Você é um advogado trabalhista calculando, POR ESTIMATIVA (como se faz na petição inicial, antes da liquidação), os valores de verbas que dependem de contagem de horas. NÃO é possível medir com exatidão sem os cartões de ponto — a estimativa deve ser RAZOÁVEL e PROPORCIONAL aos dados do caso, nunca zero, nunca "a apurar".

DADOS DO CASO:
- Salário: R$ ${salario}
- Duração do contrato: ${meses} mês(es)
- Escala/jornada: ${caso.escala || '-'} — horário: ${caso.jornada_horario || '-'}
- Extensão habitual da jornada (horas extras): ${caso.prorrogacao_jornada || 'não informado — estime de forma conservadora (ex.: 30 min/dia)'}
- Intervalo efetivamente usufruído: ${caso.intervalo_usufruido || 'não informado — considere o intervalo legal de 1h suprimido, salvo indicação em contrário'}
- Folgas/feriados trabalhados por mês (FT): ${caso.ft_qtd_media || '-'}
${clausulasCct ? `\nCLÁUSULAS DA CCT APLICÁVEL (use os percentuais reais daqui quando existirem):\n${clausulasCct}\n` : ''}

MÉTODO SUGERIDO (adapte aos dados acima; o valor final deve refletir ESTES números, não um exemplo genérico):
- valor_hora ≈ salário ÷ 220.
- dias trabalhados no período ≈ ${meses} × (15, se escala 12x36; ou 22, se 5x2/6x1/4x2).
- horas_extras = valor_hora × (1 + adicional HE, ex.: 60% na CCT de vigilância) × horas extras diárias habituais × dias trabalhados.
- intervalo_art71 = valor_hora × (1 + adicional, 50% legal ou o da CCT) × horas de intervalo suprimido/dia × dias trabalhados.
- minutos_residuais = valor_hora × (1 + adicional HE) × 1h/dia (30min antes + 30min depois) × dias trabalhados.
- dez_minutos = valor_hora × (1 + adicional HE) × (10/60)h × horas trabalhadas no período (≈ dias × horas do turno).
- adicional_noturno (se aplicável) = valor_hora × 20% × horas noturnas do turno (considerando a hora noturna reduzida de 52min30s) × dias trabalhados.
- periculosidade_he (se aplicável) = adicional de periculosidade (ex.: 30%) incidindo sobre o valor das horas extras acima.
- domingos_feriados_100 (se aplicável) = valor_hora × horas do turno × 100% (dobro) × FT/mês × meses.
- multas_convencionais = percentual da cláusula de multa da CCT (ex.: 3%) × salário × meses (ou conforme as infrações apuradas nas cláusulas acima).

Retorne APENAS o objeto JSON com os campos pedidos, todos preenchidos com um número positivo em reais.`;

  const request = { prompt, model: 'claude_sonnet_4_6', response_json_schema: schema };
  try {
    const r = await traceAiCall('Estimativa das verbas por hora', request, () =>
      base44.integrations.Core.InvokeLLM(request)
    );
    const limpo = {};
    for (const [k, v] of Object.entries(r || {})) {
      const n = Number(v);
      if (Number.isFinite(n) && n > 0) limpo[k] = n;
    }
    if (!Object.keys(limpo).length) {
      console.warn('[estimarVerbasPorHora] resposta vazia/inválida da IA:', r);
    }
    return limpo;
  } catch (e) {
    console.error('[estimarVerbasPorHora] falhou:', e?.message || e);
    return {};
  }
}
