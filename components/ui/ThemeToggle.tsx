"use client";

import { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/cn";
import { CHAVE_TEMA_STORAGE } from "@/lib/theme";

const ouvintes = new Set<() => void>();

function inscrever(callback: () => void) {
  ouvintes.add(callback);
  return () => ouvintes.delete(callback);
}

/** Lê a classe "dark" da <html> — fonte da verdade única, já aplicada pelo script inline antes da hidratação. */
function lerEstadoEscuro() {
  return document.documentElement.classList.contains("dark");
}

function lerEstadoNoServidor() {
  return false;
}

function definirTema(escuro: boolean) {
  document.documentElement.classList.toggle("dark", escuro);
  try {
    localStorage.setItem(CHAVE_TEMA_STORAGE, escuro ? "dark" : "light");
  } catch {
    // localStorage indisponível (modo privado etc.) — a preferência só não persiste.
  }
  for (const ouvinte of ouvintes) ouvinte();
}

interface ThemeToggleProps {
  className?: string;
  variante?: "icone" | "linha";
}

/**
 * Todas as instâncias (header desktop, menu mobile, popover de configurações)
 * compartilham o mesmo estado via useSyncExternalStore, então alternar em
 * uma atualiza as demais. No servidor sempre reporta "claro" (getServerSnapshot);
 * o React corrige para o valor real do DOM logo após montar, sem o
 * anti-padrão de setState dentro de useEffect.
 */
export function ThemeToggle({ className, variante = "icone" }: ThemeToggleProps) {
  const escuro = useSyncExternalStore(inscrever, lerEstadoEscuro, lerEstadoNoServidor);

  function alternar() {
    definirTema(!escuro);
  }

  if (variante === "linha") {
    return (
      <button
        type="button"
        onClick={alternar}
        aria-pressed={escuro}
        className={cn(
          "flex w-full items-center justify-between text-sm font-medium text-ink-700 dark:text-ink-200",
          className,
        )}
      >
        <span>Modo escuro</span>
        {escuro ? (
          <Sun className="h-5 w-5 text-ink-500 dark:text-ink-400" aria-hidden />
        ) : (
          <Moon className="h-5 w-5 text-ink-500 dark:text-ink-400" aria-hidden />
        )}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={alternar}
      aria-label={escuro ? "Ativar modo claro" : "Ativar modo escuro"}
      aria-pressed={escuro}
      className={cn(
        "rounded-lg p-2 text-ink-500 hover:bg-ink-100 hover:text-ink-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500",
        "dark:text-ink-400 dark:hover:bg-ink-800 dark:hover:text-ink-200",
        className,
      )}
    >
      {escuro ? <Sun className="h-5 w-5" aria-hidden /> : <Moon className="h-5 w-5" aria-hidden />}
    </button>
  );
}
