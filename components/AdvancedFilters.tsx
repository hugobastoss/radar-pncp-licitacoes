"use client";

import { Building2, CalendarRange, Hash, RotateCcw, Wallet } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { MultiSelect } from "@/components/ui/MultiSelect";
import { Button } from "@/components/ui/Button";
import { MODALIDADES, PERIODOS, PORTAIS_CONHECIDOS, SITUACOES } from "@/lib/data/dominio";
import type { FiltrosLicitacao } from "@/types/licitacao";

interface AdvancedFiltersProps {
  aberto: boolean;
  filtros: FiltrosLicitacao;
  onChange: (patch: Partial<FiltrosLicitacao>) => void;
}

function contarFiltrosAtivos(filtros: FiltrosLicitacao): number {
  let total = 0;
  if (filtros.periodo) total += 1;
  if (filtros.modalidades && filtros.modalidades.length > 0) total += 1;
  if (filtros.portais && filtros.portais.length > 0) total += 1;
  if (filtros.valorMinimo !== undefined) total += 1;
  if (filtros.valorMaximo !== undefined) total += 1;
  if (filtros.orgao?.trim()) total += 1;
  if (filtros.numeroLicitacao?.trim()) total += 1;
  if (filtros.situacao?.trim()) total += 1;
  return total;
}

export function AdvancedFilters({ aberto, filtros, onChange }: AdvancedFiltersProps) {
  if (!aberto) return null;

  const filtrosAtivos = contarFiltrosAtivos(filtros);

  function limpar() {
    onChange({
      periodo: undefined,
      dataInicial: undefined,
      dataFinal: undefined,
      modalidades: [],
      portais: [],
      valorMinimo: undefined,
      valorMaximo: undefined,
      orgao: "",
      numeroLicitacao: "",
      situacao: "",
    });
  }

  return (
    <section
      aria-label="Pesquisa avançada"
      className="mt-4 rounded-2xl border border-ink-200 bg-white p-5 shadow-card sm:p-6"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-ink-900">Pesquisa avançada</h2>
          {filtrosAtivos > 0 && (
            <span className="rounded-full bg-primary-50 px-2 py-0.5 text-xs font-medium text-primary-700">
              {filtrosAtivos} {filtrosAtivos === 1 ? "filtro aplicado" : "filtros aplicados"}
            </span>
          )}
        </div>
        {filtrosAtivos > 0 && (
          <Button variant="ghost" size="sm" leftIcon={<RotateCcw className="h-3.5 w-3.5" aria-hidden />} onClick={limpar}>
            Limpar
          </Button>
        )}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Select
            label="Período"
            value={filtros.periodo ?? ""}
            onChange={(e) =>
              onChange({ periodo: (e.target.value || undefined) as FiltrosLicitacao["periodo"] })
            }
          >
            <option value="">Sem filtro de período</option>
            {PERIODOS.map((p) => (
              <option key={p.valor} value={p.valor}>
                {p.rotulo}
              </option>
            ))}
          </Select>

          {filtros.periodo === "personalizado" && (
            <div className="mt-1 grid grid-cols-2 gap-3">
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

        <MultiSelect
          label="Modalidade"
          options={MODALIDADES.map((m) => ({ value: m.nome, label: m.nome }))}
          selected={filtros.modalidades ?? []}
          onChange={(next) => onChange({ modalidades: next })}
          allLabel="Todas as modalidades"
        />

        <MultiSelect
          label="Portal"
          options={PORTAIS_CONHECIDOS.map((p) => ({ value: p, label: p }))}
          selected={filtros.portais ?? []}
          onChange={(next) => onChange({ portais: next })}
          allLabel="Todos os portais"
        />

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
        />

        <Input
          label="Número da licitação"
          placeholder="Ex.: 90015/2026"
          leftIcon={<Hash className="h-4 w-4" aria-hidden />}
          value={filtros.numeroLicitacao ?? ""}
          onChange={(e) => onChange({ numeroLicitacao: e.target.value })}
        />

        <Select
          label="Situação"
          hint="Filtra pela situação informada pelo órgão no PNCP."
          value={filtros.situacao ?? ""}
          onChange={(e) => onChange({ situacao: e.target.value })}
        >
          <option value="">Todas as situações</option>
          {SITUACOES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Select>
      </div>

      <p className="mt-4 flex items-center gap-1.5 text-xs text-ink-500">
        <CalendarRange className="h-3.5 w-3.5" aria-hidden />
        Todos os prazos são calculados no horário de Brasília, usado pelo PNCP.
      </p>
    </section>
  );
}
