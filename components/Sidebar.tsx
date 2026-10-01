"use client";

import { useSyncExternalStore } from "react";
import { ChevronsLeft } from "lucide-react";
import { MenuFerramentas } from "@/components/MenuFerramentas";
import {
  definirMenuRecolhido,
  inscreverMenuRecolhido,
  lerMenuRecolhido,
  lerMenuRecolhidoNoServidor,
} from "@/lib/menu-lateral";

/**
 * Menu lateral do computador (a partir de 1024 px). Abaixo disso o mesmo
 * menu abre na gaveta do cabeçalho (components/Header.tsx). A largura do
 * modo recolhido vem do CSS (variante menu-recolhido); o estado aqui só
 * serve pro aria-expanded, o rótulo do botão e o title dos itens.
 */
export function Sidebar() {
  const recolhido = useSyncExternalStore(inscreverMenuRecolhido, lerMenuRecolhido, lerMenuRecolhidoNoServidor);
  const rotulo = recolhido ? "Expandir menu" : "Recolher menu";

  return (
    <aside
      data-lateral
      className="scrollbar-fina hidden w-60 overflow-y-auto border-r border-ink-200 bg-white transition-[width] duration-200 dark:border-ink-700 dark:bg-ink-900 lg:fixed lg:top-24 lg:left-0 lg:z-30 lg:block lg:h-[calc(100dvh-6rem)] menu-recolhido:w-16"
    >
      <div className="flex justify-end px-2 pt-3 menu-recolhido:justify-center">
        <button
          type="button"
          onClick={() => definirMenuRecolhido(!recolhido)}
          aria-expanded={!recolhido}
          aria-controls="menu-lateral"
          aria-label={rotulo}
          title={rotulo}
          className="rounded-lg p-1.5 text-ink-500 hover:bg-ink-100 hover:text-ink-700 dark:text-ink-400 dark:hover:bg-ink-800 dark:hover:text-ink-200"
        >
          <ChevronsLeft className="h-4 w-4 transition-transform menu-recolhido:rotate-180" aria-hidden />
        </button>
      </div>
      <div id="menu-lateral" className="px-3 pb-6 menu-recolhido:px-2">
        <MenuFerramentas recolhido={recolhido} />
      </div>
    </aside>
  );
}
