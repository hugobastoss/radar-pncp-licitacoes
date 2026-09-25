"use client";

import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ESTADOS, ESTADO_TODOS } from "@/lib/data/estados";
import { MUNICIPIOS_POR_UF } from "@/lib/data/municipios";
import { rotuloFiltroSituacao } from "@/lib/data/dominio";
import { formatarDataSimples, formatarMoeda } from "@/lib/formatters";
import type { FiltrosLicitacao } from "@/types/licitacao";

/**
 * Filtros ativos, por nome — inclui a barra principal (estado, município,
 * número, busca no objeto) e a pesquisa avançada, não só esta última.
 */
export function listarFiltrosAtivos(filtros: FiltrosLicitacao): string[] {
  const ativos: string[] = [];

  if (filtros.q?.trim()) ativos.push(`Busca: "${filtros.q.trim()}"`);

  if (filtros.uf && filtros.uf !== ESTADO_TODOS) {
    const estado = ESTADOS.find((e) => e.sigla === filtros.uf);
    ativos.push(`Estado: ${estado?.nome ?? filtros.uf}`);
  }

  if (filtros.municipio && filtros.municipio !== ESTADO_TODOS) {
    const municipiosDoEstado = filtros.uf ? MUNICIPIOS_POR_UF[filtros.uf] : undefined;
    const municipio = municipiosDoEstado?.find((m) => m.codigoIbge === filtros.municipio);
    ativos.push(`Município: ${municipio?.nome ?? filtros.municipio}`);
  }

  if (filtros.numeroLicitacao?.trim()) ativos.push(`Número: ${filtros.numeroLicitacao.trim()}`);

  if (filtros.dataInicial || filtros.dataFinal) {
    ativos.push(
      `Período: ${formatarDataSimples(filtros.dataInicial) ?? "agora"} até ${
        formatarDataSimples(filtros.dataFinal) ?? "sem limite"
      }`,
    );
  }

  if (filtros.valorMinimo !== undefined || filtros.valorMaximo !== undefined) {
    const min = filtros.valorMinimo !== undefined ? formatarMoeda(filtros.valorMinimo) : "R$ 0";
    const max = filtros.valorMaximo !== undefined ? formatarMoeda(filtros.valorMaximo) : "sem limite";
    ativos.push(`Valor: ${min} até ${max}`);
  }

  if (filtros.situacao?.trim()) ativos.push(`Situação: ${rotuloFiltroSituacao(filtros.situacao)}`);

  if (filtros.modalidades && filtros.modalidades.length > 0) {
    ativos.push(`Modalidade: ${filtros.modalidades.join(", ")}`);
  }

  if (filtros.orgao?.trim()) ativos.push(`Órgão: ${filtros.orgao.trim()}`);

  return ativos;
}

interface FiltrosAtivosBarProps {
  /** A pesquisa aplicada (não o rascunho do formulário) — reflete o que está realmente na tela. */
  filtros: FiltrosLicitacao | null;
  onLimpar: () => void;
}

/**
 * Barra "congelada" (sticky) com os filtros aplicados, por nome — fora do
 * card de "Pesquisar licitações" de propósito, pra continuar visível
 * enquanto rola pela lista de resultados. Fica logo abaixo do Header e
 * empilhada com o cabeçalho congelado da tabela (ResultsTable.tsx): mesma
 * altura (`h-12`) e visual (fundo/borda), então quando as duas estão
 * grudadas ficam uma embaixo da outra, sem sobrepor. Se mudar a altura
 * aqui, ajuste também o `top` condicional em ResultsTable.tsx.
 */
export function FiltrosAtivosBar({ filtros, onLimpar }: FiltrosAtivosBarProps) {
  const ativos = filtros ? listarFiltrosAtivos(filtros) : [];
  if (ativos.length === 0) return null;

  return (
    <div className="sticky top-16 z-20 flex h-12 items-center gap-2 overflow-x-auto border-b border-ink-200 bg-white px-4 scrollbar-fina dark:border-ink-700 dark:bg-ink-900 sm:px-6">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="shrink-0"
        leftIcon={<RotateCcw className="h-3.5 w-3.5" aria-hidden />}
        onClick={onLimpar}
      >
        Limpar
      </Button>
      {ativos.map((texto) => (
        <span
          key={texto}
          className="shrink-0 whitespace-nowrap rounded-full bg-primary-50 px-2.5 py-1 text-xs font-medium text-primary-700 dark:bg-primary-900 dark:text-primary-300"
        >
          {texto}
        </span>
      ))}
    </div>
  );
}
