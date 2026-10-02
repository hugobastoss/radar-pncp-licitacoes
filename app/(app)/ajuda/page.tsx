import type { Metadata } from "next";
import Link from "next/link";
import { GRUPOS } from "@/lib/menu-ferramentas";
import { AJUDA_FERRAMENTAS } from "@/lib/ajuda-ferramentas";

export const metadata: Metadata = {
  title: "Ajuda | QBuscado",
  description: "O que cada busca do QBuscado traz, o que informar e de onde vem a informação.",
};

export default function AjudaPage() {
  return (
    <div className="flex flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <div className="rounded-[10px] border border-ink-200 bg-white p-5 shadow-card dark:border-ink-700 dark:bg-ink-900 sm:p-6">
        <p className="text-sm text-ink-600 dark:text-ink-300">
          O que cada busca pede pra consultar, o que ela traz de volta e de onde vem a informação. Os
          resultados vêm direto das fontes oficiais no momento da consulta: nada fica salvo no servidor.
        </p>
      </div>

      {GRUPOS.map((grupo) => (
        <div key={grupo.titulo}>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-500 dark:text-ink-400">
            {grupo.titulo}
          </p>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {grupo.itens.map(({ href, label, icone: Icone }) => {
              const ajuda = AJUDA_FERRAMENTAS[href];
              if (!ajuda) return null;
              return (
                <div
                  key={href}
                  className="rounded-[10px] border border-ink-200 bg-white p-4 shadow-card dark:border-ink-700 dark:bg-ink-900"
                >
                  <Link
                    href={href}
                    className="flex items-center gap-2 text-sm font-semibold text-ink-900 hover:underline dark:text-ink-50"
                  >
                    <Icone className="h-4 w-4 shrink-0 text-primary-600 dark:text-primary-400" aria-hidden />
                    {label}
                  </Link>
                  <p className="mt-2 text-xs text-ink-500 dark:text-ink-400">
                    <span className="font-medium text-ink-700 dark:text-ink-200">Busca por:</span> {ajuda.busca}
                  </p>
                  <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-ink-700 dark:text-ink-200">
                    {ajuda.retorna.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                  <p className="mt-2 text-xs text-ink-400 dark:text-ink-500">Fonte: {ajuda.fonte}.</p>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
