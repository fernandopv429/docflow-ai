// Validação trabalhista rígida das datas/valores do caso (determinística).
// Roda ANTES dos cálculos: corrige o que é seguro corrigir e devolve alertas
// para o chat, evitando distorções (ex.: saldo de salário de ano posterior à
// rescisão, aviso prévio proporcional em contrato de menos de 1 ano).

const parseISO = (s) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || ''));
  return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
};

const fmt = (d) => d.toLocaleDateString('pt-BR');

export function validarCasoTrabalhista(caso = {}) {
  const alertas = [];
  const out = { ...caso };
  const adm = parseISO(out.data_admissao);
  const resc = parseISO(out.data_rescisao);
  const hoje = new Date();

  if (out.data_admissao && !adm) {
    alertas.push(`Data de admissão inválida ("${out.data_admissao}") — desconsiderada nos cálculos.`);
    delete out.data_admissao;
  }
  if (out.data_rescisao && !resc) {
    alertas.push(`Data de rescisão inválida ("${out.data_rescisao}") — desconsiderada nos cálculos.`);
    delete out.data_rescisao;
  }
  if (adm && resc && resc < adm) {
    alertas.push(
      `Data de rescisão (${fmt(resc)}) anterior à admissão (${fmt(adm)}) — datas desconsideradas até correção.`
    );
    delete out.data_rescisao;
  }
  if (adm && adm > hoje) {
    alertas.push(`Data de admissão (${fmt(adm)}) está no futuro — confirme.`);
  }
  if (resc && resc > hoje) {
    alertas.push(
      `Data de rescisão (${fmt(resc)}) está no futuro — os avos de 13º/férias e o saldo de salário serão calculados até essa data; confirme.`
    );
  }

  const salario = Number(out.salario);
  if (out.salario != null && !(Number.isFinite(salario) && salario > 0)) {
    alertas.push('Salário inválido — desconsiderado nos cálculos.');
    delete out.salario;
  }
  const maior = Number(out.maior_remuneracao);
  if (Number.isFinite(maior) && Number.isFinite(salario) && maior < salario) {
    alertas.push('Maior remuneração informada é menor que o salário — usando o salário como base do dano moral.');
    delete out.maior_remuneracao;
  }
  if (out.tem_desvio && out.tem_acumulo) {
    alertas.push(
      'Desvio e acúmulo de função marcados juntos — mantido apenas o DESVIO (cumular sobre os mesmos fatos é vedado).'
    );
    out.tem_acumulo = false;
  }

  return { caso: out, alertas };
}