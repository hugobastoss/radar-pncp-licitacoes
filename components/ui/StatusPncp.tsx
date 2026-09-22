"use client";

import { useStatusPncp } from "@/lib/hooks/useStatusPncp";
import type { NivelStatusPncp } from "@/lib/hooks/useStatusPncp";
import { cn } from "@/lib/cn";

const ROTULO: Record<NivelStatusPncp, string> = {
  verificando: "Verificando…",
  operacional: "Operacional",
  instavel: "Instável",
  indisponivel: "Indisponível",
};

const DESCRICAO: Record<NivelStatusPncp, string> = {
  verificando: "Consultando a disponibilidade do PNCP.",
  operacional: "A fonte principal de dados do PNCP está respondendo normalmente.",
  instavel: "A fonte principal está fora do ar; usando a fonte de contingência (respostas mais lentas).",
  indisponivel: "As duas fontes de dados do PNCP estão fora do ar no momento.",
};

const COR_PONTO: Record<NivelStatusPncp, string> = {
  verificando: "bg-ink-300 dark:bg-ink-600",
  operacional: "bg-success-600",
  instavel: "bg-warning-600",
  indisponivel: "bg-danger-600",
};

interface StatusPncpProps {
  variante?: "compacta" | "linha";
}

export function StatusPncp({ variante = "compacta" }: StatusPncpProps) {
  const nivel = useStatusPncp();

  if (variante === "linha") {
    return (
      <div className="flex items-center justify-between text-sm">
        <span className="text-ink-600 dark:text-ink-300">Status do PNCP</span>
        <span className="flex items-center gap-1.5 font-medium text-ink-900 dark:text-ink-50" title={DESCRICAO[nivel]}>
          <span className={cn("h-2 w-2 rounded-full", COR_PONTO[nivel])} aria-hidden />
          {ROTULO[nivel]}
        </span>
      </div>
    );
  }

  return (
    <span
      className="hidden items-center gap-1.5 rounded-full border border-ink-200 px-2.5 py-1 text-xs font-medium text-ink-500 dark:border-ink-700 dark:text-ink-400 sm:inline-flex"
      title={DESCRICAO[nivel]}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", COR_PONTO[nivel])} aria-hidden />
      PNCP
    </span>
  );
}
