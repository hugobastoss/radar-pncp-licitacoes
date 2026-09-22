"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Select } from "@/components/ui/Select";
import { cn } from "@/lib/cn";
import { formatarQuantidade } from "@/lib/formatters";

interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  onChangePage: (page: number) => void;
  onChangePageSize: (size: number) => void;
}

function construirPaginas(atual: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  const paginas = new Set<number>([1, total, atual, atual - 1, atual + 1]);
  const ordenadas = Array.from(paginas)
    .filter((p) => p >= 1 && p <= total)
    .sort((a, b) => a - b);

  const resultado: (number | "…")[] = [];
  let anterior = 0;
  for (const p of ordenadas) {
    if (anterior && p - anterior > 1) resultado.push("…");
    resultado.push(p);
    anterior = p;
  }
  return resultado;
}

export function Pagination({ page, pageSize, total, totalPages, onChangePage, onChangePageSize }: PaginationProps) {
  if (total === 0) return null;

  const inicio = (page - 1) * pageSize + 1;
  const fim = Math.min(page * pageSize, total);
  const paginas = construirPaginas(page, totalPages);

  return (
    <div className="flex flex-col gap-3 border-t border-ink-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
      <p className="text-sm text-ink-500">
        Exibindo <span className="font-medium text-ink-700">{formatarQuantidade(inicio)}</span>–
        <span className="font-medium text-ink-700">{formatarQuantidade(fim)}</span> de{" "}
        <span className="font-medium text-ink-700">{formatarQuantidade(total)}</span> resultados
      </p>

      <div className="flex items-center gap-3">
        <div className="w-36">
          <Select
            label="Itens por página"
            hideLabel
            value={String(pageSize)}
            onChange={(e) => onChangePageSize(Number(e.target.value))}
          >
            <option value="25">25 por página</option>
            <option value="50">50 por página</option>
            <option value="100">100 por página</option>
          </Select>
        </div>

        {totalPages > 1 && (
          <nav aria-label="Paginação de resultados" className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onChangePage(Math.max(1, page - 1))}
              disabled={page === 1}
              aria-label="Página anterior"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-ink-200 text-ink-500 hover:bg-ink-50 disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden />
            </button>

            {paginas.map((p, indice) =>
              p === "…" ? (
                <span key={`ellipsis-${indice}`} className="px-1 text-sm text-ink-400">
                  …
                </span>
              ) : (
                <button
                  key={p}
                  type="button"
                  onClick={() => onChangePage(p)}
                  aria-current={p === page ? "page" : undefined}
                  className={cn(
                    "inline-flex h-8 min-w-8 items-center justify-center rounded-lg px-2 text-sm font-medium",
                    p === page ? "bg-primary-600 text-white" : "text-ink-600 hover:bg-ink-100",
                  )}
                >
                  {p}
                </button>
              ),
            )}

            <button
              type="button"
              onClick={() => onChangePage(Math.min(totalPages, page + 1))}
              disabled={page === totalPages}
              aria-label="Próxima página"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-ink-200 text-ink-500 hover:bg-ink-50 disabled:opacity-40"
            >
              <ChevronRight className="h-4 w-4" aria-hidden />
            </button>
          </nav>
        )}
      </div>
    </div>
  );
}
