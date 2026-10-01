"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { History } from "lucide-react";
import {
  inscreverEmpresasRecentes,
  lerEmpresasRecentes,
  lerEmpresasRecentesNoServidor,
  limparEmpresasRecentes,
} from "@/lib/empresas-recentes";
import { formatarCnpj } from "@/lib/formatters";

/**
 * Últimos CNPJs consultados, como bloco lateral da própria tela de CNPJ (não
 * mais no menu lateral — ver lib/empresas-recentes.ts pra onde os dados
 * ficam guardados, só no navegador).
 */
export function ConsultasRecentesCard({ className }: { className?: string }) {
  const recentes = useSyncExternalStore(inscreverEmpresasRecentes, lerEmpresasRecentes, lerEmpresasRecentesNoServidor);
  if (recentes.length === 0) return null;

  return (
    <div className={className}>
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-ink-500 dark:text-ink-400">
          <History className="h-3.5 w-3.5" aria-hidden />
          Consultas recentes
        </p>
        <button
          type="button"
          onClick={limparEmpresasRecentes}
          aria-label="Limpar consultas recentes"
          className="rounded text-xs font-medium text-ink-500 hover:text-ink-900 dark:text-ink-400 dark:hover:text-ink-50"
        >
          Limpar
        </button>
      </div>
      <ul className="mt-3 space-y-2">
        {recentes.map((e) => (
          <li key={e.cnpj}>
            <Link
              href={`/cnpj?cnpj=${e.cnpj}`}
              className="block rounded-lg px-2 py-1.5 -mx-2 hover:bg-ink-100 dark:hover:bg-ink-800"
            >
              <span className="block truncate text-sm font-medium text-ink-900 dark:text-ink-50">{e.nome}</span>
              <span className="block text-xs tabular-nums text-ink-500 dark:text-ink-400">{formatarCnpj(e.cnpj)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
