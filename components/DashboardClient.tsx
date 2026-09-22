"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { SearchPanel } from "@/components/SearchPanel";
import { AdvancedFilters } from "@/components/AdvancedFilters";
import { QuickSearches } from "@/components/QuickSearches";
import { SummaryCards } from "@/components/SummaryCards";
import { TableFilters } from "@/components/TableFilters";
import { ResultsTable } from "@/components/ResultsTable";
import { ResultCard } from "@/components/ResultCard";
import { Pagination } from "@/components/Pagination";
import { ResultsHeader } from "@/components/ResultsHeader";
import { LoadingState } from "@/components/LoadingState";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { EstadoInicial } from "@/components/EstadoInicial";
import { Drawer } from "@/components/ui/Drawer";
import { LicitacaoDetails } from "@/components/LicitacaoDetails";
import { buscarLicitacoes } from "@/lib/api";
import { ESTADO_TODOS } from "@/lib/data/estados";
import type { PesquisaRapida } from "@/lib/data/dominio";
import type {
  CenarioDemo,
  FiltrosLicitacao,
  Licitacao,
  LicitacoesResponse,
  OrdenacaoOpcao,
} from "@/types/licitacao";

const FILTROS_PADRAO: FiltrosLicitacao = {
  q: "",
  uf: ESTADO_TODOS,
  municipio: ESTADO_TODOS,
};

type StatusBusca = "idle" | "carregando" | "sucesso" | "erro_timeout" | "erro_conexao" | "erro_servidor";

/**
 * Lê os filtros a partir da URL (link compartilhável / voltar do navegador).
 * Retorna `null` quando não há nenhum parâmetro reconhecido — nesse caso a
 * tela abre no estado inicial e só consulta quando o usuário clicar em
 * "Pesquisar", como pede o briefing.
 */
function lerFiltrosDaUrl(searchParams: URLSearchParams): FiltrosLicitacao | null {
  if (Array.from(searchParams.keys()).length === 0) return null;

  return {
    q: searchParams.get("q") ?? "",
    uf: searchParams.get("uf") ?? ESTADO_TODOS,
    municipio: searchParams.get("municipio") ?? ESTADO_TODOS,
    periodo: (searchParams.get("periodo") as FiltrosLicitacao["periodo"]) || undefined,
    dataInicial: searchParams.get("dataInicial") || undefined,
    dataFinal: searchParams.get("dataFinal") || undefined,
    modalidades: searchParams.getAll("modalidade"),
    portais: searchParams.getAll("portal"),
    valorMinimo: searchParams.has("valorMinimo") ? Number(searchParams.get("valorMinimo")) : undefined,
    valorMaximo: searchParams.has("valorMaximo") ? Number(searchParams.get("valorMaximo")) : undefined,
    orgao: searchParams.get("orgao") ?? "",
    numeroLicitacao: searchParams.get("numeroLicitacao") ?? "",
    situacao: searchParams.get("situacao") ?? "",
  };
}

export function DashboardClient() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Inicializadores preguiçosos: rodam uma única vez, na primeira
  // renderização, lendo a URL diretamente — sem precisar de um efeito só
  // para hidratar o estado inicial.
  const [filtrosRascunho, setFiltrosRascunho] = useState<FiltrosLicitacao>(
    () => lerFiltrosDaUrl(searchParams) ?? FILTROS_PADRAO,
  );
  const [filtrosAplicados, setFiltrosAplicados] = useState<FiltrosLicitacao | null>(() =>
    lerFiltrosDaUrl(searchParams),
  );
  const [avancadoAberto, setAvancadoAberto] = useState(false);
  const [pesquisaRapidaAtiva, setPesquisaRapidaAtiva] = useState<string | undefined>();

  const [modalidadeRapida, setModalidadeRapida] = useState(() => searchParams.get("modalidadeRapida") ?? "");
  const [localRapido, setLocalRapido] = useState(() => searchParams.get("localRapido") ?? "");
  const [portalRapido, setPortalRapido] = useState(() => searchParams.get("portalRapido") ?? "");
  const [ordenarPor, setOrdenarPor] = useState<OrdenacaoOpcao>(
    () => (searchParams.get("ordenarPor") as OrdenacaoOpcao) || "encerramento_asc",
  );
  const [pagina, setPagina] = useState(() => Number(searchParams.get("pagina")) || 1);
  const [tamanhoPagina, setTamanhoPagina] = useState(() => Number(searchParams.get("tamanhoPagina")) || 25);
  const [cenario, setCenario] = useState<CenarioDemo>("auto");

  const [status, setStatus] = useState<StatusBusca>("idle");
  const [resultado, setResultado] = useState<LicitacoesResponse | null>(null);
  const [mensagemErro, setMensagemErro] = useState<string | undefined>();

  const [drawerAberto, setDrawerAberto] = useState(false);
  const [licitacaoSelecionada, setLicitacaoSelecionada] = useState<Licitacao | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  const executarBusca = useCallback(async (filtros: FiltrosLicitacao) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setStatus("carregando");
    setMensagemErro(undefined);

    const resultadoBusca = await buscarLicitacoes(filtros, { signal: controller.signal });

    if (controller.signal.aborted) return;

    if (resultadoBusca.status === "sucesso") {
      setResultado(resultadoBusca.dados);
      setStatus("sucesso");
    } else if (resultadoBusca.status === "cancelado") {
      // uma busca mais recente já assumiu; nada a fazer.
    } else if (resultadoBusca.status === "erro_servidor") {
      setStatus("erro_servidor");
      setMensagemErro(resultadoBusca.mensagem);
    } else {
      setStatus(resultadoBusca.status);
    }
  }, []);

  // Dispara a busca sempre que os filtros aplicados, os refinamentos rápidos
  // da tabela, a ordenação, a página ou o cenário de demonstração mudarem —
  // nunca ao digitar no formulário (filtrosRascunho).
  useEffect(() => {
    if (!filtrosAplicados) return;

    const filtrosCompletos: FiltrosLicitacao = {
      ...filtrosAplicados,
      modalidadeRapida: modalidadeRapida || undefined,
      localRapido: localRapido || undefined,
      portalRapido: portalRapido || undefined,
      ordenarPor,
      pagina,
      tamanhoPagina,
      cenario,
    };

    // executarBusca só chama os setters de estado depois de um `await` (a
    // resposta da consulta), nunca de forma síncrona durante este efeito —
    // é o padrão padrão de "buscar dados quando uma dependência muda".
    // eslint-disable-next-line react-hooks/set-state-in-effect
    executarBusca(filtrosCompletos);

    const query = new URLSearchParams();
    const set = (chave: string, valor: string | number | undefined) => {
      if (valor === undefined || valor === "") return;
      query.set(chave, String(valor));
    };
    set("q", filtrosAplicados.q);
    set("uf", filtrosAplicados.uf);
    set("municipio", filtrosAplicados.municipio);
    set("periodo", filtrosAplicados.periodo);
    set("dataInicial", filtrosAplicados.dataInicial);
    set("dataFinal", filtrosAplicados.dataFinal);
    set("valorMinimo", filtrosAplicados.valorMinimo);
    set("valorMaximo", filtrosAplicados.valorMaximo);
    set("orgao", filtrosAplicados.orgao);
    set("numeroLicitacao", filtrosAplicados.numeroLicitacao);
    set("situacao", filtrosAplicados.situacao);
    set("ordenarPor", ordenarPor);
    set("pagina", pagina);
    set("tamanhoPagina", tamanhoPagina);
    set("modalidadeRapida", modalidadeRapida);
    set("localRapido", localRapido);
    set("portalRapido", portalRapido);
    for (const m of filtrosAplicados.modalidades ?? []) query.append("modalidade", m);
    for (const p of filtrosAplicados.portais ?? []) query.append("portal", p);

    router.replace(`${pathname}?${query.toString()}`, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtrosAplicados, modalidadeRapida, localRapido, portalRapido, ordenarPor, pagina, tamanhoPagina, cenario]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  function atualizarRascunho(patch: Partial<FiltrosLicitacao>) {
    setFiltrosRascunho((atual) => ({ ...atual, ...patch }));
  }

  function pesquisar() {
    setPesquisaRapidaAtiva(undefined);
    setModalidadeRapida("");
    setLocalRapido("");
    setPortalRapido("");
    setPagina(1);
    setFiltrosAplicados({ ...filtrosRascunho });
  }

  function aoSelecionarPesquisaRapida(pesquisa: PesquisaRapida) {
    const proximosFiltros = { ...filtrosRascunho, q: pesquisa.palavrasChave };
    setFiltrosRascunho(proximosFiltros);
    setPesquisaRapidaAtiva(pesquisa.id);
    setModalidadeRapida("");
    setLocalRapido("");
    setPortalRapido("");
    setPagina(1);
    setFiltrosAplicados(proximosFiltros);
  }

  function abrirDetalhes(item: Licitacao) {
    setLicitacaoSelecionada(item);
    setDrawerAberto(true);
  }

  function tentarNovamente() {
    if (!filtrosAplicados) return;
    executarBusca({
      ...filtrosAplicados,
      modalidadeRapida: modalidadeRapida || undefined,
      localRapido: localRapido || undefined,
      portalRapido: portalRapido || undefined,
      ordenarPor,
      pagina,
      tamanhoPagina,
      cenario,
    });
  }

  const temResultadoAnterior = resultado !== null;
  const emErro = status === "erro_timeout" || status === "erro_conexao" || status === "erro_servidor";
  const carregandoInicial = status === "carregando" && !temResultadoAnterior;
  const atualizando = status === "carregando" && temResultadoAnterior;
  const tipoErro = status === "erro_timeout" ? "timeout" : status === "erro_conexao" ? "conexao" : "servidor";

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink-900">Pesquisar licitações</h1>
        <p className="mt-1 text-sm text-ink-500">
          Consulte oportunidades diretamente no PNCP utilizando filtros personalizados.
        </p>
      </div>

      <SearchPanel
        filtros={filtrosRascunho}
        onChange={atualizarRascunho}
        avancadoAberto={avancadoAberto}
        onToggleAvancado={() => setAvancadoAberto((v) => !v)}
        onPesquisar={pesquisar}
        carregando={status === "carregando"}
      />

      <AdvancedFilters aberto={avancadoAberto} filtros={filtrosRascunho} onChange={atualizarRascunho} />

      <QuickSearches onSelecionar={aoSelecionarPesquisaRapida} idAtivo={pesquisaRapidaAtiva} />

      <div className="overflow-hidden rounded-2xl border border-ink-200 bg-white shadow-card">
        {!filtrosAplicados && <EstadoInicial />}

        {filtrosAplicados && emErro && (
          <ErrorState tipo={tipoErro} mensagem={mensagemErro} onTentarNovamente={tentarNovamente} />
        )}

        {filtrosAplicados && carregandoInicial && <LoadingState />}

        {filtrosAplicados && !emErro && resultado && (
          <>
            <ResultsHeader
              total={resultado.total}
              consultadoEm={resultado.meta.consultadoEm}
              cenario={cenario}
              onChangeCenario={(c) => {
                setCenario(c);
                setPagina(1);
              }}
              atualizando={atualizando}
            />

            <div className="px-4 py-4 sm:px-6">
              <SummaryCards resumo={resultado.summary} />
            </div>

            {resultado.total > 0 ? (
              <>
                <TableFilters
                  facets={resultado.facets}
                  modalidadeRapida={modalidadeRapida}
                  localRapido={localRapido}
                  portalRapido={portalRapido}
                  ordenarPor={ordenarPor}
                  onChangeModalidade={(v) => {
                    setModalidadeRapida(v);
                    setPagina(1);
                  }}
                  onChangeLocal={(v) => {
                    setLocalRapido(v);
                    setPagina(1);
                  }}
                  onChangePortal={(v) => {
                    setPortalRapido(v);
                    setPagina(1);
                  }}
                  onChangeOrdenacao={setOrdenarPor}
                />

                <div className={atualizando ? "opacity-60 transition-opacity" : "transition-opacity"}>
                  <ResultsTable itens={resultado.items} onVerDetalhes={abrirDetalhes} />
                  <div className="space-y-3 p-4 sm:hidden">
                    {resultado.items.map((item) => (
                      <ResultCard key={item.id} item={item} onVerDetalhes={abrirDetalhes} />
                    ))}
                  </div>
                </div>

                <Pagination
                  page={resultado.page}
                  pageSize={resultado.pageSize}
                  total={resultado.total}
                  totalPages={resultado.totalPages}
                  onChangePage={setPagina}
                  onChangePageSize={(size) => {
                    setTamanhoPagina(size);
                    setPagina(1);
                  }}
                />
              </>
            ) : (
              <EmptyState />
            )}
          </>
        )}
      </div>

      <Drawer aberto={drawerAberto} onFechar={() => setDrawerAberto(false)} titulo="Detalhes da licitação">
        {licitacaoSelecionada && <LicitacaoDetails item={licitacaoSelecionada} />}
      </Drawer>
    </div>
  );
}
