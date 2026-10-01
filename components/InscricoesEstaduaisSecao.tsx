"use client";

import { useState } from "react";
import { FileBadge } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { buscarInscricoesEstaduais } from "@/lib/api-fontes-publicas";
import type { ResultadoInscricoesEstaduais } from "@/lib/api-fontes-publicas";

type Estado = { status: "nao_consultado" } | { status: "carregando" } | ResultadoInscricoesEstaduais;

/**
 * Inscrições estaduais da empresa (o que o Sintegra de cada estado informa),
 * pela CNPJ.ws. Só consulta quando a pessoa pede: a fonte aceita 3
 * consultas por minuto por IP, e consultar em toda ficha gastaria a cota à toa.
 *
 * Use com `key={cnpj}` pra voltar ao botão quando a empresa muda.
 */
export function InscricoesEstaduaisSecao({ cnpj, className }: { cnpj: string; className?: string }) {
  const [estado, setEstado] = useState<Estado>({ status: "nao_consultado" });

  async function consultar() {
    setEstado({ status: "carregando" });
    setEstado(await buscarInscricoesEstaduais(cnpj));
  }

  const podeConsultar = estado.status !== "sucesso" && estado.status !== "carregando";

  return (
    <div className={className}>
      <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-ink-500 dark:text-ink-400">
        <FileBadge className="h-3.5 w-3.5" aria-hidden />
        Inscrições estaduais
      </p>

      {(estado.status === "limite" || estado.status === "erro_servidor") && (
        <p className="mt-2 text-sm text-ink-600 dark:text-ink-300">
          {estado.mensagem ??
            (estado.status === "limite"
              ? "Limite de consultas da fonte atingido — tente de novo em um minuto."
              : "Não foi possível consultar as inscrições estaduais neste momento.")}
        </p>
      )}

      {(podeConsultar || estado.status === "carregando") && (
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="mt-2"
          loading={estado.status === "carregando"}
          onClick={consultar}
        >
          {estado.status === "nao_consultado" || estado.status === "carregando"
            ? "Consultar inscrições estaduais"
            : "Tentar de novo"}
        </Button>
      )}

      {estado.status === "sucesso" &&
        (estado.inscricoes.length === 0 ? (
          <p className="mt-2 text-sm text-ink-600 dark:text-ink-300">Nenhuma inscrição estadual encontrada.</p>
        ) : (
          <ul className="mt-2 grid grid-cols-1 gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
            {estado.inscricoes.map((i) => (
              <li key={`${i.uf}-${i.numero}`} className="flex items-center gap-2">
                <span className="w-7 shrink-0 font-medium text-ink-900 dark:text-ink-50">{i.uf}</span>
                <span className="tabular-nums text-ink-700 dark:text-ink-200">{i.numero}</span>
                <Badge tone={i.ativa ? "success" : "neutral"}>{i.ativa ? "Ativa" : "Inativa"}</Badge>
              </li>
            ))}
          </ul>
        ))}

      {estado.status === "sucesso" && (
        <p className="mt-2 text-xs text-ink-400 dark:text-ink-500">Fonte: CNPJ.ws.</p>
      )}
    </div>
  );
}
