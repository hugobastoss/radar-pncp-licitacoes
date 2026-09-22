export const CHAVE_TEMA_STORAGE = "radar-pncp-theme";

/**
 * Executado como script inline (`beforeInteractive`) em app/layout.tsx,
 * antes da hidratação — aplica a classe "dark" o mais cedo possível para
 * evitar o flash do tema claro em quem prefere escuro.
 */
export const SCRIPT_INICIALIZACAO_TEMA = `
(function () {
  try {
    var chave = ${JSON.stringify(CHAVE_TEMA_STORAGE)};
    var salvo = localStorage.getItem(chave);
    var escuro = salvo ? salvo === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
    document.documentElement.classList.toggle("dark", escuro);
  } catch (e) {}
})();
`;
