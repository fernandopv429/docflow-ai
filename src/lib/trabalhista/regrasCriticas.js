// Regras críticas extraídas da comparação entre a minuta gerada pela IA e a
// minuta de referência revisada pelo advogado. Injetadas no prompt de geração
// e na auditoria de coerência para evitar a repetição dos mesmos erros.

// Competência: o TRT decorre do município da prestação de serviços (art. 651 CLT).
// A Grande São Paulo, Baixada Santista e Litoral pertencem ao TRT da 2ª Região;
// o interior do Estado (Campinas e região) ao TRT da 15ª Região.
import { MUNICIPIOS_TRT15 } from './engenhariaJuridica';
import { UF_TRT_MAP } from './tokens';

const normMun = (s) => (s || '').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');

export const MUNICIPIOS_TRT2 = [
  'são paulo', 'itapecerica da serra', 'embu', 'embu das artes', 'embu-guaçu', 'taboão da serra',
  'osasco', 'carapicuíba', 'cotia', 'barueri', 'jandira', 'itapevi', 'guarulhos', 'santo andré',
  'são bernardo do campo', 'são caetano do sul', 'diadema', 'mauá', 'ribeirão pires',
  'rio grande da serra', 'mogi das cruzes', 'suzano', 'poá', 'itaquaquecetuba', 'ferraz de vasconcelos',
  'arujá', 'santa isabel', 'caieiras', 'franco da rocha', 'francisco morato', 'mairiporã',
  'santana de parnaíba', 'pirapora do bom jesus', 'juquitiba', 'são lourenço da serra',
  'santos', 'são vicente', 'guarujá', 'cubatão', 'praia grande', 'itanhaém', 'peruíbe',
  'mongaguá', 'bertioga', 'caraguatatuba', 'são sebastião', 'ubatuba', 'ilhabela',
];

// Classifica o município de SP: 'TRT15' (interior/Campinas) ou 'TRT2' (Grande SP,
// Baixada e Litoral). Verifica o interior PRIMEIRO para não cair no fallback errado.
function classificaTrtSp(municipio) {
  const m = normMun(municipio);
  if (!m) return null;
  if (MUNICIPIOS_TRT15.some((n) => m.includes(normMun(n)))) return 'TRT15';
  if (MUNICIPIOS_TRT2.some((n) => m.includes(normMun(n)))) return 'TRT2';
  return null;
}

export function regiaoTrtPorMunicipio(municipio) {
  const c = classificaTrtSp(municipio);
  if (c === 'TRT15') return '15ª Região (TRT-15)';
  if (c === 'TRT2') return '2ª Região (TRT-2)';
  return null;
}

// Região do TRT no formato canônico do endereçamento (ex.: "SEGUNDA REGIÃO"),
// com fallback pela UF quando o município não está mapeado.
export function regiaoTrtCanonica(municipio, uf) {
  const c = classificaTrtSp(municipio);
  if (c === 'TRT15') return 'DÉCIMA QUINTA REGIÃO';
  if (c === 'TRT2') return 'SEGUNDA REGIÃO';
  const u = (uf || '').toUpperCase().slice(-2);
  return UF_TRT_MAP[u] || '';
}

export function blocoRegrasCriticas({ municipios = [], dataHoje } = {}) {
  const comReg = municipios.map((m) => ({ m, reg: regiaoTrtPorMunicipio(m) })).filter((x) => x.reg);
  const orientacaoTrt = comReg.length
    ? `Competência pelo município de prestação (art. 651 CLT): ${comReg.map((x) => `${x.m} → ${x.reg}`).join('; ')}. Enderece a peça à Vara do Trabalho do município NA REGIÃO INDICADA; não troque a região.`
    : 'Confirme o TRT pelo município de prestação: Grande São Paulo, Baixada Santista e Litoral = TRT da 2ª Região; interior/Campinas = TRT da 15ª Região. Em dúvida, use o marcador [REGIÃO DO TRT - confirmar]; nunca "adivinhe" a região.';

  return `

REGRAS CRÍTICAS (erros já cometidos em minutas anteriores — NÃO repita):
1. COMPETÊNCIA / TRT: ${orientacaoTrt}
2. ESCALA: use EXCLUSIVAMENTE a escala efetivamente relatada na entrevista. Se o relato é 12x36, trate apenas de 12x36 (prorrogação, folgas laboradas). É PROIBIDO criar tópicos, quadros sinóticos ou jurisprudência sobre escalas que o relato não menciona (ex.: 4x2, 5x2, 6x1 quando o caso é 12x36).
3. DESVIO × ACÚMULO DE FUNÇÃO: são pedidos ALTERNATIVOS e mutuamente excludentes para o MESMO conjunto de tarefas. Escolha UM só (desvio, quando executa tarefas de outro cargo; acúmulo, quando soma as atribuições de dois cargos) e peça apenas a multa convencional correspondente. NUNCA cumule os dois com base nos mesmos fatos.
4. HONORÁRIOS: use 15% de forma UNIFORME — no tópico próprio, no rol de pedidos e no parágrafo de fecho. Não misture 15% e 20% na mesma peça.
5. VALORES ESTIMADOS: calcule cada pedido a partir dos dados reais do caso (salário base × meses trabalhados × percentual aplicável). É PROIBIDO lançar valores redondos genéricos e altos (ex.: R$ 15.000,00 "a apurar") e igualmente PROIBIDO entregar a peça com "[VALOR A APURAR]", "R$ 0,00" ou colchetes de rascunho no rol de pedidos — sempre apresente um valor numérico proporcional. Não infle a causa: o total deve corresponder à soma dos pedidos.
6. DATA DO FECHO: use a data de hoje — "São Paulo, ${dataHoje}." Nunca deixe "[data]" em aberto.`;
}