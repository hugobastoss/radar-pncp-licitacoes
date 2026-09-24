"use client";

import { useRef, useState } from "react";
import type { FormEvent } from "react";
import { Building2, Loader2, Search, TriangleAlert, Users } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Campo } from "@/components/LicitacaoDetails";
import { buscarEmpresa } from "@/lib/api-cnpj";
import { formatarCnpj, formatarDataSimples, formatarMoeda, mascararCnpj } from "@/lib/formatters";
import type { Empresa } from "@/types/cnpj";

type Status = "idle" | "carregando" | "sucesso" | "invalido" | "nao_encontrado" | "erro";

function EmpresaCard({ empresa }: { empresa: Empresa }) {
  const ativa = empresa.situacaoCadastral?.toUpperCase() === "ATIVA";

  return (
    <div className="rounded-2xl border border-ink-200 bg-white p-5 shadow-card dark:border-ink-700 dark:bg-ink-900 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-lg font-semibold text-ink-900 dark:text-ink-50">{empresa.razaoSocial}</p>
          {empresa.nomeFantasia && (
            <p className="mt-0.5 text-sm text-ink-600 dark:text-ink-300">{empresa.nomeFantasia}</p>
          )}
          <p className="mt-1 text-xs text-ink-500 dark:text-ink-400">{formatarCnpj(empresa.cnpj)}</p>
        </div>
        {empresa.situacaoCadastral && (
          <Badge tone={ativa ? "success" : "danger"}>{empresa.situacaoCadastral}</Badge>
        )}
      </div>

      {empresa.motivoSituacaoCadastral && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-warning-700 dark:text-warning-300">
          <TriangleAlert className="h-3.5 w-3.5 shrink-0" aria-hidden />
          {empresa.motivoSituacaoCadastral}
          {empresa.dataSituacaoCadastral && ` em ${formatarDataSimples(empresa.dataSituacaoCadastral)}`}
        </p>
      )}

      <dl className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Campo rotulo="Natureza jurídica" valor={empresa.naturezaJuridica ?? "Não informada"} />
        <Campo rotulo="Porte" valor={empresa.porte ?? "Não informado"} />
        <Campo rotulo="Capital social" valor={formatarMoeda(empresa.capitalSocial)} />
        <Campo rotulo="Data de abertura" valor={formatarDataSimples(empresa.dataInicioAtividade) ?? "Não informada"} />
        <Campo rotulo="Telefone" valor={empresa.telefone ?? "Não informado"} />
        <Campo rotulo="E-mail" valor={empresa.email ?? "Não informado"} />
      </dl>

      <div className="mt-5">
        <Campo
          rotulo="Atividade principal"
          valor={empresa.atividadePrincipal ?? "Não informada"}
        />
      </div>

      {empresa.atividadesSecundarias.length > 0 && (
        <div className="mt-5">
          <dt className="text-xs font-medium uppercase tracking-wide text-ink-500 dark:text-ink-400">
            Atividades secundárias
          </dt>
          <ul className="mt-1.5 space-y-1 text-sm text-ink-700 dark:text-ink-200">
            {empresa.atividadesSecundarias.map((atividade) => (
              <li key={atividade}>{atividade}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-5">
        <Campo
          rotulo="Endereço"
          valor={[empresa.endereco, empresa.bairro, [empresa.municipio, empresa.uf].filter(Boolean).join(" - "), empresa.cep]
            .filter(Boolean)
            .join(" · ") || "Não informado"}
        />
      </div>

      {empresa.socios.length > 0 && (
        <div className="mt-5 border-t border-ink-100 pt-5 dark:border-ink-800">
          <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-ink-500 dark:text-ink-400">
            <Users className="h-3.5 w-3.5" aria-hidden />
            Quadro de sócios
          </p>
          <ul className="mt-2 space-y-2">
            {empresa.socios.map((socio) => (
              <li key={`${socio.nome}-${socio.qualificacao}`} className="text-sm">
                <span className="font-medium text-ink-900 dark:text-ink-50">{socio.nome}</span>
                <span className="text-ink-500 dark:text-ink-400"> — {socio.qualificacao}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export function CnpjClient() {
  const [valor, setValor] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [empresa, setEmpresa] = useState<Empresa | null>(null);
  const [mensagemErro, setMensagemErro] = useState<string | undefined>();
  const abortRef = useRef<AbortController | null>(null);

  async function pesquisar(evento: FormEvent) {
    evento.preventDefault();
    if (!valor.trim()) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setStatus("carregando");
    setMensagemErro(undefined);

    const resultado = await buscarEmpresa(valor, { signal: controller.signal });

    if (resultado.status === "sucesso") {
      setEmpresa(resultado.empresa);
      setStatus("sucesso");
    } else if (resultado.status === "invalido") {
      setStatus("invalido");
      setMensagemErro(resultado.mensagem);
    } else if (resultado.status === "nao_encontrado") {
      setEmpresa(null);
      setStatus("nao_encontrado");
    } else if (resultado.status === "erro_servidor") {
      setStatus("erro");
      setMensagemErro(resultado.mensagem);
    }
  }

  return (
    <div className="flex flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <div className="border-b border-ink-200 pb-4 dark:border-ink-700">
        <h1 className="text-base font-semibold text-ink-900 dark:text-ink-50">Consultar CNPJ</h1>
        <p className="mt-1 text-xs text-ink-500 dark:text-ink-400">
          Consulte dados cadastrais de empresas diretamente na base da Receita Federal.
        </p>
      </div>

      <form
        onSubmit={pesquisar}
        className="rounded-2xl border border-ink-200 bg-white p-5 shadow-card dark:border-ink-700 dark:bg-ink-900 sm:p-6"
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

      {status === "nao_encontrado" && (
        <p className="text-sm text-ink-600 dark:text-ink-300">Nenhuma empresa encontrada com esse CNPJ.</p>
      )}

      {status === "erro" && (
        <p className="text-sm text-danger-600 dark:text-danger-400">
          {mensagemErro ?? "Não foi possível consultar o CNPJ neste momento."}
        </p>
      )}

      {status === "sucesso" && empresa && <EmpresaCard empresa={empresa} />}
    </div>
  );
}
