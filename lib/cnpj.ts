/**
 * Regras do CNPJ, usadas tanto no navegador quanto no servidor.
 *
 * Desde julho de 2026 a Receita Federal emite CNPJ alfanumérico (IN RFB
 * 2.229/2024): as 12 primeiras posições podem ter letras (A–Z) e só os 2
 * dígitos verificadores continuam numéricos. Os CNPJs só numéricos seguem
 * válidos pela mesma regra — por isso nada aqui pode descartar letras
 * (o antigo `replace(/\D/g, "")` transformava `12.ABC.345/01DE-35` em
 * `123450135`).
 */

/** Tira pontuação e espaços e passa pra maiúsculas, mantendo as letras. */
export function normalizarCnpj(valor: string): string {
  return valor.toUpperCase().replace(/[^0-9A-Z]/g, "");
}

const FORMATO_CNPJ = /^[0-9A-Z]{12}[0-9]{2}$/;

/**
 * Módulo 11 com pesos de 2 a 9 da direita pra esquerda. Cada caractere vale
 * o código ASCII menos 48 ("0"–"9" → 0–9, "A" → 17, "B" → 18…) — é a regra
 * da Receita pro alfanumérico e dá o mesmo resultado do cálculo antigo pra
 * CNPJ só numérico.
 */
function digitoVerificador(base: string): number {
  let soma = 0;
  let peso = 2;
  for (let i = base.length - 1; i >= 0; i--) {
    soma += (base.charCodeAt(i) - 48) * peso;
    peso = peso === 9 ? 2 : peso + 1;
  }
  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
}

export type ValidacaoCnpj = { valido: true; cnpj: string } | { valido: false; mensagem: string };

const INVALIDO: ValidacaoCnpj = { valido: false, mensagem: "CNPJ inválido. Confira o número digitado." };

/** Valida formato e dígitos verificadores; quando válido, devolve o CNPJ normalizado. */
export function validarCnpj(valor: string): ValidacaoCnpj {
  const cnpj = normalizarCnpj(valor);

  if (cnpj.length !== 14) {
    return { valido: false, mensagem: "CNPJ incompleto. Informe os 14 caracteres." };
  }
  // Sequências repetidas (00000000000000, 11111111111111…) passam no cálculo, mas a Receita não emite.
  if (!FORMATO_CNPJ.test(cnpj) || /^(.)\1+$/.test(cnpj)) return INVALIDO;

  const base = cnpj.slice(0, 12);
  const primeiro = digitoVerificador(base);
  const segundo = digitoVerificador(`${base}${primeiro}`);
  if (cnpj.slice(12) !== `${primeiro}${segundo}`) return INVALIDO;

  return { valido: true, cnpj };
}
