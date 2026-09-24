"use client";

import { useRef, useState } from "react";
import type { FormEvent } from "react";
import { Loader2, Search, Tag } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { buscarNcm } from "@/lib/api-ncm";
import { formatarDataSimples } from "@/lib/formatters";
import type { ItemNcm } from "@/types/ncm";

type Status = "idle" | "carregando" | "sucesso" | "invalido" | "erro";

/** "9999-12-31" é o valor-sentinela da API pra "ainda vigente, sem data de fim". */
function vigencia(item: ItemNcm): string {
  if (!item.dataFim || item.dataFim.startsWith("9999")) {
    return item.dataInicio ? `Vigente desde ${formatarDataSimples(item.dataInicio)}` : "Vigente";
  }
  return `Vigente até ${formatarDataSimples(item.dataFim)}`;
}

function ItemNcmCard({ item }: { item: ItemNcm }) {
  return (
    <li className="rounded-lg border border-ink-200 bg-white p-3 dark:border-ink-700 dark:bg-ink-900">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="primary">{item.codigo}</Badge>
        <span className="text-xs text-ink-500 dark:text-ink-400">{vigencia(item)}</span>
      </div>
      <p className="mt-1.5 text-sm text-ink-700 dark:text-ink-200">{item.descricao}</p>
    </li>
  );
}

export function NcmClient() {
  const [valor, setValor] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [itens, setItens] = useState<ItemNcm[]>([]);
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

    const resultado = await buscarNcm(valor, { signal: controller.signal });

    if (resultado.status === "sucesso") {
      setItens(resultado.itens);
      setStatus("sucesso");
    } else if (resultado.status === "invalido") {
      setStatus("invalido");
      setMensagemErro(resultado.mensagem);
    } else if (resultado.status === "erro_servidor") {
      setStatus("erro");
      setMensagemErro(resultado.mensagem);
    }
  }

  return (
    <div className="flex flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <div className="border-b border-ink-200 pb-4 dark:border-ink-700">
        <h1 className="text-base font-semibold text-ink-900 dark:text-ink-50">Consultar NCM</h1>
        <p className="mt-1 text-xs text-ink-500 dark:text-ink-400">
          Consulte a classificação de mercadorias (Nomenclatura Comum do Mercosul) por código ou palavra-chave.
        </p>
      </div>

      <form
        onSubmit={pesquisar}
        className="rounded-2xl border border-ink-200 bg-white p-5 shadow-card dark:border-ink-700 dark:bg-ink-900 sm:p-6"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Input
              label="Código ou palavra-chave"
              placeholder="Ex.: 3004.90.99 ou medicamento"
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

      {status === "erro" && (
        <p className="text-sm text-danger-600 dark:text-danger-400">
          {mensagemErro ?? "Não foi possível consultar o NCM neste momento."}
        </p>
      )}

      {status === "sucesso" && itens.length === 0 && (
        <p className="text-sm text-ink-600 dark:text-ink-300">Nenhum código NCM encontrado para esse termo.</p>
      )}

      {status === "sucesso" && itens.length > 0 && (
        <ul className="space-y-2">
          {itens.map((item) => (
            <ItemNcmCard key={item.codigo} item={item} />
          ))}
        </ul>
      )}
    </div>
  );
}
