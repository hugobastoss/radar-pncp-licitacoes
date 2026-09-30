/**
 * Regras do número de processo judicial, padrão CNJ (Resolução 65/2008):
 * NNNNNNN-DD.AAAA.J.TR.OOOO (20 dígitos). Só validamos o formato (7+2+4+1+2+4
 * dígitos) — o dígito verificador usa módulo 97 de base 11, e não o
 * conferimos aqui pra não arriscar rejeitar um número real por um cálculo
 * não testado contra casos reais; a própria consulta ao DataJud já diz se o
 * processo existe.
 */

export function normalizarNumeroProcesso(valor: string): string {
  return valor.replace(/\D/g, "");
}

export type ValidacaoNumeroProcesso = { valido: true; numero: string } | { valido: false; mensagem: string };

export function validarNumeroProcesso(valor: string): ValidacaoNumeroProcesso {
  const numero = normalizarNumeroProcesso(valor);
  if (numero.length !== 20) {
    return { valido: false, mensagem: "Número de processo incompleto. Informe os 20 dígitos." };
  }
  return { valido: true, numero };
}

/** "00008323520234013202" → "0000832-35.2023.4.01.3202". */
export function formatarNumeroProcesso(numero: string | undefined): string | undefined {
  if (!numero) return undefined;
  const d = numero.replace(/\D/g, "");
  if (d.length !== 20) return numero;
  return `${d.slice(0, 7)}-${d.slice(7, 9)}.${d.slice(9, 13)}.${d.slice(13, 14)}.${d.slice(14, 16)}.${d.slice(16, 20)}`;
}

/** Máscara de número de processo aplicada enquanto o usuário digita. */
export function mascararNumeroProcesso(valor: string): string {
  const d = valor.replace(/\D/g, "").slice(0, 20);
  if (d.length <= 7) return d;
  if (d.length <= 9) return `${d.slice(0, 7)}-${d.slice(7)}`;
  if (d.length <= 13) return `${d.slice(0, 7)}-${d.slice(7, 9)}.${d.slice(9)}`;
  if (d.length <= 14) return `${d.slice(0, 7)}-${d.slice(7, 9)}.${d.slice(9, 13)}.${d.slice(13)}`;
  if (d.length <= 16) return `${d.slice(0, 7)}-${d.slice(7, 9)}.${d.slice(9, 13)}.${d.slice(13, 14)}.${d.slice(14)}`;
  return `${d.slice(0, 7)}-${d.slice(7, 9)}.${d.slice(9, 13)}.${d.slice(13, 14)}.${d.slice(14, 16)}.${d.slice(16)}`;
}
