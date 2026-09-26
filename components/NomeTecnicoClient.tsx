"use client";

import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Loader2, Search, Tag } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Select } from "@/components/ui/Select";
import { Pagination } from "@/components/Pagination";
import { buscarNomesTecnicos } from "@/lib/api-nome-tecnico";
import { cn } from "@/lib/cn";
import { formatarQuantidade } from "@/lib/formatters";
import {
  CATEGORIAS_NOME_TECNICO,
  CLASSES_RISCO,
  ehCategoriaNomeTecnico,
  ehFiltroClasseRisco,
} from "@/lib/nome-tecnico";
import type { CategoriaNomeTecnico, FiltroClasseRisco } from "@/lib/nome-tecnico";
import type { NomeTecnico, ResultadoNomesTecnicos } from "@/types/nome-tecnico";

type Status = "idle" | "carregando" | "sucesso" | "invalido" | "nao_configurado" | "erro";

interface Filtros {
  categoria?: CategoriaNomeTecnico;
  classeRisco?: FiltroClasseRisco;
}

function Definicao({ texto }: { texto: string }) {
  const [aberta, setAberta] = useState(false);
  return (
    <div className="mt-1.5">
      <p className={cn("text-xs leading-relaxed text-ink-600 dark:text-ink-300", !aberta && "line-clamp-3")}>{texto}</p>
      {/* A mediana das definições tem ~470 caracteres; as curtas cabem nas 3 linhas e não precisam do botão. */}
      {texto.length > 240 && (
        <button
          type="button"
          onClick={() => setAberta(!aberta)}
          aria-expanded={aberta}
          className="mt-0.5 text-xs font-medium text-primary-600 hover:underline dark:text-primary-400"
        >
          {aberta ? "Mostrar menos" : "Mostrar definição completa"}
        </button>
      )}
    </div>
  );
}

function NomeTecnicoItem({ item }: { item: NomeTecnico }) {
  return (
    <li className="rounded-lg border border-ink-200 bg-white p-3 dark:border-ink-700 dark:bg-ink-900">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="primary">{item.codigo}</Badge>
        <span className="text-sm font-medium text-ink-900 dark:text-ink-50">{item.nomeTecnico}</span>
      </div>
      <p className="mt-1.5 text-xs text-ink-500 dark:text-ink-400">
        {item.descricaoTipoProduto && `Tipo: ${item.descricaoTipoProduto}`}
        {item.descricaoTipoProduto && " · "}
        {item.classeRisco ? `Classe de risco: ${item.classeRisco}` : "Sem classe de risco vinculada"}
      </p>
      {item.descricao && <Definicao texto={item.descricao} />}
    </li>
  );
}

export function NomeTecnicoClient() {
  const [valor, setValor] = useState("");
  const [filtros, setFiltros] = useState<Filtros>({});
  // Termo da última busca enviada: paginação, tamanho da página e a troca
  // de filtro reconsultam com ele, não com o que estiver no campo agora.
  const [termoBuscado, setTermoBuscado] = useState<string | null>(null);
  const [pagina, setPagina] = useState(1);
  const [tamanhoPagina, setTamanhoPagina] = useState(25);
  const [status, setStatus] = useState<Status>("idle");
  const [resultado, setResultado] = useState<ResultadoNomesTecnicos | null>(null);
  const [mensagemErro, setMensagemErro] = useState<string | undefined>();
  const abortRef = useRef<AbortController | null>(null);
  const resultadoRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  async function executar(termo: string, opcoes: Filtros & { pagina: number; tamanhoPagina: number }) {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setStatus("carregando");
    setMensagemErro(undefined);

    const r = await buscarNomesTecnicos(termo, { ...opcoes, signal: controller.signal });

    if (controller.signal.aborted) return;

    if (r.status === "sucesso") {
      setResultado({
        itens: r.itens,
        total: r.total,
        pagina: r.pagina,
        totalPaginas: r.totalPaginas,
        correspondenciaParcial: r.correspondenciaParcial,
      });
      setStatus("sucesso");
    } else if (r.status === "invalido") {
      setStatus("invalido");
      setMensagemErro(r.mensagem);
    } else if (r.status === "nao_configurado") {
      setStatus("nao_configurado");
    } else if (r.status === "erro_servidor") {
      setStatus("erro");
      setMensagemErro(r.mensagem);
    }
  }

  function pesquisar(evento: FormEvent) {
    evento.preventDefault();
    // Só filtro, sem termo, também vale: lista tudo da categoria/classe escolhida.
    if (!valor.trim() && !filtros.categoria && !filtros.classeRisco) return;

    setTermoBuscado(valor);
    setResultado(null);
    setPagina(1);
    void executar(valor, { ...filtros, pagina: 1, tamanhoPagina });
  }

  function mudarFiltros(patch: Filtros) {
    const novos = { ...filtros, ...patch };
    setFiltros(novos);
    // Com uma busca na tela, o filtro vale na hora; antes da primeira busca, só fica guardado pro envio.
    if (termoBuscado !== null) {
      setPagina(1);
      void executar(termoBuscado, { ...novos, pagina: 1, tamanhoPagina });
    }
  }

  function mudarPagina(novaPagina: number) {
    if (termoBuscado === null) return;
    setPagina(novaPagina);
    void executar(termoBuscado, { ...filtros, pagina: novaPagina, tamanhoPagina });
    resultadoRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function mudarTamanhoPagina(novoTamanho: number) {
    setTamanhoPagina(novoTamanho);
    setPagina(1);
    if (termoBuscado !== null) void executar(termoBuscado, { ...filtros, pagina: 1, tamanhoPagina: novoTamanho });
  }

  // Durante a troca de página a lista anterior continua na tela, com o indicador de carregamento acima.
  const mostrarLista = resultado !== null && (status === "sucesso" || status === "carregando");

  return (
    <div className="flex flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <div className="border-b border-ink-200 pb-4 dark:border-ink-700">
        <h1 className="text-base font-semibold text-ink-900 dark:text-ink-50">Consultar nomenclatura técnica</h1>
        <p className="mt-1 text-xs text-ink-500 dark:text-ink-400">
          Consulte a nomenclatura técnica oficial de produtos para saúde na ANVISA — definição, categoria e classe
          de risco.
        </p>
      </div>

      <form
        onSubmit={pesquisar}
        className="rounded-2xl border border-ink-200 bg-white p-5 shadow-card dark:border-ink-700 dark:bg-ink-900 sm:p-6"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
          <div className="flex-1">
            <Input
              label="Nome técnico ou código"
              placeholder="Ex.: cateter balão, luva cirúrgica ou 9000005"
              hint="Palavras em qualquer ordem, com ou sem acento — também procura na definição."
              leftIcon={<Tag className="h-4 w-4" aria-hidden />}
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              onClear={() => setValor("")}
            />
          </div>
          <Button
            type="submit"
            className="sm:mt-7"
            leftIcon={status === "carregando" ? undefined : <Search className="h-4 w-4" aria-hidden />}
            loading={status === "carregando"}
          >
            Consultar
          </Button>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:max-w-xl">
          <Select
            label="Categoria"
            value={filtros.categoria ?? ""}
            onChange={(e) =>
              mudarFiltros({ categoria: ehCategoriaNomeTecnico(e.target.value) ? e.target.value : undefined })
            }
          >
            <option value="">Todas</option>
            {CATEGORIAS_NOME_TECNICO.map((c) => (
              <option key={c.valor} value={c.valor}>
                {c.rotulo}
              </option>
            ))}
          </Select>
          <Select
            label="Classe de risco"
            value={filtros.classeRisco ?? ""}
            onChange={(e) =>
              mudarFiltros({ classeRisco: ehFiltroClasseRisco(e.target.value) ? e.target.value : undefined })
            }
          >
            <option value="">Todas</option>
            {CLASSES_RISCO.map((classe) => (
              <option key={classe} value={classe}>
                Classe {classe}
              </option>
            ))}
            <option value="nenhuma">Sem classe vinculada</option>
          </Select>
        </div>
      </form>

      {status === "carregando" && (
        <div className="flex items-center gap-2 text-sm text-ink-500 dark:text-ink-400">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Consultando…
        </div>
      )}

      {status === "invalido" && (
        <p className="text-sm text-danger-600 dark:text-danger-400">{mensagemErro ?? "Termo inválido."}</p>
      )}

      {status === "nao_configurado" && (
        <p className="text-sm text-ink-600 dark:text-ink-300">
          Consulta de nomenclatura técnica ainda não configurada nesta instância.
        </p>
      )}

      {status === "erro" && (
        <p className="text-sm text-danger-600 dark:text-danger-400">
          {mensagemErro ?? "Não foi possível consultar a ANVISA neste momento."}
        </p>
      )}

      {status === "sucesso" && resultado?.itens.length === 0 && (
        <p className="text-sm text-ink-600 dark:text-ink-300">Nenhum nome técnico encontrado com esses critérios.</p>
      )}

      {mostrarLista && resultado.itens.length > 0 && (
        <div ref={resultadoRef} className="scroll-mt-20">
          <div className="rounded-t-2xl border border-b-0 border-ink-200 bg-white p-4 dark:border-ink-700 dark:bg-ink-900 sm:p-5">
            <p className="text-xs text-ink-500 dark:text-ink-400">
              {formatarQuantidade(resultado.total)}{" "}
              {resultado.total === 1 ? "nome técnico encontrado" : "nomes técnicos encontrados"}
            </p>
            {resultado.correspondenciaParcial && (
              <p className="mt-2 rounded-lg bg-warning-50 p-2.5 text-xs text-warning-700 dark:bg-warning-900/40 dark:text-warning-300">
                Nenhum nome técnico tem todas as palavras digitadas — mostrando os que têm parte delas, dos mais
                parecidos para os menos. A nomenclatura da ANVISA é genérica: tente só o nome principal do produto.
              </p>
            )}
            <ul className="mt-3 space-y-2">
              {resultado.itens.map((item) => (
                <NomeTecnicoItem key={item.codigo} item={item} />
              ))}
            </ul>
          </div>
          <Pagination
            page={pagina}
            pageSize={tamanhoPagina}
            total={resultado.total}
            totalPages={resultado.totalPaginas}
            onChangePage={mudarPagina}
            onChangePageSize={mudarTamanhoPagina}
          />
        </div>
      )}
    </div>
  );
}
