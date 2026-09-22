"use client";

import { useRef, useState } from "react";
import type { ComponentType } from "react";
import * as Collapsible from "@radix-ui/react-collapsible";
import {
  Ambulance,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  FlaskConical,
  HeartPulse,
  Pill,
  ShieldCheck,
  Smile,
  SprayCan,
  Stethoscope,
  Syringe,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { PESQUISAS_RAPIDAS, type PesquisaRapida } from "@/lib/data/dominio";
import { cn } from "@/lib/cn";

const ICONE_POR_ID: Record<string, ComponentType<{ className?: string }>> = {
  medicamentos: Pill,
  hospitalar: HeartPulse,
  odontologico: Smile,
  laboratorio: FlaskConical,
  equipamentos_medicos: Stethoscope,
  epi: ShieldCheck,
  vacinas: Syringe,
  limpeza: SprayCan,
  ambulancias: Ambulance,
};

interface QuickSearchesProps {
  onSelecionar: (pesquisa: PesquisaRapida) => void;
  idAtivo?: string;
}

export function QuickSearches({ onSelecionar, idAtivo }: QuickSearchesProps) {
  const [aberto, setAberto] = useState(false);
  const [podeVoltar, setPodeVoltar] = useState(false);
  const [podeAvancar, setPodeAvancar] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  function atualizarSetas() {
    const el = scrollRef.current;
    if (!el) return;
    setPodeVoltar(el.scrollLeft > 4);
    setPodeAvancar(el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
  }

  function rolar(direcao: -1 | 1) {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: direcao * el.clientWidth * 0.8, behavior: "smooth" });
  }

  const CLASSE_SETA =
    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-ink-200 text-ink-500 hover:bg-ink-50 hover:text-ink-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent dark:border-ink-700 dark:text-ink-400 dark:hover:bg-ink-800 dark:hover:text-ink-200";

  return (
    <Collapsible.Root
      open={aberto}
      onOpenChange={(proximo) => {
        setAberto(proximo);
        if (proximo) requestAnimationFrame(atualizarSetas);
      }}
    >
      <h2>
        <Collapsible.Trigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="md"
            leftIcon={<Zap className="h-4 w-4" aria-hidden />}
            rightIcon={
              aberto ? (
                <ChevronUp className="h-4 w-4" aria-hidden />
              ) : (
                <ChevronDown className="h-4 w-4" aria-hidden />
              )
            }
          >
            Pesquisas rápidas
          </Button>
        </Collapsible.Trigger>
      </h2>

      <Collapsible.Content className="overflow-hidden data-[state=open]:animate-[collapsible-down_200ms_ease-out] data-[state=closed]:animate-[collapsible-up_200ms_ease-out]">
        <div className="mt-2 flex items-center gap-2">
          <button
            type="button"
            onClick={() => rolar(-1)}
            disabled={!podeVoltar}
            aria-label="Ver pesquisas anteriores"
            className={CLASSE_SETA}
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
          </button>

          <div
            ref={scrollRef}
            onScroll={atualizarSetas}
            className="flex flex-1 gap-2 overflow-x-auto scroll-smooth scrollbar-oculta snap-x snap-mandatory"
          >
            {PESQUISAS_RAPIDAS.map((pesquisa) => {
              const Icone = ICONE_POR_ID[pesquisa.id] ?? Pill;
              const ativo = idAtivo === pesquisa.id;
              return (
                <button
                  key={pesquisa.id}
                  type="button"
                  onClick={() => onSelecionar(pesquisa)}
                  className={cn(
                    "flex shrink-0 basis-[calc((100%-2rem)/5)] snap-start flex-col items-start gap-1 rounded-lg border bg-white p-2.5 text-left transition-all duration-150",
                    "hover:-translate-y-0.5 hover:border-primary-300 hover:shadow-card-hover dark:hover:border-primary-700",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500",
                    "dark:bg-ink-900",
                    ativo
                      ? "border-primary-300 ring-1 ring-primary-200 dark:border-primary-700 dark:ring-primary-800"
                      : "border-ink-200 shadow-card dark:border-ink-700",
                  )}
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary-50 text-primary-600 dark:bg-primary-900 dark:text-primary-400">
                    <Icone className="h-4 w-4" aria-hidden />
                  </span>
                  <span className="text-xs font-semibold text-ink-900 dark:text-ink-50">{pesquisa.titulo}</span>
                  <span className="text-xs text-ink-500 dark:text-ink-400">{pesquisa.descricao}</span>
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => rolar(1)}
            disabled={!podeAvancar}
            aria-label="Ver mais pesquisas"
            className={CLASSE_SETA}
          >
            <ChevronRight className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </Collapsible.Content>
    </Collapsible.Root>
  );
}
