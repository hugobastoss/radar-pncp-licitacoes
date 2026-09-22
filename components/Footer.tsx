import Link from "next/link";
import { ExternalLink } from "lucide-react";

const ANO_ATUAL = new Date().getFullYear();

export function Footer() {
  return (
    <footer className="border-t border-ink-200 bg-white dark:border-ink-700 dark:bg-ink-900">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <nav className="flex flex-col gap-2 text-sm" aria-label="Links institucionais">
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

        <p className="mt-6 max-w-2xl text-xs leading-relaxed text-ink-500 dark:text-ink-400">
          O Radar Licitações é uma plataforma independente de consulta e análise de dados públicos. Não
          possui vínculo institucional com o Portal Nacional de Contratações Públicas ou com órgãos do
          Governo Federal. Os dados apresentados são provenientes do PNCP e estão sujeitos às informações
          disponibilizadas pelos órgãos responsáveis. Tratamos dados
          pessoais conforme a LGPD (Lei nº 13.709/2018), veja a{" "}
          <Link
            href="/politica-de-privacidade"
            className="font-medium text-primary-600 hover:underline dark:text-primary-400"
          >
            Política de Privacidade
          </Link>
          .
        </p>

        <div className="mt-6 flex flex-col gap-2 border-t border-ink-100 pt-4 text-xs text-ink-400 dark:border-ink-800 dark:text-ink-500 sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {ANO_ATUAL} Radar Licitações. Dados públicos fornecidos pelo Portal Nacional de Contratações
            Públicas (PNCP).
          </p>
          <p>
            Fonte dos dados:{" "}
            <a
              href="https://pncp.gov.br"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-ink-500 hover:underline dark:text-ink-400"
            >
              PNCP
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
