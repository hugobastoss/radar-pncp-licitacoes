"use client";

import { useId, useState } from "react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface TabItem {
  value: string;
  label: string;
  content: ReactNode;
}

interface TabsProps {
  items: TabItem[];
  defaultValue?: string;
  /** No root (flex-col) — ex.: "flex-1" pra esticar o conteúdo até a altura do pai. */
  className?: string;
}

/** Abas simples (sem navegação por URL) — usado quando o conteúdo de cada aba já está todo carregado. */
export function Tabs({ items, defaultValue, className }: TabsProps) {
  const [ativa, setAtiva] = useState(defaultValue ?? items[0]?.value ?? "");
  const id = useId();

  return (
    <div className={cn("flex flex-col", className)}>
      <div role="tablist" className="flex shrink-0 gap-1 border-b border-ink-200 dark:border-ink-700">
        {items.map((item) => {
          const selecionada = item.value === ativa;
          return (
            <button
              key={item.value}
              type="button"
              role="tab"
              id={`${id}-tab-${item.value}`}
              aria-selected={selecionada}
              aria-controls={`${id}-panel-${item.value}`}
              onClick={() => setAtiva(item.value)}
              className={cn(
                "-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors",
                selecionada
                  ? "border-primary-600 text-primary-700 dark:border-primary-400 dark:text-primary-300"
                  : "border-transparent text-ink-500 hover:text-ink-900 dark:text-ink-400 dark:hover:text-ink-50",
              )}
            >
              {item.label}
            </button>
          );
        })}
      </div>
      <div className="scrollbar-fina min-h-0 flex-1 overflow-y-auto">
        {items.map((item) => (
          <div
            key={item.value}
            role="tabpanel"
            id={`${id}-panel-${item.value}`}
            aria-labelledby={`${id}-tab-${item.value}`}
            hidden={item.value !== ativa}
            className="h-full pt-4"
          >
            {item.content}
          </div>
        ))}
      </div>
    </div>
  );
}
