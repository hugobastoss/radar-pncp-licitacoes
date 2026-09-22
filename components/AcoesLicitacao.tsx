import { Eye, ExternalLink, FileSearch } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { isLinkExternoSeguro } from "@/lib/portal";
import type { Licitacao } from "@/types/licitacao";

const CLASSE_ICONE =
  "inline-flex h-9 w-9 items-center justify-center rounded-lg border border-ink-200 text-ink-500 transition-colors hover:bg-ink-50 hover:text-ink-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent";

interface AcoesLicitacaoProps {
  item: Licitacao;
  variante: "tabela" | "mobile";
  onVerDetalhes: (item: Licitacao) => void;
}

export function AcoesLicitacao({ item, variante, onVerDetalhes }: AcoesLicitacaoProps) {
  const pncpSeguro = isLinkExternoSeguro(item.linkPNCP);
  const portalSeguro = isLinkExternoSeguro(item.linkSistemaOrigem);

  return (
    <div className={cn("flex items-center gap-2", variante === "tabela" ? "justify-end" : "justify-stretch")}>
      {variante === "mobile" ? (
        <Button variant="secondary" size="sm" fullWidth leftIcon={<Eye className="h-4 w-4" aria-hidden />} onClick={() => onVerDetalhes(item)}>
          Ver detalhes
        </Button>
      ) : (
        <Button variant="secondary" size="sm" leftIcon={<Eye className="h-4 w-4" aria-hidden />} onClick={() => onVerDetalhes(item)}>
          Ver detalhes
        </Button>
      )}

      {variante === "tabela" &&
        (pncpSeguro ? (
          <a
            href={item.linkPNCP}
            target="_blank"
            rel="noopener noreferrer"
            className={CLASSE_ICONE}
            title="Abrir no PNCP"
            aria-label="Abrir no PNCP (nova aba)"
          >
            <FileSearch className="h-4 w-4" aria-hidden />
          </a>
        ) : (
          <button type="button" disabled className={CLASSE_ICONE} title="Link do PNCP não informado" aria-label="Link do PNCP não informado">
            <FileSearch className="h-4 w-4" aria-hidden />
          </button>
        ))}

      {portalSeguro ? (
        <a
          href={item.linkSistemaOrigem}
          target="_blank"
          rel="noopener noreferrer"
          className={variante === "mobile" ? cn(CLASSE_ICONE, "flex-1") : CLASSE_ICONE}
          title="Abrir portal de origem"
          aria-label="Abrir portal de origem (nova aba)"
        >
          {variante === "mobile" ? (
            <span className="flex items-center justify-center gap-2 text-sm font-medium text-ink-700">
              <ExternalLink className="h-4 w-4" aria-hidden /> Abrir portal
            </span>
          ) : (
            <ExternalLink className="h-4 w-4" aria-hidden />
          )}
        </a>
      ) : (
        <button
          type="button"
          disabled
          className={variante === "mobile" ? cn(CLASSE_ICONE, "flex-1") : CLASSE_ICONE}
          title="Link do portal não informado pelo órgão"
          aria-label="Link do portal não informado"
        >
          {variante === "mobile" ? (
            <span className="flex items-center justify-center gap-2 text-sm font-medium">
              <ExternalLink className="h-4 w-4" aria-hidden /> Portal indisponível
            </span>
          ) : (
            <ExternalLink className="h-4 w-4" aria-hidden />
          )}
        </button>
      )}
    </div>
  );
}
