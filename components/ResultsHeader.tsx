"use client";

import { Info, Loader2 } from "lucide-react";
import { formatarDataHora } from "@/lib/formatters";

interface ResultsHeaderProps {
  consultadoEm: string;
  atualizando?: boolean;
  parcial?: boolean;
}

export function ResultsHeader({ consultadoEm, atualizando, parcial }: ResultsHeaderProps) {
  return (
    <div className="flex flex-col gap-1 border-b border-ink-200 px-4 py-4 dark:border-ink-700 sm:px-6">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-base font-semibold text-ink-900 dark:text-ink-50">Resultado da pesquisa</h2>
        {atualizando && (
          <span className="inline-flex items-center gap-1 text-xs text-primary-600 dark:text-primary-400">
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            Atualizando…
          </span>
        )}
        {parcial && !atualizando && (
          <span
            className="inline-flex items-center gap-1 rounded-full bg-warning-50 px-2 py-0.5 text-xs font-medium text-warning-700 dark:bg-warning-900 dark:text-warning-300"
            title="O PNCP retornou mais licitações do que conseguimos carregar de uma vez. Refine a busca (palavra-chave, estado ou modalidade) para ver um recorte mais completo."
          >
            <Info className="h-3 w-3" aria-hidden />
            Resultado parcial
          </span>
        )}
      </div>
      <p className="text-xs text-ink-500 dark:text-ink-400">
        Consulta realizada diretamente no PNCP em {formatarDataHora(consultadoEm)}.
      </p>
    </div>
  );
}
