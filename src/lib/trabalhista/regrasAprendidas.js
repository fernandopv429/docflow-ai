import { base44 } from '@/api/base44Client';
import { traceAiCall } from '@/lib/sessionTrace';

// ============================================================
// Aprendizado por correção: identifica quando o advogado dá uma
// instrução de correção/regra no chat, salva na base e injeta
// nas gerações futuras.
// ============================================================

const CLASSIFICACAO_SCHEMA = {
  type: 'object',
  required: ['eh_correcao'],
  properties: {
    eh_correcao: { type: 'boolean' },
    categoria: {
      type: 'string',
      enum: ['COMPETENCIA', 'ENQUADRAMENTO', 'TESE_JURIDICA', 'REDACAO', 'CALCULO', 'GERAL'],
    },
    regra_extraida: { type: 'string' },
    escopo: { type: 'string', enum: ['GERAL', 'FUNCAO_ESPECIFICA', 'MUNICIPIO_ESPECIFICO'] },
    filtro_aplicavel: { type: 'string' },
    resposta_chat: { type: 'string' },
  },
};

export async function classificarCorrecao(mensagem) {
  if (!mensagem?.trim()) return { eh_correcao: false };
  const request = {
    prompt: `Você é um assistente especialista do sistema DocFlow AI responsável por identificar e extrair feedbacks e correções do advogado sobre as minutas geradas.

SUA TAREFA:
Analise a mensagem enviada pelo usuário no chat e verifique se ele está solicitando uma correção de dados, alteração de tese jurídica, preferência de redação ou regra de enquadramento funcional para o escritório.

REGRAS DE CLASSIFICAÇÃO:
1. Se a mensagem for uma dúvida ou envio de dados do caso (ex.: "O salário é 2500", CPF, CNPJ, datas, endereço), trate como informação normal de entrevista → "eh_correcao": false.
2. Se a mensagem for uma instrução de correção/ajuste válida para CASOS FUTUROS (ex.: "Para Itapecerica da Serra use sempre TRT-2", "Não inclua a tese X para vigilante condutor", "Altere a porcentagem de honorários para 15%"), EXTRAIA A REGRA → "eh_correcao": true.

Quando "eh_correcao" for true, preencha:
- "categoria": COMPETENCIA | ENQUADRAMENTO | TESE_JURIDICA | REDACAO | CALCULO | GERAL
- "regra_extraida": descrição clara e objetiva da regra a ser aprendida para casos futuros
- "escopo": GERAL | FUNCAO_ESPECIFICA | MUNICIPIO_ESPECIFICO
- "filtro_aplicavel": ex.: vigilante / Itapecerica da Serra / 12x36 (se houver)
- "resposta_chat": mensagem de confirmação para o advogado (ex.: "Entendido! Registrei esta preferência/correção no sistema e ela será aplicada nas próximas gerações.")

MENSAGEM DO USUÁRIO:
"""${mensagem}"""

Responda APENAS com o objeto JSON.`,
    model: 'gemini_3_flash',
    response_json_schema: CLASSIFICACAO_SCHEMA,
  };
  try {
    const r = await traceAiCall('Classificação de correção do advogado', request, () =>
      base44.integrations.Core.InvokeLLM(request)
    );
    return r && typeof r === 'object' ? r : { eh_correcao: false };
  } catch (e) {
    console.warn('Classificação de correção indisponível.', e);
    return { eh_correcao: false };
  }
}

export async function salvarRegraAprendida(classificacao, mensagemOriginal) {
  return base44.entities.FeedbackCorrecao.create({
    categoria: classificacao.categoria || 'GERAL',
    regra_extraida: classificacao.regra_extraida,
    escopo: classificacao.escopo || 'GERAL',
    filtro_aplicavel: classificacao.filtro_aplicavel || '',
    mensagem_original: mensagemOriginal || '',
    ativo: true,
  });
}

// Carrega as regras salvas e formata o bloco para o prompt de geração.
export async function obterBlocoRegrasAprendidas() {
  try {
    const feedbacks = await base44.entities.FeedbackCorrecao.list('-created_date', 20);
    const ativas = feedbacks.filter((f) => f.ativo !== false && f.regra_extraida);
    if (!ativas.length) return '';
    const linhas = ativas.map(
      (f) => `- [${f.categoria}]${f.filtro_aplicavel ? ` (aplicável a: ${f.filtro_aplicavel})` : ''} ${f.regra_extraida}`
    );
    return `\n\n=== PREFERÊNCIAS E CORREÇÕES REGISTRADAS PELO ADVOGADO (REGRAS APRENDIDAS) ===\nAs instruções abaixo foram registradas previamente pelo advogado em correções anteriores no chat. Siga-as rigorosamente, preferindo-as a qualquer padrão genérico:\n${linhas.join('\n')}\n=== FIM DAS REGRAS APRENDIDAS ===\n`;
  } catch (e) {
    return '';
  }
}