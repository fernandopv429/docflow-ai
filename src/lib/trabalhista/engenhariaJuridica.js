// Diretrizes de "engenharia jurídica" do escritório: matrizes condicionais que
// eliminam os erros recorrentes (competência, tese rescisória, enquadramento
// funcional, jornada, dano moral e cálculo dos pedidos).

export const MUNICIPIOS_TRT15 = [
  'campinas', 'vinhedo', 'jundiaí', 'sorocaba', 'ribeirão preto', 'bauru',
  'piracicaba', 'limeira', 'americana', 'são josé dos campos', 'taubaté', 'araraquara',
];

export const BLOCO_ENGENHARIA_JURIDICA = `

DIRETRIZES DE ENGENHARIA JURÍDICA (obrigatórias):

A) COMPETÊNCIA TERRITORIAL (art. 651 CLT) — matriz fechada:
- São Paulo (todas as zonas e foros, inclusive Ruy Barbosa), Itapecerica da Serra, Embu, Taboão da Serra, Osasco, Guarulhos, Santo André, São Bernardo do Campo, Diadema, Mauá, Baixada Santista e Litoral → SEGUNDA REGIÃO (TRT-2).
- Campinas, Vinhedo, Jundiaí, Sorocaba, Ribeirão Preto, Bauru e demais municípios do interior → DÉCIMA QUINTA REGIÃO (TRT-15).
- PROIBIDO indicar TRT-15 para Itapecerica da Serra ou qualquer município da Grande São Paulo.

B) TESE RESCISÓRIA — selecione UMA conforme o relato:
- Dispensa sem justa causa: saldo de salário, aviso prévio indenizado (Lei 12.506/11), férias + 1/3, 13º proporcional e FGTS + 40%, sem capítulo de reversão/rescisão indireta.
- Pedido de demissão sob coação/ameaça: incluir "DA ANULAÇÃO DO PEDIDO DE DEMISSÃO E CONVOLAÇÃO EM DISPENSA IMOTIVADA" (art. 171, II, CC c/c art. 9º CLT), com pedido expresso de nulidade.
- Justa causa injusta: incluir "DA REVERSÃO DA DISPENSA POR JUSTA CAUSA" (art. 482 CLT; ônus do empregador; ausência de falta grave e desproporcionalidade da punição).
- Rescisão indireta: incluir "DA RESCISÃO INDIRETA DO CONTRATO DE TRABALHO" (art. 483, "b" e "d", CLT), com rol das faltas graves do empregador; a multa do art. 477 fica subsidiária.

C) ENQUADRAMENTO FUNCIONAL (nunca cumular teses sobre os mesmos fatos):
- Vigilante executando prevenção de perdas, conferência de cargas ou controle de validade de produtos → SOMENTE DESVIO DE FUNÇÃO (multa convencional de 50% por mês — cláusula 64ª da CCT de vigilância). Jamais somar acúmulo de função aos mesmos fatos.
- Vigilante conduzindo veículo/moto (motoronda) → GRATIFICAÇÃO DE FUNÇÃO de 10% sobre o salário base (cláusula 3ª).
- Porteiro/controlador executando rondas de vigilante → ACÚMULO DE FUNÇÃO de 20% sobre o salário.

D) JORNADA E DANO MORAL:
- Trate exclusivamente da escala relatada. Em 12x36, aborde a extensão habitual, a supressão do intervalo intrajornada (art. 71 CLT), os minutos de troca de uniforme antes/depois e o labor em folgas (FTS). É PROIBIDO inserir explicações, tabelas ou quadros sobre escalas 4x2, 6x2 ou qualquer jornada não trabalhada pelo obreiro.
- Para vigilantes, incluir a tese dos 10 minutos de descanso sentado a cada hora trabalhada (cláusulas 33ª/34ª da CCT).
- Dano moral: manter a fundamentação doutrinária padrão (inclusive a citação da Magistrada Martha Halfed Furtado) e INCORPORAR a narrativa concreta dos abusos relatados na entrevista (pagamentos por fora via PIX, ausência de descanso, desvio de função exaustivo, perseguição). Valor: exatamente 10x o último salário do reclamante.

E) CÁLCULO E ROL DE PEDIDOS:
- NUNCA entregue colchetes de rascunho ou valores vazios (proibido "[VALOR DA CONDUÇÃO]", "[VALOR A APURAR]", "R$ 0,00"). Quando o valor for estimativo, calcule um número proporcional e razoável (salário base × meses trabalhados × percentual aplicável).
- Pagamento por fora (folgas/FTS): apure o total e peça a INTEGRAÇÃO salarial com reflexos em DSR, aviso prévio, férias + 1/3, 13º e FGTS + 40%, sem repetir o principal em tópico isolado (evitar bis in idem).
- O valor da causa deve ser exatamente a soma dos itens do rol de pedidos.
- Honorários sucumbenciais: 15% de forma uniforme no tópico, no rol e no fecho.

G) TRAVAS ADICIONAIS (verificação final antes de entregar):
- AVISO PRÉVIO: em dispensa sem justa causa com data de saída definida, o aviso prévio é INDENIZADO (Lei 12.506/11). É PROIBIDO afirmar que o reclamante "cumpriu aviso prévio trabalhado" ou pedir a redução de 2 horas diárias quando a dispensa foi imotivada e imediata.
- PLACEHOLDERS: nenhum marcador entre colchetes ("[VALOR...]", "[CONFIRMAR]") e nenhum "R$ 0,00" pode constar da peça final. Todo item do rol de pedidos precisa de valor numérico estimado a partir do salário do reclamante e dos meses de contrato.
- VALE-TRANSPORTE: quando o valor não for informado na entrevista, adote o padrão de R$ 10,00 por dia (duas conduções de R$ 5,00) e explicite essa base de cálculo.
- FOLGAS PAGAS POR FORA (FTS): requeira o reconhecimento da natureza salarial do montante recebido em dinheiro/PIX e seus reflexos em DSR, aviso prévio, férias + 1/3, 13º e FGTS + 40%, sem duplicar a cobrança da verba principal.

F) ENTREGA:
- Comece direto em "AO MM. JUÍZO DA VARA DO TRABALHO DE ...". Sem comentários, introduções ou narração de etapas.
- Garanta a concordância de gênero em todo o texto conforme o reclamante — EXCEÇÃO: a expressão "por seu advogado constituído" refere-se ao Dr. Fernando Andrade Vieira (sempre homem). Use SEMPRE "seu advogado" (masculino), mesmo quando a reclamante for mulher — NUNCA escreva "sua advogada".
- NÃO escreva a data do fecho, "Pede deferimento", "Dá-se à causa" nem a assinatura — isso é gerado por CÓDIGO depois da sua resposta (ver CONTRATO DE SAÍDA no prompt principal).`;