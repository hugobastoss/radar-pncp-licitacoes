"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Building2, HeartPulse, Loader2, Search } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Drawer";
import { Pagination } from "@/components/Pagination";
import { LinkCnpj } from "@/components/LinkCnpj";
import { ClasseRisco, DetalheProdutoSaude, SituacaoRegistro } from "@/components/DetalheProdutoSaude";
import { buscarProdutosSaude } from "@/lib/api-produtos-saude";
import { buscaAceitaFiltroValidos } from "@/lib/produtos-saude";
import { formatarCnpj, formatarData, formatarQuantidade, mascararCnpj } from "@/lib/formatters";
import type { ProdutoSaude, ResultadoProdutosSaude, TipoBuscaProdutoSaude } from "@/types/produto-saude";

type Status = "idle" | "carregando" | "sucesso" | "invalido" | "nao_configurado" | "erro";

const DESCRICAO_BUSCA: Record<TipoBuscaProdutoSaude, string> = {
  nome: "nome do produto",
  registro: "número de registro",
  processo: "número de processo",
  cnpj: "CNPJ da empresa detentora",
};

/** Ex.: "nome do produto na empresa 16.671.467/0001-01". */
function descreverBusca(resultado: ResultadoProdutosSaude): string {
  const empresa = resultado.cnpjEmpresa ? ` na empresa ${formatarCnpj(resultado.cnpjEmpresa)}` : "";
  return `${DESCRICAO_BUSCA[resultado.tipoBusca]}${empresa}`;
}

interface BuscaAplicada {
  termo: string;
  cnpjEmpresa: string;
}

function ProdutoItem({ item, onDetalhes }: { item: ProdutoSaude; onDetalhes: (item: ProdutoSaude) => void }) {
  return (
    <li className="rounded-lg border border-ink-200 bg-white p-3 dark:border-ink-700 dark:bg-ink-900">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="text-sm font-medium text-ink-900 dark:text-ink-50">{item.produto}</p>
        <div className="flex flex-wrap gap-1.5">
          {item.siglaRiscoProduto && <ClasseRisco sigla={item.siglaRiscoProduto} />}
          <SituacaoRegistro item={item} />
        </div>
      </div>
      {item.razaoSocialEmpresa && (
        <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-xs text-ink-600 dark:text-ink-300">
          {item.razaoSocialEmpresa}
          {item.cnpjEmpresa && (
            <>
              <span aria-hidden>·</span>
              <LinkCnpj cnpj={formatarCnpj(item.cnpjEmpresa) ?? item.cnpjEmpresa} />
            </>
          )}
        </p>
      )}
      <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-ink-500 dark:text-ink-400">
          Registro: {item.registro}
          {item.processo && ` · Processo: ${item.processo}`}
          {item.dataVencimento && !item.vencido && ` · Vencimento: ${formatarData(item.dataVencimento)}`}
        </p>
        {item.processo && (
          <Button variant="secondary" size="sm" onClick={() => onDetalhes(item)}>
            Ver detalhes
          </Button>
        )}
      </div>
    </li>
  );
}

export function ProdutosSaudeClient() {
  const [valor, setValor] = useState("");
  const [cnpjEmpresa, setCnpjEmpresa] = useState("");
  const [apenasValidos, setApenasValidos] = useState(true);
  // Última busca enviada: paginação, tamanho da página e o filtro de
  // válidos reconsultam com ela, não com o que estiver nos campos agora.
  const [buscaAplicada, setBuscaAplicada] = useState<BuscaAplicada | null>(null);
  const [pagina, setPagina] = useState(1);
  const [tamanhoPagina, setTamanhoPagina] = useState(25);
  const [status, setStatus] = useState<Status>("idle");
  const [resultado, setResultado] = useState<ResultadoProdutosSaude | null>(null);
  const [mensagemErro, setMensagemErro] = useState<string | undefined>();
  const [selecionado, setSelecionado] = useState<ProdutoSaude | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const resultadoRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  async function executar(
    busca: BuscaAplicada,
    opcoes: { pagina: number; tamanhoPagina: number; apenasValidos: boolean },
  ) {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setStatus("carregando");
    setMensagemErro(undefined);

    const r = await buscarProdutosSaude(busca.termo, {
      ...opcoes,
      cnpjEmpresa: busca.cnpjEmpresa,
      signal: controller.signal,
    });

    if (controller.signal.aborted) return;

    if (r.status === "sucesso") {
      setResultado({
        itens: r.itens,
        total: r.total,
        pagina: r.pagina,
        totalPaginas: r.totalPaginas,
        tipoBusca: r.tipoBusca,
        cnpjEmpresa: r.cnpjEmpresa,
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
    // Só o CNPJ, sem termo, também vale: traz todos os produtos da empresa.
    if (!valor.trim() && !cnpjEmpresa.trim()) return;

    const busca = { termo: valor, cnpjEmpresa };
    setBuscaAplicada(busca);
    setResultado(null);
    setPagina(1);
    void executar(busca, { pagina: 1, tamanhoPagina, apenasValidos });
  }

  function mudarPagina(novaPagina: number) {
    if (!buscaAplicada) return;
    setPagina(novaPagina);
    void executar(buscaAplicada, { pagina: novaPagina, tamanhoPagina, apenasValidos });
    resultadoRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function mudarTamanhoPagina(novoTamanho: number) {
    setTamanhoPagina(novoTamanho);
    setPagina(1);
    if (buscaAplicada) void executar(buscaAplicada, { pagina: 1, tamanhoPagina: novoTamanho, apenasValidos });
  }

  function alternarApenasValidos(marcado: boolean) {
    setApenasValidos(marcado);
    // Busca por registro ou processo ignora o filtro — não precisa reconsultar.
    if (buscaAplicada && resultado && buscaAceitaFiltroValidos(resultado.tipoBusca)) {
      setPagina(1);
      void executar(buscaAplicada, { pagina: 1, tamanhoPagina, apenasValidos: marcado });
    }
  }

  // Estável entre renderizações: o Drawer refaz o efeito de foco quando
  // `onFechar` muda, o que tiraria o foco de dentro do painel a cada render.
  const fecharDetalhe = useCallback(() => setSelecionado(null), []);

  // Durante a troca de página a lista anterior continua na tela, com o indicador de carregamento acima.
  const mostrarLista = resultado !== null && (status === "sucesso" || status === "carregando");

  return (
    <div className="flex flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <div className="border-b border-ink-200 pb-4 dark:border-ink-700">
        <h1 className="text-base font-semibold text-ink-900 dark:text-ink-50">Consultar produtos para saúde</h1>
        <p className="mt-1 text-xs text-ink-500 dark:text-ink-400">
          Verifique o registro de dispositivos médicos e materiais hospitalares na ANVISA — situação, fabricante,
          modelos, códigos de barras (UDI) e certificados de boas práticas.
        </p>
      </div>

      <form
        onSubmit={pesquisar}
        className="rounded-2xl border border-ink-200 bg-white p-5 shadow-card dark:border-ink-700 dark:bg-ink-900 sm:p-6"
      >
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start">
          <div className="flex-1">
            <Input
              label="Produto, registro ou processo"
              placeholder="Ex.: cateter ou 81467349001"
              hint="Registro tem 11 dígitos e processo, 17 — com ou sem pontuação."
              leftIcon={<HeartPulse className="h-4 w-4" aria-hidden />}
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              onClear={() => setValor("")}
            />
          </div>
          <div className="lg:w-72">
            <Input
              label="CNPJ da empresa (opcional)"
              placeholder="00.000.000/0000-00"
              hint="Só produtos desta empresa detentora."
              leftIcon={<Building2 className="h-4 w-4" aria-hidden />}
              value={cnpjEmpresa}
              maxLength={18}
              onChange={(e) => setCnpjEmpresa(mascararCnpj(e.target.value))}
              onClear={() => setCnpjEmpresa("")}
            />
          </div>
          <Button
            type="submit"
            className="lg:mt-7"
            leftIcon={status === "carregando" ? undefined : <Search className="h-4 w-4" aria-hidden />}
            loading={status === "carregando"}
          >
            Consultar
          </Button>
        </div>
        <label className="mt-4 inline-flex cursor-pointer items-center gap-2 text-sm text-ink-700 dark:text-ink-200">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-ink-300 text-primary-600 focus-visible:ring-2 focus-visible:ring-primary-500 dark:border-ink-600 dark:bg-ink-800"
            checked={apenasValidos}
            onChange={(e) => alternarApenasValidos(e.target.checked)}
          />
          Mostrar só registros válidos
        </label>
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
          Consulta de produtos para saúde ainda não configurada nesta instância.
        </p>
      )}

      {status === "erro" && (
        <p className="text-sm text-danger-600 dark:text-danger-400">
          {mensagemErro ?? "Não foi possível consultar a ANVISA neste momento."}
        </p>
      )}

      {status === "sucesso" && resultado?.itens.length === 0 && (
        <p className="text-sm text-ink-600 dark:text-ink-300">
          Nenhum registro encontrado por {descreverBusca(resultado)}
          {apenasValidos && buscaAceitaFiltroValidos(resultado.tipoBusca) && " entre os registros válidos"}.
        </p>
      )}

      {mostrarLista && resultado.itens.length > 0 && (
        <div ref={resultadoRef} className="scroll-mt-20">
          <div className="rounded-t-2xl border border-b-0 border-ink-200 bg-white p-4 dark:border-ink-700 dark:bg-ink-900 sm:p-5">
            <p className="text-xs text-ink-500 dark:text-ink-400">
              {formatarQuantidade(resultado.total)} {resultado.total === 1 ? "registro encontrado" : "registros encontrados"}{" "}
              por {descreverBusca(resultado)}
              {buscaAceitaFiltroValidos(resultado.tipoBusca)
                ? apenasValidos && " (só válidos)"
                : " — aparece mesmo se estiver vencido ou cancelado"}
            </p>
            <ul className="mt-3 space-y-2">
              {resultado.itens.map((item) => (
                <ProdutoItem key={`${item.registro}-${item.processo}`} item={item} onDetalhes={setSelecionado} />
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

      <Drawer aberto={selecionado !== null} onFechar={fecharDetalhe} titulo="Detalhes do registro">
        {selecionado && <DetalheProdutoSaude key={selecionado.processo} produto={selecionado} />}
      </Drawer>
    </div>
  );
}
