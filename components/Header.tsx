"use client";

import { useCallback, useState, useSyncExternalStore } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { MenuFerramentas } from "@/components/MenuFerramentas";
import { Badge } from "@/components/ui/Badge";
import { Drawer } from "@/components/ui/Drawer";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { CABECALHOS } from "@/lib/cabecalhos";
import { formatarDataHoraComSegundos } from "@/lib/formatters";
import { inscreverRelogio, lerAgora, lerAgoraNoServidor } from "@/lib/relogio";

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
      className="hidden text-base font-medium text-ink-500 dark:text-ink-400 sm:inline-flex"
      title="Todos os horários exibidos são de Brasília, o fuso usado pelo PNCP."
    >
      {formatarDataHoraComSegundos(new Date(agora).toISOString())} (UTC-3)
    </span>
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
            <RelogioBrasilia />
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Fora do <header>: o backdrop-blur dele prenderia o position: fixed da gaveta dentro da barra. */}
      {/* O tema rola junto com o menu: num rodapé fixo, em tela baixa (celular
          deitado), ele tomaria a altura toda e o menu sumiria. */}
      <Drawer aberto={gavetaAberta} onFechar={fecharGaveta} titulo="Menu" lado="esquerda">
        <MenuFerramentas onNavegar={fecharGaveta} />
        <div className="mt-6 border-t border-ink-200 pt-4 dark:border-ink-700">
          <ThemeToggle variante="linha" />
        </div>
      </Drawer>
    </>
  );
}
