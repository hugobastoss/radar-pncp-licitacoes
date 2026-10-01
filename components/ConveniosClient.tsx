"use client";

import { useRef, useState } from "react";
import type { FormEvent } from "react";
import { ChevronLeft, ChevronRight, ExternalLink, Handshake, Loader2, Search, TriangleAlert } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { LinkCnpj } from "@/components/LinkCnpj";
import { buscarConvenios } from "@/lib/api-convenios";
import type { FiltrosBuscaConvenios } from "@/lib/api-convenios";
import { ESTADOS } from "@/lib/data/estados";
import { MUNICIPIOS_POR_UF } from "@/lib/data/municipios";
import { cn } from "@/lib/cn";
import { formatarDataSimples, formatarMoeda } from "@/lib/formatters";
import type { ConvenioFederal, ResultadoConvenios } from "@/types/transparencia";

type Status = "idle" | "carregando" | "sucesso" | "invalido" | "nao_configurado" | "erro";

const FORMATO_CNPJ = /^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/;

/** A página do convênio no Portal usa o código dele ("999870"), não o `id` da API — com o id dá 404. */
function linkConvenio(codigo: string): string {
  return `https://portaldatransparencia.gov.br/convenios/${codigo}`;
}

function tomSituacao(situacao: string | undefined): "success" | "primary" | "warning" | "neutral" {
  const s = situacao?.toUpperCase() ?? "";
  if (s.includes("EXECU")) return "primary";
  if (s.includes("CONCLU") || s.includes("APROVAD")) return "success";
  if (s.includes("INADIMPL") || s.includes("IMPUGN") || s.includes("RESCIND") || s.includes("ANULAD")) return "warning";
  return "neutral";
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

function CartaoConvenio({ convenio: c }: { convenio: ConvenioFederal }) {
  const vigencia = [formatarDataSimples(c.inicioVigencia), formatarDataSimples(c.fimVigencia)]
    .filter(Boolean)
    .join(" a ");
  const liberadoPct = c.valor > 0 ? Math.round((c.valorLiberado / c.valor) * 100) : undefined;

  return (
    <li className="rounded-xl border border-ink-200 bg-white p-4 dark:border-ink-700 dark:bg-ink-900">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-semibold text-ink-900 dark:text-ink-50">{c.convenente.nome}</p>
        {c.situacao && <Badge tone={tomSituacao(c.situacao)}>{c.situacao}</Badge>}
      </div>
      <p className="mt-0.5 text-xs text-ink-500 dark:text-ink-400">
        {c.convenente.documento &&
          (FORMATO_CNPJ.test(c.convenente.documento) ? (
            <LinkCnpj cnpj={c.convenente.documento} />
          ) : (
            c.convenente.documento
          ))}
        {c.convenente.documento && (c.municipio || c.convenente.tipo) && " · "}
        {[c.municipio && `${c.municipio}${c.uf ? `/${c.uf}` : ""}`, c.convenente.tipo].filter(Boolean).join(" · ")}
      </p>

      <p className="mt-2 text-sm text-ink-700 dark:text-ink-200">{c.objeto ?? "Objeto não informado"}</p>
      <p className="mt-1 text-xs text-ink-500 dark:text-ink-400">
        {[
          c.numero && `Convênio ${c.numero}`,
          c.concedente && `concedente ${c.concedente}`,
          vigencia && `vigência ${vigencia}`,
        ]
          .filter(Boolean)
          .join(" · ")}
      </p>

      <div className="mt-3 grid grid-cols-3 gap-3 text-sm">
        <Valor rotulo="Valor do convênio" valor={c.valor} destaque />
        <Valor rotulo={`Liberado${liberadoPct !== undefined ? ` (${liberadoPct}%)` : ""}`} valor={c.valorLiberado} />
        <Valor rotulo="Contrapartida" valor={c.valorContrapartida} />
      </div>
      {c.ultimaLiberacao && (
        <p className="mt-2 text-xs text-ink-500 dark:text-ink-400">
          Última liberação em {formatarDataSimples(c.ultimaLiberacao)}
          {c.valorUltimaLiberacao !== undefined && `: ${formatarMoeda(c.valorUltimaLiberacao)}`}
        </p>
      )}

      {c.codigo && (
        <a
          href={linkConvenio(c.codigo)}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary-600 hover:underline dark:text-primary-400"
        >
          Ver no Portal da Transparência
          <ExternalLink className="h-3 w-3" aria-hidden />
          <span className="sr-only">(abre em nova aba)</span>
        </a>
      )}
    </li>
  );
}

export function ConveniosClient() {
  const [uf, setUf] = useState("AM");
  const [municipio, setMunicipio] = useState("");
  const [convenente, setConvenente] = useState("");
  const [somenteVigentes, setSomenteVigentes] = useState(true);
  const [status, setStatus] = useState<Status>("idle");
  const [resultado, setResultado] = useState<ResultadoConvenios | null>(null);
  const [filtrosAtuais, setFiltrosAtuais] = useState<FiltrosBuscaConvenios | null>(null);
  const [mensagemErro, setMensagemErro] = useState<string | undefined>();
  const abortRef = useRef<AbortController | null>(null);

  const municipios = uf ? (MUNICIPIOS_POR_UF[uf] ?? []) : [];

  async function consultar(filtros: FiltrosBuscaConvenios) {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setStatus("carregando");
    setMensagemErro(undefined);

    const r = await buscarConvenios(filtros, { signal: controller.signal });
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
    // Com município escolhido, a UF é redundante pra CGU.
    consultar({
      uf: municipio ? undefined : uf,
      municipio,
      convenente,
      vigentes: somenteVigentes ? "1" : undefined,
      pagina: 1,
    });
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
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1.5fr_2fr_auto] lg:items-end">
          <Select
            label="Estado"
            value={uf}
            onChange={(ev) => {
              setUf(ev.target.value);
              setMunicipio("");
            }}
          >
            <option value="">Todos</option>
            {ESTADOS.map((e) => (
              <option key={e.sigla} value={e.sigla}>
                {e.nome}
              </option>
            ))}
          </Select>
          <Select label="Município" value={municipio} disabled={!uf} onChange={(ev) => setMunicipio(ev.target.value)}>
            <option value="">{uf ? "Todos do estado" : "Escolha um estado"}</option>
            {municipios.map((m) => (
              <option key={m.codigoIbge} value={m.codigoIbge}>
                {m.nome}
              </option>
            ))}
          </Select>
          <Input
            label="Convenente"
            placeholder="Ex.: MUNICIPIO DE MANAUS"
            leftIcon={<Handshake className="h-4 w-4" aria-hidden />}
            value={convenente}
            maxLength={100}
            onChange={(ev) => setConvenente(ev.target.value)}
            onClear={() => setConvenente("")}
          />
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
            checked={somenteVigentes}
            onChange={(ev) => setSomenteVigentes(ev.target.checked)}
          />
          Só convênios em vigência
        </label>
        <p className="mt-3 text-xs text-ink-400 dark:text-ink-500">
          A CGU exige um estado, um município ou o nome do convenente — e o nome tem que ser o completo, exatamente como
          no cadastro (&quot;MUNICIPIO DE MANAUS&quot; funciona, &quot;MANAUS&quot; não). Para achar uma prefeitura ou
          entidade, o mais fácil é escolher o município. Não aceita busca por CNPJ.
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
        <p className="text-sm text-ink-600 dark:text-ink-300">
          Consulta de convênios ainda não configurada nesta instância.
        </p>
      )}

      {status === "erro" && (
        <p className="text-sm text-danger-600 dark:text-danger-400">
          {mensagemErro ?? "Não foi possível consultar os convênios neste momento."}
        </p>
      )}

      {status === "sucesso" && resultado && (
        <div className="flex flex-col gap-4">
          {resultado.itens.length === 0 ? (
            <p className="flex items-start gap-1.5 text-sm text-ink-600 dark:text-ink-300">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              {resultado.pagina > 1
                ? "Não há mais convênios para esses filtros."
                : "Nenhum convênio encontrado. Se buscou pelo convenente, confira o nome completo — a CGU não aceita parte do nome."}
            </p>
          ) : (
            <>
              <p className="text-sm text-ink-600 dark:text-ink-300">
                Página {resultado.pagina} · {resultado.itens.length}{" "}
                {resultado.itens.length === 1 ? "convênio" : "convênios"}
              </p>
              <ul className="space-y-3">
                {resultado.itens.map((c) => (
                  <CartaoConvenio key={c.id} convenio={c} />
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
            Fonte: Portal da Transparência (CGU), atualizado uma vez por dia. A CGU não ordena nem informa o total de
            resultados — a lista vem de 15 em 15.
          </p>
        </div>
      )}
    </div>
  );
}
