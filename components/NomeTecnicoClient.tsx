"use client";

import { useRef, useState } from "react";
import type { FormEvent } from "react";
import { Loader2, Search, Tag } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { buscarNomesTecnicos } from "@/lib/api-nome-tecnico";
import type { NomeTecnico } from "@/types/nome-tecnico";

type Status = "idle" | "carregando" | "sucesso" | "invalido" | "nao_configurado" | "erro";

function NomeTecnicoItem({ item }: { item: NomeTecnico }) {
  return (
    <li className="rounded-lg border border-ink-200 bg-white p-3 dark:border-ink-700 dark:bg-ink-900">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="primary">{item.codigo}</Badge>
        <span className="text-sm font-medium text-ink-900 dark:text-ink-50">{item.nomeTecnico}</span>
      </div>
      <p className="mt-1.5 text-xs text-ink-500 dark:text-ink-400">
        {item.descricaoTipoProduto && `Tipo: ${item.descricaoTipoProduto}`}
        {item.classeRisco && ` · Classe de risco: ${item.classeRisco}`}
      </p>
    </li>
  );
}

export function NomeTecnicoClient() {
  const [valor, setValor] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [itens, setItens] = useState<NomeTecnico[]>([]);
  const [total, setTotal] = useState(0);
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

    const resultado = await buscarNomesTecnicos(valor, { signal: controller.signal });

    if (resultado.status === "sucesso") {
      setItens(resultado.itens);
      setTotal(resultado.total);
      setStatus("sucesso");
    } else if (resultado.status === "invalido") {
      setStatus("invalido");
      setMensagemErro(resultado.mensagem);
    } else if (resultado.status === "nao_configurado") {
      setStatus("nao_configurado");
    } else if (resultado.status === "erro_servidor") {
      setStatus("erro");
      setMensagemErro(resultado.mensagem);
    }
  }

  return (
    <div className="flex flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <div className="border-b border-ink-200 pb-4 dark:border-ink-700">
        <h1 className="text-base font-semibold text-ink-900 dark:text-ink-50">Consultar nomenclatura técnica</h1>
        <p className="mt-1 text-xs text-ink-500 dark:text-ink-400">
          Consulte a nomenclatura técnica oficial de produtos para saúde na ANVISA (categoria, classe de
          risco).
        </p>
      </div>

      <form
        onSubmit={pesquisar}
        className="rounded-2xl border border-ink-200 bg-white p-5 shadow-card dark:border-ink-700 dark:bg-ink-900 sm:p-6"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Input
              label="Nome técnico"
              placeholder="Ex.: compressas, luvas cirúrgicas"
              leftIcon={<Tag className="h-4 w-4" aria-hidden />}
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
        <p className="text-sm text-danger-600 dark:text-danger-400">{mensagemErro ?? "Termo inválido."}</p>
      )}

      {status === "nao_configurado" && (
        <p className="text-sm text-ink-600 dark:text-ink-300">
          Consulta de nomenclatura técnica ainda não configurada nesta instância.
        </p>
      )}

      {status === "erro" && (
        <p className="text-sm text-danger-600 dark:text-danger-400">
          {mensagemErro ?? "Não foi possível consultar a ANVISA neste momento."}
        </p>
      )}

      {status === "sucesso" && itens.length === 0 && (
        <p className="text-sm text-ink-600 dark:text-ink-300">Nenhum nome técnico encontrado para esse termo.</p>
      )}

      {status === "sucesso" && itens.length > 0 && (
        <div className="flex flex-col gap-3">
          <p className="text-xs text-ink-500 dark:text-ink-400">
            {total} {total === 1 ? "resultado encontrado" : "resultados encontrados"}
            {total > itens.length && ` — mostrando os primeiros ${itens.length}`}
          </p>
          <ul className="space-y-2">
            {itens.map((item) => (
              <NomeTecnicoItem key={item.codigo} item={item} />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
