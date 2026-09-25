"use client";

import { Building2, Wallet } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { ChipsSelecaoMultipla, ChipsSelecaoUnica } from "@/components/ui/Chip";
import { MODALIDADES, rotuloFiltroSituacao, SITUACOES } from "@/lib/data/dominio";
import { formatarValorMascara, valorDigitadoParaNumero } from "@/lib/formatters";
import type { FiltrosLicitacao } from "@/types/licitacao";

interface AdvancedFiltersProps {
  filtros: FiltrosLicitacao;
  onChange: (patch: Partial<FiltrosLicitacao>) => void;
}

const OPCOES_SITUACAO_CHIP = SITUACOES.map((s) => ({ value: s, label: rotuloFiltroSituacao(s) }));

export function AdvancedFilters({ filtros, onChange }: AdvancedFiltersProps) {
  return (
    <div className="mt-4">
      <div className="flex flex-col gap-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-500 dark:text-ink-400">
              Período
            </p>
            <div className="grid grid-cols-2 gap-3">
              <Input
                type="date"
                label="Data inicial"
                hint="Em branco, busca a partir de agora"
                value={filtros.dataInicial ?? ""}
                onChange={(e) => onChange({ dataInicial: e.target.value || undefined })}
              />
              <Input
                type="date"
                label="Data final"
                hint="Em branco, sem limite"
                value={filtros.dataFinal ?? ""}
                onChange={(e) => onChange({ dataFinal: e.target.value || undefined })}
              />
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-500 dark:text-ink-400">Valor</p>
            <div className="grid grid-cols-2 gap-3">
              <Input
                type="text"
                inputMode="decimal"
                label="Valor mínimo"
                placeholder="0,00"
                leftIcon={<Wallet className="h-4 w-4" aria-hidden />}
                value={formatarValorMascara(filtros.valorMinimo)}
                onChange={(e) => onChange({ valorMinimo: valorDigitadoParaNumero(e.target.value) })}
              />
              <Input
                type="text"
                inputMode="decimal"
                label="Valor máximo"
                placeholder="0,00"
                leftIcon={<Wallet className="h-4 w-4" aria-hidden />}
                value={formatarValorMascara(filtros.valorMaximo)}
                onChange={(e) => onChange({ valorMaximo: valorDigitadoParaNumero(e.target.value) })}
              />
            </div>
          </div>
        </div>

        <ChipsSelecaoUnica
          label="Situação"
          hint="Filtra pela situação informada pelo órgão no PNCP."
          options={OPCOES_SITUACAO_CHIP}
          value={filtros.situacao}
          onChange={(valor) => onChange({ situacao: valor })}
          semFiltroLabel="Todas"
        />

        <ChipsSelecaoMultipla
          label="Modalidade"
          options={MODALIDADES.map((m) => ({ value: m.nome, label: m.nome }))}
          selected={filtros.modalidades ?? []}
          onChange={(next) => onChange({ modalidades: next })}
          allLabel="Todas"
        />

        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-500 dark:text-ink-400">Órgão</p>
          <Input
            label="Órgão"
            hideLabel
            placeholder="Digite o nome do órgão"
            leftIcon={<Building2 className="h-4 w-4" aria-hidden />}
            value={filtros.orgao ?? ""}
            onChange={(e) => onChange({ orgao: e.target.value })}
            onClear={() => onChange({ orgao: "" })}
          />
        </div>
      </div>
    </div>
  );
}
