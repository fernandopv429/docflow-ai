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
  const a = new Date(admissao);
  const r = new Date(rescisao);
  if (isNaN(a) || isNaN(r) || r < a) return null;
  let meses = (r.getFullYear() - a.getFullYear()) * 12 + (r.getMonth() - a.getMonth());
  if (r.getDate() >= a.getDate()) {
    // mês em curso conta se ≥ 15 dias trabalhados (regra do avo)
    if (r.getDate() - a.getDate() >= 14) meses += 1;
  }
  return Math.max(meses, 0);
}

export function anosCompletos(admissao, rescisao) {
  const m = mesesContrato(admissao, rescisao);
  return m == null ? null : Math.floor(m / 12);
}

// Aviso prévio indenizado (Lei 12.506/2011): 30 dias + 3 dias por ano completo, máx. 90 dias.
// Na rescisão por acordo (art. 484-A, I, CLT), o aviso prévio indenizado é pago
// pela METADE — passe `acordo: true` para aplicar essa redução.
export function avisoPrevio(salario, anos, { acordo = false } = {}) {
  if (!salario || anos == null) return null;
  const diasIntegral = Math.min(30 + anos * 3, 90);
  const dias = acordo ? Math.round(diasIntegral / 2) : diasIntegral;
  return { dias, diasIntegral, valor: round2((salario / 30) * dias) };
}

// Projeta a data de rescisão pelos dias do aviso prévio INDENIZADO. O aviso
// prévio (trabalhado ou indenizado) integra o tempo de serviço do empregado
// para todos os efeitos legais (art. 487, §1º, da CLT; Súmula 371 do C. TST),
// de modo que 13º, férias proporcionais e FGTS do período devem ser apurados
// já computando esses dias adicionais — NÃO apenas a data "seca" da rescisão.
// (Isso NÃO altera os próprios dias do aviso prévio, que continuam calculados
// sobre os anos completos até a data real de rescisão.)
export function projetarDataComAvisoPrevio(rescisao, diasAviso) {
  if (!rescisao || !diasAviso) return rescisao;
  const r = new Date(rescisao);
  if (isNaN(r)) return rescisao;
  r.setDate(r.getDate() + diasAviso);
  return r.toISOString().slice(0, 10);
}

// 13º proporcional (avos sobre os meses do contrato — estimativa p/ valor da causa)
export function decimoTerceiroProporcional(salario, meses) {
  if (!salario || meses == null) return null;
  const avos = meses % 12 || 12;
  return { avos, valor: round2((salario / 12) * avos) };
}

// Férias proporcionais + 1/3
export function feriasProporcionais(salario, meses) {
  if (!salario || meses == null) return null;
  const avos = meses % 12 || 12;
  const base = (salario / 12) * avos;
  return { avos, valor: round2(base * (4 / 3)) };
}

// FGTS do período (8% ao mês) e multa rescisória. Multa padrão de 40% (dispensa
// sem justa causa/equiparadas); na rescisão por acordo (art. 484-A, II, CLT) a
// multa é de 20% — passe `multaPct: 0.2` nesse caso.
export function fgtsPeriodo(salario, meses, { multaPct = 0.4 } = {}) {
  if (!salario || meses == null) return null;
  const deposito = round2(salario * 0.08 * meses);
  return { deposito, multa: round2(deposito * multaPct), multaPct };
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
  // Rescisão por acordo (art. 484-A, CLT): aviso prévio pela metade e multa do
  // FGTS de 20% (em vez de 40%). 13º e férias proporcionais permanecem INTEGRAIS.
  const isAcordo = caso.tipo_dispensa === 'acordo';

  if (meses != null) {
    itens.push({ item: 'Duração do contrato', memoria: `${meses} mês(es) / ${anos} ano(s) completo(s)`, valor: null });
  }
  const ap = avisoPrevio(salario, anos, { acordo: isAcordo });
  if (ap) {
    const memoriaAp = isAcordo
      ? `${ap.dias} dias — metade de ${ap.diasIntegral} (art. 484-A, I, CLT — rescisão por acordo)`
      : `${ap.dias} dias (Lei 12.506/2011)`;
    itens.push({ item: 'Aviso prévio indenizado', memoria: memoriaAp, valor: ap.valor });
  }

  // 13º, férias e FGTS usam o tempo de serviço COM a projeção do aviso prévio
  // indenizado (art. 487, §1º, CLT; Súmula 371 TST) — por isso os avos podem
  // diferir de uma contagem "seca" entre admissão e rescisão. No acordo, a
  // projeção usa os dias efetivamente indenizados (a metade), mas os avos de
  // 13º/férias em si NÃO são reduzidos pela metade — só o aviso e a multa do FGTS.
  const dataProjetada = ap ? projetarDataComAvisoPrevio(caso.data_rescisao, ap.dias) : caso.data_rescisao;
  const mesesProjetados = mesesContrato(caso.data_admissao, dataProjetada) ?? meses;
  const sufixoProjecao = ap ? ` (com projeção do aviso prévio indenizado — art. 487 §1º CLT/Súm. 371 TST)` : '';

  const dt = decimoTerceiroProporcional(salario, mesesProjetados);
  if (dt) itens.push({ item: '13º proporcional', memoria: `${dt.avos}/12 avos${sufixoProjecao}`, valor: dt.valor });
  const fe = feriasProporcionais(salario, mesesProjetados);
  if (fe) itens.push({ item: 'Férias proporcionais + 1/3', memoria: `${fe.avos}/12 avos + 1/3${sufixoProjecao}`, valor: fe.valor });
  const fg = fgtsPeriodo(salario, mesesProjetados, { multaPct: isAcordo ? 0.2 : 0.4 });
  if (fg) {
    itens.push({ item: 'FGTS do período (8%)', memoria: `8% × ${mesesProjetados} meses${sufixoProjecao}`, valor: fg.deposito });
    itens.push({
      item: isAcordo ? 'Multa de 20% do FGTS (acordo)' : 'Multa de 40% do FGTS',
      memoria: isAcordo ? '20% sobre os depósitos (art. 484-A, II, CLT — rescisão por acordo)' : '40% sobre os depósitos',
      valor: fg.multa,
    });
  }
  if (caso.val_ft) {
    const dsr = dsrSobreValor(Number(caso.val_ft));
    itens.push({ item: 'Folgas trabalhadas (informado)', memoria: 'valor do caso', valor: round2(Number(caso.val_ft)) });
    if (dsr) itens.push({ item: 'Reflexo DSR sobre FT (1/6)', memoria: 'Súm. 172 TST', valor: dsr });
  }
  if (caso.tem_dano_moral && (salario || caso.maior_remuneracao)) {
    const baseDM = Number(caso.maior_remuneracao) || salario;
    itens.push({ item: 'Dano moral (10x remuneração)', memoria: 'padrão do escritório (10x a maior remuneração na função)', valor: danoMoral10x(baseDM) });
  }
  // Verbas conexas adicionais (padrões FAV — aditivas; só entram com dado/flag de suporte)
  const funcNorm = (caso.funcao || '').toLowerCase();
  if (/condutor|motorizad/.test(funcNorm) && salario && meses) {
    itens.push({ item: 'Gratificação de função (10%)', memoria: '10% × salário × meses (cláusula 3ª CCT — condutor)', valor: round2(salario * 0.1 * meses) });
  }
  if (caso.tem_acumulo && salario && meses) {
    itens.push({ item: 'Acúmulo de função (20%/mês)', memoria: '20% × salário × meses (multa normativa)', valor: round2(salario * 0.2 * meses) });
  }
  // Desvio de função: multa convencional de 50%/mês (cláusula 64ª da CCT de
  // vigilância). Calculado por código sobre os MESES REAIS do contrato (não
  // projetados) — já vimos a IA errar essa conta sozinha (usou 10 meses num
  // contrato de 8). Se `tem_desvio` não vier marcado pelo parser mas a
  // entrevista relatar desvio, a IA ainda pode estimar por conta própria no
  // texto — este cálculo é um reforço, não um bloqueio ao tópico.
  if (caso.tem_desvio && salario && meses) {
    itens.push({ item: 'Desvio de função (50%/mês)', memoria: '50% × salário × meses reais do contrato (Cláusula 64ª CCT)', valor: round2(salario * 0.5 * meses) });
  }
  const assidMensal = Number(caso.assiduidade_prometido || caso.assiduidade_diferenca) || null;
  if (assidMensal && meses) {
    itens.push({ item: 'Prêmio assiduidade (suprimido)', memoria: 'valor mensal × meses (estimativa)', valor: round2(assidMensal * meses) });
  }
  return itens;
}