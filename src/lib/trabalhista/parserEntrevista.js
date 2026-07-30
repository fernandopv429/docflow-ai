import { base44 } from '@/api/base44Client';
import { traceAiCall } from '@/lib/sessionTrace';

// Agente extrator: converte a entrevista (texto livre E/OU o FORMULÁRIO DE
// ENTREVISTA padrão do escritório, anexado em PDF/imagem/DOCX) nos campos
// estruturados do caso, com um modelo rápido/barato. Não faz aritmética
// (isso é do mathUtils) nem inventa dados; apenas extrai o que consta.
const CASO_SCHEMA = {
  type: 'object',
  properties: {
    titulo: { type: 'string', description: 'Ex.: "Nome do reclamante × 1ª reclamada"' },

    // Reclamante
    recl_nome: { type: 'string' },
    recl_genero: { type: 'string', enum: ['M', 'F'], description: 'Gênero do reclamante (M/F) para concordância' },
    recl_nacionalidade: { type: 'string' },
    recl_estado_civil: { type: 'string' },
    recl_cpf: { type: 'string', description: 'Somente números' },
    recl_rg: { type: 'string' },
    recl_pis: { type: 'string' },
    recl_ctps: { type: 'string' },
    recl_serie: { type: 'string' },
    recl_nascimento: { type: 'string', description: 'Formato YYYY-MM-DD' },
    recl_filiacao: { type: 'string', description: 'Nome da mãe e do pai' },
    recl_endereco: { type: 'string' },

    // Reclamadas
    recl1_nome: { type: 'string', description: 'Razão social da 1ª reclamada (empregadora)' },
    recl1_cnpj: { type: 'string', description: 'Somente números' },
    recl1_logradouro: { type: 'string' },
    recl2_nome: { type: 'string', description: '2ª reclamada / tomadora de serviços, se houver' },
    recl2_cnpj: { type: 'string' },
    local_prestacao: { type: 'string', description: 'Endereço do local onde os serviços foram prestados (define a competência)' },
    comarca_uf: { type: 'string', description: 'UF com 2 letras (ex.: SP)' },

    // Contrato
    data_admissao: { type: 'string', description: 'Formato YYYY-MM-DD' },
    data_rescisao: { type: 'string', description: 'Formato YYYY-MM-DD' },
    funcao: { type: 'string' },
    salario: { type: 'number' },
    maior_remuneracao: { type: 'number', description: 'Maior remuneração na função (base do dano moral); se ausente, usa o salário' },
    tipo_dispensa: {
      type: 'string',
      enum: ['sem_justa_causa', 'rescisao_indireta', 'nulidade_pedido_demissao', 'reversao_justa_causa', 'acordo'],
    },

    // Jornada
    jornada_horario: { type: 'string', description: 'Horários. Ex.: das 19h às 7h' },
    escala: { type: 'string', description: 'Escala. Ex.: 12x36, 4x2, 5x2, 6x1' },
    intervalo_usufruido: { type: 'string', description: 'Intervalo efetivo. Ex.: 10 a 15 minutos / suprimido' },
    prorrogacao_jornada: { type: 'string', description: 'Extensão habitual (horas extras). Ex.: 30 min a 1h; antecedente/sucedente' },
    val_ft: { type: 'number', description: 'Valor pago por CADA folga trabalhada (R$)' },
    val_conducao: { type: 'number', description: 'Valor de UMA condução (R$), p/ vale-transporte nas folgas' },
    ft_qtd_media: { type: 'number', description: 'Média de folgas/feriados trabalhados por mês' },

    // Teses — dados de apoio
    acumulo_atividades: { type: 'string', description: 'Tarefas extras acumuladas (ex.: recepção, cadastro, medicação, rondas)' },
    assiduidade_prometido: { type: 'number', description: 'Bônus de assiduidade prometido (R$)' },
    assiduidade_pago: { type: 'number', description: 'Bônus de assiduidade efetivamente pago (R$)' },
    assiduidade_diferenca: { type: 'number', description: 'Diferença mensal da assiduidade (R$)' },
    doenca_descricao: { type: 'string', description: 'Doença/lesão ocupacional (ex.: hérnia de disco)' },
    valor_por_fora: { type: 'number', description: 'Valor médio pago por fora (R$)' },
    valor_aux_alimentacao: { type: 'number', description: 'Valor diário do auxílio/vale-alimentação-refeição (R$)' },
    cct_ano: { type: 'string', description: 'Ano da CCT aplicável. Ex.: 2025' },
    cct_clausulas: { type: 'string', description: 'Cláusulas específicas citadas' },
    cct_clausula_multa: { type: 'string', description: 'Cláusula da multa convencional' },
    periodo_ferias_prop: { type: 'string', description: 'Período das férias proporcionais, se citado' },
    periodo_13: { type: 'string', description: 'Período do 13º proporcional, se citado' },
    periodo_ferias_vencidas: { type: 'string', description: 'Período das férias vencidas, se houver' },

    // Flags das teses (true APENAS com suporte no relato)
    tem_acumulo: { type: 'boolean' },
    tem_adic_noturno: { type: 'boolean', description: 'Houve labor em horário noturno (jornada cruza 22h–5h)' },
    tem_integracao_por_fora: { type: 'boolean', description: 'Pagamento "por fora" (dinheiro/PIX)' },
    tem_periculosidade: { type: 'boolean' },
    tem_insalubridade: { type: 'boolean' },
    tem_assiduidade: { type: 'boolean', description: 'Bônus de assiduidade pago a menor' },
    tem_vale_transporte: { type: 'boolean', description: 'Ausência de VT nas folgas' },
    tem_auxilio_alimentacao: { type: 'boolean', description: 'Ausência de auxílio-alimentação nas folgas' },
    tem_doenca: { type: 'boolean', description: 'Doença ocupacional decorrente do trabalho' },
    tem_estabilidade: { type: 'boolean', description: 'Estabilidade provisória (acompanha doença)' },
    tem_pensao: { type: 'boolean', description: 'Perda/redução da capacidade laborativa' },
    tem_ft: { type: 'boolean', description: 'Folgas/feriados trabalhados' },
    tem_ferias_vencidas: { type: 'boolean' },
    tem_dano_moral: { type: 'boolean' },

    // Textos livres do caso concreto
    dano_fatos: { type: 'string', description: 'Fato concreto do dano moral (2-4 frases): nome do líder/supervisor, perseguição, humilhações, suspensões indevidas, mudança de posto etc.' },
  },
};

export async function extrairCasoDeTexto(texto, fileUrls) {
  const request = {
    prompt: `Você é um extrator de dados de entrevistas trabalhistas do escritório FAV Advogados. Os dados podem estar no TEXTO abaixo E/OU nos DOCUMENTOS ANEXADOS (PDF/imagem/DOCX) — em especial o FORMULÁRIO DE ENTREVISTA padrão do escritório (assinado via ZapSign). LEIA OS ANEXOS e preencha os campos do caso.

TEXTO (pode estar vazio se tudo estiver no anexo):
"""
${texto || '(sem texto — usar os documentos anexados)'}
"""

ESTRUTURA DO FORMULÁRIO DE ENTREVISTA (quando anexado):
- "IDENTIFICAÇÃO DO(A) CLIENTE": parágrafo único com nome, data de nascimento, nacionalidade, estado civil, função, RG, CPF, PIS, Série, filiação (mãe/pai), endereço, CEP, e-mail e telefone → preencha os campos recl_*.
- "IDENTIFICAÇÃO DO(S) RECLAMADO(S)": 1ª RECLAMADA = empregadora (recl1_nome/recl1_cnpj/recl1_logradouro); 2ª RECLAMADA = tomadora (recl2_nome/recl2_cnpj); "CARGO" → funcao; "TEMPO LABORADO" → data_admissao e data_rescisao (e a modalidade citada, ex.: "RESCISÃO INDIRETA"); "ESCALA/HORARIO" (ex.: "12X36 19H AS 7H") → escala ("12x36") e jornada_horario ("das 19h às 7h").
- Seções NUMERADAS com caixas no formato "(X)" (MARCADA) e "( )" (vazia). Considere apenas a opção marcada com X:
  1. Tipo de Dispensa → tipo_dispensa (Justa causa→reversao_justa_causa; Sem justa causa→sem_justa_causa; Pedido de demissão [se sob coação/perseguição no relato]→nulidade_pedido_demissao; Rescisão indireta→rescisao_indireta). "Último dia trabalhado" → data_rescisao.
  2. Benefícios → Vale-refeição/alimentação (valor)→valor_aux_alimentacao; se marcado "NÃO"→tem_auxilio_alimentacao=true; Vale-transporte.
  3. Jornada (finais de semana/feriados) e 5. Folgas Trabalhadas (FT): "Quantidade"→ft_qtd_media; "Valor recebido"→val_ft; "Forma: DINHEIRO/PIX"→tem_integracao_por_fora=true e valor_por_fora=val_ft; FT marcada "Sim"→tem_ft=true.
  6. Intervalo Intrajornada: "suprimido / quanto tempo em média"→intervalo_usufruido.
  7. Horas Extras: média + período antecedente + sucedente→prorrogacao_jornada.
  8. Acúmulo/Desvio de função: "Sim"→tem_acumulo=true; "Quais funções"→acumulo_atividades.
  10. Gratificações: se recebe algum tipo de gratificação (relevante p/ vigilante condutor).
  11. Documentos (holerites, rescisão, espelho de ponto): se NÃO fornecidos, é argumento da Súm. 338 TST — registre no dano_fatos apenas se pertinente.
  13. Saúde e Segurança: Insalubridade "Sim"→tem_insalubridade; Periculosidade "Sim"→tem_periculosidade; doença/acidente de trabalho→tem_doenca e doenca_descricao.
- "FATOS NARRADOS PELO RECLAMANTE": texto livre (líder/supervisor, perseguição, humilhações, ameaças, suspensões indevidas, mudança de posto/andar, reserva técnica) → sintetize em dano_fatos e defina tem_dano_moral=true quando houver.

Regras:
- Extraia SOMENTE o que estiver explícito ou claramente inferível no texto/anexos. NÃO invente dados. Omita campos sem informação (não retorne string vazia nem null).
- Datas em YYYY-MM-DD (interprete formatos brasileiros; "17/12/2024 – RESCISÃO INDIRETA ... 28/07/2026" → data_admissao=2024-12-17, data_rescisao=2026-07-28).
- CPF/CNPJ/PIS somente números. Valores monetários como número (ex.: 220.00); ignore "$"/"R$".
- recl_genero: 'M' ou 'F', inferido do nome/relato (para concordância de gênero na peça).
- escala noturna (jornada que cruza 22h–5h, ex.: 19h às 7h) → tem_adic_noturno=true.
- maior_remuneracao: só se citada uma remuneração maior que o salário (base do dano moral); senão omita.

Responda APENAS com o objeto JSON.`,
    model: 'gemini_3_flash',
    response_json_schema: CASO_SCHEMA,
  };
  if (fileUrls?.length) request.file_urls = fileUrls;
  const dados = await traceAiCall('Extração estruturada do caso', request, () =>
    base44.integrations.Core.InvokeLLM(request)
  );

  // Remove valores vazios para não sobrescrever campos com lixo
  const limpo = {};
  for (const [k, v] of Object.entries(dados || {})) {
    if (v === null || v === undefined || v === '') continue;
    limpo[k] = v;
  }
  return limpo;
}
