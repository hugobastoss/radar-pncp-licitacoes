import { Eye, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { isLinkExternoSeguro } from "@/lib/portal";
import type { Licitacao } from "@/types/licitacao";

const CLASSE_LINK_PORTAL =
  "inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-lg border border-ink-200 text-sm font-medium text-ink-700 transition-colors hover:bg-ink-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent dark:border-ink-700 dark:text-ink-200 dark:hover:bg-ink-800";

interface AcoesLicitacaoProps {
  item: Licitacao;
  onVerDetalhes: (item: Licitacao) => void;
}

/**
 * Usado só nos cards mobile — na tabela desktop os detalhes ficam na própria
 * linha expansível (ver components/ResultsTable.tsx), sem drawer.
 */
export function AcoesLicitacao({ item, onVerDetalhes }: AcoesLicitacaoProps) {
  const portalSeguro = isLinkExternoSeguro(item.linkSistemaOrigem);

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="secondary"
        size="sm"
        className="flex-1"
        leftIcon={<Eye className="h-4 w-4" aria-hidden />}
        onClick={() => onVerDetalhes(item)}
      >
        Ver detalhes
      </Button>

      {portalSeguro ? (
        <a
          href={item.linkSistemaOrigem}
          target="_blank"
          rel="noopener noreferrer"
          className={CLASSE_LINK_PORTAL}
          title="Abrir portal de origem"
          aria-label="Abrir portal de origem (nova aba)"
        >
          <ExternalLink className="h-4 w-4" aria-hidden /> Abrir portal
        </a>
      ) : (
        <button
          type="button"
          disabled
          className={cn(CLASSE_LINK_PORTAL, "disabled:hover:bg-transparent")}
          title="Link do portal não informado pelo órgão"
          aria-label="Link do portal não informado"
        >
          <ExternalLink className="h-4 w-4" aria-hidden /> Indisponível
        </button>
      )}
    </div>
  );
}
