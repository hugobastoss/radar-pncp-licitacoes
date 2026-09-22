"use client";

import { useRef, useState } from "react";
import { CircleHelp, Menu, Radar, Settings, X } from "lucide-react";
import { useClickOutside } from "@/lib/hooks/useClickOutside";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

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
          <h3 className="text-sm font-semibold text-ink-900 dark:text-ink-50">Como usar o RADAR PNCP</h3>
          <ul className="mt-2 space-y-2 text-sm text-ink-600 dark:text-ink-300">
            <li>Digite o que procura e escolha estado e município na pesquisa rápida.</li>
            <li>Use a pesquisa avançada para refinar por período, modalidade, portal e valor.</li>
            <li>Os resultados vêm diretamente do PNCP no momento da consulta — nada fica salvo.</li>
          </ul>
        </div>
      )}
    </div>
  );
}

function PopoverConfiguracoes() {
  const [aberto, setAberto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, () => setAberto(false), aberto);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-expanded={aberto}
        aria-label="Configurações"
        className="rounded-lg p-2 text-ink-500 hover:bg-ink-100 hover:text-ink-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:text-ink-400 dark:hover:bg-ink-800 dark:hover:text-ink-200"
      >
        <Settings className="h-5 w-5" aria-hidden />
      </button>
      {aberto && (
        <div className="absolute right-0 z-40 mt-2 w-72 rounded-lg border border-ink-200 bg-white p-4 shadow-popover dark:border-ink-700 dark:bg-ink-900">
          <h3 className="text-sm font-semibold text-ink-900 dark:text-ink-50">Configurações</h3>
          <dl className="mt-2 space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <dt className="text-ink-600 dark:text-ink-300">Fuso horário exibido</dt>
              <dd className="font-medium text-ink-900 dark:text-ink-50">Brasília (UTC-3)</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-ink-600 dark:text-ink-300">Fonte dos dados</dt>
              <dd className="font-medium text-ink-900 dark:text-ink-50">Demonstração</dd>
            </div>
          </dl>
          <div className="mt-3 border-t border-ink-100 pt-3 dark:border-ink-800">
            <ThemeToggle variante="linha" />
          </div>
          <p className="mt-3 text-xs text-ink-500 dark:text-ink-400">Mais preferências chegam em versões futuras.</p>
        </div>
      )}
    </div>
  );
}

export function Header() {
  const [menuMobileAberto, setMenuMobileAberto] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-ink-200 bg-white/95 backdrop-blur dark:border-ink-700 dark:bg-ink-900/95">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-600 text-white">
            <Radar className="h-5 w-5" aria-hidden />
          </span>
          <div className="leading-tight">
            <p className="text-base font-semibold tracking-tight text-ink-900 dark:text-ink-50">RADAR PNCP</p>
            <p className="hidden text-xs text-ink-500 dark:text-ink-400 sm:block">
              Pesquisa inteligente de licitações públicas
            </p>
          </div>
        </div>

        <div className="hidden items-center gap-2 sm:flex">
          <PopoverAjuda />
          <ThemeToggle />
          <PopoverConfiguracoes />
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
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-ink-700 dark:text-ink-200">Ajuda</span>
            <CircleHelp className="h-5 w-5 text-ink-500 dark:text-ink-400" aria-hidden />
          </div>
          <div className="mt-3 flex items-center justify-between">
            <span className="text-sm font-medium text-ink-700 dark:text-ink-200">Configurações</span>
            <Settings className="h-5 w-5 text-ink-500 dark:text-ink-400" aria-hidden />
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-ink-100 pt-3 dark:border-ink-800">
            <ThemeToggle variante="linha" />
          </div>
        </div>
      )}
    </header>
  );
}
