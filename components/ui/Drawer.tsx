"use client";

import { useEffect, useId, useRef } from "react";
import type { ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";

interface DrawerProps {
  aberto: boolean;
  onFechar: () => void;
  titulo: string;
  children: ReactNode;
  rodape?: ReactNode;
}

const SELETOR_FOCAVEIS =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

export function Drawer({ aberto, onFechar, titulo, children, rodape }: DrawerProps) {
  const painelRef = useRef<HTMLDivElement>(null);
  const tituloId = useId();

  useEffect(() => {
    if (!aberto) return;

    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function aoTeclar(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onFechar();
        return;
      }
      if (e.key === "Tab" && painelRef.current) {
        const focaveis = painelRef.current.querySelectorAll<HTMLElement>(SELETOR_FOCAVEIS);
        if (focaveis.length === 0) return;
        const primeiro = focaveis[0];
        const ultimo = focaveis[focaveis.length - 1];
        if (e.shiftKey && document.activeElement === primeiro) {
          e.preventDefault();
          ultimo.focus();
        } else if (!e.shiftKey && document.activeElement === ultimo) {
          e.preventDefault();
          primeiro.focus();
        }
      }
    }

    document.addEventListener("keydown", aoTeclar);
    const timer = setTimeout(() => painelRef.current?.focus(), 0);

    return () => {
      document.body.style.overflow = overflowAnterior;
      document.removeEventListener("keydown", aoTeclar);
      clearTimeout(timer);
    };
  }, [aberto, onFechar]);

  if (!aberto) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        aria-label={`Fechar ${titulo.toLowerCase()}`}
        className="absolute inset-0 bg-ink-900/40 dark:bg-black/60"
        onClick={onFechar}
      />
      <div
        ref={painelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={tituloId}
        tabIndex={-1}
        className={cn(
          "relative flex h-full w-full flex-col bg-white shadow-drawer outline-none dark:bg-ink-900",
          "sm:max-w-lg",
        )}
      >
        <div className="flex items-center justify-between border-b border-ink-200 px-5 py-4 dark:border-ink-700">
          <h2 id={tituloId} className="text-base font-semibold text-ink-900 dark:text-ink-50">
            {titulo}
          </h2>
          <button
            type="button"
            onClick={onFechar}
            aria-label="Fechar"
            className="rounded-md p-1.5 text-ink-500 hover:bg-ink-100 hover:text-ink-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:text-ink-400 dark:hover:bg-ink-800 dark:hover:text-ink-200"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {rodape && <div className="border-t border-ink-200 px-5 py-4 dark:border-ink-700">{rodape}</div>}
      </div>
    </div>
  );
}
