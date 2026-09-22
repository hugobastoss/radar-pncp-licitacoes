import { SearchX } from "lucide-react";

export function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-16 text-center" role="status">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-ink-100 text-ink-400">
        <SearchX className="h-6 w-6" aria-hidden />
      </span>
      <h3 className="text-base font-semibold text-ink-900">Nenhuma licitação encontrada</h3>
      <p className="max-w-sm text-sm text-ink-500">Tente ampliar o período ou alterar as palavras-chave e filtros.</p>
    </div>
  );
}
