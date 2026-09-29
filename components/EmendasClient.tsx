"use client";

import { useRef, useState } from "react";
import type { FormEvent } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, ExternalLink, Landmark, Loader2, Search, TriangleAlert } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { LinkCnpj } from "@/components/LinkCnpj";
import { buscarDocumentosEmenda, buscarEmendas } from "@/lib/api-emendas";
import type { FiltrosBuscaEmendas } from "@/lib/api-emendas";
import { linkEmenda, PRIMEIRO_ANO_EMENDAS, TIPOS_EMENDA } from "@/lib/emendas";
import { linkDocumentoDespesa } from "@/lib/portal-transparencia";
import { cn } from "@/lib/cn";
import { formatarMoeda } from "@/lib/formatters";
import type {
  DocumentoEmenda,
  EmendaParlamentar,
  FavorecidoDocumento,
  RecebedorEmenda,
  ResultadoDocumentosEmenda,
  ResultadoEmendas,
} from "@/types/transparencia";

type Status = "idle" | "carregando" | "sucesso" | "invalido" | "nao_configurado" | "erro";

const ANO_ATUAL = new Date().getFullYear();
const ANOS = Array.from({ length: ANO_ATUAL - PRIMEIRO_ANO_EMENDAS + 1 }, (_, i) => String(ANO_ATUAL - i));
const FORMATO_CNPJ = /^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/;
const DOCUMENTOS_VISIVEIS = 10;

const TOM_FASE: Record<string, "primary" | "warning" | "success"> = {
  Empenho: "primary",
  Liquidação: "warning",
  Pagamento: "success",
};

function LinkExterno({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn("inline-flex items-center gap-1 text-primary-600 hover:underline dark:text-primary-400", className)}
    >
      {children}
      <ExternalLink className="h-3 w-3" aria-hidden />
      <span className="sr-only">(abre em nova aba)</span>
    </a>
  );
}

/** CNPJ vira link pra consulta de CNPJ do app; CPF (vem mascarado da CGU) fica só como texto. */
function Favorecido({ favorecido: f }: { favorecido: FavorecidoDocumento }) {
  return (
    <span>
      <span className="text-ink-900 dark:text-ink-50">{f.nome}</span>
      {(f.documento || f.uf) && (
        <span className="block text-xs text-ink-500 dark:text-ink-400">
          {f.documento && (FORMATO_CNPJ.test(f.documento) ? <LinkCnpj cnpj={f.documento} /> : f.documento)}
          {f.documento && f.uf && " · "}
          {f.uf}
        </span>
      )}
    </span>
  );
}

function Recebedores({ recebedores, completos }: { recebedores: RecebedorEmenda[]; completos: boolean }) {
  if (recebedores.length === 0) {
    return <p className="text-sm text-ink-500 dark:text-ink-400">Nenhum pagamento feito com esta emenda até agora.</p>;
  }
  return (
    <div>
      <ul className="space-y-1.5 text-sm">
        {recebedores.map((r) => (
          <li key={r.documento ?? r.nome} className="flex items-start justify-between gap-3">
            <Favorecido favorecido={r} />
            <span className="shrink-0 font-medium tabular-nums text-ink-900 dark:text-ink-50">{formatarMoeda(r.valor)}</span>
          </li>
        ))}
      </ul>
      {!completos && (
        <p className="mt-1.5 text-xs text-warning-700 dark:text-warning-300">
          Alguns pagamentos ficaram sem detalhe — os valores por favorecido podem estar incompletos.
        </p>
      )}
    </div>
  );
}

function LinhaDocumento({ documento: d }: { documento: DocumentoEmenda }) {
  const link = linkDocumentoDespesa(d.fase, d.codigo);
  return (
    <tr className="border-t border-ink-100 align-top dark:border-ink-800">
      <td className="py-2 pr-3 tabular-nums">{d.data ?? "—"}</td>
      <td className="py-2 pr-3">
        <Badge tone={TOM_FASE[d.fase] ?? "neutral"}>{d.fase}</Badge>
        {d.especie && d.especie !== "Original" && (
          <span className="mt-0.5 block text-xs text-danger-600 dark:text-danger-400">{d.especie}</span>
        )}
      </td>
      <td className="py-2 pr-3 tabular-nums">
        {link ? <LinkExterno href={link}>{d.codigoResumido}</LinkExterno> : d.codigoResumido}
      </td>
      <td className="py-2 pr-3">
        {d.favorecido ? <Favorecido favorecido={d.favorecido} /> : <span className="text-ink-400">—</span>}
        {d.observacao && <span className="mt-0.5 block text-xs text-ink-500 dark:text-ink-400">{d.observacao}</span>}
      </td>
      <td className="py-2 text-right font-medium tabular-nums text-ink-900 dark:text-ink-50">
        {d.valor !== undefined ? formatarMoeda(d.valor) : <span className="font-normal text-ink-400">—</span>}
      </td>
    </tr>
  );
}

function ItemDocumento({ documento: d }: { documento: DocumentoEmenda }) {
  const link = linkDocumentoDespesa(d.fase, d.codigo);
  return (
    <li className="border-t border-ink-100 py-2 text-sm text-ink-700 first:border-t-0 dark:border-ink-800 dark:text-ink-200">
      <div className="flex items-center justify-between gap-2">
        <span className="flex flex-wrap items-center gap-1.5">
          <span className="tabular-nums">{d.data ?? "—"}</span>
          <Badge tone={TOM_FASE[d.fase] ?? "neutral"}>{d.fase}</Badge>
          {d.especie && d.especie !== "Original" && (
            <span className="text-xs text-danger-600 dark:text-danger-400">{d.especie}</span>
          )}
        </span>
        <span className="shrink-0 font-medium tabular-nums text-ink-900 dark:text-ink-50">
          {d.valor !== undefined ? formatarMoeda(d.valor) : <span className="font-normal text-ink-400">—</span>}
        </span>
      </div>
      <p className="mt-0.5 text-xs tabular-nums">
        {link ? <LinkExterno href={link}>{d.codigoResumido}</LinkExterno> : d.codigoResumido}
      </p>
      {d.favorecido && (
        <div className="mt-1">
          <Favorecido favorecido={d.favorecido} />
        </div>
      )}
      {d.observacao && <p className="mt-0.5 text-xs text-ink-500 dark:text-ink-400">{d.observacao}</p>}
    </li>
  );
}

type EstadoDocumentos =
  | { status: "carregando" }
  | ({ status: "sucesso" } & ResultadoDocumentosEmenda)
  | { status: "erro"; mensagem?: string };

function Documentos({ estado, codigo }: { estado: EstadoDocumentos; codigo: string }) {
  const [todos, setTodos] = useState(false);

  if (estado.status === "carregando") {
    return (
      <p className="flex items-center gap-1.5 text-sm text-ink-500 dark:text-ink-400">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        Buscando empenhos, liquidações e pagamentos…
      </p>
    );
  }
  if (estado.status === "erro") {
    return (
      <p className="text-sm text-danger-600 dark:text-danger-400">
        {estado.mensagem ?? "Não foi possível consultar os documentos da emenda neste momento."}
      </p>
    );
  }
  if (estado.itens.length === 0) {
    return <p className="text-sm text-ink-500 dark:text-ink-400">Nenhum documento registrado para esta emenda.</p>;
  }

  const visiveis = todos ? estado.itens : estado.itens.slice(0, DOCUMENTOS_VISIVEIS);
  const semDetalhe = estado.itens.filter((d) => !d.detalhado && d.fase !== "Liquidação").length;

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-ink-500 dark:text-ink-400">Quem recebeu</p>
        <div className="mt-1.5">
          <Recebedores recebedores={estado.recebedores} completos={estado.pagamentosDetalhados} />
        </div>
      </div>

      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-ink-500 dark:text-ink-400">
          Documentos ({estado.itens.length}
          {!estado.completo && "+"})
        </p>
        {/* No celular a tabela ficaria espremida (a observação do documento é longa): vira lista. */}
        <ul className="mt-1.5 sm:hidden">
          {visiveis.map((d) => (
            <ItemDocumento key={d.codigo} documento={d} />
          ))}
        </ul>
        <div className="mt-1.5 hidden overflow-x-auto scrollbar-fina sm:block">
          <table className="w-full min-w-[640px] text-sm text-ink-700 dark:text-ink-200">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-ink-500 dark:text-ink-400">
                <th className="pb-1 pr-3 font-medium">Data</th>
                <th className="pb-1 pr-3 font-medium">Fase</th>
                <th className="pb-1 pr-3 font-medium">Documento</th>
                <th className="pb-1 pr-3 font-medium">Favorecido</th>
                <th className="pb-1 text-right font-medium">Valor</th>
              </tr>
            </thead>
            <tbody>
              {visiveis.map((d) => (
                <LinhaDocumento key={d.codigo} documento={d} />
              ))}
            </tbody>
          </table>
        </div>
        {estado.itens.length > DOCUMENTOS_VISIVEIS && (
          <button
            type="button"
            onClick={() => setTodos(!todos)}
            className="mt-2 text-xs font-medium text-primary-600 hover:underline dark:text-primary-400"
          >
            {todos ? "Mostrar menos" : `Mostrar todos (${estado.itens.length})`}
          </button>
        )}
        <p className="mt-2 text-xs text-ink-400 dark:text-ink-500">
          A CGU não informa o valor da liquidação.
          {semDetalhe > 0 &&
            ` ${semDetalhe} ${semDetalhe === 1 ? "documento ficou" : "documentos ficaram"} sem valor e favorecido para não passar do limite de consultas — `}
          {semDetalhe > 0 && <LinkExterno href={linkEmenda(codigo)}>veja no Portal da Transparência</LinkExterno>}
          {!estado.completo && " A emenda tem mais documentos do que o limite consultado."}
        </p>
      </div>
    </div>
  );
}

function Valor({ rotulo, valor, destaque }: { rotulo: string; valor: number; destaque?: boolean }) {
  return (
    <div>
      <p className="text-xs text-ink-500 dark:text-ink-400">{rotulo}</p>
      <p
        className={cn(
          "tabular-nums",
          destaque ? "font-semibold text-ink-900 dark:text-ink-50" : "text-ink-700 dark:text-ink-200",
        )}
      >
        {formatarMoeda(valor)}
      </p>
    </div>
  );
}

function CartaoEmenda({ emenda: e }: { emenda: EmendaParlamentar }) {
  const [documentos, setDocumentos] = useState<EstadoDocumentos | null>(null);
  const [aberto, setAberto] = useState(false);
  const temRestos = e.restoInscrito !== 0 || e.restoPago !== 0 || e.restoCancelado !== 0;

  async function alternar() {
    const abrir = !aberto;
    setAberto(abrir);
    if (!abrir || (documentos && documentos.status !== "erro")) return;
    setDocumentos({ status: "carregando" });
    const r = await buscarDocumentosEmenda(e.codigo);
    if (r.status === "sucesso") setDocumentos(r);
    else if (r.status !== "cancelado") {
      setDocumentos({ status: "erro", mensagem: "mensagem" in r ? r.mensagem : undefined });
    }
  }

  return (
    <li className="rounded-xl border border-ink-200 bg-white p-4 dark:border-ink-700 dark:bg-ink-900">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-semibold text-ink-900 dark:text-ink-50">{e.autor}</p>
        <Badge tone="accent">{e.tipo.replace(/^Emenda /, "")}</Badge>
      </div>
      <p className="mt-1 text-xs text-ink-500 dark:text-ink-400">
        {[
          `Emenda ${e.numero}/${e.ano}`,
          e.localidade,
          [e.funcao, e.subfuncao].filter(Boolean).join(" › "),
          `código ${e.codigo}`,
        ]
          .filter(Boolean)
          .join(" · ")}
      </p>

      <div className="mt-3 grid grid-cols-3 gap-3 text-sm">
        <Valor rotulo="Empenhado" valor={e.empenhado} />
        <Valor rotulo="Liquidado" valor={e.liquidado} />
        <Valor rotulo="Pago" valor={e.pago} destaque />
      </div>
      {e.empenhado < 0 && (
        <p className="mt-2 text-xs text-ink-500 dark:text-ink-400">
          Empenhado negativo: segundo a CGU, as anulações de empenho superaram os empenhos novos no ano.
        </p>
      )}
      {temRestos && (
        <p className="mt-2 text-xs text-ink-500 dark:text-ink-400">
          Restos a pagar de anos anteriores: inscrito {formatarMoeda(e.restoInscrito)} · pago{" "}
          {formatarMoeda(e.restoPago)}
          {e.restoCancelado !== 0 && ` · cancelado ${formatarMoeda(e.restoCancelado)}`}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-medium">
        <button
          type="button"
          onClick={alternar}
          aria-expanded={aberto}
          className="inline-flex items-center gap-1 text-primary-600 hover:underline dark:text-primary-400"
        >
          {aberto ? <ChevronUp className="h-3.5 w-3.5" aria-hidden /> : <ChevronDown className="h-3.5 w-3.5" aria-hidden />}
          {aberto ? "Esconder documentos" : "Documentos e quem recebeu"}
        </button>
        <LinkExterno href={linkEmenda(e.codigo)}>Ver no Portal da Transparência</LinkExterno>
      </div>

      {aberto && documentos && (
        <div className="mt-3 border-t border-ink-100 pt-3 dark:border-ink-800">
          <Documentos estado={documentos} codigo={e.codigo} />
        </div>
      )}
    </li>
  );
}

export function EmendasClient() {
  const [autor, setAutor] = useState("");
  const [ano, setAno] = useState(String(ANO_ATUAL));
  const [tipo, setTipo] = useState("");
  const [numero, setNumero] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [resultado, setResultado] = useState<ResultadoEmendas | null>(null);
  const [filtrosAtuais, setFiltrosAtuais] = useState<FiltrosBuscaEmendas | null>(null);
  const [mensagemErro, setMensagemErro] = useState<string | undefined>();
  const abortRef = useRef<AbortController | null>(null);

  async function consultar(filtros: FiltrosBuscaEmendas) {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setStatus("carregando");
    setMensagemErro(undefined);

    const r = await buscarEmendas(filtros, { signal: controller.signal });
    if (r.status === "cancelado") return;
    if (r.status === "sucesso") {
      setResultado({ itens: r.itens, pagina: r.pagina, temMais: r.temMais });
      setFiltrosAtuais(filtros);
      setStatus("sucesso");
    } else if (r.status === "nao_configurado") {
      setStatus("nao_configurado");
    } else {
      setStatus(r.status === "invalido" ? "invalido" : "erro");
      setMensagemErro(r.mensagem);
    }
  }

  function pesquisar(evento: FormEvent) {
    evento.preventDefault();
    consultar({ autor, ano, tipo, numero, pagina: 1 });
  }

  function irParaPagina(pagina: number) {
    if (!filtrosAtuais) return;
    consultar({ ...filtrosAtuais, pagina });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="flex flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <div className="border-b border-ink-200 pb-4 dark:border-ink-700">
        <h1 className="text-base font-semibold text-ink-900 dark:text-ink-50">Emendas parlamentares</h1>
        <p className="mt-1 text-xs text-ink-500 dark:text-ink-400">
          Quanto cada emenda ao orçamento federal já empenhou, liquidou e pagou — e para quem foi o dinheiro. Dados do
          Portal da Transparência (CGU).
        </p>
      </div>

      <form
        onSubmit={pesquisar}
        className="rounded-2xl border border-ink-200 bg-white p-5 shadow-card dark:border-ink-700 dark:bg-ink-900 sm:p-6"
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1.5fr_1fr_auto] lg:items-end">
          <Input
            label="Autor"
            placeholder="Ex.: HEINZE, BANCADA DO AMAZONAS"
            leftIcon={<Landmark className="h-4 w-4" aria-hidden />}
            value={autor}
            maxLength={100}
            onChange={(ev) => setAutor(ev.target.value)}
            onClear={() => setAutor("")}
          />
          <Select label="Ano" value={ano} onChange={(ev) => setAno(ev.target.value)}>
            <option value="">Todos os anos</option>
            {ANOS.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </Select>
          <Select label="Tipo" value={tipo} onChange={(ev) => setTipo(ev.target.value)}>
            <option value="">Todos os tipos</option>
            {TIPOS_EMENDA.map((t) => (
              <option key={t.valor} value={t.valor}>
                {t.rotulo}
              </option>
            ))}
          </Select>
          <Input
            label="Número"
            placeholder="Ex.: 0004"
            inputMode="numeric"
            value={numero}
            maxLength={4}
            onChange={(ev) => setNumero(ev.target.value.replace(/\D/g, ""))}
            onClear={() => setNumero("")}
          />
          <Button
            type="submit"
            leftIcon={status === "carregando" ? undefined : <Search className="h-4 w-4" aria-hidden />}
            loading={status === "carregando"}
          >
            Consultar
          </Button>
        </div>
        <p className="mt-3 text-xs text-ink-400 dark:text-ink-500">
          Autor pode ser parlamentar, bancada ou comissão — parte do nome basta, com ou sem acento.
        </p>
      </form>

      {status === "carregando" && (
        <div className="flex items-center gap-2 text-sm text-ink-500 dark:text-ink-400">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Consultando o Portal da Transparência…
        </div>
      )}

      {status === "invalido" && <p className="text-sm text-danger-600 dark:text-danger-400">{mensagemErro}</p>}

      {status === "nao_configurado" && (
        <p className="text-sm text-ink-600 dark:text-ink-300">Consulta de emendas ainda não configurada nesta instância.</p>
      )}

      {status === "erro" && (
        <p className="text-sm text-danger-600 dark:text-danger-400">
          {mensagemErro ?? "Não foi possível consultar as emendas neste momento."}
        </p>
      )}

      {status === "sucesso" && resultado && (
        <div className="flex flex-col gap-4">
          {resultado.itens.length === 0 ? (
            <p className="flex items-start gap-1.5 text-sm text-ink-600 dark:text-ink-300">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              {resultado.pagina > 1
                ? "Não há mais emendas para esses filtros."
                : "Nenhuma emenda encontrada. Confira a grafia do autor — a busca é por parte do nome, como aparece no Portal."}
            </p>
          ) : (
            <>
              <p className="text-sm text-ink-600 dark:text-ink-300">
                Página {resultado.pagina} · {resultado.itens.length}{" "}
                {resultado.itens.length === 1 ? "emenda" : "emendas"}
              </p>
              <ul className="space-y-3">
                {resultado.itens.map((e) => (
                  <CartaoEmenda key={e.codigo} emenda={e} />
                ))}
              </ul>
            </>
          )}

          {(resultado.pagina > 1 || resultado.temMais) && (
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
              <span className="text-xs text-ink-500 dark:text-ink-400">Página {resultado.pagina}</span>
              <Button
                variant="secondary"
                size="sm"
                rightIcon={<ChevronRight className="h-4 w-4" aria-hidden />}
                disabled={!resultado.temMais}
                onClick={() => irParaPagina(resultado.pagina + 1)}
              >
                Próxima
              </Button>
            </div>
          )}

          <p className="text-xs text-ink-400 dark:text-ink-500">
            Fonte: Portal da Transparência (CGU), atualizado uma vez por dia. A CGU não informa o total de resultados —
            a lista vem de 15 em 15.
          </p>
        </div>
      )}
    </div>
  );
}
