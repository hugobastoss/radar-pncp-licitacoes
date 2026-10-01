"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Building2, ExternalLink, Loader2, Search, TriangleAlert } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { AbasEmpenhos } from "@/components/AbasEmpenhos";
import { CartaoValor } from "@/components/EmpenhosAmClient";
import { buscarEmpenhosFederais } from "@/lib/api-empenhos-federais";
import { validarCnpj } from "@/lib/cnpj";
import { cn } from "@/lib/cn";
import { formatarCnpj, formatarMoeda, mascararCnpj } from "@/lib/formatters";
import { linkDocumentoDespesa } from "@/lib/portal-transparencia";
import type { EmpenhoFederal, ResultadoEmpenhosFederais } from "@/types/transparencia";

type Status = "idle" | "carregando" | "sucesso" | "invalido" | "limite" | "nao_configurado" | "erro";

function CartaoEmpenho({ empenho: e }: { empenho: EmpenhoFederal }) {
  const link = linkDocumentoDespesa("Empenho", e.codigo);
  const temSaldo = e.aReceber > 0;

  return (
    <li className="rounded-xl border border-ink-200 bg-white p-4 dark:border-ink-700 dark:bg-ink-900">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-1.5 text-sm font-semibold text-ink-900 dark:text-ink-50">
            {link ? (
              <a
                href={link}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 tabular-nums text-primary-600 hover:underline dark:text-primary-400"
              >
                {e.codigoResumido}
                <ExternalLink className="h-3 w-3" aria-hidden />
                <span className="sr-only">(abre o empenho no Portal da Transparência em nova aba)</span>
              </a>
            ) : (
              e.codigoResumido
            )}
            <span className="font-normal text-ink-500 dark:text-ink-400">· {e.orgao ?? e.orgaoSuperior ?? e.ug}</span>
            {e.restoAPagar && temSaldo && <Badge tone="warning">Resto a pagar</Badge>}
          </p>
          {e.descricao && <p className="mt-1 text-sm text-ink-700 dark:text-ink-200">{e.descricao}</p>}
          {e.notaRestos && <p className="mt-0.5 text-xs text-warning-700 dark:text-warning-300">{e.notaRestos}</p>}
          <p className="mt-1 text-xs text-ink-500 dark:text-ink-400">
            {[
              e.data && `emitido em ${e.data}`,
              e.ug && e.ug !== e.orgao && e.ug,
              e.orgaoSuperior && e.orgaoSuperior !== e.orgao && e.orgaoSuperior,
              e.elemento,
              e.processo && `processo ${e.processo}`,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
          <p className="mt-1 text-xs text-ink-500 dark:text-ink-400">
            Empenhado {formatarMoeda(e.empenhado)} · pago {formatarMoeda(e.pago)}
            {e.cancelado > 0 && ` · cancelado ${formatarMoeda(e.cancelado)}`}
            {!e.completo && " · pagamentos não conferidos por completo"}
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
            {formatarMoeda(e.aReceber)}
          </p>
        </div>
      </div>
    </li>
  );
}

export function EmpenhosFederaisClient() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Mesmo padrão da tela do Amazonas: a URL (/empenhos-federal?cnpj=...) abre a tela já consultando.
  const [valor, setValor] = useState(() => mascararCnpj(searchParams.get("cnpj") ?? ""));
  const [consulta, setConsulta] = useState<{ cnpj: string } | null>(() => {
    const cnpj = searchParams.get("cnpj");
    return cnpj ? { cnpj } : null;
  });
  const [status, setStatus] = useState<Status>("idle");
  const [resultado, setResultado] = useState<ResultadoEmpenhosFederais | null>(null);
  const [cnpjConsultado, setCnpjConsultado] = useState("");
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

    const r = await buscarEmpenhosFederais(cnpj, { signal: controller.signal });
    if (controller.signal.aborted || r.status === "cancelado") return;

    if (r.status === "sucesso") {
      setResultado({
        favorecido: r.favorecido,
        anos: r.anos,
        empenhos: r.empenhos,
        totais: r.totais,
        totalEmpenhos: r.totalEmpenhos,
        completo: r.completo,
      });
      setCnpjConsultado(cnpj);
      setStatus("sucesso");
    } else if (r.status === "nao_configurado") {
      setStatus("nao_configurado");
    } else {
      setStatus(r.status === "invalido" ? "invalido" : r.status === "limite" ? "limite" : "erro");
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

  const comSaldo = resultado?.empenhos.filter((e) => e.aReceber > 0) ?? [];
  const visiveis = soComSaldo ? comSaldo : (resultado?.empenhos ?? []);
  const restosAPagar = comSaldo.filter((e) => e.restoAPagar).reduce((s, e) => s + e.aReceber, 0);

  return (
    <div className="flex flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <AbasEmpenhos />

      <form
        onSubmit={pesquisar}
        className="rounded-[10px] border border-ink-200 bg-white p-5 shadow-card dark:border-ink-700 dark:bg-ink-900 sm:p-6"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Input
              label="CNPJ do fornecedor"
              placeholder="00.000.000/0000-00"
              leftIcon={<Building2 className="h-4 w-4" aria-hidden />}
              value={valor}
              maxLength={18}
              onChange={(ev) => setValor(mascararCnpj(ev.target.value))}
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
            Buscando os empenhos e os pagamentos de cada um no Portal da Transparência… Para fornecedores grandes pode
            levar meio minuto.
          </span>
        </div>
      )}

      {(status === "invalido" || status === "limite") && (
        <p className="text-sm text-danger-600 dark:text-danger-400">{mensagemErro ?? "CNPJ inválido."}</p>
      )}

      {status === "nao_configurado" && (
        <p className="text-sm text-ink-600 dark:text-ink-300">
          Consulta de empenhos federais ainda não configurada nesta instância.
        </p>
      )}

      {status === "erro" && (
        <p className="text-sm text-danger-600 dark:text-danger-400">
          {mensagemErro ?? "Não foi possível consultar os empenhos federais neste momento."}
        </p>
      )}

      {status === "sucesso" && resultado && resultado.empenhos.length === 0 && (
        <p className="text-sm text-ink-600 dark:text-ink-300">
          Nenhum empenho do governo federal para {formatarCnpj(cnpjConsultado)} em {resultado.anos.join(" e ")}.
        </p>
      )}

      {status === "sucesso" && resultado && resultado.empenhos.length > 0 && (
        <div className="flex flex-col gap-4">
          <div>
            <p className="text-sm font-semibold text-ink-900 dark:text-ink-50">{resultado.favorecido}</p>
            <p className="text-xs text-ink-500 dark:text-ink-400">
              {formatarCnpj(cnpjConsultado)} ·{" "}
              {resultado.totalEmpenhos === 1 ? "1 empenho" : `${resultado.totalEmpenhos} empenhos`} em{" "}
              {[...resultado.anos].reverse().join(" e ")}
              {resultado.totalEmpenhos > resultado.empenhos.length &&
                ` (os ${resultado.empenhos.length} mais recentes analisados)`}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <CartaoValor
              rotulo="A receber"
              valor={resultado.totais.aReceber}
              destaque
              dica={restosAPagar > 0 ? `inclui ${formatarMoeda(restosAPagar)} de restos a pagar` : undefined}
            />
            <CartaoValor rotulo="Empenhado" valor={resultado.totais.empenhado} />
            <CartaoValor
              rotulo="Pago"
              valor={resultado.totais.pago}
              dica={
                resultado.totais.cancelado > 0
                  ? `e ${formatarMoeda(resultado.totais.cancelado)} cancelados (restos a pagar)`
                  : undefined
              }
            />
          </div>

          {!resultado.completo && (
            <p className="flex items-start gap-1.5 rounded-lg bg-warning-50 p-3 text-xs text-warning-700 dark:bg-warning-900/40 dark:text-warning-300">
              <TriangleAlert className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />
              Parte dos empenhos ou dos pagamentos ficou de fora (limite de consultas ou falha do Portal) — os valores
              podem estar incompletos.
            </p>
          )}

          <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-ink-700 dark:text-ink-200">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-ink-300 text-primary-600 focus-visible:ring-2 focus-visible:ring-primary-500 dark:border-ink-600 dark:bg-ink-800"
              checked={soComSaldo}
              onChange={(ev) => setSoComSaldo(ev.target.checked)}
            />
            Mostrar só empenhos com saldo a receber
            {soComSaldo && resultado.empenhos.length > comSaldo.length && (
              <span className="text-xs text-ink-500 dark:text-ink-400">
                ({resultado.empenhos.length - comSaldo.length} quitados escondidos)
              </span>
            )}
          </label>

          {visiveis.length === 0 ? (
            <p className="text-sm text-ink-600 dark:text-ink-300">Nenhum empenho com saldo a receber.</p>
          ) : (
            <ul className="space-y-3">
              {visiveis.map((e) => (
                <CartaoEmpenho key={e.codigo} empenho={e} />
              ))}
            </ul>
          )}

          <p className="text-xs text-ink-400 dark:text-ink-500">
            Fonte: Portal da Transparência (CGU), atualizado uma vez por dia. Empenhos emitidos em{" "}
            {[...resultado.anos].reverse().join(" e ")} e os de anos anteriores inscritos em restos a pagar nesse
            período. A receber = valor atual do empenho (com reforços e anulações) − pagamentos, estornos descontados;
            para resto a pagar, o saldo inscrito (já sem cancelamentos) − o que foi pago desde então. A CGU não informa o
            valor liquidado, então não dá para separar o que já foi atestado.
          </p>
        </div>
      )}
    </div>
  );
}
