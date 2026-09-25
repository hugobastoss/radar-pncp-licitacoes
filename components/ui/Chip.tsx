"use client";

import type { ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";

interface ChipProps {
  ativo: boolean;
  onClick: () => void;
  /** Quando definido e `ativo`, mostra um "x" que chama isso em vez de `onClick` — usado na seleção única. */
  onLimpar?: () => void;
  children: ReactNode;
}

export function Chip({ ativo, onClick, onLimpar, children }: ChipProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border text-sm font-medium transition-colors",
        ativo
          ? "border-primary-600 bg-primary-600 text-white"
          : "border-ink-200 bg-white text-ink-700 hover:bg-ink-50 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-200 dark:hover:bg-ink-800",
      )}
    >
      <button
        type="button"
        onClick={onClick}
        aria-pressed={ativo}
        className={cn(
          "rounded-full py-1.5 pl-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500",
          ativo && onLimpar ? "pr-1.5" : "pr-3",
        )}
      >
        {children}
      </button>
      {ativo && onLimpar && (
        <button
          type="button"
          onClick={onLimpar}
          aria-label="Remover filtro"
          className="mr-1.5 flex h-4 w-4 items-center justify-center rounded-full hover:bg-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          <X className="h-3 w-3" aria-hidden />
        </button>
      )}
    </span>
  );
}

interface OpcaoChip {
  value: string;
  label: string;
}

interface ChipsSelecaoUnicaProps {
  label: string;
  hint?: string;
  options: OpcaoChip[];
  value?: string;
  onChange: (value: string | undefined) => void;
  semFiltroLabel?: string;
  /** false quando sempre precisa haver uma opção selecionada (sem chip "sem filtro" nem "x" pra limpar). */
  permitirLimpar?: boolean;
}

/** Chips de seleção única — clicar em outro chip troca a seleção; o "x" ou o chip "sem filtro" limpam. */
export function ChipsSelecaoUnica({
  label,
  hint,
  options,
  value,
  onChange,
  semFiltroLabel = "Sem filtro",
  permitirLimpar = true,
}: ChipsSelecaoUnicaProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium uppercase tracking-wide text-ink-500 dark:text-ink-400">{label}</span>
      <div className="flex flex-wrap gap-2">
        {permitirLimpar && (
          <Chip ativo={!value} onClick={() => onChange(undefined)}>
            {semFiltroLabel}
          </Chip>
        )}
        {options.map((opcao) => (
          <Chip
            key={opcao.value}
            ativo={value === opcao.value}
            onClick={() => onChange(opcao.value)}
            onLimpar={permitirLimpar ? () => onChange(undefined) : undefined}
          >
            {opcao.label}
          </Chip>
        ))}
      </div>
      {hint && <p className="text-xs text-ink-500 dark:text-ink-400">{hint}</p>}
    </div>
  );
}

interface ChipsSelecaoMultiplaProps {
  label: string;
  hint?: string;
  options: OpcaoChip[];
  selected: string[];
  onChange: (next: string[]) => void;
  allLabel?: string;
}

/** Chips de seleção múltipla — cada chip alterna independentemente, sem afetar os demais. */
export function ChipsSelecaoMultipla({
  label,
  hint,
  options,
  selected,
  onChange,
  allLabel = "Todos",
}: ChipsSelecaoMultiplaProps) {
  function alternar(value: string) {
    onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value]);
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium uppercase tracking-wide text-ink-500 dark:text-ink-400">{label}</span>
      <div className="flex flex-wrap gap-2">
        <Chip ativo={selected.length === 0} onClick={() => onChange([])}>
          {allLabel}
        </Chip>
        {options.map((opcao) => (
          <Chip key={opcao.value} ativo={selected.includes(opcao.value)} onClick={() => alternar(opcao.value)}>
            {opcao.label}
          </Chip>
        ))}
      </div>
      {hint && <p className="text-xs text-ink-500 dark:text-ink-400">{hint}</p>}
    </div>
  );
}
