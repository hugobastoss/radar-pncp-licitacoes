"use client";

import { Building2, CalendarRange, RotateCcw, Wallet } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { ChipsSelecaoMultipla, ChipsSelecaoUnica } from "@/components/ui/Chip";
import { Button } from "@/components/ui/Button";
import { MODALIDADES, PERIODOS, PORTAIS_CONHECIDOS, SITUACOES } from "@/lib/data/dominio";
import type { FiltrosLicitacao } from "@/types/licitacao";

interface AdvancedFiltersProps {
  filtros: FiltrosLicitacao;
  onChange: (patch: Partial<FiltrosLicitacao>) => void;
}

const OPCOES_PERIODO_CHIP = PERIODOS.map((p) => ({
  value: p.valor,
  label: p.valor === "personalizado" ? "Personalizado" : p.rotulo.replace("Próximos ", ""),
}));

const OPCOES_SITUACAO_CHIP = SITUACOES.map((s) => ({ value: s, label: s }));

function contarFiltrosAtivos(filtros: FiltrosLicitacao): number {
  let total = 0;
  // "15" é o padrão pré-selecionado — só conta como filtro ativo quando o
  // usuário escolhe outra coisa.
  if (filtros.periodo && filtros.periodo !== "15") total += 1;
  if (filtros.modalidades && filtros.modalidades.length > 0) total += 1;
  if (filtros.portais && filtros.portais.length > 0) total += 1;
  if (filtros.valorMinimo !== undefined) total += 1;
  if (filtros.valorMaximo !== undefined) total += 1;
  if (filtros.orgao?.trim()) total += 1;
  if (filtros.situacao?.trim()) total += 1;
  return total;
}

export function AdvancedFilters({ filtros, onChange }: AdvancedFiltersProps) {
  const filtrosAtivos = contarFiltrosAtivos(filtros);

  function limpar() {
    onChange({
      periodo: "15",
      dataInicial: undefined,
      dataFinal: undefined,
      modalidades: [],
      portais: [],
      valorMinimo: undefined,
      valorMaximo: undefined,
      orgao: "",
      situacao: undefined,
    });
  }

  return (
    <div className="mt-4">
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-ink-200 dark:bg-ink-700" />
        <span className="text-xs font-semibold uppercase tracking-wide text-ink-400 dark:text-ink-500">
          Filtros avançados
        </span>
        <div className="h-px flex-1 bg-ink-200 dark:bg-ink-700" />
      </div>

      {filtrosAtivos > 0 && (
        <div className="mt-4 flex items-center justify-between gap-3">
          <span className="rounded-full bg-primary-50 px-2 py-0.5 text-xs font-medium text-primary-700 dark:bg-primary-900 dark:text-primary-300">
            {filtrosAtivos} {filtrosAtivos === 1 ? "filtro aplicado" : "filtros aplicados"}
          </span>
          <Button variant="ghost" size="sm" leftIcon={<RotateCcw className="h-3.5 w-3.5" aria-hidden />} onClick={limpar}>
            Limpar
          </Button>
        </div>
      )}

      <div className="mt-4 flex flex-col gap-5">
        <div>
          <ChipsSelecaoUnica
            label="Período"
            options={OPCOES_PERIODO_CHIP}
            value={filtros.periodo}
            onChange={(valor) => onChange({ periodo: valor as FiltrosLicitacao["periodo"] })}
            permitirLimpar={false}
          />

          {filtros.periodo === "personalizado" && (
            <div className="mt-3 grid grid-cols-2 gap-3 sm:max-w-sm">
              <Input
                type="date"
                label="Data inicial"
                value={filtros.dataInicial ?? ""}
                onChange={(e) => onChange({ dataInicial: e.target.value || undefined })}
              />
              <Input
                type="date"
                label="Data final"
                value={filtros.dataFinal ?? ""}
                onChange={(e) => onChange({ dataFinal: e.target.value || undefined })}
              />
            </div>
          )}
        </div>

        <ChipsSelecaoMultipla
          label="Modalidade"
          options={MODALIDADES.map((m) => ({ value: m.nome, label: m.nome }))}
          selected={filtros.modalidades ?? []}
          onChange={(next) => onChange({ modalidades: next })}
          allLabel="Todas"
        />

        <ChipsSelecaoMultipla
          label="Portal"
          options={PORTAIS_CONHECIDOS.map((p) => ({ value: p, label: p }))}
          selected={filtros.portais ?? []}
          onChange={(next) => onChange({ portais: next })}
          allLabel="Todos"
        />

        <ChipsSelecaoUnica
          label="Situação"
          hint="Filtra pela situação informada pelo órgão no PNCP."
          options={OPCOES_SITUACAO_CHIP}
          value={filtros.situacao}
          onChange={(valor) => onChange({ situacao: valor })}
          semFiltroLabel="Todas"
        />

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="grid grid-cols-2 gap-3">
            <Input
              type="number"
              inputMode="decimal"
              label="Valor mínimo"
              placeholder="0,00"
              leftIcon={<Wallet className="h-4 w-4" aria-hidden />}
              value={filtros.valorMinimo ?? ""}
              onChange={(e) => onChange({ valorMinimo: e.target.value ? Number(e.target.value) : undefined })}
            />
            <Input
              type="number"
              inputMode="decimal"
              label="Valor máximo"
              placeholder="0,00"
              leftIcon={<Wallet className="h-4 w-4" aria-hidden />}
              value={filtros.valorMaximo ?? ""}
              onChange={(e) => onChange({ valorMaximo: e.target.value ? Number(e.target.value) : undefined })}
            />
          </div>

          <Input
            label="Órgão"
            placeholder="Digite o nome do órgão"
            leftIcon={<Building2 className="h-4 w-4" aria-hidden />}
            value={filtros.orgao ?? ""}
            onChange={(e) => onChange({ orgao: e.target.value })}
            onClear={() => onChange({ orgao: "" })}
          />
        </div>
      </div>

      <p className="mt-4 flex items-center gap-1.5 text-xs text-ink-500 dark:text-ink-400">
        <CalendarRange className="h-3.5 w-3.5" aria-hidden />
        Todos os prazos são calculados no horário de Brasília, usado pelo PNCP.
      </p>
    </div>
  );
}
