// Mapa UF → Região do TRT (competência) e rótulos das modalidades de rescisão.
// (A derivação de tokens/validação antiga foi substituída por montarPeca.js.)
export const UF_TRT_MAP = {
  AC: 'DÉCIMA QUARTA REGIÃO', AL: 'DÉCIMA NONA REGIÃO', AP: 'OITAVA REGIÃO',
  AM: 'OITAVA REGIÃO', BA: 'QUINTA REGIÃO', CE: 'SÉTIMA REGIÃO',
  DF: 'DÉCIMA REGIÃO', ES: 'DÉCIMA SÉTIMA REGIÃO', GO: 'DÉCIMA OITAVA REGIÃO',
  MA: 'DÉCIMA SEXTA REGIÃO', MT: 'DÉCIMA OITAVA REGIÃO', MS: 'VIGÉSIMA QUARTA REGIÃO',
  MG: 'TERCEIRA REGIÃO', PA: 'OITAVA REGIÃO', PB: 'DÉCIMA TERCEIRA REGIÃO',
  PR: 'NONA REGIÃO', PE: 'SEXTA REGIÃO', PI: 'VIGÉSIMA SEGUNDA REGIÃO',
  RJ: 'PRIMEIRA REGIÃO', RN: 'VIGÉSIMA PRIMEIRA REGIÃO', RS: 'QUARTA REGIÃO',
  RO: 'DÉCIMA QUARTA REGIÃO', RR: 'OITAVA REGIÃO', SC: 'DÉCIMA SEGUNDA REGIÃO',
  SP: 'SEGUNDA REGIÃO', SE: 'VIGÉSIMA REGIÃO', TO: 'VIGÉSIMA SÉTIMA REGIÃO',
};

export const TIPO_DISPENSA_LABELS = {
  sem_justa_causa: 'Dispensa sem justa causa (art. 7º, I, CF)',
  rescisao_indireta: 'Rescisão indireta (art. 483, CLT)',
  nulidade_pedido_demissao: 'Nulidade do pedido de demissão (art. 9º CLT — coação)',
  reversao_justa_causa: 'Reversão da justa causa (art. 493, CLT)',
  acordo: 'Acordo entre partes (art. 484-A, CLT)',
};
