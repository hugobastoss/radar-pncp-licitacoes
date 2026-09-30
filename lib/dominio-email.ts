/**
 * Domínio de um e-mail que vale consultar no registro.br: só `.br` (é o que o
 * registro.br responde) e só domínio próprio — o de um provedor de e-mail
 * diria quem é o provedor, não a empresa.
 */
const PROVEDORES_DE_EMAIL = [
  "uol.com.br",
  "bol.com.br",
  "terra.com.br",
  "ig.com.br",
  "yahoo.com.br",
  "hotmail.com.br",
  "outlook.com.br",
  "live.com.br",
  "msn.com.br",
  "globo.com.br",
  "zipmail.com.br",
  "oi.com.br",
  "r7.com.br",
];

const FORMATO_DOMINIO_BR = /^([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+br$/;

/** Um nome de domínio `.br` bem formado (em minúsculas). Usado pela rota antes de consultar o registro.br. */
export function ehDominioBr(dominio: string): boolean {
  return dominio.length <= 253 && FORMATO_DOMINIO_BR.test(dominio);
}

export function dominioDoEmail(email: string | undefined): string | undefined {
  const partes = (email ?? "").trim().toLowerCase().split("@");
  if (partes.length !== 2 || !partes[0]) return undefined;
  const dominio = partes[1];
  if (!FORMATO_DOMINIO_BR.test(dominio)) return undefined;
  if (PROVEDORES_DE_EMAIL.some((provedor) => dominio === provedor || dominio.endsWith(`.${provedor}`))) return undefined;
  return dominio;
}
