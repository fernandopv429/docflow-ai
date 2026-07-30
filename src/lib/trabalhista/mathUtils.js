// Cálculos trabalhistas determinísticos (JavaScript puro).
// A IA NÃO faz aritmética: estes valores são calculados por código e
// entregues prontos ao auditor, que só valida coerência jurídica.

export const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

export function formatBRL(n) {
  if (n == null || isNaN(n)) return '—';
  return Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// Meses completos entre duas datas (mínimo 0)
export function mesesContrato(admissao, rescisao) {
  if (!admissao || !rescisao) return null;
  const pd = (s) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || '')); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date(s); };
  const a = pd(admissao);
  const r = pd(rescisao);
  if (isNaN(a) || isNaN(r) || r < a) return null;
  let meses = (r.getFullYear() - a.getFullYear()) * 12 + (r.getMonth() - a.getMonth());
  if (r.getDate() >= a.getDate()) {
    // mês em curso conta se ≥ 15 dias trabalhados (regra do avo)
    if (r.getDate() - a.getDate() >= 14) meses += 1;
  }
  return Math.max(meses, 0);
}

// Aviso prévio indenizado (Lei 12.506/2011): 30 dias + 3 dias por ano completo, máx. 90 dias
export function avisoPrevio(salario, anos) {
  if (!salario || anos == null) return null;
  const dias = Math.min(30 + anos * 3, 90);
  return { dias, valor: round2((salario / 30) * dias) };
}

// 13º proporcional (avos sobre os meses do contrato — estimativa p/ valor da causa)
export function decimoTerceiroProporcional(salario, meses) {
  if (!salario || !meses) return null;
  const avos = meses % 12 || 12;
  return { avos, valor: round2((salario / 12) * avos) };
}

// Férias proporcionais + 1/3
export function feriasProporcionais(salario, meses) {
  if (!salario || !meses) return null;
  const avos = meses % 12 || 12;
  const base = (salario / 12) * avos;
  return { avos, valor: round2(base * (4 / 3)) };
}

// FGTS do período (8% ao mês) e multa de 40%
export function fgtsPeriodo(salario, meses) {
  if (!salario || !meses) return null;
  const deposito = round2(salario * 0.08 * meses);
  return { deposito, multa40: round2(deposito * 0.4) };
}

// Reflexo de DSR sobre verba variável habitual (1/6 — Súm. 172 TST)
export function dsrSobreValor(valor) {
  if (!valor) return null;
  return round2(valor / 6);
}

// Dano moral no padrão do escritório: 10x a maior remuneração
export function danoMoral10x(maiorRemuneracao) {
  if (!maiorRemuneracao) return null;
  return round2(maiorRemuneracao * 10);
}

// Consolida os cálculos possíveis a partir dos dados do caso.
// Retorna apenas itens calculáveis (inputs presentes) com rótulo + memória.
export function calcularVerbasCaso(caso = {}) {
  const itens = [];
  const salario = Number(caso.salario) || null;
  const meses = mesesContrato(caso.data_admissao, caso.data_rescisao);
  const anos = meses == null ? null : Math.floor(meses / 12);

  if (meses != null) {
    itens.push({ item: 'Duração do contrato', memoria: `${meses} mês(es) / ${anos} ano(s) completo(s)`, valor: null });
  }
  const ap = avisoPrevio(salario, anos);
  if (ap) itens.push({ item: 'Aviso prévio indenizado', memoria: `${ap.dias} dias (Lei 12.506/2011)`, valor: ap.valor });

  // Saldo de salário: dias trabalhados no mês da rescisão (dia do mês, teto 30)
  let saldo = null;
  if (salario && caso.data_rescisao) {
    const md = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(caso.data_rescisao));
    const dia = md ? Math.min(Number(md[3]), 30) : null;
    if (dia) {
      saldo = round2((salario / 30) * dia);
      itens.push({ item: 'Saldo de salário', memoria: `${dia} dia(s) do mês da rescisão`, valor: saldo });
    }
  }
  const dt = decimoTerceiroProporcional(salario, meses);
  if (dt) itens.push({ item: '13º proporcional', memoria: `${dt.avos}/12 avos`, valor: dt.valor });
  const fe = feriasProporcionais(salario, meses);
  if (fe) itens.push({ item: 'Férias proporcionais + 1/3', memoria: `${fe.avos}/12 avos + 1/3`, valor: fe.valor });
  const fg = fgtsPeriodo(salario, meses);
  if (fg) {
    itens.push({ item: 'FGTS do período (8%)', memoria: `8% × ${meses} meses`, valor: fg.deposito });
    itens.push({ item: 'Multa de 40% do FGTS', memoria: '40% sobre os depósitos', valor: fg.multa40 });
  }
  // Multa do art. 477 (mora rescisória) = 1 salário
  if (salario) itens.push({ item: 'Multa do art. 477 da CLT', memoria: '1 salário (mora nas verbas rescisórias)', valor: round2(salario) });
  // Multa do art. 467 = 50% das verbas rescisórias incontroversas (saldo + aviso + 13º + férias)
  const baseResc = (saldo || 0) + (ap ? ap.valor : 0) + (dt ? dt.valor : 0) + (fe ? fe.valor : 0);
  if (baseResc > 0) itens.push({ item: 'Multa do art. 467 da CLT', memoria: '50% das verbas rescisórias incontroversas', valor: round2(baseResc * 0.5) });

  if (caso.tem_dano_moral && (salario || caso.maior_remuneracao)) {
    const baseDM = Number(caso.maior_remuneracao) || salario;
    itens.push({ item: 'Dano moral (10x remuneração)', memoria: 'padrão do escritório (10x a maior remuneração na função)', valor: danoMoral10x(baseDM) });
  }

  // Função exercida além da contratada — conforme o caso (mutuamente conforme o relato):
  const funcNorm = (caso.funcao || '').toLowerCase();
  if (caso.tem_desvio && salario && meses) {
    itens.push({ item: 'Desvio de função (50%/mês)', memoria: '50% × salário × meses (multa normativa — cláusula 64ª)', valor: round2(salario * 0.5 * meses) });
  }
  if (caso.tem_acumulo && salario && meses) {
    itens.push({ item: 'Acúmulo de função (20%/mês)', memoria: '20% × salário × meses (multa normativa)', valor: round2(salario * 0.2 * meses) });
  }
  if (/condutor|motorizad/.test(funcNorm) && salario && meses) {
    itens.push({ item: 'Gratificação de função (10%)', memoria: '10% × salário × meses (cláusula 3ª CCT — condutor)', valor: round2(salario * 0.1 * meses) });
  }

  const assidMensal = Number(caso.assiduidade_prometido || caso.assiduidade_diferenca) || null;
  if (assidMensal && meses) {
    itens.push({ item: 'Prêmio assiduidade (suprimido)', memoria: 'valor mensal × meses (estimativa)', valor: round2(assidMensal * meses) });
  }

  // Integração dos valores pagos "por fora" (FTs) = valor por folga × folgas/mês × meses
  const valFolga = Number(caso.val_ft) || null;
  if (valFolga) {
    const qtd = Number(caso.ft_qtd_media) || null;
    const total = qtd && meses ? round2(valFolga * qtd * meses) : round2(valFolga * (meses || 1));
    const dsr = dsrSobreValor(total);
    itens.push({ item: 'Integração de valores pagos por fora (FTs)', memoria: qtd && meses ? `R$ ${valFolga} × ${qtd} folgas × ${meses} meses` : 'valor informado', valor: total });
    if (dsr) itens.push({ item: 'Reflexo DSR sobre FT (1/6)', memoria: 'Súm. 172 TST', valor: dsr });
  }
  return itens;
}