"use client";

import { Search, SlidersHorizontal } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Combobox } from "@/components/ui/Combobox";
import { Button } from "@/components/ui/Button";
import { ESTADOS, ESTADO_TODOS } from "@/lib/data/estados";
import { MUNICIPIOS_POR_UF } from "@/lib/data/municipios";
import type { FiltrosLicitacao } from "@/types/licitacao";

interface SearchPanelProps {
  filtros: FiltrosLicitacao;
  onChange: (patch: Partial<FiltrosLicitacao>) => void;
  avancadoAberto: boolean;
  onToggleAvancado: () => void;
  onPesquisar: () => void;
  carregando: boolean;
}

export function SearchPanel({
  filtros,
  onChange,
  avancadoAberto,
  onToggleAvancado,
  onPesquisar,
  carregando,
}: SearchPanelProps) {
  const uf = filtros.uf ?? ESTADO_TODOS;
  const municipiosDisponiveis = uf !== ESTADO_TODOS ? (MUNICIPIOS_POR_UF[uf] ?? []) : [];

  const opcoesMunicipio = [
    { value: ESTADO_TODOS, label: "Todos os municípios" },
    ...municipiosDisponiveis.map((m) => ({ value: m.codigoIbge, label: m.nome })),
  ];

  function aoSubmeter(evento: React.FormEvent) {
    evento.preventDefault();
    onPesquisar();
  }

  return (
    <form
      onSubmit={aoSubmeter}
      className="rounded-2xl border border-ink-200 bg-white p-5 shadow-card sm:p-6"
      aria-label="Pesquisa rápida de licitações"
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-primary-600">Pesquisa rápida</p>

      <div className="mt-3">
        <Input
          label="O que você está procurando?"
          hideLabel
          placeholder="Ex.: medicamentos, material hospitalar, odontológico"
          leftIcon={<Search className="h-4 w-4" aria-hidden />}
          className="h-12 text-base"
          value={filtros.q ?? ""}
          onChange={(e) => onChange({ q: e.target.value })}
        />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Select
          label="Estado"
          value={uf}
          onChange={(e) => onChange({ uf: e.target.value, municipio: ESTADO_TODOS })}
        >
          <option value={ESTADO_TODOS}>Todos os estados</option>
          {ESTADOS.map((estado) => (
            <option key={estado.sigla} value={estado.sigla}>
              {estado.nome}
            </option>
          ))}
        </Select>

        <Combobox
          label="Município"
          options={opcoesMunicipio}
          value={filtros.municipio ?? ESTADO_TODOS}
          onChange={(value) => onChange({ municipio: value })}
          disabled={uf === ESTADO_TODOS}
          placeholder={uf === ESTADO_TODOS ? "Selecione um estado primeiro" : "Todos os municípios"}
          hint={uf === ESTADO_TODOS ? "Disponível ao escolher um estado específico." : undefined}
        />
      </div>

      <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Button
          type="button"
          variant="ghost"
          size="md"
          leftIcon={<SlidersHorizontal className="h-4 w-4" aria-hidden />}
          onClick={onToggleAvancado}
          aria-expanded={avancadoAberto}
        >
          Pesquisa avançada
        </Button>

        <Button
          type="submit"
          size="lg"
          leftIcon={<Search className="h-4 w-4" aria-hidden />}
          loading={carregando}
          fullWidth
          className="sm:w-auto sm:min-w-56"
        >
          Pesquisar licitações
        </Button>
      </div>
    </form>
  );
}
