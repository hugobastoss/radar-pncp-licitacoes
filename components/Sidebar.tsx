"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, MapPin, Search, ShieldAlert, Tag } from "lucide-react";
import { cn } from "@/lib/cn";

const ITENS_NAV = [
  { href: "/", label: "Licitações", icone: Search },
  { href: "/cnpj", label: "CNPJ", icone: Building2 },
  { href: "/sancoes", label: "Sanções", icone: ShieldAlert },
  { href: "/cep", label: "CEP", icone: MapPin },
  { href: "/ncm", label: "NCM", icone: Tag },
] as const;

export function Sidebar() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Navegação principal"
      className="shrink-0 border-b border-ink-200 bg-white dark:border-ink-700 dark:bg-ink-900 sm:w-56 sm:border-b-0 sm:border-r"
    >
      <div className="flex gap-1 overflow-x-auto px-4 py-2 scrollbar-oculta sm:flex-col sm:overflow-visible sm:p-4">
        {ITENS_NAV.map(({ href, label, icone: Icone }) => {
          const ativo = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              aria-current={ativo ? "page" : undefined}
              className={cn(
                "flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                ativo
                  ? "bg-primary-50 text-primary-700 dark:bg-primary-900 dark:text-primary-300"
                  : "text-ink-600 hover:bg-ink-100 hover:text-ink-900 dark:text-ink-300 dark:hover:bg-ink-800 dark:hover:text-ink-50",
              )}
            >
              <Icone className="h-4 w-4" aria-hidden />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
