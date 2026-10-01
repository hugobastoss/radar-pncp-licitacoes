"use client";

import { useId } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/cn";
import { GRUPOS } from "@/lib/menu-ferramentas";

interface MenuFerramentasProps {
  /** Só põe o nome no `title` de cada item; o que some e a largura vêm da variante menu-recolhido (CSS). */
  recolhido?: boolean;
  /** A gaveta do celular fecha ao escolher uma tela. */
  onNavegar?: () => void;
}

/** As ferramentas em grupos — o mesmo menu no lateral do computador e na gaveta do celular. */
export function MenuFerramentas({ recolhido = false, onNavegar }: MenuFerramentasProps) {
  const pathname = usePathname();
  const id = useId();

  return (
    <div className="flex flex-col gap-6">
      <nav aria-label="Navegação principal" className="flex flex-col gap-5 menu-recolhido:gap-3">
        {GRUPOS.map((grupo, i) => (
          <div key={grupo.titulo}>
            {i > 0 && <div className="mx-2 mb-3 hidden border-t border-ink-200 dark:border-ink-700 menu-recolhido:block" aria-hidden />}
            <p
              id={`${id}-grupo-${i}`}
              className="mb-1.5 px-3 text-xs font-medium uppercase tracking-wide text-ink-500 dark:text-ink-400 menu-recolhido:sr-only"
            >
              {grupo.titulo}
            </p>
            <ul aria-labelledby={`${id}-grupo-${i}`} className="space-y-0.5">
              {grupo.itens.map(({ href, label, icone: Icone, ativoEm, beta }) => {
                const ativo = ativoEm ? ativoEm.includes(pathname) : pathname === href;
                return (
                  <li key={href}>
                    <Link
                      href={href}
                      onClick={onNavegar}
                      aria-current={ativo ? "page" : undefined}
                      title={recolhido ? label : undefined}
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                        "menu-recolhido:justify-center menu-recolhido:px-0",
                        ativo
                          ? "bg-primary-50 text-primary-700 dark:bg-primary-900 dark:text-primary-300"
                          : "text-ink-600 hover:bg-ink-100 hover:text-ink-900 dark:text-ink-300 dark:hover:bg-ink-800 dark:hover:text-ink-50",
                      )}
                    >
                      <Icone className="h-4 w-4 shrink-0" aria-hidden />
                      <span className="truncate menu-recolhido:sr-only">{label}</span>
                      {beta && (
                        <Badge tone="accent" className="ml-auto menu-recolhido:hidden">
                          Beta
                        </Badge>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    </div>
  );
}
