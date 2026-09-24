"use client";

import { useRef, useState } from "react";
import type { FormEvent } from "react";
import { HeartPulse, Loader2, Search } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { buscarProdutosSaude } from "@/lib/api-produtos-saude";
import { formatarCnpj, formatarData } from "@/lib/formatters";
import type { ProdutoSaude } from "@/types/produto-saude";

type Status = "idle" | "carregando" | "sucesso" | "invalido" | "nao_configurado" | "erro";

function ProdutoItem({ item }: { item: ProdutoSaude }) {
  const valido = item.situacao?.toLowerCase() === "válido" && !item.cancelado;

  return (
    <li className="rounded-lg border border-ink-200 bg-white p-3 dark:border-ink-700 dark:bg-ink-900">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="text-sm font-medium text-ink-900 dark:text-ink-50">{item.produto}</p>
        {item.situacao && <Badge tone={valido ? "success" : "danger"}>{item.situacao}</Badge>}
      </div>
      {item.razaoSocialEmpresa && (
        <p className="mt-1 text-xs text-ink-600 dark:text-ink-300">
          {item.razaoSocialEmpresa}
          {item.cnpjEmpresa && ` · ${formatarCnpj(item.cnpjEmpresa)}`}
        </p>
      )}
      <p className="mt-1.5 text-xs text-ink-500 dark:text-ink-400">
        Registro: {item.registro}
        {item.processo && ` · Processo: ${item.processo}`}
        {item.dataVencimento && ` · Vencimento: ${formatarData(item.dataVencimento)}`}
      </p>
    </li>
  );
}

export function ProdutosSaudeClient() {
  const [valor, setValor] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [itens, setItens] = useState<ProdutoSaude[]>([]);
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

    const resultado = await buscarProdutosSaude(valor, { signal: controller.signal });

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
        <h1 className="text-base font-semibold text-ink-900 dark:text-ink-50">Consultar produtos para saúde</h1>
        <p className="mt-1 text-xs text-ink-500 dark:text-ink-400">
          Verifique o registro de dispositivos médicos e materiais hospitalares na ANVISA.
        </p>
      </div>

      <form
        onSubmit={pesquisar}
        className="rounded-2xl border border-ink-200 bg-white p-5 shadow-card dark:border-ink-700 dark:bg-ink-900 sm:p-6"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Input
              label="Nome do produto"
              placeholder="Ex.: luva, seringa, cateter"
              leftIcon={<HeartPulse className="h-4 w-4" aria-hidden />}
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
          Consulta de produtos para saúde ainda não configurada nesta instância.
        </p>
      )}

      {status === "erro" && (
        <p className="text-sm text-danger-600 dark:text-danger-400">
          {mensagemErro ?? "Não foi possível consultar a ANVISA neste momento."}
        </p>
      )}

      {status === "sucesso" && itens.length === 0 && (
        <p className="text-sm text-ink-600 dark:text-ink-300">Nenhum produto encontrado para esse termo.</p>
      )}

      {status === "sucesso" && itens.length > 0 && (
        <div className="flex flex-col gap-3">
          <p className="text-xs text-ink-500 dark:text-ink-400">
            {total} {total === 1 ? "resultado encontrado" : "resultados encontrados"}
            {total > itens.length && ` — mostrando os primeiros ${itens.length}`}
          </p>
          <ul className="space-y-2">
            {itens.map((item) => (
              <ProdutoItem key={`${item.registro}-${item.processo}`} item={item} />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
