import { applyConditionals } from '@/lib/variables';
import { formatBRL, brlComExtenso } from './mathUtils';
import { regiaoTrtCanonica } from './regrasCriticas';

// Formata dinheiro só quando há valor POSITIVO; 0/ausente/inválido → undefined
// (vira marcador [preencher]) para nunca emitir "R$ 0,00" na peça.
const money = (v) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? formatBRL(n) : undefined; };

// ============================================================
// Montador determinístico da peça (rede de segurança do pipeline).
// Roda DEPOIS do aplicarPlano(). Garante que:
//  1) os condicionais {{#if T_X}}...{{/if}} de MODALIDADE sejam resolvidos
//     (só o capítulo da modalidade correta permanece);
//  2) os tokens factuais/determinísticos ({{COMARCA}}, {{RECL_NOME}},
//     {{VALOR_DANO_MORAL}}, etc.) que a IA/plano não preencheu sejam
//     substituídos por código (partes, competência, datas, narrativas,
//     e os valores calculados pelo mathUtils);
//  3) NENHUM token cru {{X}} chegue ao documento — o que não for
//     preenchível vira um marcador visível [preencher: X].
// A IA NÃO calcula: valores vêm do mathUtils (determinístico); verbas que
// dependem de contagem de horas ficam como marcador para revisão/estimativa.
// ============================================================

const MESES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

function fmtDataExtenso(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''));
  if (!m) return iso ? String(iso) : '';
  const [, y, mo, d] = m;
  const mes = MESES[Number(mo) - 1] || '';
  return `${d} de ${mes} de ${y}`;
}

// Rótulo do item calculado (mathUtils.calcularVerbasCaso) -> token {{VALOR_*}}
const CALC_TOKEN = {
  'Dano moral (10x remuneração)': 'VALOR_DANO_MORAL',
  'Gratificação de função (10%)': 'VALOR_GRATIFICACAO',
  'Acúmulo de função (20%/mês)': 'VALOR_ACUMULO',
  'Desvio de função (50%/mês)': 'VALORES_DESVIO_FUNCAO',
  'Prêmio assiduidade (suprimido)': 'VALOR_ASSIDUIDADE',
  'Multa do art. 477 da CLT': 'VALOR_MULTA_477',
  'Multa do art. 467 da CLT': 'VALOR_ART_467',
  'Integração de valores pagos por fora (FTs)': 'VALORES_FORA_FOLHA',
};

// Pontuação padrão de documentos pessoais para a qualificação (a entrevista/
// parser entrega só dígitos; aqui formata para leitura/redação jurídica).
function formatarCpf(v) {
  const d = (v || '').replace(/\D/g, '');
  return d.length === 11 ? d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4') : v;
}
function formatarPis(v) {
  const d = (v || '').replace(/\D/g, '');
  return d.length === 11 ? d.replace(/(\d{3})(\d{5})(\d{2})(\d{1})/, '$1.$2.$3-$4') : v;
}
function formatarRg(v) {
  const d = (v || '').replace(/\D/g, '');
  return d.length === 9 ? d.replace(/(\d{2})(\d{3})(\d{3})(\d{1})/, '$1.$2.$3-$4') : v;
}

function montarQualificacao(caso = {}) {
  const fem = caso.recl_genero === 'F';
  const partes = [
    caso.recl_nacionalidade || (fem ? 'brasileira' : 'brasileiro'),
    caso.recl_estado_civil,
    caso.funcao,
    caso.recl_rg && `${fem ? 'portadora' : 'portador'} da cédula de identidade RG nº ${formatarRg(caso.recl_rg)}`,
    caso.recl_cpf && `inscrito${fem ? 'a' : ''} no CPF sob nº ${formatarCpf(caso.recl_cpf)}`,
    caso.recl_pis && `PIS nº ${formatarPis(caso.recl_pis)}`,
    caso.recl_ctps && `CTPS nº ${caso.recl_ctps}`,
    caso.recl_serie && `Série nº ${caso.recl_serie}`,
    caso.recl_nascimento && `nascido${fem ? 'a' : ''} em ${fmtDataExtenso(caso.recl_nascimento)}`,
    caso.recl_filiacao && `filho${fem ? 'a' : ''} de ${caso.recl_filiacao}`,
    caso.recl_endereco && `residente e domiciliado${fem ? 'a' : ''} em ${caso.recl_endereco}`,
  ].filter(Boolean);
  return partes.join(', ');
}

// Constrói o mapa de tokens determinísticos a partir do caso + cálculos + dados oficiais.
export function tokensDaPeca({ caso = {}, calculos = [], dadosReceita = [], dadosCep = [], attrs = {}, valoresIA = {} } = {}) {
  const uf = (caso.comarca_uf || '').toUpperCase().slice(-2);
  const soDig = (s) => (s || '').replace(/\D/g, '');
  const receita = (cnpj) => (dadosReceita || []).find((d) => d && !d.erro && soDig(d.cnpj) === soDig(cnpj));
  const r1 = receita(caso.recl1_cnpj);
  const r2 = receita(caso.recl2_cnpj);
  const municipioCep = (dadosCep || []).find((d) => d && !d.erro && d.municipio);

  const dados = {};
  const set = (k, v) => { if (v !== undefined && v !== null && v !== '') dados[k] = v; };

  // Valores determinísticos (mathUtils)
  for (const c of calculos || []) {
    if (c.valor == null) continue;
    const tk = CALC_TOKEN[c.item];
    if (tk) set(tk, money(c.valor));
  }
  const fgtsDep = (calculos || []).find((c) => c.item === 'FGTS do período (8%)');
  const fgtsMul = (calculos || []).find((c) => c.item === 'Multa de 40% do FGTS');
  if (fgtsDep) set('VALOR_FGTS_DIF', money(fgtsDep.valor));
  if (fgtsMul) set('VALOR_FGTS_MULTA', money(fgtsMul.valor));
  if (fgtsDep && fgtsMul) set('VALOR_FGTS_TOTAL', money((Number(fgtsDep.valor) || 0) + (Number(fgtsMul.valor) || 0)));

  // Detalhe das verbas rescisórias (composição legível a partir dos itens calculados)
  const acha = (nome) => (calculos || []).find((c) => c.item === nome);
  const partesResc = [];
  const sd = acha('Saldo de salário'); if (sd && Number(sd.valor) > 0) partesResc.push(`saldo de salário: ${formatBRL(sd.valor)}`);
  const av = acha('Aviso prévio indenizado'); if (av && Number(av.valor) > 0) partesResc.push(`aviso prévio indenizado: ${formatBRL(av.valor)}`);
  const t13 = acha('13º proporcional'); if (t13 && Number(t13.valor) > 0) partesResc.push(`13º proporcional: ${formatBRL(t13.valor)}`);
  const fer = acha('Férias proporcionais + 1/3'); if (fer && Number(fer.valor) > 0) partesResc.push(`férias proporcionais + 1/3: ${formatBRL(fer.valor)}`);
  if (fgtsDep && fgtsMul) partesResc.push(`FGTS + 40%: ${formatBRL((Number(fgtsDep.valor) || 0) + (Number(fgtsMul.valor) || 0))}`);
  if (partesResc.length) set('VERBAS_RESCISORIAS_DETALHE', `${partesResc.join('; ')}.`);

  // Valores ESTIMADOS pela IA (verbas que dependem de contagem de horas/dias)
  const IA_TOKEN = {
    horas_extras: 'VALORES_HORAS_EXTRAS',
    intervalo_art71: 'VALORES_INTERVALO',
    adicional_noturno: 'VALOR_ADICIONAL_NOTURNO',
    domingos_feriados_100: 'VALORES_DOMINGOS_FERIADOS',
    dez_minutos: 'VALORES_DESCANSO_SENTADO',
    periculosidade_he: 'VALORES_PERICULOSIDADE_HE',
    minutos_residuais: 'VALORES_MINUTOS_RESIDUAIS',
    vt_folgas: 'VALOR_VT_FOLGAS',
    alimentacao_folgas: 'VALOR_ALIMENTACAO_FOLGAS',
    multas_convencionais: 'VALOR_MULTAS_CONVENCIONAIS',
    ft_diferenca: 'VALOR_FT_DIFERENCA',
  };
  let somaIA = 0;
  for (const [k, tk] of Object.entries(IA_TOKEN)) {
    const v = money((valoresIA || {})[k]);
    if (v) { set(tk, v); somaIA += Number(valoresIA[k]) || 0; }
  }

  // Valor da causa (estimativo): soma determinística + estimativas da IA, teto R$ 400.000
  let somaCausa = somaIA;
  for (const c of calculos || []) { const n = Number(c.valor); if (Number.isFinite(n) && n > 0) somaCausa += n; }
  const valorCausaFinal = somaCausa > 0 ? Math.min(Math.round((somaCausa + Number.EPSILON) * 100) / 100, 400000) : null;
  if (valorCausaFinal) {
    set('VALOR_CAUSA', formatBRL(valorCausaFinal));
    set('VALOR_CAUSA_EXTENSO', valorPorExtenso(valorCausaFinal));
  }

  // Competência / partes
  set('COMARCA', caso.comarca || (municipioCep && municipioCep.municipio) || '');
  set('COMARCA_UF', uf);
  set('REGIAO_TRT', regiaoTrtCanonica(caso.comarca || (municipioCep && municipioCep.municipio), caso.comarca_uf));
  set('LOCAL_PRESTACAO', caso.local_prestacao || '');
  // Rito sumaríssimo só é cabível até 40 salários mínimos (art. 852-A da CLT).
  // Como a estimativa do LLM sobre o rito não é confiável, o código decide pelo
  // rito com base no valor da causa já calculado (limiar conservador).
  const RITO_SUMARISSIMO_LIMITE = 40000;
  const ritoSumarissimoValido = attrs.rito === 'sumarissimo' && (!valorCausaFinal || valorCausaFinal <= RITO_SUMARISSIMO_LIMITE);
  set('RITO', ritoSumarissimoValido ? 'sumaríssimo' : 'ordinário');
  set('RECL_NOME', caso.recl_nome);
  set('RECL_QUALIFICACAO', montarQualificacao(caso));
  set('FUNCAO', caso.funcao);
  set('SALARIO', money(caso.salario));
  set('SALARIO_EXTENSO', brlComExtenso(caso.salario));
  set('DATA_ADMISSAO', fmtDataExtenso(caso.data_admissao));
  set('DATA_RESCISAO', fmtDataExtenso(caso.data_rescisao));
  set('RECL1_NOME', (r1 && r1.razao_social) || caso.recl1_nome);
  set('RECL1_CNPJ', (r1 && r1.cnpj) || caso.recl1_cnpj);
  set('RECL1_ENDERECO', (r1 && r1.endereco) || caso.recl1_logradouro);
  set('RECL2_NOME', (r2 && r2.razao_social) || caso.recl2_nome);
  set('RECL2_CNPJ', (r2 && r2.cnpj) || caso.recl2_cnpj);
  set('RECL2_ENDERECO', (r2 && r2.endereco) || '');

  // Narrativas (o extrator/parser já as sintetiza; boilerplate fica no template)
  set('DANO_MORAL_FATOS', caso.dano_fatos);
  set('DANO_FATOS', caso.dano_fatos);
  set('MOTIVO_RESCISAO_FATOS', caso.motivo_rescisao_fatos);
  set('ACUMULO_ATIVIDADES', caso.acumulo_atividades || caso.desvio_acumulo_fatos);
  set('DESVIO_ATIVIDADES', caso.desvio_acumulo_fatos || caso.acumulo_atividades);
  set('JORNADA_HORARIO', caso.jornada_horario);
  set('JORNADA_PERIODOS', caso.jornada_horario);
  set('VAL_ASSIDUIDADE_MENSAL', money(caso.assiduidade_prometido));
  set('VALOR_CONDUCAO_DIA', money(caso.val_conducao));
  set('VALOR_ALIMENTACAO_DIA', money(caso.valor_aux_alimentacao));

  return dados;
}

// Flags dos condicionais {{#if}} do Modelo Padrão (apenas MODALIDADE — mutuamente exclusivas).
export function flagsDaPeca(caso = {}, attrs = {}) {
  const tipo = caso.tipo_dispensa || attrs.tipo_dispensa;
  return {
    T_DISPENSA: tipo === 'sem_justa_causa',
    T_INDIRETA: tipo === 'rescisao_indireta',
    T_COACAO: tipo === 'nulidade_pedido_demissao',
    T_REVERSAO: tipo === 'reversao_justa_causa',
    T_ACORDO: tipo === 'acordo',
  };
}

// Flags que determinam a PODA determinística das seções opcionais (montagemSecoes.podarPorFlags).
export function flagsSecoes(caso = {}, attrs = {}) {
  return {
    tem_tomadora: !!(caso.recl2_nome || caso.recl2_cnpj || attrs.tem_tomadora),
    tem_gratificacao: /condutor|motorizad/i.test(caso.funcao || ''),
    tem_acumulo: !!caso.tem_acumulo,
    tem_desvio: !!caso.tem_desvio,
    tem_assiduidade: !!(caso.tem_assiduidade || caso.assiduidade_prometido),
    tem_adic_noturno: !!caso.tem_adic_noturno,
    escala_12x36: /12\s*x\s*36/i.test(`${caso.escala || ''} ${caso.jornada_horario || ''}`),
    tem_periculosidade: !!caso.tem_periculosidade,
    tem_integracao_por_fora: !!(caso.tem_integracao_por_fora || caso.val_ft),
    tem_ft: !!(caso.tem_ft || caso.val_ft),
  };
}

// Validador pré-render: lista os tokens que continuaram sem valor no HTML final.
export function assertNoUnreplacedTokens(html) {
  const pendentes = new Set();
  for (const m of String(html || '').matchAll(/\[preencher:\s*([A-Z0-9_]+)\s*\]/g)) pendentes.add(m[1]);
  for (const m of String(html || '').matchAll(/\{\{\s*([A-Z0-9_]+)\s*\}\}/g)) pendentes.add(m[1]);
  return [...pendentes];
}

// Passo final: resolve condicionais de modalidade + substitui tokens + marca residuais.
export function montarPeca(html, ctx = {}) {
  if (!html) return html;
  const flags = flagsDaPeca(ctx.caso || {}, ctx.attrs || {});
  // Se nenhuma modalidade foi identificada, assume dispensa sem justa causa (peça mais enxuta).
  if (!Object.values(flags).some(Boolean)) flags.T_DISPENSA = true;
  let out = applyConditionals(html, flags);

  // Poda também os ITENS DE PEDIDO (no rol "DOS PEDIDOS") das verbas que não se
  // aplicam ao caso — o capítulo de mérito já foi removido por podarPorFlags, mas
  // a linha correspondente do rol precisa sair junto (senão fica [preencher]).
  const fs = flagsSecoes(ctx.caso || {}, ctx.attrs || {});
  const PEDIDO_POR_FLAG = {
    tem_gratificacao: ['VALOR_GRATIFICACAO'],
    tem_acumulo: ['VALOR_ACUMULO'],
    tem_assiduidade: ['VALOR_ASSIDUIDADE', 'VAL_ASSIDUIDADE_MENSAL', 'ASSIDUIDADE_DESDE'],
  };
  for (const [flag, toks] of Object.entries(PEDIDO_POR_FLAG)) {
    if (fs[flag]) continue;
    for (const tk of toks) {
      out = out.replace(new RegExp(`<p\\b[^>]*>(?:(?!</p>)[\\s\\S])*?\\{\\{${tk}\\}\\}(?:(?!</p>)[\\s\\S])*?</p>`, 'g'), '');
    }
  }

  const dados = tokensDaPeca(ctx);
  out = out.replace(/\{\{\s*([A-Z0-9_]+)\s*\}\}/g, (m, k) => {
    if (dados[k] !== undefined && dados[k] !== '') {
      return `<mark class="ai-filled-field" data-ai-field="${k}">${dados[k]}</mark>`;
    }
    return `<mark class="ai-pending-field" data-ai-field="${k}" style="background:#fff3cd;color:#8a5d00;">[preencher: ${k}]</mark>`;
  });
  return out;
}