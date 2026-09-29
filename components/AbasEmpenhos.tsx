"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/cn";

const ABAS = [
  { href: "/empenhos-federal", rotulo: "Governo federal" },
  { href: "/empenhos-am", rotulo: "Governo do Amazonas" },
] as const;

/** Troca entre as duas telas de empenhos a receber, levando o CNPJ junto. */
export function AbasEmpenhos() {
  const pathname = usePathname();
  const cnpj = useSearchParams().get("cnpj");

  return (
    <nav aria-label="Esfera do governo" className="flex gap-1 rounded-lg bg-ink-100 p-1 dark:bg-ink-800 sm:w-fit">
      {ABAS.map((a) => {
        const ativa = pathname === a.href;
        return (
          <Link
            key={a.href}
            href={cnpj ? `${a.href}?cnpj=${encodeURIComponent(cnpj)}` : a.href}
            aria-current={ativa ? "page" : undefined}
            className={cn(
              "flex-1 rounded-md px-3 py-1.5 text-center text-sm font-medium transition-colors sm:flex-none",
              ativa
                ? "bg-white text-ink-900 shadow-sm dark:bg-ink-900 dark:text-ink-50"
                : "text-ink-600 hover:text-ink-900 dark:text-ink-300 dark:hover:text-ink-50",
            )}
          >
            {a.rotulo}
          </Link>
        );
      })}
    </nav>
  );
}
