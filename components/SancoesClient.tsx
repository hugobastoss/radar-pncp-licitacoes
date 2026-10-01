"use client";

import { useRef, useState } from "react";
import type { FormEvent } from "react";
import { Building2, Loader2, Search, ShieldAlert, ShieldCheck } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { descreverResumoSancoes, SancaoItem } from "@/components/SancaoItem";
import { CertidaoTcuSecao } from "@/components/CertidaoTcuSecao";
import type { EstadoCertidaoTcu } from "@/components/CertidaoTcuSecao";
import { ListaSujaAlerta } from "@/components/ListaSujaAlerta";
import { buscarListaSuja } from "@/lib/api-fontes-publicas";
import { buscarSancoes } from "@/lib/api-sancoes";
import { buscarCertidaoTcu } from "@/lib/api-tcu";
import { normalizarCnpj } from "@/lib/cnpj";
import { mascararCnpj } from "@/lib/formatters";
import type { RegistroListaSuja } from "@/types/fontes-publicas";
import type { Sancao } from "@/types/transparencia";

type Status = "idle" | "carregando" | "sucesso" | "invalido" | "nao_configurado" | "erro";

export function SancoesClient() {
  const [valor, setValor] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [resultado, setResultado] = useState<{ ceis: Sancao[]; cnep: Sancao[] } | null>(null);
  const [mensagemErro, setMensagemErro] = useState<string | undefined>();
  const [certidaoTcu, setCertidaoTcu] = useState<EstadoCertidaoTcu>({ status: "carregando" });
  const [cnpjConsultado, setCnpjConsultado] = useState("");
  // `undefined`: ainda consultando; `null`: a lista suja não pôde ser conferida.
  const [listaSuja, setListaSuja] = useState<RegistroListaSuja[] | null | undefined>(undefined);
  const abortRef = useRef<AbortController | null>(null);

  async function pesquisar(evento: FormEvent) {
    evento.preventDefault();
    if (!valor.trim()) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setStatus("carregando");
    setMensagemErro(undefined);
    setCertidaoTcu({ status: "carregando" });
    setCnpjConsultado(normalizarCnpj(valor));
    setListaSuja(undefined);

    // A lista suja do trabalho escravo é de outra fonte (MTE): chega à parte e falha sozinha.
    void buscarListaSuja(normalizarCnpj(valor), { signal: controller.signal }).then((r) => {
      if (controller.signal.aborted) return;
      if (r.status === "sucesso") setListaSuja(r.registros);
      else if (r.status !== "cancelado") setListaSuja(null);
    });

    // O TCU é mais lento (~6 s na primeira consulta) — aparece quando chegar, sem segurar as sanções.
    void buscarCertidaoTcu(valor, { signal: controller.signal }).then((r) => {
      if (controller.signal.aborted) return;
      if (r.status === "sucesso") setCertidaoTcu(r);
      else if (r.status !== "cancelado") setCertidaoTcu({ status: "erro", mensagem: "mensagem" in r ? r.mensagem : undefined });
    });

    const resposta = await buscarSancoes(valor, { signal: controller.signal });

    if (resposta.status === "sucesso") {
      setResultado({ ceis: resposta.ceis, cnep: resposta.cnep });
      setStatus("sucesso");
    } else if (resposta.status === "invalido") {
      setStatus("invalido");
      setMensagemErro(resposta.mensagem);
    } else if (resposta.status === "nao_configurado") {
      setStatus("nao_configurado");
    } else if (resposta.status === "erro_servidor") {
      setStatus("erro");
      setMensagemErro(resposta.mensagem);
    }
  }

  const todas = resultado ? [...resultado.ceis, ...resultado.cnep] : [];

  return (
    <div className="flex flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <form
        onSubmit={pesquisar}
        className="rounded-[10px] border border-ink-200 bg-white p-5 shadow-card dark:border-ink-700 dark:bg-ink-900 sm:p-6"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Input
              label="CNPJ"
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
        <div className="flex items-center gap-2 text-sm text-ink-500 dark:text-ink-400">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Consultando…
        </div>
      )}

      {status === "invalido" && (
        <p className="text-sm text-danger-600 dark:text-danger-400">{mensagemErro ?? "CNPJ inválido."}</p>
      )}

      {status === "nao_configurado" && (
        <p className="text-sm text-ink-600 dark:text-ink-300">
          Consulta de sanções ainda não configurada nesta instância.
        </p>
      )}

      {status === "erro" && (
        <p className="text-sm text-danger-600 dark:text-danger-400">
          {mensagemErro ?? "Não foi possível consultar sanções neste momento."}
        </p>
      )}

      {status === "sucesso" && (
        <div className="rounded-[10px] border border-ink-200 bg-white p-5 shadow-card dark:border-ink-700 dark:bg-ink-900 sm:p-6">
          <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-ink-500 dark:text-ink-400">
            <ShieldAlert className="h-3.5 w-3.5" aria-hidden />
            Resultado
          </p>

          {todas.length === 0 ? (
            <p className="mt-2 flex items-center gap-1.5 text-sm text-success-700 dark:text-success-300">
              <ShieldCheck className="h-4 w-4" aria-hidden />
              Nenhuma sanção encontrada no CEIS ou no CNEP.
            </p>
          ) : (
            <>
              <p className="mt-2 text-sm text-ink-700 dark:text-ink-200">
                {descreverResumoSancoes(todas)}
              </p>
              <ul className="mt-3 space-y-2">
                {todas.map((sancao) => (
                  <SancaoItem key={`${sancao.tipo}-${sancao.id}`} sancao={sancao} />
                ))}
              </ul>
            </>
          )}

          <p className="mt-3 text-xs text-ink-400 dark:text-ink-500">Fonte: Portal da Transparência (CGU).</p>

          {listaSuja !== undefined &&
            (listaSuja?.length === 0 ? (
              <p className="mt-4 flex items-center gap-1.5 text-sm text-success-700 dark:text-success-300">
                <ShieldCheck className="h-4 w-4" aria-hidden />
                Não consta na lista suja do trabalho escravo (MTE).
              </p>
            ) : (
              <ListaSujaAlerta registros={listaSuja} className="mt-4" />
            ))}

          <CertidaoTcuSecao
            estado={certidaoTcu}
            cnpj={cnpjConsultado}
            className="mt-5 border-t border-ink-100 pt-5 dark:border-ink-800"
          />
        </div>
      )}
    </div>
  );
}
