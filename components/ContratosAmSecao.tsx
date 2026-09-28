"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, FileSignature, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { formatarDataSimples, formatarMoeda } from "@/lib/formatters";
import type { ContratoEstadual, ResultadoContratosAm } from "@/types/am";

export type EstadoContratosAm =
  | { status: "carregando" }
  | ({ status: "sucesso" } & ResultadoContratosAm)
  | { status: "erro"; mensagem?: string };

const VISIVEIS = 5;

export function vigencia(c: Pick<ContratoEstadual, "dataInicio" | "dataFim">): string | undefined {
  if (!c.dataInicio && !c.dataFim) return undefined;
  return [formatarDataSimples(c.dataInicio), formatarDataSimples(c.dataFim)].filter(Boolean).join(" a ");
}

function ItemContrato({ contrato: c }: { contrato: ContratoEstadual }) {
  return (
    <li className="rounded-lg border border-ink-200 p-3 dark:border-ink-700">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="text-sm text-ink-900 dark:text-ink-50">{c.objeto ?? "Objeto não informado"}</p>
        <div className="flex shrink-0 flex-wrap items-center gap-1.5">
          {c.vigente && <Badge tone="success">Vigente</Badge>}
          {c.valorTotal !== undefined && (
            <span className="text-sm font-medium tabular-nums text-ink-900 dark:text-ink-50">
              {formatarMoeda(c.valorTotal)}
            </span>
          )}
        </div>
      </div>
      <p className="mt-1 text-xs text-ink-500 dark:text-ink-400">
        {[c.ugSigla ?? c.ugNome, c.termo, vigencia(c) && `vigência ${vigencia(c)}`, c.processoCompra && `processo ${c.processoCompra}`]
          .filter(Boolean)
          .join(" · ")}
      </p>
      {c.aditivos.length > 0 && (
        <p className="mt-0.5 text-xs text-ink-500 dark:text-ink-400">
          {c.aditivos.length === 1 ? "1 aditivo" : `${c.aditivos.length} aditivos`} (último: {c.aditivos.at(-1)?.termo}
          {c.aditivos.at(-1)?.detalhamento && ` — ${c.aditivos.at(-1)?.detalhamento}`})
        </p>
      )}
    </li>
  );
}

/** Seção da consulta de CNPJ com os contratos da empresa com o Governo do Amazonas (SGC da SEFAZ-AM). */
export function ContratosAmSecao({ estado, cnpj }: { estado: EstadoContratosAm; cnpj: string }) {
  const [todos, setTodos] = useState(false);

  return (
    <div className="mt-5 border-t border-ink-100 pt-5 dark:border-ink-800">
      <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-ink-500 dark:text-ink-400">
        <FileSignature className="h-3.5 w-3.5" aria-hidden />
        Contratos com o Governo do Amazonas
      </p>

      {estado.status === "carregando" && (
        <p className="mt-2 flex items-center gap-1.5 text-sm text-ink-500 dark:text-ink-400">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Procurando nos contratos de todos os órgãos do estado…
        </p>
      )}

      {estado.status === "erro" && (
        <p className="mt-2 text-sm text-danger-600 dark:text-danger-400">
          {estado.mensagem ?? "Não foi possível consultar os contratos do Governo do Amazonas neste momento."}
        </p>
      )}

      {estado.status === "sucesso" && estado.contratos.length === 0 && (
        <p className="mt-2 text-sm text-ink-600 dark:text-ink-300">
          Nenhum contrato com o Governo do Amazonas entre {estado.anos.inicio} e {estado.anos.fim}.
        </p>
      )}

      {estado.status === "sucesso" && estado.contratos.length > 0 && (
        <div className="mt-2">
          <p className="text-sm text-ink-700 dark:text-ink-200">
            {estado.contratos.length === 1 ? "1 contrato" : `${estado.contratos.length} contratos`} ·{" "}
            {(() => {
              const vigentes = estado.contratos.filter((c) => c.vigente).length;
              return vigentes === 1 ? "1 vigente" : `${vigentes} vigentes`;
            })()}
          </p>
          <ul className="mt-2 space-y-2">
            {(todos ? estado.contratos : estado.contratos.slice(0, VISIVEIS)).map((c) => (
              <ItemContrato key={c.chave} contrato={c} />
            ))}
          </ul>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
            {estado.contratos.length > VISIVEIS && (
              <button
                type="button"
                onClick={() => setTodos(!todos)}
                className="text-xs font-medium text-primary-600 hover:underline dark:text-primary-400"
              >
                {todos ? "Mostrar menos" : `Mostrar todos (${estado.contratos.length})`}
              </button>
            )}
            <Link
              href={`/empenhos-am?cnpj=${cnpj}`}
              className="inline-flex items-center gap-1 text-xs font-medium text-primary-600 hover:underline dark:text-primary-400"
            >
              Ver empenhos a receber
              <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          </div>
        </div>
      )}

      {estado.status === "sucesso" && (
        <p className="mt-2 text-xs text-ink-400 dark:text-ink-500">
          Fonte: SGC — Sistema de Gestão de Contratos da SEFAZ-AM. Contratos de {estado.anos.fim - 1} e{" "}
          {estado.anos.fim}, e os ainda vigentes desde {estado.anos.inicio}.
          {!estado.completo && " Alguns órgãos não responderam — a lista pode estar incompleta."}
        </p>
      )}
    </div>
  );
}
