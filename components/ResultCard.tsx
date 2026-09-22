"use client";

import { useState } from "react";
import { Calendar, ChevronDown, ChevronUp, MapPin, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { AcoesLicitacao } from "@/components/AcoesLicitacao";
import { grupoDaModalidade, tonalidadeDaSituacao } from "@/lib/data/dominio";
import { formatarDataHoraCurta, formatarLocal, formatarMoeda, truncarTexto } from "@/lib/formatters";
import type { Licitacao } from "@/types/licitacao";

const TONE_POR_GRUPO = {
  pregao: "primary",
  dispensa: "warning",
  outra: "accent",
} as const;

const LIMITE_CARACTERES_OBJETO_MOBILE = 110;

interface ResultCardProps {
  item: Licitacao;
  onVerDetalhes: (item: Licitacao) => void;
}

export function ResultCard({ item, onVerDetalhes }: ResultCardProps) {
  const [expandido, setExpandido] = useState(false);
  const grupo = grupoDaModalidade(item.modalidade);
  const { truncado, foiTruncado } = truncarTexto(item.objeto, LIMITE_CARACTERES_OBJETO_MOBILE);

  return (
    <article className="rounded-xl border border-ink-200 bg-white p-4 shadow-card dark:border-ink-700 dark:bg-ink-900">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-semibold text-ink-900 dark:text-ink-50">
          {item.numeroLicitacao ? `Nº ${item.numeroLicitacao}` : "Número não informado"}
        </p>
        <Badge tone={TONE_POR_GRUPO[grupo]} className="shrink-0">
          {item.modalidade ?? "Não informada"}
        </Badge>
      </div>

      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="inline-flex min-w-0 items-center gap-1.5 text-sm text-ink-600 dark:text-ink-300">
          <MapPin className="h-4 w-4 shrink-0 text-ink-400 dark:text-ink-500" aria-hidden />
          <span className="truncate">{formatarLocal(item.municipio, item.uf)}</span>
        </span>
        <Badge tone={tonalidadeDaSituacao(item.situacao)} className="shrink-0">
          {item.situacao ?? "Não informada"}
        </Badge>
      </div>

      <p className="mt-2 flex items-center gap-1.5 text-sm text-ink-500 dark:text-ink-400">
        <Calendar className="h-4 w-4 text-ink-400 dark:text-ink-500" aria-hidden />
        {formatarDataHoraCurta(item.dataEncerramento)}
      </p>

      <p className="mt-2 text-sm text-ink-500 dark:text-ink-400">
        {expandido ? item.objeto ?? "Objeto não informado" : truncado}
        {foiTruncado && (
          <button
            type="button"
            onClick={() => setExpandido((v) => !v)}
            className="ml-1 inline-flex items-center gap-0.5 align-middle text-xs font-medium text-primary-600 dark:text-primary-400"
          >
            {expandido ? (
              <>
                ver menos <ChevronUp className="h-3 w-3" aria-hidden />
              </>
            ) : (
              <>
                ver mais <ChevronDown className="h-3 w-3" aria-hidden />
              </>
            )}
          </button>
        )}
      </p>

      <p className="mt-2 flex items-center gap-1.5 text-sm font-semibold tabular-nums text-ink-900 dark:text-ink-50">
        <Wallet className="h-4 w-4 text-ink-400 dark:text-ink-500" aria-hidden />
        {formatarMoeda(item.valorEstimado, item.valorSigiloso)}
      </p>

      <div className="mt-4 flex gap-2">
        <AcoesLicitacao item={item} onVerDetalhes={onVerDetalhes} />
      </div>
    </article>
  );
}
