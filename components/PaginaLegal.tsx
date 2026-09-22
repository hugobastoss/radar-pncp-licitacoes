import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

interface PaginaLegalProps {
  titulo: string;
  atualizadoEm: string;
  children: ReactNode;
}

export function PaginaLegal({ titulo, atualizadoEm, children }: PaginaLegalProps) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Voltar para a pesquisa
      </Link>

      <div className="mt-6 rounded-2xl border border-ink-200 bg-white p-6 shadow-card dark:border-ink-700 dark:bg-ink-900 sm:p-8">
        <h1 className="text-xl font-semibold tracking-tight text-ink-900 dark:text-ink-50">{titulo}</h1>
        <p className="mt-1 text-sm text-ink-500 dark:text-ink-400">Última atualização: {atualizadoEm}</p>

        <div className="mt-6 space-y-8">{children}</div>
      </div>
    </div>
  );
}

interface SecaoLegalProps {
  titulo: string;
  children: ReactNode;
}

export function SecaoLegal({ titulo, children }: SecaoLegalProps) {
  return (
    <section>
      <h2 className="text-base font-semibold text-ink-900 dark:text-ink-50">{titulo}</h2>
      <div className="mt-2 space-y-2 text-sm leading-relaxed text-ink-700 dark:text-ink-300">{children}</div>
    </section>
  );
}
