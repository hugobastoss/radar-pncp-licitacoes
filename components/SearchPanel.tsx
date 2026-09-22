"use client";

import * as Collapsible from "@radix-ui/react-collapsible";
import { ChevronDown, ChevronUp, Hash, Search, SlidersHorizontal } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Combobox } from "@/components/ui/Combobox";
import { Button } from "@/components/ui/Button";
import { QuickSearches } from "@/components/QuickSearches";
import { AdvancedFilters } from "@/components/AdvancedFilters";
import { ESTADOS, ESTADO_TODOS } from "@/lib/data/estados";
import { MUNICIPIOS_POR_UF } from "@/lib/data/municipios";
import type { PesquisaRapida } from "@/lib/data/dominio";
import type { FiltrosLicitacao } from "@/types/licitacao";

interface SearchPanelProps {
  filtros: FiltrosLicitacao;
  onChange: (patch: Partial<FiltrosLicitacao>) => void;
  avancadoAberto: boolean;
  onToggleAvancado: () => void;
  onPesquisar: () => void;
  carregando: boolean;
  onSelecionarPesquisaRapida: (pesquisa: PesquisaRapida) => void;
  pesquisaRapidaAtiva?: string;
}

export function SearchPanel({
  filtros,
  onChange,
  avancadoAberto,
  onToggleAvancado,
  onPesquisar,
  carregando,
  onSelecionarPesquisaRapida,
  pesquisaRapidaAtiva,
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
      className="rounded-2xl border border-ink-200 bg-white p-5 shadow-card dark:border-ink-700 dark:bg-ink-900 sm:p-6"
      aria-label="Pesquisa rápida de licitações"
    >
      <div className="border-b border-ink-200 pb-4 dark:border-ink-700">
        <h1 className="text-base font-semibold text-ink-900 dark:text-ink-50">Pesquisar licitações</h1>
        <p className="mt-1 text-xs text-ink-500 dark:text-ink-400">
          Consulte oportunidades diretamente no PNCP utilizando filtros personalizados.
        </p>
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

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input
          label="Número da licitação"
          placeholder="Ex.: 90015/2026"
          leftIcon={<Hash className="h-4 w-4" aria-hidden />}
          value={filtros.numeroLicitacao ?? ""}
          onChange={(e) => onChange({ numeroLicitacao: e.target.value })}
          onClear={() => onChange({ numeroLicitacao: "" })}
        />

        <Input
          label="O que você está procurando?"
          placeholder="Busca no objeto da licitação e no nome do órgão."
          leftIcon={<Search className="h-4 w-4" aria-hidden />}
          value={filtros.q ?? ""}
          onChange={(e) => onChange({ q: e.target.value })}
          onClear={() => onChange({ q: "" })}
        />
      </div>

      <Collapsible.Root open={avancadoAberto} onOpenChange={onToggleAvancado}>
        <div className="mt-3">
          <Collapsible.Trigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="md"
              leftIcon={<SlidersHorizontal className="h-4 w-4" aria-hidden />}
              rightIcon={
                avancadoAberto ? (
                  <ChevronUp className="h-4 w-4" aria-hidden />
                ) : (
                  <ChevronDown className="h-4 w-4" aria-hidden />
                )
              }
            >
              Pesquisa avançada
            </Button>
          </Collapsible.Trigger>
        </div>

        <Collapsible.Content className="overflow-hidden data-[state=open]:animate-[collapsible-down_200ms_ease-out] data-[state=closed]:animate-[collapsible-up_200ms_ease-out]">
          <AdvancedFilters filtros={filtros} onChange={onChange} />
        </Collapsible.Content>
      </Collapsible.Root>

      <div className="mt-5">
        <QuickSearches onSelecionar={onSelecionarPesquisaRapida} idAtivo={pesquisaRapidaAtiva} />
      </div>

      <div className="mt-5">
        <Button
          type="submit"
          size="lg"
          leftIcon={<Search className="h-4 w-4" aria-hidden />}
          loading={carregando}
          fullWidth
        >
          Pesquisar licitações
        </Button>
      </div>
    </form>
  );
}
