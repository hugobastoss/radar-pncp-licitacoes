"use client";

import { Select } from "@/components/ui/Select";
import { Combobox } from "@/components/ui/Combobox";
import { OPCOES_ORDENACAO } from "@/lib/data/dominio";
import type { FacetasDisponiveis, OrdenacaoOpcao } from "@/types/licitacao";

interface TableFiltersProps {
  facets: FacetasDisponiveis;
  modalidadeRapida: string;
  localRapido: string;
  portalRapido: string;
  ordenarPor: OrdenacaoOpcao;
  onChangeModalidade: (valor: string) => void;
  onChangeLocal: (valor: string) => void;
  onChangePortal: (valor: string) => void;
  onChangeOrdenacao: (valor: OrdenacaoOpcao) => void;
}

/**
 * Filtros rápidos da tabela (seção 11) + ordenação (seção 12).
 *
 * Refinam a pesquisa já aplicada — as opções vêm de `facets`, calculadas a
 * partir do resultado da pesquisa, então nunca mostram valores que não
 * apareceriam de qualquer forma nesta busca.
 */
export function TableFilters({
  facets,
  modalidadeRapida,
  localRapido,
  portalRapido,
  ordenarPor,
  onChangeModalidade,
  onChangeLocal,
  onChangePortal,
  onChangeOrdenacao,
}: TableFiltersProps) {
  const opcoesLocal = [
    { value: "", label: "Todos os locais" },
    ...facets.municipios.map((m) => ({ value: m.codigoIbge, label: m.nome })),
  ];

  return (
    <div className="flex flex-col gap-3 border-b border-ink-200 bg-ink-25 px-4 py-3 dark:border-ink-700 dark:bg-ink-800 sm:flex-row sm:flex-wrap sm:items-end sm:gap-4 sm:px-6">
      <div className="w-full sm:w-56">
        <Combobox
          label="Local"
          hideLabel
          options={opcoesLocal}
          value={localRapido}
          onChange={onChangeLocal}
          placeholder="Todos os locais"
        />
      </div>

      <div className="w-full sm:w-48">
        <Select label="Modalidade" hideLabel value={modalidadeRapida} onChange={(e) => onChangeModalidade(e.target.value)}>
          <option value="">Todas as modalidades</option>
          {facets.modalidades.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </Select>
      </div>

      <div className="w-full sm:w-52">
        <Select label="Portal" hideLabel value={portalRapido} onChange={(e) => onChangePortal(e.target.value)}>
          <option value="">Todos os portais</option>
          {facets.portais.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </Select>
      </div>

      <div className="w-full sm:ml-auto sm:w-64">
        <Select
          label="Ordenar por"
          value={ordenarPor}
          onChange={(e) => onChangeOrdenacao(e.target.value as OrdenacaoOpcao)}
        >
          {OPCOES_ORDENACAO.map((opcao) => (
            <option key={opcao.valor} value={opcao.valor}>
              {opcao.rotulo}
            </option>
          ))}
        </Select>
      </div>
    </div>
  );
}
