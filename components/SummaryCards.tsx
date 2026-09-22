import type { ComponentType } from "react";
import { FileStack, Gavel, Layers, ShieldCheck } from "lucide-react";
import { formatarQuantidade } from "@/lib/formatters";
import type { ResumoLicitacoes } from "@/types/licitacao";

interface CartaoConfig {
  chave: keyof ResumoLicitacoes;
  rotulo: string;
  icone: ComponentType<{ className?: string }>;
  tonalidade: string;
}

const CARTOES: CartaoConfig[] = [
  {
    chave: "total",
    rotulo: "Total encontrado",
    icone: FileStack,
    tonalidade: "bg-primary-50 text-primary-600 dark:bg-primary-900 dark:text-primary-400",
  },
  {
    chave: "pregoes",
    rotulo: "Pregões",
    icone: Gavel,
    tonalidade: "bg-success-50 text-success-700 dark:bg-success-900 dark:text-success-300",
  },
  {
    chave: "dispensas",
    rotulo: "Dispensas",
    icone: ShieldCheck,
    tonalidade: "bg-warning-50 text-warning-700 dark:bg-warning-900 dark:text-warning-300",
  },
  {
    chave: "outras",
    rotulo: "Outras modalidades",
    icone: Layers,
    tonalidade: "bg-accent-50 text-accent-700 dark:bg-accent-900 dark:text-accent-300",
  },
];

export function SummaryCards({ resumo }: { resumo: ResumoLicitacoes }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
      {CARTOES.map((cartao) => (
        <div
          key={cartao.chave}
          className="rounded-lg border border-ink-200 bg-white p-3 shadow-card dark:border-ink-700 dark:bg-ink-900"
        >
          <div className="flex items-center gap-2">
            <span className={`inline-flex h-7 w-7 items-center justify-center rounded-md ${cartao.tonalidade}`}>
              <cartao.icone className="h-4 w-4" aria-hidden />
            </span>
            <p className="text-lg font-semibold tabular-nums text-ink-900 dark:text-ink-50">
              {formatarQuantidade(resumo[cartao.chave])}
            </p>
          </div>
          <p className="mt-2 text-sm text-ink-500 dark:text-ink-400">{cartao.rotulo}</p>
        </div>
      ))}
    </div>
  );
}
