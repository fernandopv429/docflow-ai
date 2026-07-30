import { applyConditionals } from '@/lib/variables';
import { formatBRL } from './mathUtils';
import { UF_TRT_MAP } from './tokens';

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
  'Prêmio assiduidade (suprimido)': 'VALOR_ASSIDUIDADE',
};

function montarQualificacao(caso = {}) {
  const fem = caso.recl_genero === 'F';
  const partes = [
    caso.recl_nacionalidade || (fem ? 'brasileira' : 'brasileiro'),
    caso.recl_estado_civil,
    caso.funcao,
    caso.recl_rg && `${fem ? 'portadora' : 'portador'} da cédula de identidade RG nº ${caso.recl_rg}`,
    caso.recl_cpf && `inscrito${fem ? 'a' : ''} no CPF sob nº ${caso.recl_cpf}`,
    caso.recl_pis && `PIS nº ${caso.recl_pis}`,
    caso.recl_ctps && `CTPS nº ${caso.recl_ctps}`,
    caso.recl_serie && `Série nº ${caso.recl_serie}`,
    caso.recl_nascimento && `nascido${fem ? 'a' : ''} em ${fmtDataExtenso(caso.recl_nascimento)}`,
    caso.recl_filiacao && `filho${fem ? 'a' : ''} de ${caso.recl_filiacao}`,
    caso.recl_endereco && `residente e domiciliado${fem ? 'a' : ''} em ${caso.recl_endereco}`,
  ].filter(Boolean);
  return partes.join(', ');
}

// Constrói o mapa de tokens determinísticos a partir do caso + cálculos + dados oficiais.
export function tokensDaPeca({ caso = {}, calculos = [], dadosReceita = [], dadosCep = [], attrs = {} } = {}) {
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
    if (tk) set(tk, formatBRL(c.valor));
  }
  const fgtsDep = (calculos || []).find((c) => c.item === 'FGTS do período (8%)');
  const fgtsMul = (calculos || []).find((c) => c.item === 'Multa de 40% do FGTS');
  if (fgtsDep) set('VALOR_FGTS_DIF', formatBRL(fgtsDep.valor));
  if (fgtsMul) set('VALOR_FGTS_MULTA', formatBRL(fgtsMul.valor));
  if (fgtsDep && fgtsMul) set('VALOR_FGTS_TOTAL', formatBRL((Number(fgtsDep.valor) || 0) + (Number(fgtsMul.valor) || 0)));

  // Competência / partes
  set('COMARCA', caso.comarca || (municipioCep && municipioCep.municipio) || '');
  set('COMARCA_UF', uf);
  set('REGIAO_TRT', UF_TRT_MAP[uf] || '');
  set('LOCAL_PRESTACAO', caso.local_prestacao || '');
  set('RITO', attrs.rito === 'sumarissimo' ? 'sumaríssimo' : 'ordinário');
  set('RECL_NOME', caso.recl_nome);
  set('RECL_QUALIFICACAO', montarQualificacao(caso));
  set('FUNCAO', caso.funcao);
  set('SALARIO', caso.salario != null ? formatBRL(caso.salario) : '');
  set('SALARIO_EXTENSO', caso.salario != null ? formatBRL(caso.salario) : '');
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
  set('VAL_ASSIDUIDADE_MENSAL', caso.assiduidade_prometido != null ? formatBRL(caso.assiduidade_prometido) : '');
  set('VALOR_CONDUCAO_DIA', caso.val_conducao != null ? formatBRL(caso.val_conducao) : '');
  set('VALOR_ALIMENTACAO_DIA', caso.valor_aux_alimentacao != null ? formatBRL(caso.valor_aux_alimentacao) : '');

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

// Passo final: resolve condicionais de modalidade + substitui tokens + marca residuais.
export function montarPeca(html, ctx = {}) {
  if (!html) return html;
  const flags = flagsDaPeca(ctx.caso || {}, ctx.attrs || {});
  // Se nenhuma modalidade foi identificada, assume dispensa sem justa causa (peça mais enxuta).
  if (!Object.values(flags).some(Boolean)) flags.T_DISPENSA = true;
  let out = applyConditionals(html, flags);
  const dados = tokensDaPeca(ctx);
  out = out.replace(/\{\{\s*([A-Z0-9_]+)\s*\}\}/g, (m, k) => {
    if (dados[k] !== undefined && dados[k] !== '') {
      return `<mark class="ai-filled-field" data-ai-field="${k}">${dados[k]}</mark>`;
    }
    return `<mark class="ai-pending-field" data-ai-field="${k}" style="background:#fff3cd;color:#8a5d00;">[preencher: ${k}]</mark>`;
  });
  return out;
}
