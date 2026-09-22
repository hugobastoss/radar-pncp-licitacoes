"use client";

import { useRef, useState, useSyncExternalStore } from "react";
import Image from "next/image";
import { ChevronDown, ChevronUp, CircleHelp, Clock, Menu, X } from "lucide-react";
import { useClickOutside } from "@/lib/hooks/useClickOutside";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { StatusPncp } from "@/components/ui/StatusPncp";
import { formatarDataHoraCurta } from "@/lib/formatters";

const DICAS_AJUDA = [
  "Digite o que procura e escolha estado e município na pesquisa rápida.",
  "Use a pesquisa avançada para refinar por período, modalidade, portal e valor.",
  "Os resultados vêm diretamente do PNCP no momento da consulta. Nada fica salvo.",
];

function PopoverAjuda() {
  const [aberto, setAberto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, () => setAberto(false), aberto);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-expanded={aberto}
        aria-label="Ajuda"
        className="rounded-lg p-2 text-ink-500 hover:bg-ink-100 hover:text-ink-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:text-ink-400 dark:hover:bg-ink-800 dark:hover:text-ink-200"
      >
        <CircleHelp className="h-5 w-5" aria-hidden />
      </button>
      {aberto && (
        <div className="absolute right-0 z-40 mt-2 w-72 rounded-lg border border-ink-200 bg-white p-4 shadow-popover dark:border-ink-700 dark:bg-ink-900">
          <h3 className="text-sm font-semibold text-ink-900 dark:text-ink-50">Como usar o Radar Licitações</h3>
          <ul className="mt-2 space-y-2 text-sm text-ink-600 dark:text-ink-300">
            {DICAS_AJUDA.map((dica) => (
              <li key={dica}>{dica}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function inscreverRelogio(callback: () => void) {
  const intervalo = setInterval(callback, 10000);
  return () => clearInterval(intervalo);
}

function lerAgora() {
  return Date.now();
}

function lerAgoraNoServidor() {
  return null;
}

/**
 * Relógio ao vivo no horário de Brasília (o fuso usado pelo PNCP), via
 * useSyncExternalStore — no servidor sempre reporta `null` (getServerSnapshot)
 * e o React corrige para o horário real logo após montar, sem o anti-padrão
 * de setState dentro de useEffect.
 */
function RelogioBrasilia() {
  const agora = useSyncExternalStore(inscreverRelogio, lerAgora, lerAgoraNoServidor);

  if (agora === null) return null;

  return (
    <span
      className="hidden items-center gap-1.5 text-sm font-medium text-ink-500 dark:text-ink-400 sm:inline-flex"
      title="Todos os horários exibidos são de Brasília, o fuso usado pelo PNCP."
    >
      <Clock className="h-4 w-4" aria-hidden />
      {formatarDataHoraCurta(new Date(agora).toISOString())} (UTC-3)
    </span>
  );
}

export function Header() {
  const [menuMobileAberto, setMenuMobileAberto] = useState(false);
  const [ajudaMobileAberta, setAjudaMobileAberta] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-ink-200 bg-white/95 backdrop-blur dark:border-ink-700 dark:bg-ink-900/95">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <Image src="/logo.png" alt="" width={36} height={36} className="h-9 w-9 shrink-0" priority />
          <div className="min-w-0 leading-tight">
            <p className="truncate text-base font-semibold tracking-tight text-ink-900 dark:text-ink-50">
              Radar Licitações
            </p>
            <p className="truncate text-xs text-ink-500 dark:text-ink-400">
              Pesquisa inteligente de licitações públicas
            </p>
          </div>
        </div>

        <div className="hidden items-center gap-2 sm:flex">
          <StatusPncp />
          <RelogioBrasilia />
          <PopoverAjuda />
          <ThemeToggle />
        </div>

        <button
          type="button"
          className="rounded-lg p-2 text-ink-600 hover:bg-ink-100 dark:text-ink-300 dark:hover:bg-ink-800 sm:hidden"
          aria-label="Abrir menu"
          aria-expanded={menuMobileAberto}
          onClick={() => setMenuMobileAberto((v) => !v)}
        >
          {menuMobileAberto ? <X className="h-5 w-5" aria-hidden /> : <Menu className="h-5 w-5" aria-hidden />}
        </button>
      </div>

      {menuMobileAberto && (
        <div className="border-t border-ink-200 bg-white px-4 py-3 dark:border-ink-700 dark:bg-ink-900 sm:hidden">
          <StatusPncp variante="linha" />
          <div className="mt-3 border-t border-ink-100 pt-3 dark:border-ink-800">
            <button
              type="button"
              onClick={() => setAjudaMobileAberta((v) => !v)}
              aria-expanded={ajudaMobileAberta}
              className="flex w-full items-center justify-between text-sm font-medium text-ink-700 dark:text-ink-200"
            >
              <span className="inline-flex items-center gap-2">
                <CircleHelp className="h-5 w-5 text-ink-500 dark:text-ink-400" aria-hidden />
                Ajuda
              </span>
              {ajudaMobileAberta ? (
                <ChevronUp className="h-4 w-4 text-ink-400 dark:text-ink-500" aria-hidden />
              ) : (
                <ChevronDown className="h-4 w-4 text-ink-400 dark:text-ink-500" aria-hidden />
              )}
            </button>
            {ajudaMobileAberta && (
              <ul className="mt-2 space-y-2 text-sm text-ink-600 dark:text-ink-300">
                {DICAS_AJUDA.map((dica) => (
                  <li key={dica}>{dica}</li>
                ))}
              </ul>
            )}
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-ink-100 pt-3 dark:border-ink-800">
            <ThemeToggle variante="linha" />
          </div>
        </div>
      )}
    </header>
  );
}
