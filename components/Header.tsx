"use client";

import { useEffect, useRef, useState } from "react";
import { CircleHelp, Menu, Radar, Settings, Wifi, WifiOff, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { useClickOutside } from "@/lib/hooks/useClickOutside";

type StatusConsulta = "verificando" | "online" | "offline";

function useStatusConsulta(): StatusConsulta {
  const [status, setStatus] = useState<StatusConsulta>("verificando");

  useEffect(() => {
    let cancelado = false;

    async function verificar() {
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        if (!cancelado) setStatus("offline");
        return;
      }
      try {
        const resposta = await fetch("/api/health", { cache: "no-store" });
        if (!cancelado) setStatus(resposta.ok ? "online" : "offline");
      } catch {
        if (!cancelado) setStatus("offline");
      }
    }

    verificar();
    const intervalo = setInterval(verificar, 45000);
    window.addEventListener("online", verificar);
    window.addEventListener("offline", verificar);

    return () => {
      cancelado = true;
      clearInterval(intervalo);
      window.removeEventListener("online", verificar);
      window.removeEventListener("offline", verificar);
    };
  }, []);

  return status;
}

function IndicadorStatus({ status }: { status: StatusConsulta }) {
  const config = {
    verificando: { texto: "Verificando conexão…", dot: "bg-ink-300", cor: "text-ink-500" },
    online: { texto: "Consulta online", dot: "bg-success-600", cor: "text-success-700" },
    offline: { texto: "Sem conexão", dot: "bg-danger-600", cor: "text-danger-700" },
  }[status];

  return (
    <span className={cn("inline-flex items-center gap-2 rounded-full bg-ink-50 px-3 py-1.5 text-xs font-medium", config.cor)}>
      <span className={cn("h-2 w-2 rounded-full", config.dot)} aria-hidden />
      {config.texto}
    </span>
  );
}

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
        className="rounded-lg p-2 text-ink-500 hover:bg-ink-100 hover:text-ink-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
      >
        <CircleHelp className="h-5 w-5" aria-hidden />
      </button>
      {aberto && (
        <div className="absolute right-0 z-40 mt-2 w-72 rounded-lg border border-ink-200 bg-white p-4 shadow-popover">
          <h3 className="text-sm font-semibold text-ink-900">Como usar o RADAR PNCP</h3>
          <ul className="mt-2 space-y-2 text-sm text-ink-600">
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
        className="rounded-lg p-2 text-ink-500 hover:bg-ink-100 hover:text-ink-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
      >
        <Settings className="h-5 w-5" aria-hidden />
      </button>
      {aberto && (
        <div className="absolute right-0 z-40 mt-2 w-72 rounded-lg border border-ink-200 bg-white p-4 shadow-popover">
          <h3 className="text-sm font-semibold text-ink-900">Configurações</h3>
          <dl className="mt-2 space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <dt className="text-ink-600">Fuso horário exibido</dt>
              <dd className="font-medium text-ink-900">Brasília (UTC-3)</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-ink-600">Fonte dos dados</dt>
              <dd className="font-medium text-ink-900">Demonstração</dd>
            </div>
          </dl>
          <p className="mt-3 text-xs text-ink-500">Mais preferências chegam em versões futuras.</p>
        </div>
      )}
    </div>
  );
}

export function Header() {
  const status = useStatusConsulta();
  const [menuMobileAberto, setMenuMobileAberto] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-ink-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-600 text-white">
            <Radar className="h-5 w-5" aria-hidden />
          </span>
          <div className="leading-tight">
            <p className="text-base font-semibold tracking-tight text-ink-900">RADAR PNCP</p>
            <p className="hidden text-xs text-ink-500 sm:block">Pesquisa inteligente de licitações públicas</p>
          </div>
        </div>

        <div className="hidden items-center gap-2 sm:flex">
          <IndicadorStatus status={status} />
          <PopoverAjuda />
          <PopoverConfiguracoes />
        </div>

        <button
          type="button"
          className="rounded-lg p-2 text-ink-600 hover:bg-ink-100 sm:hidden"
          aria-label="Abrir menu"
          aria-expanded={menuMobileAberto}
          onClick={() => setMenuMobileAberto((v) => !v)}
        >
          {menuMobileAberto ? <X className="h-5 w-5" aria-hidden /> : <Menu className="h-5 w-5" aria-hidden />}
        </button>
      </div>

      {menuMobileAberto && (
        <div className="border-t border-ink-200 bg-white px-4 py-3 sm:hidden">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-ink-700">Ajuda</span>
            <CircleHelp className="h-5 w-5 text-ink-500" aria-hidden />
          </div>
          <div className="mt-3 flex items-center justify-between">
            <span className="text-sm font-medium text-ink-700">Configurações</span>
            <Settings className="h-5 w-5 text-ink-500" aria-hidden />
          </div>
          <div className="mt-3 flex items-center gap-2 text-sm">
            {status === "online" ? (
              <Wifi className="h-4 w-4 text-success-600" aria-hidden />
            ) : (
              <WifiOff className="h-4 w-4 text-danger-600" aria-hidden />
            )}
            <span className={status === "online" ? "text-success-700" : "text-danger-700"}>
              {status === "online" ? "Consulta online" : status === "offline" ? "Sem conexão" : "Verificando…"}
            </span>
          </div>
        </div>
      )}
    </header>
  );
}
