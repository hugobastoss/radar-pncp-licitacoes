"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { SearchPanel } from "@/components/SearchPanel";
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
import { chaveMunicipio, grupoDaModalidade, normalizarTexto, ordenar } from "@/lib/data/dominio";
import { cn } from "@/lib/cn";
import type { PesquisaRapida } from "@/lib/data/dominio";
import type { FiltrosLicitacao, Licitacao, LicitacoesResponse, OrdenacaoOpcao } from "@/types/licitacao";

const FILTROS_PADRAO: FiltrosLicitacao = {
  q: "",
  uf: ESTADO_TODOS,
  municipio: ESTADO_TODOS,
  periodo: "15",
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
    periodo: (searchParams.get("periodo") as FiltrosLicitacao["periodo"]) || "15",
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

  const [status, setStatus] = useState<StatusBusca>("idle");
  const [resultado, setResultado] = useState<LicitacoesResponse | null>(null);
  const [mensagemErro, setMensagemErro] = useState<string | undefined>();

  const [drawerAberto, setDrawerAberto] = useState(false);
  const [licitacaoSelecionada, setLicitacaoSelecionada] = useState<Licitacao | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const resultadoRef = useRef<HTMLDivElement>(null);

  // Só rola depois que o React já pintou o novo estado (ex.: LoadingState no
  // lugar do EstadoInicial, bem mais alto) — chamar scrollIntoView direto no
  // clique media a posição com o layout antigo e o deslocamento fica curto
  // demais pra perceber. O duplo rAF garante que o layout novo já existe.
  useEffect(() => {
    if (!filtrosAplicados) return;

    const primeiroFrame = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        resultadoRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });

    return () => cancelAnimationFrame(primeiroFrame);
  }, [filtrosAplicados]);

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

  // Dispara a busca sempre que os filtros aplicados mudarem — nunca ao
  // digitar no formulário (filtrosRascunho), nunca só por causa da página,
  // nunca só por causa dos refinamentos rápidos da tabela (Modalidade/
  // Local/Portal) e nunca só por causa da ordenação (ver os cálculos locais
  // mais abaixo): a API já devolve todos os itens que casam com a pesquisa
  // de uma vez, e página, refinamentos rápidos e ordenação são só recortes
  // locais sobre esse resultado — nenhuma das três fontes do PNCP aceita um
  // parâmetro de ordenação, então reconsultar a cada troca só bateria de
  // novo na cascata de fontes à toa. Reconsultar o servidor a cada clique
  // batia de novo nessa cascata — instável por natureza — e podia trazer um
  // resultado de uma fonte diferente da que gerou as opções que o usuário
  // via na tela.
  useEffect(() => {
    if (!filtrosAplicados) return;

    // executarBusca só chama os setters de estado depois de um `await` (a
    // resposta da consulta), nunca de forma síncrona durante este efeito —
    // é o padrão padrão de "buscar dados quando uma dependência muda".
    // eslint-disable-next-line react-hooks/set-state-in-effect
    executarBusca(filtrosAplicados);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtrosAplicados]);

  // Mantém a URL compartilhável em sincronia com todos os campos, incluindo
  // página e itens-por-página — mas sem disparar uma nova busca (efeito
  // acima), só reescreve a query string.
  useEffect(() => {
    if (!filtrosAplicados) return;

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
  }, [filtrosAplicados, modalidadeRapida, localRapido, portalRapido, ordenarPor, pagina, tamanhoPagina]);

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

  function limparFiltros() {
    setFiltrosRascunho(FILTROS_PADRAO);
    setPesquisaRapidaAtiva(undefined);
    setModalidadeRapida("");
    setLocalRapido("");
    setPortalRapido("");
    setAvancadoAberto(false);
    setPagina(1);
    setFiltrosAplicados({ ...FILTROS_PADRAO });
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
    executarBusca(filtrosAplicados);
  }

  const temResultadoAnterior = resultado !== null;
  const emErro = status === "erro_timeout" || status === "erro_conexao" || status === "erro_servidor";
  const carregandoInicial = status === "carregando" && !temResultadoAnterior;
  const atualizando = status === "carregando" && temResultadoAnterior;
  const tipoErro = status === "erro_timeout" ? "timeout" : status === "erro_conexao" ? "conexao" : "servidor";

  // Refinamentos rápidos da tabela (Modalidade/Local/Portal): aplicados aqui,
  // no cliente, sobre o resultado já buscado — nunca reconsultando o
  // servidor (ver comentário no efeito de busca acima). `resultado.facets` e
  // `resultado.summary` continuam refletindo a pesquisa aplicada inteira
  // (sem esses refinamentos), então os dropdowns nunca colapsam para uma
  // única opção depois de usados — só o resumo abaixo é recalculado com o
  // recorte atual, reproduzindo o que o servidor fazia antes.
  const itensRefinados = (resultado?.items ?? []).filter((item) => {
    if (modalidadeRapida && normalizarTexto(item.modalidade ?? "") !== normalizarTexto(modalidadeRapida)) {
      return false;
    }
    if (localRapido && chaveMunicipio(item) !== localRapido) return false;
    if (portalRapido && normalizarTexto(item.portal ?? "") !== normalizarTexto(portalRapido)) return false;
    return true;
  });

  const summaryRefinado = {
    total: itensRefinados.length,
    pregoes: itensRefinados.filter((i) => grupoDaModalidade(i.modalidade) === "pregao").length,
    dispensas: itensRefinados.filter((i) => grupoDaModalidade(i.modalidade) === "dispensa").length,
    outras: itensRefinados.filter((i) => grupoDaModalidade(i.modalidade) === "outra").length,
  };

  // Ordenação ("Ordenar por"): também local, pelo mesmo motivo dos
  // refinamentos rápidos — nenhuma fonte aceita esse parâmetro, então é só
  // reordenar em memória o que já foi buscado (ver lib/data/dominio.ts).
  const itensOrdenados = ordenar(itensRefinados, ordenarPor);

  // Paginação local: trocar de página é só fatiar esse array (já filtrado e
  // ordenado) em memória — nunca uma nova consulta ao PNCP.
  const totalPaginasCliente = Math.max(1, Math.ceil(itensOrdenados.length / tamanhoPagina));
  const paginaValida = Math.min(pagina, totalPaginasCliente);
  const itensDaPagina = itensOrdenados.slice((paginaValida - 1) * tamanhoPagina, paginaValida * tamanhoPagina);

  // A paginação fica FORA do card com `overflow-hidden` de propósito: esse
  // overflow é só pra cortar os cantos arredondados, mas também vira o
  // "container" de referência do `position: sticky` — como esse card não
  // tem altura fixa nem rolagem própria (quem rola é a página), a paginação
  // nunca tinha espaço de verdade pra flutuar. Como um elemento irmão, ela
  // flutua em relação à janela de verdade.
  const mostrandoPaginacao = Boolean(filtrosAplicados && !emErro && resultado && itensRefinados.length > 0);

  return (
    <div className="flex flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <SearchPanel
        filtros={filtrosRascunho}
        onChange={atualizarRascunho}
        avancadoAberto={avancadoAberto}
        onToggleAvancado={() => setAvancadoAberto((v) => !v)}
        onPesquisar={pesquisar}
        carregando={status === "carregando"}
        onSelecionarPesquisaRapida={aoSelecionarPesquisaRapida}
        pesquisaRapidaAtiva={pesquisaRapidaAtiva}
      />

      <div ref={resultadoRef} className="scroll-mt-20 flex flex-col">
        <div
          className={cn(
            // Sem `overflow-hidden` de propósito (mesmo motivo da paginação
            // em components/Pagination.tsx): esse overflow vira o container
            // de referência do `position: sticky` do cabeçalho da tabela
            // (components/ResultsTable.tsx) e, como este card não tem altura
            // fixa nem rolagem própria, ele nunca teria espaço de verdade
            // pra "grudar" no topo. Cantos possivelmente pontudos em algum
            // filho ficam sob responsabilidade do próprio filho (ver
            // LoadingState, o único caso real aqui).
            "border border-ink-200 bg-white shadow-card dark:border-ink-700 dark:bg-ink-900",
            mostrandoPaginacao ? "rounded-t-2xl border-b-0" : "rounded-2xl",
          )}
        >
          {!filtrosAplicados && <EstadoInicial />}

          {filtrosAplicados && emErro && (
            <ErrorState tipo={tipoErro} mensagem={mensagemErro} onTentarNovamente={tentarNovamente} />
          )}

          {filtrosAplicados && carregandoInicial && <LoadingState />}

          {filtrosAplicados && !emErro && resultado && (
            <>
              <ResultsHeader
                consultadoEm={resultado.meta.consultadoEm}
                atualizando={atualizando}
                // `meta.parcial` reflete o total bruto que a fonte devolveu,
                // antes dos filtros aplicados aqui (data, modalidade,
                // município, valor, órgão, situação, portal) — sem isso, dava
                // pra mostrar "Resultado parcial" junto com uma lista vazia
                // (a busca original tinha mais itens, mas nenhum sobreviveu
                // aos filtros), o que não faz sentido pro usuário.
                parcial={resultado.meta.parcial && resultado.total > 0}
              />

              <div className="px-4 py-4 sm:px-6">
                <SummaryCards resumo={summaryRefinado} />
              </div>

              {itensRefinados.length > 0 ? (
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
                    onChangeOrdenacao={(v) => {
                      setOrdenarPor(v);
                      setPagina(1);
                    }}
                  />

                  <div className={atualizando ? "opacity-60 transition-opacity" : "transition-opacity"}>
                    <ResultsTable itens={itensDaPagina} />
                    <div className="space-y-3 p-4 sm:hidden">
                      {itensDaPagina.map((item) => (
                        <ResultCard key={item.id} item={item} onVerDetalhes={abrirDetalhes} />
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <EmptyState onLimparFiltros={limparFiltros} />
              )}
            </>
          )}
        </div>

        {mostrandoPaginacao && (
          <Pagination
            page={paginaValida}
            pageSize={tamanhoPagina}
            total={itensRefinados.length}
            totalPages={totalPaginasCliente}
            onChangePage={setPagina}
            onChangePageSize={(size) => {
              setTamanhoPagina(size);
              setPagina(1);
            }}
          />
        )}
      </div>

      <Drawer aberto={drawerAberto} onFechar={() => setDrawerAberto(false)} titulo="Detalhes da licitação">
        {licitacaoSelecionada && <LicitacaoDetails item={licitacaoSelecionada} />}
      </Drawer>
    </div>
  );
}
