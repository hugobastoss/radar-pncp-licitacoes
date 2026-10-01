"use client";

import { useRef, useState } from "react";
import type { FormEvent } from "react";
import { Loader2, Scale, Search, ShieldAlert } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Combobox } from "@/components/ui/Combobox";
import { Badge } from "@/components/ui/Badge";
import { Campo } from "@/components/LicitacaoDetails";
import { buscarProcessoJudicial } from "@/lib/api-processos";
import { formatarNumeroProcesso, mascararNumeroProcesso } from "@/lib/processo-judicial";
import { formatarDataHora } from "@/lib/formatters";
import { TRIBUNAIS } from "@/lib/data/tribunais";
import type { ProcessoJudicial } from "@/types/processo-judicial";

type Status = "idle" | "carregando" | "sucesso" | "invalido" | "nao_encontrado" | "erro";

const OPCOES_TRIBUNAL = TRIBUNAIS.map((t) => ({ value: t.alias, label: t.nome }));

function ProcessoCard({ processo }: { processo: ProcessoJudicial }) {
  const sigiloso = processo.nivelSigilo > 0;

  return (
    <div className="rounded-[10px] border border-ink-200 bg-white p-5 shadow-card dark:border-ink-700 dark:bg-ink-900 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <Scale className="mt-0.5 h-5 w-5 shrink-0 text-primary-600 dark:text-primary-400" aria-hidden />
          <div>
            <p className="text-lg font-semibold tabular-nums text-ink-900 dark:text-ink-50">
              {formatarNumeroProcesso(processo.numeroProcesso)}
            </p>
            <p className="mt-0.5 text-sm text-ink-600 dark:text-ink-300">
              {processo.tribunal}
              {processo.grau && ` · ${processo.grau}`}
            </p>
          </div>
        </div>
        {sigiloso && (
          <Badge tone="warning" icon={<ShieldAlert className="h-3.5 w-3.5" aria-hidden />}>
            Segredo de justiça
          </Badge>
        )}
      </div>

      {sigiloso ? (
        <p className="mt-4 text-sm text-ink-600 dark:text-ink-300">
          Este processo está sob algum grau de sigilo (nível {processo.nivelSigilo}). Por respeito ao segredo de
          justiça, não exibimos assuntos, órgão julgador nem andamentos.
        </p>
      ) : (
        <>
          <dl className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Campo rotulo="Classe" valor={processo.classe ?? "Não informada"} />
            <Campo rotulo="Órgão julgador" valor={processo.orgaoJulgador ?? "Não informado"} />
            <Campo rotulo="Sistema" valor={processo.sistema ?? "Não informado"} />
            <Campo rotulo="Data de ajuizamento" valor={formatarDataHora(processo.dataAjuizamento)} />
            <Campo rotulo="Última atualização" valor={formatarDataHora(processo.dataUltimaAtualizacao)} />
          </dl>

          {processo.assuntos.length > 0 && (
            <div className="mt-5">
              <dt className="text-xs font-medium uppercase tracking-wide text-ink-500 dark:text-ink-400">
                Assuntos
              </dt>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {processo.assuntos.map((assunto) => (
                  <Badge key={assunto}>{assunto}</Badge>
                ))}
              </div>
            </div>
          )}

          {processo.movimentos.length > 0 && (
            <div className="mt-5 border-t border-ink-100 pt-5 dark:border-ink-800">
              <p className="text-xs font-medium uppercase tracking-wide text-ink-500 dark:text-ink-400">
                Andamentos ({processo.movimentos.length})
              </p>
              <ol className="mt-3 space-y-3">
                {processo.movimentos.map((movimento, indice) => (
                  <li key={`${movimento.codigo}-${movimento.dataHora}-${indice}`} className="text-sm">
                    <p className="font-medium text-ink-900 dark:text-ink-50">
                      {movimento.nome ?? `Movimento ${movimento.codigo}`}
                    </p>
                    <p className="text-xs text-ink-500 dark:text-ink-400">
                      {formatarDataHora(movimento.dataHora)}
                      {movimento.complemento && ` · ${movimento.complemento}`}
                    </p>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </>
      )}

      <p className="mt-5 border-t border-ink-100 pt-3 text-xs text-ink-400 dark:border-ink-800 dark:text-ink-500">
        Fonte: DataJud (CNJ) — metadados públicos do processo, sem dados das partes.
      </p>
    </div>
  );
}

export function ProcessoJudicialClient() {
  const [tribunal, setTribunal] = useState("");
  const [numero, setNumero] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [processo, setProcesso] = useState<ProcessoJudicial | null>(null);
  const [mensagemErro, setMensagemErro] = useState<string | undefined>();
  const abortRef = useRef<AbortController | null>(null);

  async function pesquisar(evento: FormEvent) {
    evento.preventDefault();
    if (!tribunal || !numero.trim()) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setStatus("carregando");
    setMensagemErro(undefined);

    const resultado = await buscarProcessoJudicial(tribunal, numero, { signal: controller.signal });

    if (resultado.status === "sucesso") {
      setProcesso(resultado.processo);
      setStatus("sucesso");
    } else if (resultado.status === "invalido") {
      setStatus("invalido");
      setMensagemErro(resultado.mensagem);
    } else if (resultado.status === "nao_encontrado") {
      setProcesso(null);
      setStatus("nao_encontrado");
    } else if (resultado.status === "erro_servidor") {
      setStatus("erro");
      setMensagemErro(resultado.mensagem);
    }
  }

  return (
    <div className="flex flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <form
        onSubmit={pesquisar}
        className="rounded-[10px] border border-ink-200 bg-white p-5 shadow-card dark:border-ink-700 dark:bg-ink-900 sm:p-6"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="w-full sm:w-72">
            <Combobox
              label="Tribunal"
              options={OPCOES_TRIBUNAL}
              value={tribunal}
              onChange={setTribunal}
              placeholder="Buscar tribunal…"
            />
          </div>
          <div className="flex-1">
            <Input
              label="Número do processo"
              placeholder="0000000-00.0000.0.00.0000"
              leftIcon={<Search className="h-4 w-4" aria-hidden />}
              value={numero}
              maxLength={25}
              onChange={(e) => setNumero(mascararNumeroProcesso(e.target.value))}
              onClear={() => setNumero("")}
            />
          </div>
          <Button
            type="submit"
            leftIcon={status === "carregando" ? undefined : <Search className="h-4 w-4" aria-hidden />}
            loading={status === "carregando"}
            disabled={!tribunal || !numero.trim()}
          >
            Consultar
          </Button>
        </div>
      </form>

      {status === "carregando" && (
        <div className="flex items-center gap-2 text-sm text-ink-500 dark:text-ink-400">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Consultando o DataJud — pode levar até meio minuto…
        </div>
      )}

      {status === "invalido" && (
        <p className="text-sm text-danger-600 dark:text-danger-400">{mensagemErro ?? "Consulta inválida."}</p>
      )}

      {status === "nao_encontrado" && (
        <p className="text-sm text-ink-600 dark:text-ink-300">
          Nenhum processo encontrado com esse número neste tribunal. Confira o tribunal selecionado — o mesmo
          número só existe em um deles.
        </p>
      )}

      {status === "erro" && (
        <p className="text-sm text-danger-600 dark:text-danger-400">
          {mensagemErro ?? "Não foi possível consultar o processo neste momento."}
        </p>
      )}

      {status === "sucesso" && processo && <ProcessoCard processo={processo} />}
    </div>
  );
}
