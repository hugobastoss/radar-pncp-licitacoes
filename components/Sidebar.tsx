"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  FileStack,
  Handshake,
  HeartPulse,
  Landmark,
  MapPin,
  Network,
  Receipt,
  Search,
  ShieldAlert,
  Tag,
  Tags,
  UserRound,
} from "lucide-react";
import { cn } from "@/lib/cn";

const ITENS_NAV: { href: string; label: string; icone: typeof Search; ativoEm?: string[] }[] = [
  { href: "/", label: "Licitações", icone: Search },
  { href: "/atas", label: "Atas", icone: FileStack },
  { href: "/cnpj", label: "CNPJ", icone: Building2 },
  { href: "/cpf", label: "CPF", icone: UserRound },
  { href: "/sancoes", label: "Sanções", icone: ShieldAlert },
  { href: "/cep", label: "CEP", icone: MapPin },
  { href: "/ncm", label: "NCM", icone: Tag },
  { href: "/produtos-saude", label: "Produtos p/ Saúde", icone: HeartPulse },
  { href: "/nome-tecnico", label: "Nome Técnico", icone: Tags },
  { href: "/sinapse", label: "Sinapse", icone: Network },
  { href: "/emendas", label: "Emendas", icone: Landmark },
  { href: "/convenios", label: "Convênios", icone: Handshake },
  // As duas telas de empenhos (Amazonas e federal) têm abas entre si.
  { href: "/empenhos-am", label: "Empenhos", icone: Receipt, ativoEm: ["/empenhos-am", "/empenhos-federal"] },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Navegação principal"
      className="shrink-0 border-b border-ink-200 bg-white dark:border-ink-700 dark:bg-ink-900 sm:border-b-0 sm:bg-transparent sm:dark:bg-transparent"
    >
      <div className="flex gap-1 overflow-x-auto px-4 py-2 scrollbar-oculta sm:grid sm:grid-cols-3 sm:gap-3 sm:overflow-visible sm:px-4 sm:py-4 md:grid-cols-7 xl:grid-cols-13">
        {ITENS_NAV.map(({ href, label, icone: Icone, ativoEm }) => {
          const ativo = ativoEm ? ativoEm.includes(pathname) : pathname === href;
          return (
            <Link
              key={href}
              href={href}
              aria-current={ativo ? "page" : undefined}
              className={cn(
                "flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                "sm:flex-col sm:justify-center sm:gap-2 sm:rounded-2xl sm:border sm:p-4 sm:text-center sm:text-xs sm:shadow-card",
                ativo
                  ? "bg-primary-50 text-primary-700 dark:bg-primary-900 dark:text-primary-300 sm:border-primary-200 sm:dark:border-primary-800"
                  : "text-ink-600 hover:bg-ink-100 hover:text-ink-900 dark:text-ink-300 dark:hover:bg-ink-800 dark:hover:text-ink-50 sm:border-ink-200 sm:bg-white sm:hover:bg-ink-50 sm:dark:border-ink-700 sm:dark:bg-ink-900 sm:dark:hover:bg-ink-800",
              )}
            >
              <Icone className="h-4 w-4 sm:h-5 sm:w-5" aria-hidden />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
