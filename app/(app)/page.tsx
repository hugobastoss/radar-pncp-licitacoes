import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { GRUPOS } from "@/lib/menu-ferramentas";

export const metadata: Metadata = {
  title: "QBuscado: Consulta inteligente de dados públicos",
  description:
    "Licitações, empresas, sanções, emendas parlamentares, convênios e outros dados públicos num só lugar, direto das fontes oficiais.",
};

export default function InicioPage() {
  return (
    <div className="flex flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <div className="flex items-center gap-4 rounded-[10px] border border-primary-200 bg-primary-50 p-5 shadow-card dark:border-primary-900 dark:bg-primary-900/30 sm:p-6">
        <Image
          src="/icone_logo.png"
          alt=""
          width={48}
          height={48}
          className="h-10 w-10 shrink-0 rounded-xl sm:h-12 sm:w-12"
        />
        <div>
          <p className="text-sm text-primary-700 dark:text-primary-300">Consulta inteligente de dados públicos.</p>
          <p className="mt-1 text-sm font-semibold text-primary-900 dark:text-primary-100">
            Menos busca. Mais informação.
          </p>
        </div>
      </div>

      {GRUPOS.map((grupo) => (
        <div key={grupo.titulo}>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-500 dark:text-ink-400">
            {grupo.titulo}
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {grupo.itens.map(({ href, label, icone: Icone, beta }) => (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-3 rounded-[10px] border border-ink-200 bg-white p-4 shadow-card transition-colors hover:border-primary-300 hover:bg-ink-50 dark:border-ink-700 dark:bg-ink-900 dark:hover:border-primary-700 dark:hover:bg-ink-800"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-ink-200 bg-ink-50 text-primary-600 dark:border-ink-700 dark:bg-ink-800 dark:text-primary-400">
                  <Icone className="h-4 w-4" aria-hidden />
                </span>
                <span className="flex items-center gap-2 text-sm font-medium text-ink-800 dark:text-ink-100">
                  {label}
                  {beta && <Badge tone="accent">Beta</Badge>}
                </span>
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
