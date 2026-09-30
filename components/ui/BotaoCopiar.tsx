"use client";

import { useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Ícone que copia um texto pra área de transferência. Depois de copiar, vira
 * um "✓" por 2 s e avisa o leitor de tela ("Copiado").
 */
export function BotaoCopiar({ texto, rotulo, className }: { texto: string; rotulo: string; className?: string }) {
  const [estado, setEstado] = useState<"parado" | "copiado" | "falhou">("parado");

  useEffect(() => {
    if (estado === "parado") return;
    const timer = setTimeout(() => setEstado("parado"), 2000);
    return () => clearTimeout(timer);
  }, [estado]);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto);
      setEstado("copiado");
    } catch {
      // Sem permissão de área de transferência (página sem HTTPS, navegador bloqueando).
      setEstado("falhou");
    }
  }

  return (
    <button
      type="button"
      onClick={copiar}
      aria-label={rotulo}
      title={estado === "copiado" ? "Copiado" : estado === "falhou" ? "Não foi possível copiar" : rotulo}
      className={cn(
        "inline-flex h-6 w-6 items-center justify-center rounded-md text-ink-400 hover:bg-ink-100 hover:text-ink-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:text-ink-500 dark:hover:bg-ink-800 dark:hover:text-ink-200",
        estado === "copiado" && "text-success-600 dark:text-success-300",
        className,
      )}
    >
      {estado === "copiado" ? <Check className="h-3.5 w-3.5" aria-hidden /> : <Copy className="h-3.5 w-3.5" aria-hidden />}
      <span className="sr-only" aria-live="polite">
        {estado === "copiado" ? "Copiado" : estado === "falhou" ? "Não foi possível copiar" : ""}
      </span>
    </button>
  );
}
