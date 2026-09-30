/**
 * Menu lateral recolhido (só ícones) no computador. A fonte da verdade é o
 * atributo data-menu do <html>, aplicado antes da hidratação pelo script
 * abaixo, então a coluna já nasce com a largura certa. O CSS lê o atributo
 * pela variante `menu-recolhido:` (app/globals.css).
 */
export const CHAVE_MENU_STORAGE = "radar-pncp-menu-recolhido";

/** Roda junto do script do tema (app/layout.tsx), antes da hidratação. */
export const SCRIPT_INICIALIZACAO_MENU = `
(function () {
  try {
    if (localStorage.getItem(${JSON.stringify(CHAVE_MENU_STORAGE)}) === "1") {
      document.documentElement.dataset.menu = "recolhido";
    }
  } catch (e) {}
})();
`;

const ouvintes = new Set<() => void>();

export function inscreverMenuRecolhido(callback: () => void) {
  ouvintes.add(callback);
  return () => {
    ouvintes.delete(callback);
  };
}

export function lerMenuRecolhido(): boolean {
  return document.documentElement.dataset.menu === "recolhido";
}

export function lerMenuRecolhidoNoServidor(): boolean {
  return false;
}

export function definirMenuRecolhido(recolhido: boolean) {
  const { dataset } = document.documentElement;
  if (recolhido) dataset.menu = "recolhido";
  else delete dataset.menu;
  try {
    if (recolhido) localStorage.setItem(CHAVE_MENU_STORAGE, "1");
    else localStorage.removeItem(CHAVE_MENU_STORAGE);
  } catch {
    // localStorage indisponível (modo privado etc.): vale só até recarregar.
  }
  for (const ouvinte of ouvintes) ouvinte();
}
