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
  { chave: "total", rotulo: "Total encontrado", icone: FileStack, tonalidade: "bg-primary-50 text-primary-600" },
  { chave: "pregoes", rotulo: "Pregões", icone: Gavel, tonalidade: "bg-success-50 text-success-700" },
  { chave: "dispensas", rotulo: "Dispensas", icone: ShieldCheck, tonalidade: "bg-warning-50 text-warning-700" },
  { chave: "outras", rotulo: "Outras modalidades", icone: Layers, tonalidade: "bg-accent-50 text-accent-700" },
];

export function SummaryCards({ resumo }: { resumo: ResumoLicitacoes }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
      {CARTOES.map((cartao) => (
        <div key={cartao.chave} className="rounded-xl border border-ink-200 bg-white p-4 shadow-card">
          <span className={`inline-flex h-9 w-9 items-center justify-center rounded-lg ${cartao.tonalidade}`}>
            <cartao.icone className="h-5 w-5" aria-hidden />
          </span>
          <p className="mt-3 text-2xl font-semibold tabular-nums text-ink-900">
            {formatarQuantidade(resumo[cartao.chave])}
          </p>
          <p className="text-xs text-ink-500">{cartao.rotulo}</p>
        </div>
      ))}
    </div>
  );
}
