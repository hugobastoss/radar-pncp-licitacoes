"use client";

import { CircleHelp, Download, FileCheck2, Loader2, ShieldAlert, ShieldCheck } from "lucide-react";
import { linkPdfCertidaoTcu } from "@/lib/api-tcu";
import { cn } from "@/lib/cn";
import type { CertidaoTcu, ItemCertidaoTcu } from "@/types/tcu";

export type EstadoCertidaoTcu =
  | { status: "carregando" }
  | ({ status: "sucesso" } & CertidaoTcu)
  | { status: "erro"; mensagem?: string };

const ROTULO_SITUACAO: Record<ItemCertidaoTcu["situacao"], string> = {
  nada_consta: "Nada consta",
  consta: "Constam registros",
  indisponivel: "Não consultado",
};

function ItemCertidao({ item: i }: { item: ItemCertidaoTcu }) {
  const Icone = i.situacao === "nada_consta" ? ShieldCheck : i.situacao === "consta" ? ShieldAlert : CircleHelp;
  return (
    <li className="flex items-start gap-2 text-sm">
      <Icone
        className={cn(
          "mt-0.5 h-4 w-4 shrink-0",
          i.situacao === "nada_consta" && "text-success-600 dark:text-success-300",
          i.situacao === "consta" && "text-danger-600 dark:text-danger-400",
          i.situacao === "indisponivel" && "text-ink-400",
        )}
        aria-hidden
      />
      <div className="min-w-0">
        <p className="text-ink-900 dark:text-ink-50">
          <span
            className={cn(
              "font-medium",
              i.situacao === "consta" && "text-danger-700 dark:text-danger-300",
              i.situacao === "nada_consta" && "text-success-700 dark:text-success-300",
            )}
          >
            {ROTULO_SITUACAO[i.situacao]}
          </span>{" "}
          : {i.descricao} <span className="text-xs text-ink-500 dark:text-ink-400">({i.emissor})</span>
        </p>
        {i.observacao && <p className="mt-0.5 text-xs text-ink-600 dark:text-ink-300">{i.observacao}</p>}
      </div>
    </li>
  );
}

/**
 * Certidão consolidada do TCU: inidôneos (TCU), improbidade (CNJ), CEIS e
 * CNEP. Usada na consulta de CNPJ e na de sanções.
 */
export function CertidaoTcuSecao({ estado, cnpj, className }: { estado: EstadoCertidaoTcu; cnpj: string; className?: string }) {
  const constaAlgo = estado.status === "sucesso" && estado.itens.some((i) => i.situacao === "consta");

  return (
    <div className={className}>
      <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-ink-500 dark:text-ink-400">
        <FileCheck2 className="h-3.5 w-3.5" aria-hidden />
        Certidão consolidada (TCU)
      </p>

      {estado.status === "carregando" && (
        <p className="mt-2 flex items-center gap-1.5 text-sm text-ink-500 dark:text-ink-400">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Consultando inidôneos do TCU, improbidade (CNJ), CEIS e CNEP…
        </p>
      )}

      {estado.status === "erro" && (
        <p className="mt-2 text-sm text-danger-600 dark:text-danger-400">
          {estado.mensagem ?? "Não foi possível consultar o TCU neste momento."}
        </p>
      )}

      {estado.status === "sucesso" && (
        <>
          <ul className="mt-2 space-y-1.5">
            {estado.itens.map((i) => (
              <ItemCertidao key={i.tipo} item={i} />
            ))}
          </ul>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
            <a
              href={linkPdfCertidaoTcu(cnpj)}
              download
              className="inline-flex items-center gap-1 text-xs font-medium text-primary-600 hover:underline dark:text-primary-400"
            >
              <Download className="h-3.5 w-3.5" aria-hidden />
              Baixar certidão (PDF)
            </a>
            <span className="text-xs text-ink-400 dark:text-ink-500">
              {estado.emitidaEm && `Emitida em ${estado.emitidaEm}. `}
              {constaAlgo
                ? "A certidão mostra os registros acima."
                : "Serve para anexar na habilitação de uma licitação."}
            </span>
          </div>
        </>
      )}
    </div>
  );
}
