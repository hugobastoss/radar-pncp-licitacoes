"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";

export interface OpcaoMultiSelect {
  value: string;
  label: string;
}

interface MultiSelectProps {
  label: string;
  hideLabel?: boolean;
  options: OpcaoMultiSelect[];
  selected: string[];
  onChange: (next: string[]) => void;
  allLabel?: string;
  hint?: string;
}

/**
 * Multiseleção com opção "Todos": `selected` vazio significa "sem filtro"
 * (equivalente a todas as opções). Selecionar um item específico sai do
 * modo "Todos"; remover o último item selecionado volta a ele.
 */
export function MultiSelect({
  label,
  hideLabel,
  options,
  selected,
  onChange,
  allLabel = "Todos",
  hint,
}: MultiSelectProps) {
  const [aberto, setAberto] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const botaoId = useId();
  const painelId = useId();

  useEffect(() => {
    function aoClicarFora(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setAberto(false);
      }
    }
    function aoTeclar(e: globalThis.KeyboardEvent) {
      if (e.key === "Escape") setAberto(false);
    }
    document.addEventListener("mousedown", aoClicarFora);
    document.addEventListener("keydown", aoTeclar);
    return () => {
      document.removeEventListener("mousedown", aoClicarFora);
      document.removeEventListener("keydown", aoTeclar);
    };
  }, []);

  function alternar(value: string) {
    if (selected.includes(value)) {
      onChange(selected.filter((v) => v !== value));
    } else {
      onChange([...selected, value]);
    }
  }

  const rotulo =
    selected.length === 0
      ? allLabel
      : selected.length === 1
        ? (options.find((o) => o.value === selected[0])?.label ?? allLabel)
        : `${selected.length} selecionadas`;

  return (
    <div className="flex flex-col gap-1.5" ref={containerRef}>
      <span id={botaoId} className={cn("text-sm font-medium text-ink-700 dark:text-ink-200", hideLabel && "sr-only")}>
        {label}
      </span>
      <div className="relative">
        <button
          type="button"
          aria-haspopup="listbox"
          aria-expanded={aberto}
          aria-labelledby={`${botaoId} ${botaoId}-valor`}
          onClick={() => setAberto((v) => !v)}
          className={cn(
            "flex h-10 w-full items-center justify-between rounded-lg border border-ink-200 bg-white px-3 text-sm text-ink-900",
            "focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100",
            "dark:border-ink-700 dark:bg-ink-900 dark:text-ink-50 dark:focus:ring-primary-900",
            aberto && "border-primary-500 ring-2 ring-primary-100 dark:ring-primary-900",
          )}
        >
          <span
            id={`${botaoId}-valor`}
            className={cn("truncate text-left", selected.length === 0 && "text-ink-500 dark:text-ink-400")}
          >
            {rotulo}
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 text-ink-400 dark:text-ink-500" aria-hidden />
        </button>

        {aberto && (
          <div
            id={painelId}
            role="listbox"
            aria-multiselectable="true"
            aria-labelledby={botaoId}
            className="absolute z-30 mt-1 max-h-72 w-full min-w-[16rem] overflow-auto rounded-lg border border-ink-200 bg-white py-1 shadow-popover dark:border-ink-700 dark:bg-ink-900"
          >
            <label className="flex cursor-pointer items-center gap-2 border-b border-ink-100 px-3 py-2 text-sm font-medium text-ink-700 hover:bg-ink-50 dark:border-ink-800 dark:text-ink-200 dark:hover:bg-ink-800">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-ink-300 text-primary-600 focus-visible:ring-2 focus-visible:ring-primary-500 dark:border-ink-600 dark:bg-ink-800"
                checked={selected.length === 0}
                onChange={() => onChange([])}
              />
              {allLabel}
            </label>
            {options.map((opcao) => {
              const marcado = selected.includes(opcao.value);
              return (
                <label
                  key={opcao.value}
                  role="option"
                  aria-selected={marcado}
                  className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm text-ink-700 hover:bg-ink-50 dark:text-ink-200 dark:hover:bg-ink-800"
                >
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-ink-300 text-primary-600 focus-visible:ring-2 focus-visible:ring-primary-500 dark:border-ink-600 dark:bg-ink-800"
                    checked={marcado}
                    onChange={() => alternar(opcao.value)}
                  />
                  <span className="flex-1">{opcao.label}</span>
                  {marcado && <Check className="h-4 w-4 text-primary-600 dark:text-primary-400" aria-hidden />}
                </label>
              );
            })}
          </div>
        )}
      </div>
      {hint && <p className="text-xs text-ink-500 dark:text-ink-400">{hint}</p>}
    </div>
  );
}
