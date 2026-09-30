"use client";

import { useId, useSyncExternalStore } from "react";
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
  Scale,
  Search,
  ShieldAlert,
  Tag,
  Tags,
  UserRound,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/cn";
import {
  inscreverEmpresasRecentes,
  lerEmpresasRecentes,
  lerEmpresasRecentesNoServidor,
  limparEmpresasRecentes,
} from "@/lib/empresas-recentes";
import { formatarCnpj } from "@/lib/formatters";

interface ItemMenu {
  href: string;
  label: string;
  icone: LucideIcon;
  ativoEm?: string[];
  beta?: boolean;
}

const GRUPOS: { titulo: string; itens: ItemMenu[] }[] = [
  {
    titulo: "Licitações e dinheiro público",
    itens: [
      { href: "/", label: "Licitações", icone: Search },
      { href: "/atas", label: "Atas", icone: FileStack },
      // As duas telas de empenhos (Amazonas e federal) têm abas entre si.
      { href: "/empenhos-am", label: "Empenhos", icone: Receipt, ativoEm: ["/empenhos-am", "/empenhos-federal"] },
      { href: "/convenios", label: "Convênios", icone: Handshake },
      { href: "/emendas", label: "Emendas", icone: Landmark },
    ],
  },
  {
    titulo: "Empresas e pessoas",
    itens: [
      { href: "/cnpj", label: "CNPJ", icone: Building2 },
      { href: "/cpf", label: "CPF", icone: UserRound },
      { href: "/processos", label: "Processos", icone: Scale },
      { href: "/sancoes", label: "Sanções", icone: ShieldAlert },
      { href: "/sinapse", label: "Sinapse", icone: Network, beta: true },
    ],
  },
  {
    titulo: "Consultas de apoio",
    itens: [
      { href: "/cep", label: "CEP", icone: MapPin },
      { href: "/ncm", label: "NCM", icone: Tag },
      { href: "/produtos-saude", label: "Produtos p/ Saúde", icone: HeartPulse },
      { href: "/nome-tecnico", label: "Nome Técnico", icone: Tags },
    ],
  },
];

interface MenuFerramentasProps {
  /** Só põe o nome no `title` de cada item; o que some e a largura vêm da variante menu-recolhido (CSS). */
  recolhido?: boolean;
  /** A gaveta do celular fecha ao escolher uma tela. */
  onNavegar?: () => void;
}

/** As ferramentas em grupos e as empresas recentes — o mesmo menu no lateral do computador e na gaveta do celular. */
export function MenuFerramentas({ recolhido = false, onNavegar }: MenuFerramentasProps) {
  const pathname = usePathname();
  const id = useId();
  const recentes = useSyncExternalStore(inscreverEmpresasRecentes, lerEmpresasRecentes, lerEmpresasRecentesNoServidor);

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

      {recentes.length > 0 && (
        <section aria-labelledby={`${id}-recentes`} className="menu-recolhido:hidden">
          <div className="flex items-center justify-between px-3">
            {/* Um <p>, não um título: o menu vem antes do <h1> de cada tela. */}
            <p id={`${id}-recentes`} className="text-xs font-medium uppercase tracking-wide text-ink-500 dark:text-ink-400">
              Consultas recentes
            </p>
            <button
              type="button"
              onClick={limparEmpresasRecentes}
              aria-label="Limpar consultas recentes"
              className="rounded text-xs font-medium text-ink-500 hover:text-ink-900 dark:text-ink-400 dark:hover:text-ink-50"
            >
              Limpar
            </button>
          </div>
          <ul className="mt-1.5 space-y-0.5">
            {recentes.map((e) => (
              <li key={e.cnpj}>
                <Link
                  href={`/cnpj?cnpj=${e.cnpj}`}
                  onClick={onNavegar}
                  className="block rounded-lg px-3 py-1.5 hover:bg-ink-100 dark:hover:bg-ink-800"
                >
                  <span className="block truncate text-sm text-ink-800 dark:text-ink-100">{e.nome}</span>
                  <span className="block text-xs tabular-nums text-ink-500 dark:text-ink-400">{formatarCnpj(e.cnpj)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
