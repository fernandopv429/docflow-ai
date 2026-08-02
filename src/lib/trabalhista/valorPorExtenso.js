// Conversão determinística de valores monetários (R$) para extenso, em
// português, no padrão já usado nas petições do escritório (ex.: "vinte e
// um mil, quatrocentos e oitenta e dois reais e vinte centavos"). Suporta
// até centenas de milhões — muito acima do teto de R$ 400.000,00 do escritório.
// Escrito para ser usado no lugar da IA "escrever por extenso de cabeça",
// eliminando divergência entre o número e o texto por extenso.

const UNIDADES = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove'];
const DEZ_A_DEZENOVE = [
  'dez', 'onze', 'doze', 'treze', 'catorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove',
];
const DEZENAS = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
const CENTENAS = [
  '', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos',
];

function grupoPorExtenso(n) {
  // n: 0-999
  if (n === 0) return '';
  if (n === 100) return 'cem';
  const c = Math.floor(n / 100);
  const resto = n % 100;
  const partes = [];
  if (c) partes.push(CENTENAS[c]);
  if (resto) {
    if (resto < 10) partes.push(UNIDADES[resto]);
    else if (resto < 20) partes.push(DEZ_A_DEZENOVE[resto - 10]);
    else {
      const d = Math.floor(resto / 10);
      const u = resto % 10;
      partes.push(u ? `${DEZENAS[d]} e ${UNIDADES[u]}` : DEZENAS[d]);
    }
  }
  return partes.join(' e ');
}

function inteiroPorExtenso(n) {
  if (n === 0) return 'zero';
  const milhoes = Math.floor(n / 1000000);
  const milhares = Math.floor((n % 1000000) / 1000);
  const centenas = n % 1000;
  const partes = [];
  if (milhoes) partes.push(milhoes === 1 ? 'um milhão' : `${grupoPorExtenso(milhoes)} milhões`);
  if (milhares) partes.push(milhares === 1 ? 'mil' : `${grupoPorExtenso(milhares)} mil`);
  if (centenas) partes.push(grupoPorExtenso(centenas));
  return partes.join(', ');
}

// Converte um valor em reais (number) para a frase por extenso completa,
// incluindo "reais" e "centavos" no plural/singular corretos.
export function valorPorExtenso(valor) {
  const centavosTotais = Math.round((Number(valor) || 0) * 100);
  const reais = Math.floor(centavosTotais / 100);
  const centavos = centavosTotais % 100;
  const centavosTxt = centavos ? `${inteiroPorExtenso(centavos)} ${centavos === 1 ? 'centavo' : 'centavos'}` : '';
  if (!reais) return centavosTxt || 'zero reais';
  const reaisTxt = `${inteiroPorExtenso(reais)} ${reais === 1 ? 'real' : 'reais'}`;
  return centavos ? `${reaisTxt} e ${centavosTxt}` : reaisTxt;
}

// Formata em "R$ X.XXX,XX" (padrão brasileiro).
export function formatarReais(valor) {
  return (Number(valor) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
