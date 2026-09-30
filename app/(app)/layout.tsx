import type { ReactNode } from "react";
import { Sidebar } from "@/components/Sidebar";

/** Ferramentas: menu lateral à esquerda (só no computador) e a tela à direita. */
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex">
      <Sidebar />
      <div className="min-w-0 flex-1">
        <div className="mx-auto max-w-7xl">{children}</div>
      </div>
    </div>
  );
}
