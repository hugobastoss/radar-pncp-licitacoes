"use client";

import { useRef, useState } from "react";
import type { FormEvent } from "react";
import { Loader2, MapPin, Search } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Campo } from "@/components/LicitacaoDetails";
import { buscarEndereco } from "@/lib/api-cep";
import { mascararCep } from "@/lib/formatters";
import type { Endereco } from "@/types/cep";

type Status = "idle" | "carregando" | "sucesso" | "invalido" | "nao_encontrado" | "erro";

function EnderecoCard({ endereco }: { endereco: Endereco }) {
  return (
    <div className="rounded-2xl border border-ink-200 bg-white p-5 shadow-card dark:border-ink-700 dark:bg-ink-900 sm:p-6">
      <div className="flex items-start gap-2">
        <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-primary-600 dark:text-primary-400" aria-hidden />
        <div>
          <p className="text-lg font-semibold text-ink-900 dark:text-ink-50">
            {endereco.logradouro || "Logradouro não informado"}
          </p>
          <p className="mt-0.5 text-sm text-ink-600 dark:text-ink-300">
            {[endereco.bairro, `${endereco.cidade} - ${endereco.uf}`].filter(Boolean).join(" · ")}
          </p>
          <p className="mt-1 text-xs text-ink-500 dark:text-ink-400">{mascararCep(endereco.cep)}</p>
        </div>
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Campo rotulo="Bairro" valor={endereco.bairro ?? "Não informado"} />
        <Campo rotulo="Cidade" valor={endereco.cidade || "Não informada"} />
        <Campo rotulo="UF" valor={endereco.uf || "Não informada"} />
        <Campo rotulo="Código IBGE" valor={endereco.codigoIbge ?? "Não informado"} />
        {endereco.latitude && endereco.longitude && (
          <Campo rotulo="Coordenadas" valor={`${endereco.latitude}, ${endereco.longitude}`} />
        )}
      </dl>
    </div>
  );
}

export function CepClient() {
  const [valor, setValor] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [endereco, setEndereco] = useState<Endereco | null>(null);
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

    const resultado = await buscarEndereco(valor, { signal: controller.signal });

    if (resultado.status === "sucesso") {
      setEndereco(resultado.endereco);
      setStatus("sucesso");
    } else if (resultado.status === "invalido") {
      setStatus("invalido");
      setMensagemErro(resultado.mensagem);
    } else if (resultado.status === "nao_encontrado") {
      setEndereco(null);
      setStatus("nao_encontrado");
    } else if (resultado.status === "erro_servidor") {
      setStatus("erro");
      setMensagemErro(resultado.mensagem);
    }
  }

  return (
    <div className="flex flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <div className="border-b border-ink-200 pb-4 dark:border-ink-700">
        <h1 className="text-base font-semibold text-ink-900 dark:text-ink-50">Consultar CEP</h1>
        <p className="mt-1 text-xs text-ink-500 dark:text-ink-400">
          Consulte o endereço correspondente a um CEP.
        </p>
      </div>

      <form
        onSubmit={pesquisar}
        className="rounded-2xl border border-ink-200 bg-white p-5 shadow-card dark:border-ink-700 dark:bg-ink-900 sm:p-6"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Input
              label="CEP"
              placeholder="00000-000"
              leftIcon={<MapPin className="h-4 w-4" aria-hidden />}
              value={valor}
              maxLength={9}
              onChange={(e) => setValor(mascararCep(e.target.value))}
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
        <p className="text-sm text-danger-600 dark:text-danger-400">{mensagemErro ?? "CEP inválido."}</p>
      )}

      {status === "nao_encontrado" && (
        <p className="text-sm text-ink-600 dark:text-ink-300">Nenhum endereço encontrado para esse CEP.</p>
      )}

      {status === "erro" && (
        <p className="text-sm text-danger-600 dark:text-danger-400">
          {mensagemErro ?? "Não foi possível consultar o CEP neste momento."}
        </p>
      )}

      {status === "sucesso" && endereco && <EnderecoCard endereco={endereco} />}
    </div>
  );
}
