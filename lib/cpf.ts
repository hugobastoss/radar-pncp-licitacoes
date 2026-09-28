/** Regras do CPF, usadas tanto no navegador quanto no servidor. */

export function normalizarCpf(valor: string): string {
  return valor.replace(/\D/g, "");
}

/** Módulo 11 com pesos decrescentes a partir de `base.length + 1` (10 pro 1º dígito, 11 pro 2º). */
function digitoVerificador(base: string): number {
  let soma = 0;
  for (let i = 0; i < base.length; i++) soma += Number(base[i]) * (base.length + 1 - i);
  const resto = (soma * 10) % 11;
  return resto === 10 ? 0 : resto;
}

export type ValidacaoCpf = { valido: true; cpf: string } | { valido: false; mensagem: string };

const INVALIDO: ValidacaoCpf = { valido: false, mensagem: "CPF inválido. Confira o número digitado." };

/** Valida formato e dígitos verificadores; quando válido, devolve só os 11 dígitos. */
export function validarCpf(valor: string): ValidacaoCpf {
  const cpf = normalizarCpf(valor);

  if (cpf.length !== 11) {
    return { valido: false, mensagem: "CPF incompleto. Informe os 11 dígitos." };
  }
  // Sequências repetidas (000.000.000-00, 111.111.111-11…) passam no cálculo, mas a Receita não emite.
  if (/^(\d)\1+$/.test(cpf)) return INVALIDO;

  const primeiro = digitoVerificador(cpf.slice(0, 9));
  const segundo = digitoVerificador(cpf.slice(0, 10));
  if (cpf.slice(9) !== `${primeiro}${segundo}`) return INVALIDO;

  return { valido: true, cpf };
}
