import Link from "next/link";
import { ExternalLink } from "lucide-react";

const ANO_ATUAL = new Date().getFullYear();

export function Footer() {
  return (
    <footer className="border-t border-ink-200 bg-white dark:border-ink-700 dark:bg-ink-900">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <p className="max-w-2xl text-xs leading-relaxed text-ink-500 dark:text-ink-400">
            O QBuscado é uma plataforma independente de consulta e análise de dados públicos. Não
            possui vínculo institucional com o Portal Nacional de Contratações Públicas ou com órgãos do
            Governo Federal. Os dados apresentados vêm de diversas fontes oficiais (PNCP, Receita Federal,
            Portal da Transparência, TCU e outras) e estão sujeitos às informações disponibilizadas por
            cada órgão responsável. Tratamos dados
            pessoais conforme a{" "}
            <Link href="/lgpd" className="font-medium text-primary-600 hover:underline dark:text-primary-400">
              LGPD
            </Link>{" "}
            (Lei nº 13.709/2018), veja a{" "}
            <Link
              href="/politica-de-privacidade"
              className="font-medium text-primary-600 hover:underline dark:text-primary-400"
            >
              Política de Privacidade
            </Link>
            .
          </p>

          <nav className="flex shrink-0 flex-col gap-2 text-sm" aria-label="Links institucionais">
            <Link href="/ajuda" className="text-ink-600 hover:text-ink-900 dark:text-ink-300 dark:hover:text-ink-50">
              Ajuda
            </Link>
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
            <Link
              href="/lgpd"
              className="text-ink-600 hover:text-ink-900 dark:text-ink-300 dark:hover:text-ink-50"
            >
              LGPD
            </Link>
            <a
              href="https://qbuscado.userjot.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-ink-600 hover:text-ink-900 dark:text-ink-300 dark:hover:text-ink-50"
            >
              Sugestões e bugs
              <ExternalLink className="h-3.5 w-3.5" aria-hidden />
            </a>
            <a
              href="https://github.com/hugobastoss/site-qbuscado"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-ink-600 hover:text-ink-900 dark:text-ink-300 dark:hover:text-ink-50"
            >
              GitHub
              <ExternalLink className="h-3.5 w-3.5" aria-hidden />
            </a>
          </nav>
        </div>

        <div className="mt-6 border-t border-ink-100 pt-4 text-xs text-ink-400 dark:border-ink-800 dark:text-ink-500">
          <p>© {ANO_ATUAL} QBuscado.</p>
        </div>
      </div>
    </footer>
  );
}
