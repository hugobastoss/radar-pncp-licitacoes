"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Building2, ChevronDown, ChevronUp, ExternalLink, Loader2, Search, TriangleAlert } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { vigencia } from "@/components/ContratosAmSecao";
import { buscarEmpenhosAm } from "@/lib/api-am";
import { validarCnpj } from "@/lib/cnpj";
import { cn } from "@/lib/cn";
import { formatarCnpj, formatarDataSimples, formatarMoeda, mascararCnpj } from "@/lib/formatters";
import type { ContratoComEmpenhos, NotaEmpenhoContrato, ResultadoEmpenhosAm, TotaisEmpenhos } from "@/types/am";

type Status = "idle" | "carregando" | "sucesso" | "invalido" | "erro";

function CartaoValor({
  rotulo,
  valor,
  destaque,
  dica,
}: {
  rotulo: string;
  valor: number;
  destaque?: boolean;
  dica?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border p-4",
        destaque
          ? "border-primary-200 bg-primary-50 dark:border-primary-800 dark:bg-primary-900/40"
          : "border-ink-200 bg-white dark:border-ink-700 dark:bg-ink-900",
      )}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-ink-500 dark:text-ink-400">{rotulo}</p>
      <p
        className={cn(
          "mt-1 font-semibold tabular-nums text-ink-900 dark:text-ink-50",
          destaque ? "text-2xl text-primary-700 dark:text-primary-300" : "text-lg",
        )}
      >
        {formatarMoeda(valor)}
      </p>
      {dica && <p className="mt-0.5 text-xs text-ink-500 dark:text-ink-400">{dica}</p>}
    </div>
  );
}

function Resumo({ totais, anoExercicio }: { totais: TotaisEmpenhos; anoExercicio: number }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <CartaoValor
        rotulo="A receber"
        valor={totais.aReceber}
        destaque
        dica={totais.restosAPagar > 0 ? `inclui ${formatarMoeda(totais.restosAPagar)} de anos anteriores` : undefined}
      />
      <CartaoValor
        rotulo="Liquidado a pagar"
        valor={totais.liquidadoAPagar}
        dica="entrega já atestada, só falta pagar"
      />
      <CartaoValor rotulo={`Empenhado em ${anoExercicio}`} valor={totais.empenhado} />
      <CartaoValor
        rotulo={`Pago em ${anoExercicio}`}
        valor={totais.pago}
        dica={
          totais.pagoRestosAPagar > 0
            ? `mais ${formatarMoeda(totais.pagoRestosAPagar)} de notas de anos anteriores`
            : undefined
        }
      />
    </div>
  );
}

const DESCRICAO_SITUACAO: Record<
  Exclude<NotaEmpenhoContrato["situacao"], "encontrada">,
  (n: NotaEmpenhoContrato, ano: number) => string
> = {
  nao_encontrada: () => "Não aparece na SEFAZ — provavelmente um reforço, já somado a outra nota deste contrato.",
  sem_saldo: (n, ano) => `Nota de ${n.ano} sem saldo em ${ano} — quitada ou cancelada.`,
  indisponivel: () => "Não foi possível consultar esta nota na SEFAZ agora.",
};

function LinhaNota({ nota: n, anoExercicio }: { nota: NotaEmpenhoContrato; anoExercicio: number }) {
  const v = n.valores;
  const restoAPagar = v && Number(n.ano) !== anoExercicio;
  return (
    <tr className="border-t border-ink-100 align-top dark:border-ink-800">
      <td className="py-2 pr-3">
        <a
          href={n.link}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 font-medium tabular-nums text-primary-600 hover:underline dark:text-primary-400"
        >
          {n.numero}
          <ExternalLink className="h-3 w-3" aria-hidden />
          <span className="sr-only">(abre a nota no portal da SEFAZ em nova aba)</span>
        </a>
        {n.dataEmissao && (
          <p className="text-xs text-ink-500 dark:text-ink-400">emitida em {formatarDataSimples(n.dataEmissao)}</p>
        )}
      </td>
      {v && !restoAPagar ? (
        <>
          <td className="py-2 pr-3 text-right tabular-nums">{formatarMoeda(v.empenhado)}</td>
          <td className="py-2 pr-3 text-right tabular-nums">{formatarMoeda(v.liquidado)}</td>
          <td className="py-2 pr-3 text-right tabular-nums">{formatarMoeda(v.pago)}</td>
          <td className="py-2 text-right font-medium tabular-nums">{formatarMoeda(v.aReceber)}</td>
        </>
      ) : v && restoAPagar ? (
        <>
          <td colSpan={3} className="py-2 pr-3 text-right text-xs text-ink-600 dark:text-ink-300">
            Resto a pagar de {n.ano} — pago em {anoExercicio}: {formatarMoeda(v.pagoRestosAPagar)}
          </td>
          <td className="py-2 text-right font-medium tabular-nums">{formatarMoeda(v.aReceber)}</td>
        </>
      ) : (
        <td colSpan={4} className="py-2 text-xs text-ink-500 dark:text-ink-400">
          {DESCRICAO_SITUACAO[n.situacao as Exclude<typeof n.situacao, "encontrada">](n, anoExercicio)} Valor no
          contrato: {formatarMoeda(n.valorNoContrato)}.
        </td>
      )}
    </tr>
  );
}

/** ["2023", "2024", "2025"] → "2023, 2024 e 2025". */
function listarAnos(anos: string[]): string {
  return anos.length <= 1 ? (anos[0] ?? "") : `${anos.slice(0, -1).join(", ")} e ${anos.at(-1)}`;
}

function CartaoContrato({ contrato: c, anoExercicio }: { contrato: ContratoComEmpenhos; anoExercicio: number }) {
  const [aberto, setAberto] = useState(c.totais.aReceber > 0);
  const [verSemSaldo, setVerSemSaldo] = useState(false);
  const temSaldo = c.totais.aReceber > 0;
  // Notas de anos anteriores já quitadas só fazem volume: ficam num resumo, abrível.
  const semSaldo = c.notas.filter((n) => n.situacao === "sem_saldo");
  const notasVisiveis = verSemSaldo ? c.notas : c.notas.filter((n) => n.situacao !== "sem_saldo");
  const anosSemSaldo = [...new Set(semSaldo.map((n) => n.ano))].sort();

  return (
    <li className="rounded-xl border border-ink-200 bg-white p-4 dark:border-ink-700 dark:bg-ink-900">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-1.5 text-sm font-semibold text-ink-900 dark:text-ink-50">
            {c.termo}
            <span className="font-normal text-ink-500 dark:text-ink-400">· {c.ugSigla ?? c.ugNome}</span>
            {c.vigente ? <Badge tone="success">Vigente</Badge> : <Badge>Encerrado</Badge>}
          </p>
          <p className="mt-1 text-sm text-ink-700 dark:text-ink-200">{c.objeto ?? "Objeto não informado"}</p>
          <p className="mt-1 text-xs text-ink-500 dark:text-ink-400">
            {[
              c.valorTotal !== undefined && `valor do contrato ${formatarMoeda(c.valorTotal)}`,
              vigencia(c) && `vigência ${vigencia(c)}`,
              c.processoCompra && `processo ${c.processoCompra}`,
              c.aditivos.length > 0 && (c.aditivos.length === 1 ? "1 aditivo" : `${c.aditivos.length} aditivos`),
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        <div className="shrink-0 sm:text-right">
          <p className="text-xs uppercase tracking-wide text-ink-500 dark:text-ink-400">A receber</p>
          <p
            className={cn(
              "text-lg font-semibold tabular-nums",
              temSaldo ? "text-primary-700 dark:text-primary-300" : "text-ink-500 dark:text-ink-400",
            )}
          >
            {formatarMoeda(c.totais.aReceber)}
          </p>
          {c.totais.liquidadoAPagar > 0 && (
            <p className="text-xs text-ink-500 dark:text-ink-400">
              {formatarMoeda(c.totais.liquidadoAPagar)} já atestado
            </p>
          )}
        </div>
      </div>

      {c.notas.length === 0 ? (
        <p className="mt-2 text-xs text-ink-500 dark:text-ink-400">
          Nenhuma nota de empenho registrada neste contrato.
        </p>
      ) : (
        <>
          <button
            type="button"
            onClick={() => setAberto(!aberto)}
            aria-expanded={aberto}
            className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary-600 hover:underline dark:text-primary-400"
          >
            {aberto ? (
              <ChevronUp className="h-3.5 w-3.5" aria-hidden />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" aria-hidden />
            )}
            {aberto ? "Esconder notas de empenho" : `Ver notas de empenho (${c.notas.length})`}
          </button>
          {aberto && (
            <div className="mt-2 overflow-x-auto scrollbar-fina">
              {notasVisiveis.length > 0 && (
                <table className="w-full min-w-[560px] text-sm text-ink-700 dark:text-ink-200">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wide text-ink-500 dark:text-ink-400">
                      <th className="pb-1 pr-3 font-medium">Nota</th>
                      <th className="pb-1 pr-3 text-right font-medium">Empenhado</th>
                      <th className="pb-1 pr-3 text-right font-medium">Liquidado</th>
                      <th className="pb-1 pr-3 text-right font-medium">Pago</th>
                      <th className="pb-1 text-right font-medium">A receber</th>
                    </tr>
                  </thead>
                  <tbody>
                    {notasVisiveis.map((n) => (
                      <LinhaNota key={`${n.ug}-${n.numero}`} nota={n} anoExercicio={anoExercicio} />
                    ))}
                  </tbody>
                </table>
              )}
              {semSaldo.length > 0 && (
                <p className="mt-2 border-t border-ink-100 pt-2 text-xs text-ink-500 dark:border-ink-800 dark:text-ink-400">
                  {semSaldo.length === 1 ? "1 nota" : `${semSaldo.length} notas`} de {listarAnos(anosSemSaldo)} sem
                  saldo em {anoExercicio} (quitadas ou canceladas), somando{" "}
                  {formatarMoeda(semSaldo.reduce((s, n) => s + n.valorNoContrato, 0))} no contrato.{" "}
                  <button
                    type="button"
                    onClick={() => setVerSemSaldo(!verSemSaldo)}
                    className="font-medium text-primary-600 hover:underline dark:text-primary-400"
                  >
                    {verSemSaldo ? "Esconder" : "Mostrar"}
                  </button>
                </p>
              )}
            </div>
          )}
        </>
      )}
    </li>
  );
}

export function EmpenhosAmClient() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Mesmo padrão da consulta de CNPJ: a URL (/empenhos-am?cnpj=...) abre a tela já consultando.
  const [valor, setValor] = useState(() => mascararCnpj(searchParams.get("cnpj") ?? ""));
  const [consulta, setConsulta] = useState<{ cnpj: string } | null>(() => {
    const cnpj = searchParams.get("cnpj");
    return cnpj ? { cnpj } : null;
  });
  const [status, setStatus] = useState<Status>("idle");
  const [resultado, setResultado] = useState<ResultadoEmpenhosAm | null>(null);
  const [cnpjConsultado, setCnpjConsultado] = useState<string>("");
  const [mensagemErro, setMensagemErro] = useState<string | undefined>();
  const [soComSaldo, setSoComSaldo] = useState(true);
  const abortRef = useRef<AbortController | null>(null);

  const executar = useCallback(async (cnpj: string) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setStatus("carregando");
    setMensagemErro(undefined);
    setResultado(null);

    const r = await buscarEmpenhosAm(cnpj, { signal: controller.signal });
    if (controller.signal.aborted) return;

    if (r.status === "sucesso") {
      setResultado({
        contratos: r.contratos,
        totais: r.totais,
        anoExercicio: r.anoExercicio,
        completo: r.completo,
      });
      setCnpjConsultado(cnpj);
      setStatus("sucesso");
    } else if (r.status === "invalido") {
      setStatus("invalido");
      setMensagemErro(r.mensagem);
    } else if (r.status === "erro_servidor") {
      setStatus("erro");
      setMensagemErro(r.mensagem);
    }
  }, []);

  useEffect(() => {
    if (!consulta) return;
    // Mesmo padrão do DashboardClient: a consulta é assíncrona e o efeito só a dispara.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    executar(consulta.cnpj);
    const validacao = validarCnpj(consulta.cnpj);
    if (validacao.valido) router.replace(`${pathname}?cnpj=${validacao.cnpj}`, { scroll: false });
  }, [consulta, executar, pathname, router]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  function pesquisar(evento: FormEvent) {
    evento.preventDefault();
    if (!valor.trim()) return;
    setConsulta({ cnpj: valor });
  }

  const contratosVisiveis =
    resultado && soComSaldo ? resultado.contratos.filter((c) => c.totais.aReceber > 0) : (resultado?.contratos ?? []);
  const semSaldo = resultado
    ? resultado.contratos.length - resultado.contratos.filter((c) => c.totais.aReceber > 0).length
    : 0;
  const nomeContratado = resultado?.contratos[0]?.contratado;

  return (
    <div className="flex flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <div className="border-b border-ink-200 pb-4 dark:border-ink-700">
        <h1 className="text-base font-semibold text-ink-900 dark:text-ink-50">
          Empenhos a receber — Governo do Amazonas
        </h1>
        <p className="mt-1 text-xs text-ink-500 dark:text-ink-400">
          Contratos do fornecedor com o estado e quanto de cada nota de empenho já foi liquidado e pago.
        </p>
      </div>

      <form
        onSubmit={pesquisar}
        className="rounded-2xl border border-ink-200 bg-white p-5 shadow-card dark:border-ink-700 dark:bg-ink-900 sm:p-6"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Input
              label="CNPJ do fornecedor"
              placeholder="00.000.000/0000-00"
              leftIcon={<Building2 className="h-4 w-4" aria-hidden />}
              value={valor}
              maxLength={18}
              onChange={(e) => setValor(mascararCnpj(e.target.value))}
              onClear={() => setValor("")}
            />
          </div>
          <Button
            type="submit"
            leftIcon={status === "carregando" ? undefined : <Search className="h-4 w-4" aria-hidden />}
            loading={status === "carregando"}
          >
            Consultar
          </Button>
        </div>
      </form>

      {status === "carregando" && (
        <div className="flex items-start gap-2 text-sm text-ink-500 dark:text-ink-400">
          <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin" aria-hidden />
          <span>
            Procurando contratos em todos os órgãos do estado e conferindo as notas de empenho na SEFAZ… A primeira
            consulta do dia pode levar até meio minuto.
          </span>
        </div>
      )}

      {status === "invalido" && (
        <p className="text-sm text-danger-600 dark:text-danger-400">{mensagemErro ?? "CNPJ inválido."}</p>
      )}

      {status === "erro" && (
        <p className="text-sm text-danger-600 dark:text-danger-400">
          {mensagemErro ?? "Não foi possível consultar os empenhos do Governo do Amazonas neste momento."}
        </p>
      )}

      {status === "sucesso" && resultado && resultado.contratos.length === 0 && (
        <p className="text-sm text-ink-600 dark:text-ink-300">
          Nenhum contrato com o Governo do Amazonas encontrado para {formatarCnpj(cnpjConsultado)}.
        </p>
      )}

      {status === "sucesso" && resultado && resultado.contratos.length > 0 && (
        <div className="flex flex-col gap-4">
          <div>
            <p className="text-sm font-semibold text-ink-900 dark:text-ink-50">{nomeContratado}</p>
            <p className="text-xs text-ink-500 dark:text-ink-400">
              {formatarCnpj(cnpjConsultado)} ·{" "}
              {resultado.contratos.length === 1 ? "1 contrato" : `${resultado.contratos.length} contratos`} com o estado
            </p>
          </div>

          <Resumo totais={resultado.totais} anoExercicio={resultado.anoExercicio} />

          {!resultado.completo && (
            <p className="flex items-start gap-1.5 rounded-lg bg-warning-50 p-3 text-xs text-warning-700 dark:bg-warning-900/40 dark:text-warning-300">
              <TriangleAlert className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />
              Alguns órgãos ou notas não responderam agora — os valores podem estar incompletos. Tente de novo em alguns
              minutos.
            </p>
          )}

          <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-ink-700 dark:text-ink-200">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-ink-300 text-primary-600 focus-visible:ring-2 focus-visible:ring-primary-500 dark:border-ink-600 dark:bg-ink-800"
              checked={soComSaldo}
              onChange={(e) => setSoComSaldo(e.target.checked)}
            />
            Mostrar só contratos com saldo a receber
            {soComSaldo && semSaldo > 0 && (
              <span className="text-xs text-ink-500 dark:text-ink-400">
                ({semSaldo} {semSaldo === 1 ? "contrato sem saldo escondido" : "contratos sem saldo escondidos"})
              </span>
            )}
          </label>

          {contratosVisiveis.length === 0 ? (
            <p className="text-sm text-ink-600 dark:text-ink-300">Nenhum contrato com saldo a receber.</p>
          ) : (
            <ul className="space-y-3">
              {contratosVisiveis.map((c) => (
                <CartaoContrato key={c.chave} contrato={c} anoExercicio={resultado.anoExercicio} />
              ))}
            </ul>
          )}

          <p className="text-xs text-ink-400 dark:text-ink-500">
            Fontes: SGC — Sistema de Gestão de Contratos da SEFAZ-AM (quais notas pertencem a cada contrato) e Portal da
            Transparência Fiscal da SEFAZ-AM (quanto de cada nota foi empenhado, liquidado e pago, com os reforços já
            somados). A receber = empenhado − pago das notas de {resultado.anoExercicio}, mais o saldo de restos a
            pagar das notas de anos anteriores.
          </p>
        </div>
      )}
    </div>
  );
}
