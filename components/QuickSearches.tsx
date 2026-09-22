"use client";

import type { ComponentType } from "react";
import { FlaskConical, HeartPulse, Pill, Smile } from "lucide-react";
import { PESQUISAS_RAPIDAS, type PesquisaRapida } from "@/lib/data/dominio";
import { cn } from "@/lib/cn";

const ICONE_POR_ID: Record<string, ComponentType<{ className?: string }>> = {
  medicamentos: Pill,
  hospitalar: HeartPulse,
  odontologico: Smile,
  laboratorio: FlaskConical,
};

interface QuickSearchesProps {
  onSelecionar: (pesquisa: PesquisaRapida) => void;
  idAtivo?: string;
}

export function QuickSearches({ onSelecionar, idAtivo }: QuickSearchesProps) {
  return (
    <section aria-labelledby="pesquisas-rapidas-titulo">
      <h2 id="pesquisas-rapidas-titulo" className="text-sm font-semibold text-ink-700">
        Pesquisas rápidas
      </h2>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {PESQUISAS_RAPIDAS.map((pesquisa) => {
          const Icone = ICONE_POR_ID[pesquisa.id] ?? Pill;
          const ativo = idAtivo === pesquisa.id;
          return (
            <button
              key={pesquisa.id}
              type="button"
              onClick={() => onSelecionar(pesquisa)}
              className={cn(
                "flex flex-col items-start gap-2 rounded-xl border bg-white p-4 text-left transition-shadow duration-150",
                "hover:shadow-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500",
                ativo ? "border-primary-300 ring-1 ring-primary-200" : "border-ink-200 shadow-card",
              )}
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-50 text-primary-600">
                <Icone className="h-5 w-5" aria-hidden />
              </span>
              <span className="text-sm font-semibold text-ink-900">{pesquisa.titulo}</span>
              <span className="text-xs text-ink-500">{pesquisa.descricao}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
