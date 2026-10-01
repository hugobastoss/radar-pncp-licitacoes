"use client";

import { useRef, useState } from "react";
import type { FormEvent } from "react";
import { ChevronLeft, ChevronRight, ExternalLink, FileStack, Loader2, Search, TriangleAlert } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { LinkCnpj } from "@/components/LinkCnpj";
import { buscarAtas } from "@/lib/api-atas";
import type { FiltrosBuscaAtas } from "@/lib/api-atas";
import { ESTADOS } from "@/lib/data/estados";
import { formatarDataSimples } from "@/lib/formatters";
import type { AtaRegistroPreco, ResultadoAtas } from "@/types/ata";

type Status = "idle" | "carregando" | "sucesso" | "invalido" | "erro";

const AVISO_VENCIMENTO_DIAS = 30;

/** Dias até o fim da vigência (negativo = já venceu), contados no dia de hoje. */
function diasAteFim(fim: string | undefined): number | undefined {
  if (!fim) return undefined;
  const [a, m, d] = fim.split("-").map(Number);
  const hoje = new Date();
  const inicioHoje = Date.UTC(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  return Math.round((Date.UTC(a, m - 1, d) - inicioHoje) / 86_400_000);
}

function SeloVigencia({ ata }: { ata: AtaRegistroPreco }) {
  if (ata.cancelada) return <Badge tone="danger">Cancelada</Badge>;
  const dias = diasAteFim(ata.vigenciaFim);
  if (dias === undefined) return null;
  if (dias < 0) return <Badge>Encerrada</Badge>;
  if (dias <= AVISO_VENCIMENTO_DIAS) {
    return <Badge tone="warning">{dias === 0 ? "Vence hoje" : dias === 1 ? "Vence amanhã" : `Vence em ${dias} dias`}</Badge>;
  }
  return <Badge tone="success">Vigente</Badge>;
}

function CartaoAta({ ata: a }: { ata: AtaRegistroPreco }) {
  const vigencia = [formatarDataSimples(a.vigenciaInicio), formatarDataSimples(a.vigenciaFim)].filter(Boolean).join(" a ");
  return (
    <li className="rounded-xl border border-ink-200 bg-white p-4 dark:border-ink-700 dark:bg-ink-900">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-semibold text-ink-900 dark:text-ink-50">{a.titulo}</p>
        <SeloVigencia ata={a} />
      </div>
      <p className="mt-1.5 text-sm text-ink-700 dark:text-ink-200">{a.objeto ?? "Objeto não informado"}</p>
      <p className="mt-1.5 text-xs text-ink-500 dark:text-ink-400">
        {[a.orgao, a.unidade && a.unidade !== a.orgao && a.unidade, a.municipio && `${a.municipio}${a.uf ? `/${a.uf}` : ""}`]
          .filter(Boolean)
          .join(" · ")}
        {a.orgaoCnpj && (
          <>
            {" · "}
            <LinkCnpj cnpj={a.orgaoCnpj} />
          </>
        )}
      </p>
      <p className="mt-0.5 text-xs text-ink-500 dark:text-ink-400">
        {[vigencia && `vigência ${vigencia}`, a.modalidade].filter(Boolean).join(" · ")}
      </p>
      {a.link && (
        <a
          href={a.link}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary-600 hover:underline dark:text-primary-400"
        >
          Ver itens, fornecedores e preços no PNCP
          <ExternalLink className="h-3 w-3" aria-hidden />
          <span className="sr-only">(abre em nova aba)</span>
        </a>
      )}
    </li>
  );
}

export function AtasClient() {
  const [q, setQ] = useState("");
  const [uf, setUf] = useState("AM");
  const [todas, setTodas] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [resultado, setResultado] = useState<ResultadoAtas | null>(null);
  const [filtrosAtuais, setFiltrosAtuais] = useState<FiltrosBuscaAtas | null>(null);
  const [mensagemErro, setMensagemErro] = useState<string | undefined>();
  const abortRef = useRef<AbortController | null>(null);

  async function consultar(filtros: FiltrosBuscaAtas) {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setStatus("carregando");
    setMensagemErro(undefined);

    const r = await buscarAtas(filtros, { signal: controller.signal });
    if (r.status === "cancelado") return;
    if (r.status === "sucesso") {
      setResultado({ itens: r.itens, total: r.total, pagina: r.pagina, totalPaginas: r.totalPaginas });
      setFiltrosAtuais(filtros);
      setStatus("sucesso");
    } else {
      setStatus(r.status === "invalido" ? "invalido" : "erro");
      setMensagemErro(r.mensagem);
    }
  }

  function pesquisar(evento: FormEvent) {
    evento.preventDefault();
    consultar({ q, uf, todas, pagina: 1 });
  }

  function irParaPagina(pagina: number) {
    if (!filtrosAtuais) return;
    consultar({ ...filtrosAtuais, pagina });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="flex flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <form
        onSubmit={pesquisar}
        className="rounded-[10px] border border-ink-200 bg-white p-5 shadow-card dark:border-ink-700 dark:bg-ink-900 sm:p-6"
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[2fr_1fr] lg:grid-cols-[3fr_1fr_auto] lg:items-end">
          <Input
            label="O que procura"
            placeholder="Ex.: cadeira de rodas, dipirona, notebook"
            leftIcon={<FileStack className="h-4 w-4" aria-hidden />}
            value={q}
            maxLength={200}
            onChange={(ev) => setQ(ev.target.value)}
            onClear={() => setQ("")}
          />
          <Select label="Estado" value={uf} onChange={(ev) => setUf(ev.target.value)}>
            <option value="">Brasil todo</option>
            {ESTADOS.map((e) => (
              <option key={e.sigla} value={e.sigla}>
                {e.nome}
              </option>
            ))}
          </Select>
          <Button
            type="submit"
            leftIcon={status === "carregando" ? undefined : <Search className="h-4 w-4" aria-hidden />}
            loading={status === "carregando"}
          >
            Consultar
          </Button>
        </div>
        <label className="mt-3 inline-flex cursor-pointer items-center gap-2 text-sm text-ink-700 dark:text-ink-200">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-ink-300 text-primary-600 focus-visible:ring-2 focus-visible:ring-primary-500 dark:border-ink-600 dark:bg-ink-800"
            checked={todas}
            disabled={!q.trim()}
            onChange={(ev) => setTodas(ev.target.checked)}
          />
          Incluir atas encerradas
          <span className="text-xs text-ink-400 dark:text-ink-500">(só com texto na busca)</span>
        </label>
      </form>

      {status === "carregando" && (
        <div className="flex items-center gap-2 text-sm text-ink-500 dark:text-ink-400">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Consultando o PNCP… ele anda instável, pode levar alguns segundos.
        </div>
      )}

      {status === "invalido" && <p className="text-sm text-danger-600 dark:text-danger-400">{mensagemErro}</p>}

      {status === "erro" && (
        <p className="text-sm text-danger-600 dark:text-danger-400">
          {mensagemErro ?? "Não foi possível consultar o PNCP neste momento."}
        </p>
      )}

      {status === "sucesso" && resultado && (
        <div className="flex flex-col gap-4">
          {resultado.itens.length === 0 ? (
            <p className="flex items-start gap-1.5 text-sm text-ink-600 dark:text-ink-300">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              Nenhuma ata encontrada para esses filtros.
            </p>
          ) : (
            <>
              <p className="text-sm text-ink-600 dark:text-ink-300">
                {resultado.total.toLocaleString("pt-BR")} {resultado.total === 1 ? "ata" : "atas"}
                {filtrosAtuais?.todas ? "" : " vigentes"} · página {resultado.pagina} de{" "}
                {resultado.totalPaginas.toLocaleString("pt-BR")}
              </p>
              <ul className="space-y-3">
                {resultado.itens.map((a) => (
                  <CartaoAta key={a.id} ata={a} />
                ))}
              </ul>
            </>
          )}

          {resultado.totalPaginas > 1 && (
            <div className="flex items-center justify-between gap-3">
              <Button
                variant="secondary"
                size="sm"
                leftIcon={<ChevronLeft className="h-4 w-4" aria-hidden />}
                disabled={resultado.pagina <= 1}
                onClick={() => irParaPagina(resultado.pagina - 1)}
              >
                Anterior
              </Button>
              <span className="text-xs text-ink-500 dark:text-ink-400">
                Página {resultado.pagina} de {resultado.totalPaginas.toLocaleString("pt-BR")}
              </span>
              <Button
                variant="secondary"
                size="sm"
                rightIcon={<ChevronRight className="h-4 w-4" aria-hidden />}
                disabled={resultado.pagina >= resultado.totalPaginas}
                onClick={() => irParaPagina(resultado.pagina + 1)}
              >
                Próxima
              </Button>
            </div>
          )}

          <p className="text-xs text-ink-400 dark:text-ink-500">
            Fonte: PNCP (Portal Nacional de Contratações Públicas). Os itens, os fornecedores e os preços registrados
            ficam na página de cada ata no PNCP.
          </p>
        </div>
      )}
    </div>
  );
}
