import { RotateCcw, SearchX } from "lucide-react";
import { Button } from "@/components/ui/Button";

interface EmptyStateProps {
  onLimparFiltros?: () => void;
}

export function EmptyState({ onLimparFiltros }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-16 text-center" role="status">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-ink-100 text-ink-400 dark:bg-ink-800 dark:text-ink-500">
        <SearchX className="h-6 w-6" aria-hidden />
      </span>
      <h3 className="text-base font-semibold text-ink-900 dark:text-ink-50">Nenhuma licitação encontrada</h3>
      <p className="max-w-sm text-sm text-ink-500 dark:text-ink-400">
        Tente ampliar o período ou alterar as palavras-chave e filtros.
      </p>
      {onLimparFiltros && (
        <Button
          variant="secondary"
          leftIcon={<RotateCcw className="h-4 w-4" aria-hidden />}
          onClick={onLimparFiltros}
        >
          Limpar filtros
        </Button>
      )}
    </div>
  );
}
