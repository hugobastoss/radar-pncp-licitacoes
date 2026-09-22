"use client";

import { Loader2 } from "lucide-react";
import { Select } from "@/components/ui/Select";
import { formatarDataHora } from "@/lib/formatters";
import type { CenarioDemo } from "@/types/licitacao";

interface ResultsHeaderProps {
  consultadoEm: string;
  cenario: CenarioDemo;
  onChangeCenario: (cenario: CenarioDemo) => void;
  atualizando?: boolean;
}

export function ResultsHeader({ consultadoEm, cenario, onChangeCenario, atualizando }: ResultsHeaderProps) {
  return (
    <div className="flex flex-col gap-3 border-b border-ink-200 px-4 py-4 dark:border-ink-700 sm:flex-row sm:items-start sm:justify-between sm:px-6">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-base font-semibold text-ink-900 dark:text-ink-50">Resultado da pesquisa</h2>
          <span className="rounded-full bg-ink-100 px-2 py-0.5 text-xs font-medium text-ink-500 dark:bg-ink-800 dark:text-ink-400">
            Dados de demonstração
          </span>
          {atualizando && (
            <span className="inline-flex items-center gap-1 text-xs text-primary-600 dark:text-primary-400">
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              Atualizando…
            </span>
          )}
        </div>
        <p className="mt-1 text-xs text-ink-500 dark:text-ink-400">
          Consulta realizada diretamente no PNCP em {formatarDataHora(consultadoEm)}.
        </p>
      </div>

      {/*
        Seletor de cenário: existe apenas para permitir a você visualizar
        todos os estados da tela (vazio, erro, timeout) sem depender do
        backend real. Pode ser removido quando a integração com o PNCP
        estiver pronta.
      */}
      <div className="w-full sm:w-56">
        <Select
          label="Cenário (demonstração)"
          value={cenario}
          onChange={(e) => onChangeCenario(e.target.value as CenarioDemo)}
        >
          <option value="auto">Automático (padrão)</option>
          <option value="sucesso">Forçar sucesso</option>
          <option value="vazio">Forçar vazio</option>
          <option value="erro_servidor">Forçar erro temporário</option>
          <option value="erro_conexao">Forçar erro de conexão</option>
          <option value="timeout">Forçar timeout</option>
          <option value="lento">Forçar carregamento lento</option>
        </Select>
      </div>
    </div>
  );
}
