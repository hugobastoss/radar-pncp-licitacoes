"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/cn";
import { formatarMoeda } from "@/lib/formatters";
import { isLinkExternoSeguro } from "@/lib/portal";
import type { Sancao } from "@/types/transparencia";

/** Quantas sanções há e quantas barram licitar/contratar — pro selo do topo das telas. */
export function resumirSancoes(sancoes: Sancao[]): { total: number; impeditivas: number } {
  return { total: sancoes.length, impeditivas: sancoes.filter((s) => s.impedeContratar).length };
}

/** Ex.: "2 sanções — 1 impede licitar ou contratar." Onde vale cada impedimento está em cada item. */
export function descreverResumoSancoes(sancoes: Sancao[]): string {
  const { total, impeditivas } = resumirSancoes(sancoes);
  const quantidade = total === 1 ? "1 sanção" : `${total} sanções`;
  if (impeditivas === 0) return `${quantidade} — nenhuma impede licitar ou contratar.`;
  if (impeditivas === total) return `${quantidade} — ${total === 1 ? "impede" : "todas impedem"} licitar ou contratar.`;
  return `${quantidade} — ${impeditivas} ${impeditivas === 1 ? "impede" : "impedem"} licitar ou contratar.`;
}

function capitalizar(texto: string): string {
  const minusculo = texto.toLowerCase();
  return minusculo.charAt(0).toUpperCase() + minusculo.slice(1);
}

function Linha({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <p className="text-xs text-ink-600 dark:text-ink-300">
      <span className="font-medium text-ink-700 dark:text-ink-200">{rotulo}: </span>
      {children}
    </p>
  );
}

/** Usado na consulta de sanções (SancoesClient) e na de CNPJ (CnpjClient). */
export function SancaoItem({ sancao: s }: { sancao: Sancao }) {
  const [detalhes, setDetalhes] = useState(false);
  const orgao = s.orgaoSancionador;
  const localOrgao = [orgao?.uf, orgao?.esfera && capitalizar(orgao.esfera), orgao?.poder].filter(Boolean).join(" · ");
  const linkSeguro = s.publicacao?.link && isLinkExternoSeguro(s.publicacao.link) ? s.publicacao.link : undefined;

  const vigencia = s.dataFimSancao
    ? `${s.dataInicioSancao ? `de ${s.dataInicioSancao} ` : ""}até ${s.dataFimSancao}`
    : `${s.dataInicioSancao ? `desde ${s.dataInicioSancao}, ` : ""}sem prazo determinado`;

  const temDetalhes =
    s.fundamentacao.length > 0 ||
    s.numeroProcesso ||
    s.publicacao ||
    s.dataPublicacao ||
    s.dataTransitoJulgado ||
    orgao?.telefone ||
    orgao?.endereco ||
    s.informacoesAdicionais;

  return (
    <li
      className={cn(
        "rounded-lg border p-3",
        s.impedeContratar
          ? "border-danger-200 bg-danger-50 dark:border-danger-900 dark:bg-danger-900/30"
          : "border-warning-200 bg-warning-50 dark:border-warning-900 dark:bg-warning-900/30",
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={s.impedeContratar ? "danger" : "warning"}>{s.tipo}</Badge>
        <Badge tone={s.impedeContratar ? "danger" : "warning"}>
          {s.impedeContratar ? "Impede contratar" : "Não impede contratar"}
        </Badge>
        <span className="text-sm font-medium text-ink-900 dark:text-ink-50">{s.tipoSancao}</span>
      </div>

      <div className="mt-2 space-y-1">
        {s.abrangencia && <Linha rotulo="Onde vale">{s.abrangencia}</Linha>}
        <Linha rotulo="Vigência">{vigencia}</Linha>
        {orgao && (
          <Linha rotulo="Órgão sancionador">
            {orgao.nome}
            {localOrgao && ` (${localOrgao})`}
          </Linha>
        )}
        {s.valorMulta !== undefined && <Linha rotulo="Multa">{formatarMoeda(s.valorMulta)}</Linha>}
      </div>

      {temDetalhes && (
        <button
          type="button"
          onClick={() => setDetalhes(!detalhes)}
          aria-expanded={detalhes}
          className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary-600 hover:underline dark:text-primary-400"
        >
          {detalhes ? <ChevronUp className="h-3.5 w-3.5" aria-hidden /> : <ChevronDown className="h-3.5 w-3.5" aria-hidden />}
          {detalhes ? "Menos detalhes" : "Mais detalhes"}
        </button>
      )}

      {detalhes && (
        <div className="mt-2 space-y-1 border-t border-ink-200/70 pt-2 dark:border-ink-700/70">
          {s.fundamentacao.length > 0 && (
            <div className="text-xs text-ink-600 dark:text-ink-300">
              <span className="font-medium text-ink-700 dark:text-ink-200">Fundamentação legal:</span>
              <ul className="mt-0.5 list-disc space-y-0.5 pl-4">
                {s.fundamentacao.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            </div>
          )}
          {s.numeroProcesso && <Linha rotulo="Processo">{s.numeroProcesso}</Linha>}
          {s.dataPublicacao && <Linha rotulo="Publicada em">{s.dataPublicacao}</Linha>}
          {(s.publicacao?.texto || s.publicacao?.detalhamento || linkSeguro) && (
            <Linha rotulo="Publicação">
              {[s.publicacao?.texto, s.publicacao?.detalhamento].filter(Boolean).join(" — ")}
              {linkSeguro && (
                <a
                  href={linkSeguro}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-1 inline-flex items-center gap-0.5 text-primary-600 hover:underline dark:text-primary-400"
                >
                  abrir
                  <ExternalLink className="h-3 w-3" aria-hidden />
                  <span className="sr-only">(abre em nova aba)</span>
                </a>
              )}
            </Linha>
          )}
          {s.dataTransitoJulgado && <Linha rotulo="Trânsito em julgado">{s.dataTransitoJulgado}</Linha>}
          {(orgao?.telefone || orgao?.endereco) && (
            <Linha rotulo="Contato do órgão">{[orgao?.telefone, orgao?.endereco].filter(Boolean).join(" · ")}</Linha>
          )}
          {s.informacoesAdicionais && <Linha rotulo="Informações adicionais">{s.informacoesAdicionais}</Linha>}
        </div>
      )}
    </li>
  );
}
