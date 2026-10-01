"use client";

import { useCallback, useRef, useState, useSyncExternalStore } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, ChevronUp, CircleHelp, Clock, Menu } from "lucide-react";
import { useClickOutside } from "@/lib/hooks/useClickOutside";
import { MenuFerramentas } from "@/components/MenuFerramentas";
import { Badge } from "@/components/ui/Badge";
import { Drawer } from "@/components/ui/Drawer";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { StatusServicos } from "@/components/ui/StatusServicos";
import { CABECALHOS } from "@/lib/cabecalhos";
import { formatarDataHoraCurta } from "@/lib/formatters";
import { inscreverRelogio, lerAgora, lerAgoraNoServidor } from "@/lib/relogio";

const DICAS_AJUDA = [
  "Digite o que procura e escolha estado e município na pesquisa rápida.",
  "Use a pesquisa avançada para refinar por período, modalidade, portal e valor.",
  "Os resultados vêm diretamente das fontes oficiais no momento da consulta. Nada fica salvo no servidor.",
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
          <h3 className="text-sm font-semibold text-ink-900 dark:text-ink-50">Como usar o QBuscado</h3>
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

/** O pé da gaveta: o que no computador fica à direita da barra do topo. */
function RodapeGaveta() {
  const [ajudaAberta, setAjudaAberta] = useState(false);

  return (
    <div className="space-y-3">
      <StatusServicos variante="linha" />
      <div className="border-t border-ink-100 pt-3 dark:border-ink-800">
        <button
          type="button"
          onClick={() => setAjudaAberta((v) => !v)}
          aria-expanded={ajudaAberta}
          className="flex w-full items-center justify-between text-sm font-medium text-ink-700 dark:text-ink-200"
        >
          <span className="inline-flex items-center gap-2">
            <CircleHelp className="h-5 w-5 text-ink-500 dark:text-ink-400" aria-hidden />
            Ajuda
          </span>
          {ajudaAberta ? (
            <ChevronUp className="h-4 w-4 text-ink-400 dark:text-ink-500" aria-hidden />
          ) : (
            <ChevronDown className="h-4 w-4 text-ink-400 dark:text-ink-500" aria-hidden />
          )}
        </button>
        {ajudaAberta && (
          <ul className="mt-2 space-y-2 text-sm text-ink-600 dark:text-ink-300">
            {DICAS_AJUDA.map((dica) => (
              <li key={dica}>{dica}</li>
            ))}
          </ul>
        )}
      </div>
      <div className="border-t border-ink-100 pt-3 dark:border-ink-800">
        <ThemeToggle variante="linha" />
      </div>
    </div>
  );
}

export function Header() {
  const [gavetaAberta, setGavetaAberta] = useState(false);
  // Estável entre renderizações: o Drawer refaz o efeito de foco quando `onFechar` muda.
  const fecharGaveta = useCallback(() => setGavetaAberta(false), []);
  const pathname = usePathname();
  // Sem entrada pra rota atual (a "/", a tela de pouso, e qualquer rota nova
  // ainda não cadastrada): mostra o nome do site em vez do título de uma ferramenta.
  // O ícone, porém, é sempre a logo — só o título e a descrição mudam por tela.
  const pagina = CABECALHOS[pathname];

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-ink-200 bg-white/95 backdrop-blur dark:border-ink-700 dark:bg-ink-900/95">
        {/* 96 px (h-24). Quem gruda embaixo dela conta com essa altura: o menu lateral
            (Sidebar), a barra de filtros (FiltrosAtivosBar) e o cabeçalho da tabela (ResultsTable). */}
        <div className="flex h-24 items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              className="-ml-2 shrink-0 rounded-lg p-2 text-ink-600 hover:bg-ink-100 dark:text-ink-300 dark:hover:bg-ink-800 lg:hidden"
              aria-label="Abrir menu"
              aria-expanded={gavetaAberta}
              onClick={(e) => {
                // O Safari não dá foco a um botão no clique. Com o foco aqui, a gaveta sabe
                // pra quem devolvê-lo ao fechar (ver components/ui/Drawer.tsx).
                e.currentTarget.focus();
                setGavetaAberta(true);
              }}
            >
              <Menu className="h-5 w-5" aria-hidden />
            </button>
            <Link href="/" className="flex min-w-0 items-center gap-3 rounded-lg">
              <Image
                src="/icone_logo.png"
                alt=""
                width={48}
                height={48}
                className="h-10 w-10 shrink-0 rounded-xl sm:h-12 sm:w-12"
                priority
              />
              <div className="min-w-0 leading-tight">
                <p className="flex items-center gap-2 truncate text-lg font-bold tracking-tight text-ink-900 dark:text-ink-50 sm:text-xl">
                  {pagina?.titulo ?? "QBuscado"}
                  {pagina?.beta && <Badge tone="accent">Beta</Badge>}
                </p>
                <p className="mt-0.5 truncate text-xs text-ink-500 dark:text-ink-400 sm:text-sm">
                  {pagina?.descricao ?? "Consulta inteligente de dados públicos"}
                </p>
              </div>
            </Link>
          </div>

          <div className="hidden items-center gap-2 sm:flex">
            <StatusServicos />
            <RelogioBrasilia />
            <PopoverAjuda />
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Fora do <header>: o backdrop-blur dele prenderia o position: fixed da gaveta dentro da barra. */}
      {/* Status, ajuda e tema rolam junto com o menu: num rodapé fixo, em tela baixa
          (celular deitado), eles tomariam a altura toda e o menu sumiria. */}
      <Drawer aberto={gavetaAberta} onFechar={fecharGaveta} titulo="Menu" lado="esquerda">
        <MenuFerramentas onNavegar={fecharGaveta} />
        <div className="mt-6 border-t border-ink-200 pt-4 dark:border-ink-700">
          <RodapeGaveta />
        </div>
      </Drawer>
    </>
  );
}
