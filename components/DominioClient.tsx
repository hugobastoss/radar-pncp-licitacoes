"use client";

import { useRef, useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { Calendar, Globe, Loader2, Search } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Campo } from "@/components/LicitacaoDetails";
import { buscarRegistroDominio } from "@/lib/api-fontes-publicas";
import { ehDominioBr } from "@/lib/dominio-email";
import { formatarCnpj, formatarData } from "@/lib/formatters";
import type { RegistroDominio } from "@/types/fontes-publicas";

type Status = "idle" | "carregando" | "sucesso" | "invalido" | "nao_encontrado" | "erro";

function RegistroCard({ registro }: { registro: RegistroDominio }) {
  const titular = registro.titular;

  return (
    <div className="rounded-[10px] border border-ink-200 bg-white p-5 shadow-card dark:border-ink-700 dark:bg-ink-900 sm:p-6">
      <div className="flex items-start gap-2">
        <Globe className="mt-0.5 h-5 w-5 shrink-0 text-primary-600 dark:text-primary-400" aria-hidden />
        <p className="text-lg font-semibold text-ink-900 dark:text-ink-50">{registro.dominio}</p>
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Campo
          rotulo="Titular"
          valor={
            titular?.cnpj ? (
              <Link
                href={`/cnpj?cnpj=${titular.cnpj}`}
                className="font-medium tabular-nums text-primary-600 hover:underline dark:text-primary-400"
              >
                {titular.nome ?? formatarCnpj(titular.cnpj)}
              </Link>
            ) : (
              (titular?.nome ?? (titular?.tipo === "cpf" ? "Pessoa física" : "Não informado"))
            )
          }
        />
        {titular?.cnpj && <Campo rotulo="CNPJ" valor={formatarCnpj(titular.cnpj)} />}
        <Campo rotulo="Criado em" valor={formatarData(registro.criadoEm)} />
        <Campo rotulo="Última alteração" valor={formatarData(registro.alteradoEm)} />
        <Campo rotulo="Expira em" valor={formatarData(registro.expiraEm)} />
      </dl>

      <p className="mt-5 flex items-center gap-1.5 text-xs text-ink-400 dark:text-ink-500">
        <Calendar className="h-3.5 w-3.5" aria-hidden />
        Fonte: registro.br (RDAP).
      </p>
    </div>
  );
}

export function DominioClient() {
  const [valor, setValor] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [registro, setRegistro] = useState<RegistroDominio | null>(null);
  const [mensagemErro, setMensagemErro] = useState<string | undefined>();
  const abortRef = useRef<AbortController | null>(null);

  async function pesquisar(evento: FormEvent) {
    evento.preventDefault();
    const dominio = valor.trim().toLowerCase();
    if (!dominio) return;

    if (!ehDominioBr(dominio)) {
      setStatus("invalido");
      setMensagemErro("Informe um domínio terminado em .br (ex.: empresa.com.br). Outros domínios não são aceitos.");
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setStatus("carregando");
    setMensagemErro(undefined);

    const resultado = await buscarRegistroDominio(dominio, { signal: controller.signal });

    if (resultado.status === "sucesso") {
      if (resultado.registro) {
        setRegistro(resultado.registro);
        setStatus("sucesso");
      } else {
        setRegistro(null);
        setStatus("nao_encontrado");
      }
    } else if (resultado.status === "limite" || resultado.status === "erro_servidor") {
      setStatus("erro");
      setMensagemErro(resultado.mensagem);
    }
    // "cancelado" não chega aqui: outra busca já substituiu esta antes de terminar.
  }

  return (
    <div className="flex flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <form
        onSubmit={pesquisar}
        className="rounded-[10px] border border-ink-200 bg-white p-5 shadow-card dark:border-ink-700 dark:bg-ink-900 sm:p-6"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Input
              label="Domínio"
              placeholder="empresa.com.br"
              hint="Só domínios terminados em .br (com.br, org.br, adv.br…)."
              leftIcon={<Globe className="h-4 w-4" aria-hidden />}
              value={valor}
              onChange={(e) => setValor(e.target.value)}
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
        <p className="text-sm text-danger-600 dark:text-danger-400">{mensagemErro ?? "Domínio inválido."}</p>
      )}

      {status === "nao_encontrado" && (
        <p className="text-sm text-ink-600 dark:text-ink-300">Esse domínio não está registrado.</p>
      )}

      {status === "erro" && (
        <p className="text-sm text-danger-600 dark:text-danger-400">
          {mensagemErro ?? "Não foi possível consultar o domínio neste momento."}
        </p>
      )}

      {status === "sucesso" && registro && <RegistroCard registro={registro} />}
    </div>
  );
}
