"use client";

import { useRef, useState } from "react";
import { Calendar, ChevronDown, ChevronsDownUp, ChevronsUpDown, ChevronUp, ExternalLink, FileSearch } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Campo } from "@/components/LicitacaoDetails";
import { DocumentosLicitacao } from "@/components/DocumentosLicitacao";
import { cn } from "@/lib/cn";
import { grupoDaModalidade, rotuloSituacao, tonalidadeDaSituacao } from "@/lib/data/dominio";
import { formatarDataHora, formatarDataHoraCurta, formatarLocal, formatarMoeda } from "@/lib/formatters";
import { identificarPortal, isLinkExternoSeguro } from "@/lib/portal";
import type { Licitacao } from "@/types/licitacao";

interface ResultsTableProps {
  itens: Licitacao[];
  /** Empilha o cabeçalho congelado abaixo da FiltrosAtivosBar (h-12) em vez de direto sob o Header. */
  temFiltrosAtivos?: boolean;
}

const TONE_POR_GRUPO = {
  pregao: "primary",
  dispensa: "warning",
  outra: "accent",
} as const;

const COLUNAS =
  "grid grid-cols-[minmax(180px,1.3fr)_minmax(130px,0.9fr)_minmax(150px,1fr)_minmax(110px,0.7fr)_minmax(120px,0.8fr)_40px]";

function PainelExpandido({ item }: { item: Licitacao }) {
  const pncpSeguro = isLinkExternoSeguro(item.linkPNCP);
  const portalSeguro = isLinkExternoSeguro(item.linkSistemaOrigem);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <div>
        <Campo rotulo="Órgão" valor={item.orgao ?? "Órgão não informado"} />
        <div className="mt-4">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-500 dark:text-ink-400">Objeto completo</p>
          <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-ink-700 dark:text-ink-200">
            {item.objeto ?? "Objeto não informado"}
          </p>
        </div>

        <div className="mt-4">
          <DocumentosLicitacao item={item} />
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            size="sm"
            leftIcon={<FileSearch className="h-4 w-4" aria-hidden />}
            disabled={!pncpSeguro}
            title={pncpSeguro ? undefined : "Link do PNCP não informado"}
            onClick={() => pncpSeguro && window.open(item.linkPNCP, "_blank", "noopener,noreferrer")}
          >
            Abrir no PNCP
          </Button>
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<ExternalLink className="h-4 w-4" aria-hidden />}
            disabled={!portalSeguro}
            title={portalSeguro ? undefined : "Link do portal de origem não informado"}
            onClick={() => portalSeguro && window.open(item.linkSistemaOrigem, "_blank", "noopener,noreferrer")}
          >
            Portal de origem
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-6 gap-y-4">
        <Campo rotulo="Situação" valor={rotuloSituacao(item.situacao, item.dataAbertura)} />
        <Campo rotulo="Modo de disputa" valor={item.modoDisputa ?? "Não informado"} />
        <Campo rotulo="Portal" valor={identificarPortal(item.linkSistemaOrigem).nome} />
        <Campo rotulo="Abertura" valor={formatarDataHora(item.dataAbertura)} />
        <Campo rotulo="Encerramento" valor={formatarDataHora(item.dataEncerramento)} />
        <Campo rotulo="CNPJ do órgão" valor={item.cnpjOrgao ?? "Não informado"} />
        <Campo rotulo="Controle PNCP" valor={item.numeroControlePNCP ?? "Não informado"} />
      </div>
    </div>
  );
}

export function ResultsTable({ itens, temFiltrosAtivos }: ResultsTableProps) {
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set());

  function alternarExpandido(id: string) {
    setExpandidos((atual) => {
      const proximo = new Set(atual);
      if (proximo.has(id)) proximo.delete(id);
      else proximo.add(id);
      return proximo;
    });
  }

  const todosExpandidos = itens.length > 0 && itens.every((item) => expandidos.has(item.id));

  function alternarTodos() {
    setExpandidos(todosExpandidos ? new Set() : new Set(itens.map((item) => item.id)));
  }

  const corpoRef = useRef<HTMLDivElement>(null);
  const cabecalhoRef = useRef<HTMLDivElement>(null);

  // O cabeçalho fica "congelado" (sticky) abaixo da barra superior do app —
  // mas como ele rola na horizontal junto com o corpo (tabela larga,
  // min-w-[800px]), os dois viram containers de scroll horizontal
  // independentes (não dá pra aninhar um dentro do outro sem quebrar o
  // sticky, que precisa "enxergar" a janela de verdade, não um ancestral com
  // overflow). Por isso sincronizamos o scrollLeft manualmente entre eles.
  function sincronizarDoCabecalho() {
    if (corpoRef.current && cabecalhoRef.current) {
      corpoRef.current.scrollLeft = cabecalhoRef.current.scrollLeft;
    }
  }
  function sincronizarDoCorpo() {
    if (corpoRef.current && cabecalhoRef.current) {
      cabecalhoRef.current.scrollLeft = corpoRef.current.scrollLeft;
    }
  }

  return (
    <div className="hidden sm:block">
      <div
        ref={cabecalhoRef}
        onScroll={sincronizarDoCabecalho}
        className={cn(
          "sticky z-20 overflow-x-auto scrollbar-fina border-b border-ink-200 bg-white px-4 dark:border-ink-700 dark:bg-ink-900",
          temFiltrosAtivos ? "top-28" : "top-16",
        )}
      >
        <div
          className={cn(
            COLUNAS,
            "min-w-[800px] items-center gap-4 py-2 text-xs font-semibold uppercase tracking-wide text-ink-500 dark:text-ink-400",
          )}
        >
          <span>Local</span>
          <span>Situação</span>
          <span>Licitação</span>
          <span>Número</span>
          <span className="text-right">Valor</span>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={alternarTodos}
              aria-label={todosExpandidos ? "Recolher todos os detalhes" : "Expandir todos os detalhes"}
              title={todosExpandidos ? "Recolher todos" : "Expandir todos"}
              className="inline-flex h-6 w-6 items-center justify-center rounded-md normal-case text-ink-400 hover:bg-ink-100 hover:text-ink-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:text-ink-500 dark:hover:bg-ink-800 dark:hover:text-ink-200"
            >
              {todosExpandidos ? (
                <ChevronsDownUp className="h-4 w-4" aria-hidden />
              ) : (
                <ChevronsUpDown className="h-4 w-4" aria-hidden />
              )}
            </button>
          </div>
        </div>
      </div>

      <div ref={corpoRef} onScroll={sincronizarDoCorpo} className="overflow-x-auto scrollbar-fina p-4">
        <div className="min-w-[800px]">
          <div className="flex flex-col gap-3">
            {itens.map((item) => {
              const expandido = expandidos.has(item.id);
              const idPainel = `detalhes-licitacao-${item.id}`;

              return (
                <div
                  key={item.id}
                  className="overflow-hidden rounded-xl border border-ink-200 bg-white shadow-card dark:border-ink-700 dark:bg-ink-900"
                >
                  <div
                    onClick={() => alternarExpandido(item.id)}
                    aria-expanded={expandido}
                    className={cn(
                      COLUNAS,
                      "cursor-pointer items-center gap-4 px-4 py-4",
                      !expandido && "hover:bg-ink-25/60 dark:hover:bg-ink-800/60",
                    )}
                  >
                    <div>
                      <p className="text-lg font-semibold text-ink-900 dark:text-ink-50">
                        {formatarLocal(item.municipio, item.uf)}
                      </p>
                      <p className="mt-1.5 flex items-center gap-1.5 text-base text-ink-500 dark:text-ink-400">
                        <Calendar className="h-3.5 w-3.5" aria-hidden />
                        {formatarDataHoraCurta(item.dataEncerramento)}
                      </p>
                    </div>

                    <div>
                      <Badge tone={tonalidadeDaSituacao(item.situacao)} className="uppercase">
                        {rotuloSituacao(item.situacao, item.dataAbertura)}
                      </Badge>
                    </div>

                    <div>
                      <Badge tone={TONE_POR_GRUPO[grupoDaModalidade(item.modalidade)]} className="uppercase">
                        {item.modalidade ?? "Não informada"}
                      </Badge>
                    </div>

                    <div>
                      <span className="font-medium tabular-nums text-ink-900 dark:text-ink-50">
                        {item.numeroLicitacao ?? "Não informado"}
                      </span>
                    </div>

                    <div className="text-right font-medium tabular-nums text-ink-900 dark:text-ink-50">
                      {formatarMoeda(item.valorEstimado, item.valorSigiloso)}
                    </div>

                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          alternarExpandido(item.id);
                        }}
                        aria-expanded={expandido}
                        aria-controls={idPainel}
                        aria-label={expandido ? "Recolher detalhes da licitação" : "Expandir detalhes da licitação"}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-ink-400 hover:bg-ink-100 hover:text-ink-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:text-ink-500 dark:hover:bg-ink-800 dark:hover:text-ink-200"
                      >
                        {expandido ? (
                          <ChevronUp className="h-4 w-4" aria-hidden />
                        ) : (
                          <ChevronDown className="h-4 w-4" aria-hidden />
                        )}
                      </button>
                    </div>
                  </div>

                  {expandido && (
                    <div
                      id={idPainel}
                      className="border-t border-ink-200 bg-primary-50 px-4 py-5 dark:border-ink-700 dark:bg-ink-800 sm:px-6"
                    >
                      <PainelExpandido item={item} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
