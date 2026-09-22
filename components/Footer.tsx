import Image from "next/image";
import Link from "next/link";
import { ExternalLink } from "lucide-react";

const ANO_ATUAL = new Date().getFullYear();

export function Footer() {
  return (
    <footer className="border-t border-ink-200 bg-white dark:border-ink-700 dark:bg-ink-900">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <Image src="/logo.png" alt="" width={32} height={32} className="h-8 w-8 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-ink-900 dark:text-ink-50">Radar Licitações</p>
              <p className="mt-1 max-w-sm text-xs text-ink-500 dark:text-ink-400">
                Ferramenta independente de pesquisa de licitações públicas. Não é um serviço oficial do
                governo. Os dados exibidos vêm diretamente do{" "}
                <a
                  href="https://pncp.gov.br"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-primary-600 hover:underline dark:text-primary-400"
                >
                  PNCP
                </a>
                .
              </p>
            </div>
          </div>

          <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm" aria-label="Links institucionais">
            <Link
              href="/termos-de-uso"
              className="text-ink-600 hover:text-ink-900 dark:text-ink-300 dark:hover:text-ink-50"
            >
              Termos de Uso
            </Link>
            <Link
              href="/politica-de-privacidade"
              className="text-ink-600 hover:text-ink-900 dark:text-ink-300 dark:hover:text-ink-50"
            >
              Política de Privacidade
            </Link>
            <a
              href="https://github.com/hugobastoss/radar-pncp-licitacoes"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-ink-600 hover:text-ink-900 dark:text-ink-300 dark:hover:text-ink-50"
            >
              GitHub
              <ExternalLink className="h-3.5 w-3.5" aria-hidden />
            </a>
          </nav>
        </div>

        <p className="mt-6 border-t border-ink-100 pt-4 text-xs text-ink-400 dark:border-ink-800 dark:text-ink-500">
          © {ANO_ATUAL} Radar Licitações. Dados públicos fornecidos pelo Portal Nacional de Contratações
          Públicas (PNCP).
        </p>
      </div>
    </footer>
  );
}
