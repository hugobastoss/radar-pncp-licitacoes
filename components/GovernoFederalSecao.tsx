"use client";

import { useState } from "react";
import { Check, Landmark, Loader2, Minus, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { formatarDataSimples, formatarMoeda } from "@/lib/formatters";
import type { ContratoFederal, DadosGovernoFederal, ResumoPessoaJuridica } from "@/types/transparencia";

export type EstadoGovernoFederal =
  | { status: "carregando" }
  | ({ status: "sucesso" } & DadosGovernoFederal)
  | { status: "nao_configurado" }
  | { status: "erro"; mensagem?: string };

const ITENS_RESUMO: { chave: keyof Omit<ResumoPessoaJuridica, "semRegistro">; rotulo: string; alerta?: boolean }[] = [
  { chave: "possuiContratacao", rotulo: "Contratos com o governo federal" },
  { chave: "participanteLicitacao", rotulo: "Participou de licitações federais" },
  { chave: "favorecidoDespesas", rotulo: "Recebeu pagamentos federais" },
  { chave: "emitiuNFe", rotulo: "Emitiu nota fiscal para o governo" },
  { chave: "convenios", rotulo: "Convênios" },
  { chave: "favorecidoTransferencias", rotulo: "Recebeu transferências" },
  { chave: "beneficiadoRenunciaFiscal", rotulo: "Benefício fiscal (renúncia)" },
  { chave: "sancionadoCEPIM", rotulo: "Impedida de convênios (CEPIM)", alerta: true },
];

const CONTRATOS_VISIVEIS = 5;
const ORGAOS_VISIVEIS = 5;

function Titulo({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-medium uppercase tracking-wide text-ink-500 dark:text-ink-400">{children}</p>;
}

function TextoSecundario({ children }: { children: React.ReactNode }) {
  return <p className="mt-1.5 text-sm text-ink-500 dark:text-ink-400">{children}</p>;
}

function Resumo({ resumo }: { resumo: ResumoPessoaJuridica }) {
  if (resumo.semRegistro) {
    return <TextoSecundario>O Portal da Transparência não tem registro deste CNPJ.</TextoSecundario>;
  }
  return (
    <ul className="mt-2 flex flex-wrap gap-1.5">
      {ITENS_RESUMO.map(({ chave, rotulo, alerta }) => {
        const sim = resumo[chave];
        // CEPIM só aparece quando é "sim" — "não está impedida" não diz nada útil.
        if (alerta && !sim) return null;
        return (
          <li key={chave}>
            <Badge
              tone={sim ? (alerta ? "danger" : "primary") : "neutral"}
              icon={sim ? <Check className="h-3 w-3" aria-hidden /> : <Minus className="h-3 w-3" aria-hidden />}
              className={sim ? undefined : "opacity-70"}
            >
              <span className="sr-only">{sim ? "Sim: " : "Não: "}</span>
              {rotulo}
            </Badge>
          </li>
        );
      })}
    </ul>
  );
}

function Pagamentos({ dados }: { dados: NonNullable<DadosGovernoFederal["pagamentos"]> }) {
  if (dados.total === 0) {
    return <TextoSecundario>Nenhum pagamento federal de {dados.inicio} a {dados.fim}.</TextoSecundario>;
  }
  return (
    <div className="mt-1.5">
      <p className="text-sm text-ink-900 dark:text-ink-50">
        <span className="text-lg font-semibold tabular-nums">{formatarMoeda(dados.total)}</span>
        <span className="text-ink-500 dark:text-ink-400">
          {" "}
          de {dados.inicio} a {dados.fim}
          {!dados.completo && " (ou mais — a lista da CGU passou do limite consultado)"}
        </span>
      </p>
      <ul className="mt-2 space-y-1 text-sm">
        {dados.porOrgao.slice(0, ORGAOS_VISIVEIS).map((o) => (
          <li key={o.orgao} className="flex justify-between gap-3">
            <span className="text-ink-700 dark:text-ink-200">
              {o.orgao}
              {o.orgaoSuperior && o.orgaoSuperior !== o.orgao && (
                <span className="text-xs text-ink-500 dark:text-ink-400"> · {o.orgaoSuperior}</span>
              )}
            </span>
            <span className="shrink-0 tabular-nums text-ink-900 dark:text-ink-50">{formatarMoeda(o.valor)}</span>
          </li>
        ))}
      </ul>
      {dados.porOrgao.length > ORGAOS_VISIVEIS && (
        <p className="mt-1 text-xs text-ink-400 dark:text-ink-500">
          E mais {dados.porOrgao.length - ORGAOS_VISIVEIS} {dados.porOrgao.length - ORGAOS_VISIVEIS === 1 ? "órgão" : "órgãos"}.
        </p>
      )}
    </div>
  );
}

function ItemContrato({ contrato: c }: { contrato: ContratoFederal }) {
  const valor = c.valorFinal ?? c.valorInicial;
  return (
    <li className="rounded-lg border border-ink-200 p-3 dark:border-ink-700">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="text-sm text-ink-900 dark:text-ink-50">{c.objeto ?? "Objeto não informado"}</p>
        <div className="flex shrink-0 flex-wrap items-center gap-1.5">
          {c.vigente && <Badge tone="success">Vigente</Badge>}
          {valor !== undefined && (
            <span className="text-sm font-medium tabular-nums text-ink-900 dark:text-ink-50">{formatarMoeda(valor)}</span>
          )}
        </div>
      </div>
      <p className="mt-1 text-xs text-ink-500 dark:text-ink-400">
        {[c.orgao ?? c.unidadeGestora, c.orgaoMaximo].filter(Boolean).join(" · ")}
      </p>
      <p className="mt-0.5 text-xs text-ink-500 dark:text-ink-400">
        {[
          `Contrato ${c.numero}`,
          c.modalidade,
          c.dataInicioVigencia &&
            `vigência ${formatarDataSimples(c.dataInicioVigencia)}${c.dataFimVigencia ? ` a ${formatarDataSimples(c.dataFimVigencia)}` : ""}`,
          c.processo && `processo ${c.processo}`,
        ]
          .filter(Boolean)
          .join(" · ")}
      </p>
    </li>
  );
}

function Contratos({ dados }: { dados: NonNullable<DadosGovernoFederal["contratos"]> }) {
  const [todos, setTodos] = useState(false);
  const vigentes = dados.itens.filter((c) => c.vigente).length;

  if (dados.itens.length === 0) {
    return <TextoSecundario>Nenhum contrato com o Poder Executivo federal.</TextoSecundario>;
  }

  // Vigentes primeiro (é o que interessa numa análise de concorrente/parceiro), depois os mais recentes.
  const ordenados = [...dados.itens].sort((a, b) => Number(b.vigente) - Number(a.vigente));
  const visiveis = todos ? ordenados : ordenados.slice(0, CONTRATOS_VISIVEIS);

  return (
    <div className="mt-1.5">
      <p className="text-sm text-ink-700 dark:text-ink-200">
        {dados.itens.length}
        {!dados.completo && "+"} {dados.itens.length === 1 ? "contrato" : "contratos"} ·{" "}
        {vigentes === 1 ? "1 vigente" : `${vigentes} vigentes`}
      </p>
      {!dados.completo && (
        <p className="mt-1 text-xs text-warning-700 dark:text-warning-300">
          A empresa tem mais contratos do que o limite consultado — a lista e a contagem estão incompletas.
        </p>
      )}
      <ul className="mt-2 space-y-2">
        {visiveis.map((c) => (
          <ItemContrato key={c.id} contrato={c} />
        ))}
      </ul>
      {ordenados.length > CONTRATOS_VISIVEIS && (
        <button
          type="button"
          onClick={() => setTodos(!todos)}
          className="mt-2 text-xs font-medium text-primary-600 hover:underline dark:text-primary-400"
        >
          {todos ? "Mostrar menos" : `Mostrar todos (${ordenados.length})`}
        </button>
      )}
    </div>
  );
}

/** Seção da consulta de CNPJ com o que a empresa tem de relação com o governo federal. */
export function GovernoFederalSecao({ estado }: { estado: EstadoGovernoFederal }) {
  return (
    <div className="mt-5 border-t border-ink-100 pt-5 dark:border-ink-800">
      <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-ink-500 dark:text-ink-400">
        <Landmark className="h-3.5 w-3.5" aria-hidden />
        Relação com o governo federal
      </p>

      {estado.status === "carregando" && (
        <p className="mt-2 flex items-center gap-1.5 text-sm text-ink-500 dark:text-ink-400">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Consultando contratos e pagamentos…
        </p>
      )}

      {estado.status === "nao_configurado" && (
        <TextoSecundario>Consulta ao Portal da Transparência ainda não configurada nesta instância.</TextoSecundario>
      )}

      {estado.status === "erro" && (
        <p className="mt-2 text-sm text-danger-600 dark:text-danger-400">
          {estado.mensagem ?? "Não foi possível consultar o Portal da Transparência neste momento."}
        </p>
      )}

      {estado.status === "sucesso" && (
        <div className="mt-2 space-y-5">
          <div>
            {estado.resumo ? (
              <Resumo resumo={estado.resumo} />
            ) : (
              <TextoSecundario>Não foi possível consultar o resumo agora.</TextoSecundario>
            )}
          </div>

          {!estado.resumo?.semRegistro && (
            <>
              <div>
                <Titulo>Pagamentos recebidos</Titulo>
                {estado.pagamentos ? (
                  <Pagamentos dados={estado.pagamentos} />
                ) : (
                  <TextoSecundario>Não foi possível consultar os pagamentos agora.</TextoSecundario>
                )}
              </div>

              <div>
                <Titulo>Contratos</Titulo>
                {estado.contratos ? (
                  <Contratos dados={estado.contratos} />
                ) : (
                  <TextoSecundario>Não foi possível consultar os contratos agora.</TextoSecundario>
                )}
              </div>
            </>
          )}

          <p className="flex items-start gap-1.5 text-xs text-ink-400 dark:text-ink-500">
            <TriangleAlert className="mt-px h-3 w-3 shrink-0" aria-hidden />
            Fonte: Portal da Transparência (CGU). Contratos e pagamentos são só do Poder Executivo federal — não
            incluem estados e municípios.
          </p>
        </div>
      )}
    </div>
  );
}
