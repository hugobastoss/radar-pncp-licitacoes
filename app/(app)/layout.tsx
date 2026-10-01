import type { ReactNode } from "react";
import { Footer } from "@/components/Footer";
import { Sidebar } from "@/components/Sidebar";

/** Ferramentas: menu lateral à esquerda (só no computador) e a tela à direita. */
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex">
      <Sidebar />
      {/* min-h: o menu é `fixed` e cobre toda a altura da tela (ver Sidebar.tsx) — sem
          essa altura mínima aqui, o rodapé de uma tela curta apareceria por baixo dele. */}
      <div className="flex min-h-[calc(100dvh-6rem)] min-w-0 flex-1 flex-col lg:ml-60 lg:menu-recolhido-fora:ml-16">
        <div className="mx-auto w-full max-w-7xl flex-1">{children}</div>
        <Footer />
      </div>
    </div>
  );
}
