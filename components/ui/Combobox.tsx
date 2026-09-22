"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import { cn } from "@/lib/cn";

export interface OpcaoCombobox {
  value: string;
  label: string;
}

interface ComboboxProps {
  label: string;
  hideLabel?: boolean;
  options: OpcaoCombobox[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  emptyMessage?: string;
  disabled?: boolean;
  hint?: string;
}

function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

/**
 * Select pesquisável acessível (padrão combobox), usado para Município —
 * lista que pode ter dezenas de itens (ex.: Pará tem 144 municípios).
 */
export function Combobox({
  label,
  hideLabel,
  options,
  value,
  onChange,
  placeholder = "Selecionar…",
  emptyMessage = "Nenhum resultado encontrado.",
  disabled,
  hint,
}: ComboboxProps) {
  const [aberto, setAberto] = useState(false);
  const [termo, setTermo] = useState("");
  const [indiceAtivo, setIndiceAtivo] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const listaRef = useRef<HTMLUListElement>(null);
  const listboxId = useId();
  const inputId = useId();

  const selecionado = options.find((o) => o.value === value);

  const filtradas = useMemo(() => {
    if (!termo.trim()) return options;
    const alvo = normalizar(termo);
    return options.filter((o) => normalizar(o.label).includes(alvo));
  }, [options, termo]);

  useEffect(() => {
    function aoClicarFora(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setAberto(false);
        setTermo("");
      }
    }
    document.addEventListener("mousedown", aoClicarFora);
    return () => document.removeEventListener("mousedown", aoClicarFora);
  }, []);

  useEffect(() => {
    if (!aberto) return;
    const item = listaRef.current?.children[indiceAtivo] as HTMLElement | undefined;
    item?.scrollIntoView({ block: "nearest" });
  }, [indiceAtivo, aberto]);

  function selecionar(opcao: OpcaoCombobox) {
    onChange(opcao.value);
    setAberto(false);
    setTermo("");
  }

  function aoTeclar(e: KeyboardEvent<HTMLInputElement>) {
    if (!aberto && (e.key === "ArrowDown" || e.key === "Enter")) {
      e.preventDefault();
      setAberto(true);
      setIndiceAtivo(0);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setIndiceAtivo((i) => Math.min(i + 1, filtradas.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setIndiceAtivo((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const opcao = filtradas[indiceAtivo];
      if (opcao) selecionar(opcao);
    } else if (e.key === "Escape") {
      setAberto(false);
      setTermo("");
    }
  }

  const idAtivo = aberto && filtradas[indiceAtivo] ? `${listboxId}-${filtradas[indiceAtivo].value}` : undefined;

  return (
    <div className="flex flex-col gap-1.5" ref={containerRef}>
      <label htmlFor={inputId} className={cn("text-sm font-medium text-ink-700", hideLabel && "sr-only")}>
        {label}
      </label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" aria-hidden />
        <input
          id={inputId}
          role="combobox"
          aria-expanded={aberto}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={idAtivo}
          autoComplete="off"
          disabled={disabled}
          className={cn(
            "h-10 w-full rounded-lg border border-ink-200 bg-white pl-9 pr-9 text-sm text-ink-900 placeholder:text-ink-400",
            "focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100",
            "disabled:bg-ink-50 disabled:text-ink-400",
          )}
          placeholder={placeholder}
          value={aberto ? termo : (selecionado?.label ?? "")}
          onFocus={() => {
            setAberto(true);
            setTermo("");
            setIndiceAtivo(0);
          }}
          onChange={(e) => {
            setTermo(e.target.value);
            setIndiceAtivo(0);
          }}
          onKeyDown={aoTeclar}
        />
        <ChevronDown
          className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400"
          aria-hidden
        />

        {aberto && (
          <ul
            ref={listaRef}
            id={listboxId}
            role="listbox"
            aria-label={label}
            className="absolute z-30 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-ink-200 bg-white py-1 shadow-popover"
          >
            {filtradas.length === 0 && <li className="px-3 py-2 text-sm text-ink-500">{emptyMessage}</li>}
            {filtradas.map((opcao, indice) => (
              <li
                key={opcao.value}
                id={`${listboxId}-${opcao.value}`}
                role="option"
                aria-selected={opcao.value === value}
                onMouseDown={(e) => {
                  e.preventDefault();
                  selecionar(opcao);
                }}
                onMouseEnter={() => setIndiceAtivo(indice)}
                className={cn(
                  "flex cursor-pointer items-center justify-between px-3 py-2 text-sm",
                  indice === indiceAtivo ? "bg-primary-50 text-primary-700" : "text-ink-700",
                )}
              >
                {opcao.label}
                {opcao.value === value && <Check className="h-4 w-4 shrink-0" aria-hidden />}
              </li>
            ))}
          </ul>
        )}
      </div>
      {hint && <p className="text-xs text-ink-500">{hint}</p>}
    </div>
  );
}
