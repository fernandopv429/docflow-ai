import { deriveTokens, TIPO_DISPENSA_LABELS } from './tokens';

export const AUDITORIA_SCHEMA = {
  type: 'object',
  required: ['classificacao', 'inconsistencias', 'pendencias', 'status_final', 'resumo_para_advogado'],
  properties: {
    classificacao: {
      type: 'object',
      properties: {
        template_sugerido: { type: 'string' },
        confianca: { type: 'number' },
        categoria: { type: 'string' },
        justificativa: { type: 'string' },
      },
    },
    documentos: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          tipo: { type: 'string' },
          presente: { type: 'boolean' },
          periodo: { type: 'string' },
          valores_extraidos: { type: 'string' },
          observacao: { type: 'string' },
        },
      },
    },
    tokens: { type: 'object' },
    valores_pedidos: { type: 'object' },
    teses_incluidas: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          tese: { type: 'string' },
          fundamento: { type: 'string' },
          evidencia: { type: 'string' },
        },
      },
    },
    teses_excluidas: {
      type: 'array',
      items: {
        type: 'object',
        properties: { tese: { type: 'string' }, motivo: { type: 'string' } },
      },
    },
    inconsistencias: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          severidade: { type: 'string', enum: ['BLOQUEANTE', 'ATENCAO', 'INFO'] },
          descricao: { type: 'string' },
          campo: { type: 'string' },
          sugestao: { type: 'string' },
        },
      },
    },
    pendencias: { type: 'array', items: { type: 'string' } },
    valor_causa: { type: 'string' },
    status_final: { type: 'string', enum: ['bloqueado', 'revisar', 'aprovado'] },
    resumo_para_advogado: { type: 'string' },
  },
};

export const ESP58_PROMPT_PADRAO = `Você é um auditor técnico-jurídico especialista em petições trabalhistas brasileiras.

Sua responsabilidade é:
1. CLASSIFICAÇÃO: Sugerir o template de petição mais apropriado com confiança de 0.0 a 1.0
2. VALIDAÇÃO DE DOCUMENTOS: Verificar presença e período de documentos críticos (holerites, CTPS, TRCT, ponto, FGTS)
3. EXTRAÇÃO DE TOKENS: Extrair todos os tokens {{TOKEN}} necessários para preencher o modelo
4. AUDITORIA CRUZADA: Comparar dados do caso com CCTs aplicáveis quando disponíveis
5. GESTÃO DE TESES: Incluir teses legais com evidência documental; excluir as sem suporte
6. ANÁLISE DE INCONSISTÊNCIAS: Classificar por severidade (BLOQUEANTE / ATENCAO / INFO)
7. CÁLCULO DO VALOR DA CAUSA: Validar a composição e fundamentação

REGRAS DE STATUS FINAL:
- "bloqueado" se houver qualquer inconsistência BLOQUEANTE
- "revisar" se houver inconsistência ATENCAO (sem BLOQUEANTE)
- "aprovado" se não houver inconsistências relevantes

NÃO invente dados. Responda APENAS com o JSON estruturado solicitado.`;

function contextoCaso(caso) {
  const tokens = deriveTokens(caso);
  return `DADOS DO CASO (estruturados):
${JSON.stringify(tokens, null, 2)}

MODALIDADE DE RESCISÃO: ${TIPO_DISPENSA_LABELS[caso.tipo_dispensa] || 'não informada'}
IRREGULARIDADES/FLAGS: desvio=${!!caso.tem_desvio}, acúmulo=${!!caso.tem_acumulo}, insalubridade=${!!caso.tem_insalubridade}, periculosidade=${!!caso.tem_periculosidade}, adic. noturno=${!!caso.tem_adic_noturno}
DOCUMENTOS ANEXADOS: ${(caso.document_names || []).join(', ') || 'nenhum'}`;
}

export function buildAuditorPrompt({ caso, promptSistema, templates }) {
  const listaTemplates = (templates || [])
    .map((t) => `- "${t.title}"${t.description ? `: ${t.description}` : ''}`)
    .join('\n') || '- (nenhum template cadastrado)';

  return `${promptSistema || ESP58_PROMPT_PADRAO}

---

${contextoCaso(caso)}

TEMPLATES DISPONÍVEIS (use o nome EXATO em template_sugerido):
${listaTemplates}

${caso.analise_laudo ? `LAUDO DE ANÁLISE DOCUMENTAL PRÉVIO:\n${caso.analise_laudo}\n` : ''}
Analise os documentos anexados (se houver) e os dados acima. Extraia os tokens, valide inconsistências e retorne o JSON estruturado.`;
}

export function buildLaudoPrompt(caso) {
  return `Você é um advogado trabalhista especialista em análise probatória e issue-spotting.
Seu objetivo é gerar um LAUDO TÉCNICO estruturado que subsidia a redação de uma petição inicial trabalhista.

${contextoCaso(caso)}
ALEGAÇÕES DE DANO MORAL: ${caso.dano_fatos || caso.dano_supervisor || 'nenhuma'}

INSTRUÇÃO: Analise TODOS os documentos anexados e gere um laudo com EXATAMENTE esta estrutura:

### 0. DADOS CONTRATUAIS FUNDAMENTAIS
- DATA DE ADMISSÃO (CTPS/contrato; se ausente: "não localizada nos documentos")
- MODALIDADE DE RESCISÃO (TRCT/relato; se ausente: "não localizada")
- RECLAMADAS: liste TODAS as empresas com nome + CNPJ. Se houver tomadora de serviço: "TOMADORA IDENTIFICADA — Súmula 331 TST aplicável: tópico de responsabilidade subsidiária OBRIGATÓRIO na petição."

### 1. HORAS EXTRAS
Holerites (valor, habitualidade, adicional), divergências ponto vs. alegado, reflexos (Súm. 264, 291, 376 TST): DSR, 13º, férias + 1/3, FGTS + 40%.

### 2. FOLGAS TRABALHADAS / DSR (FT)
Labor em dias de descanso sem dobro (art. 9º Lei 605/49; Súm. 146 TST). Quantifique folgas trabalhadas e período.

### 3. CARTÃO BRITÂNICO
Horários uniformes/invariáveis → "CARTÃO BRITÂNICO DETECTADO — Presunção de veracidade da jornada alegada (Súmula 338, III, TST)."

### 4. ADICIONAL NOTURNO
Pagamento, horário 22h-05h (art. 73 CLT), hora reduzida 52:30, prorrogação (Súm. 60 e 91 TST).

### 5. OUTRAS IRREGULARIDADES
Uniforme debitado, desvio de função, FGTS não recolhido, verbas rescisórias divergentes, intervalo suprimido (art. 71 CLT), descontos indevidos, retenção de CTPS.

### 6. CRUZAMENTO COM O RELATO DO CASO
DIVERGÊNCIAS (documento ≠ alegado) e LACUNAS PROBATÓRIAS (alegado sem documento).

### 7. DOCUMENTOS ILEGÍVEIS / NÃO IDENTIFICADOS
"Documento [nome] — ilegível ou não identificado. Conferência manual obrigatória."

FORMATO: seções numeradas 0-7, objetivo e direto, cite o documento de origem em cada achado. NÃO invente dados — sem documento, registre "Sem documento disponível para análise deste item."

Ao final:
### RESUMO EXECUTIVO
Bullet points com os 5-7 principais achados.

### AVISO OBRIGATÓRIO
⚠️ Este laudo é um apoio à análise jurídica e NÃO substitui a validação humana pelo advogado responsável.`;
}