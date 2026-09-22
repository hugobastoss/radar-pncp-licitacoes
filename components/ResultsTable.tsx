"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { PortalBadge } from "@/components/PortalBadge";
import { PrazoIndicador } from "@/components/PrazoIndicador";
import { AcoesLicitacao } from "@/components/AcoesLicitacao";
import { grupoDaModalidade } from "@/lib/data/dominio";
import {
  formatarLocal,
  formatarMoeda,
  formatarNumeroLicitacao,
  truncarTexto,
} from "@/lib/formatters";
import type { Licitacao } from "@/types/licitacao";

const TONE_POR_GRUPO = {
  pregao: "primary",
  dispensa: "warning",
  outra: "accent",
} as const;

interface ResultsTableProps {
  itens: Licitacao[];
  onVerDetalhes: (item: Licitacao) => void;
}

const LIMITE_CARACTERES_OBJETO = 90;

export function ResultsTable({ itens, onVerDetalhes }: ResultsTableProps) {
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set());

  function alternarExpandido(id: string) {
    setExpandidos((atual) => {
      const proximo = new Set(atual);
      if (proximo.has(id)) proximo.delete(id);
      else proximo.add(id);
      return proximo;
    });
  }

  return (
    <div className="hidden overflow-x-auto scrollbar-fina sm:block">
      <table className="w-full min-w-[960px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-ink-200 bg-ink-25 text-left text-xs font-semibold uppercase tracking-wide text-ink-500">
            <th scope="col" className="px-4 py-3">Encerramento</th>
            <th scope="col" className="px-4 py-3">Licitação</th>
            <th scope="col" className="px-4 py-3">Órgão / Objeto</th>
            <th scope="col" className="px-4 py-3">Modalidade</th>
            <th scope="col" className="px-4 py-3">Local</th>
            <th scope="col" className="px-4 py-3">Portal</th>
            <th scope="col" className="px-4 py-3 text-right">Valor estimado</th>
            <th scope="col" className="px-4 py-3 text-right">Ações</th>
          </tr>
        </thead>
        <tbody>
          {itens.map((item) => {
            const grupo = grupoDaModalidade(item.modalidade);
            const objetoExpandido = expandidos.has(item.id);
            const { truncado, foiTruncado } = truncarTexto(item.objeto, LIMITE_CARACTERES_OBJETO);

            return (
              <tr key={item.id} className="border-b border-ink-100 align-top hover:bg-ink-25/60">
                <td className="px-4 py-4">
                  <PrazoIndicador dataEncerramento={item.dataEncerramento} />
                </td>
                <td className="px-4 py-4">
                  <span className="font-medium text-ink-900">
                    {formatarNumeroLicitacao(item.modalidade, item.numeroLicitacao)}
                  </span>
                  {item.numeroControlePNCP && (
                    <p className="mt-0.5 text-xs text-ink-500">PNCP {item.numeroControlePNCP}</p>
                  )}
                </td>
                <td className="max-w-xs px-4 py-4">
                  <p className="font-medium text-ink-900">{item.orgao ?? "Órgão não informado"}</p>
                  <p className="mt-0.5 text-ink-500">
                    {objetoExpandido ? item.objeto ?? "Objeto não informado" : truncado}
                  </p>
                  {foiTruncado && (
                    <button
                      type="button"
                      onClick={() => alternarExpandido(item.id)}
                      className="mt-1 inline-flex items-center gap-0.5 text-xs font-medium text-primary-600 hover:text-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                    >
                      {objetoExpandido ? (
                        <>
                          Ver menos <ChevronUp className="h-3 w-3" aria-hidden />
                        </>
                      ) : (
                        <>
                          Ver objeto completo <ChevronDown className="h-3 w-3" aria-hidden />
                        </>
                      )}
                    </button>
                  )}
                </td>
                <td className="px-4 py-4">
                  <Badge tone={TONE_POR_GRUPO[grupo]}>{item.modalidade ?? "Não informada"}</Badge>
                </td>
                <td className="px-4 py-4 text-ink-700">{formatarLocal(item.municipio, item.uf)}</td>
                <td className="px-4 py-4">
                  <PortalBadge linkSistemaOrigem={item.linkSistemaOrigem} />
                </td>
                <td className="px-4 py-4 text-right font-medium tabular-nums text-ink-900">
                  {formatarMoeda(item.valorEstimado, item.valorSigiloso)}
                </td>
                <td className="px-4 py-4">
                  <AcoesLicitacao item={item} variante="tabela" onVerDetalhes={onVerDetalhes} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
