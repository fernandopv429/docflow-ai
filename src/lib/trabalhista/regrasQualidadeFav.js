// Regras de qualidade FAV Advogados: correções pontuais apontadas na revisão
// humana das últimas minutas (e-mails, local de prestação, desvio × acúmulo,
// multas convencionais, cronologia do fecho e duplicidade de valores).

export const BLOCO_REGRAS_QUALIDADE_FAV = `

QUALIFICAÇÃO E DADOS DE CONTATO (OBRIGATÓRIO):
- E-MAIL DO RECLAMANTE: inclua obrigatoriamente o e-mail PESSOAL do trabalhador (informado na entrevista) na qualificação do preâmbulo. NUNCA o substitua pelo e-mail do escritório.
- E-MAIL DO PATRONO: trabalhista@favadvogados.com.br consta APENAS na qualificação do advogado e no fecho, para comunicações.
- CTPS E DOCUMENTOS: preencha número e série exatos da CTPS e os demais documentos, sem marcadores como [SÉRIE] ou [PENDENTE].

COMPETÊNCIA TERRITORIAL E FATOS:
- No tópico "DA COMPETÊNCIA PROCESSUAL", indique expressamente o endereço ONDE O TRABALHADOR PRESTOU SERVIÇOS (ex.: dependências da 2ª Reclamada/Tomadora). NUNCA use o endereço residencial do trabalhador como local de trabalho.
- Reproduza os endereços com a grafia EXATA informada na entrevista/dados oficiais (inclusive quilometragem, ex.: "Km 296,5"). Não arredonde nem altere números do endereço.

REGRAS TÉCNICAS E ANTI-CONTRADIÇÃO:
1. DESVIO × ACÚMULO: vigilante que executava atividades de Prevenção de Perdas (conferência de cargas, produtos, validade, paletes) gera EXCLUSIVAMENTE "DESVIO DE FUNÇÃO" (multa convencional de 50%/mês da CCT). NÃO inclua capítulo de acúmulo de função (20%) para os mesmos fatos.
2. DANO MORAL: causa de pedir fluida e encadeada. É PROIBIDO deixar frases soltas, fragmentadas ou cortadas (ex.: "direitos lesados.").
3. MULTAS CONVENCIONAIS: indique o número exato das cláusulas violadas (ex.: Cláusulas 71ª/72ª da CCT) e o percentual previsto no instrumento coletivo.
4. SEM DUPLICIDADE NO ROL DE PEDIDOS: cada verba aparece UMA única vez. Se o aviso prévio indenizado já figura no detalhamento das verbas rescisórias, não o repita em item isolado (e vice-versa). O valor da causa é a soma dos itens SEM duplicar nenhuma verba.

CRONOLOGIA E SÚMULAS NO FECHO (IMUTÁVEL):
1. NÃO escreva a data de assinatura, "Pede deferimento", "Dá-se à causa" nem a assinatura — isso é inserido por CÓDIGO depois da sua resposta, sempre com a data correta (posterior à rescisão). Encerre no último requerimento final.
2. Honorários sucumbenciais de 15% fundamentados no art. 791-A da CLT.
3. Publicações exclusivamente em nome do Dr. Fernando Andrade Vieira, OAB/SP nº 320.825 (Súmula 427 do C. TST).
4. NUNCA cite a Súmula 425 do TST para fundamentar honorários advocatícios.

FORMATO DE SAÍDA: entregue o texto da petição inicial (até o último requerimento final, SEM o fecho), limpo, com capítulos em negrito, sem qualquer comentário antes ou depois, seguido do CONTRATO DE SAÍDA (<!--PEDIDOS_VALORES:[...]-->) descrito no prompt principal.`;