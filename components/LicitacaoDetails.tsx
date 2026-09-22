import { ExternalLink, FileSearch, Info } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { PortalBadge } from "@/components/PortalBadge";
import { PrazoIndicador } from "@/components/PrazoIndicador";
import {
  formatarDataHora,
  formatarLocal,
  formatarMoeda,
  formatarNumeroLicitacao,
} from "@/lib/formatters";
import { isLinkExternoSeguro } from "@/lib/portal";
import type { Licitacao } from "@/types/licitacao";

export function Campo({ rotulo, valor }: { rotulo: string; valor: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-ink-500 dark:text-ink-400">{rotulo}</dt>
      <dd className="mt-1 text-sm text-ink-900 dark:text-ink-50">{valor}</dd>
    </div>
  );
}

export function LicitacaoDetails({ item }: { item: Licitacao }) {
  const pncpSeguro = isLinkExternoSeguro(item.linkPNCP);
  const portalSeguro = isLinkExternoSeguro(item.linkSistemaOrigem);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start gap-2 rounded-lg bg-ink-50 p-3 text-xs text-ink-500 dark:bg-ink-800 dark:text-ink-400">
        <Info className="h-4 w-4 shrink-0 text-ink-400 dark:text-ink-500" aria-hidden />
        Dados de demonstração — nenhuma informação nesta tela corresponde a uma licitação real.
      </div>

      <div>
        <p className="text-base font-semibold text-ink-900 dark:text-ink-50">
          {formatarNumeroLicitacao(item.modalidade, item.numeroLicitacao)}
        </p>
        <p className="mt-0.5 text-sm text-ink-600 dark:text-ink-300">{item.orgao ?? "Órgão não informado"}</p>
      </div>

      <PrazoIndicador dataEncerramento={item.dataEncerramento} className="self-start" />

      <dl className="grid grid-cols-2 gap-4">
        <Campo rotulo="Modalidade" valor={item.modalidade ?? "Não informada"} />
        <Campo rotulo="Situação" valor={item.situacao ?? "Não informada"} />
        <Campo rotulo="Município" valor={item.municipio ?? "Não informado"} />
        <Campo rotulo="Estado" valor={item.uf ?? "Não informado"} />
        <Campo rotulo="CNPJ do órgão" valor={item.cnpjOrgao ?? "Não informado"} />
        <Campo rotulo="Local" valor={formatarLocal(item.municipio, item.uf)} />
        <Campo rotulo="Data de abertura" valor={formatarDataHora(item.dataAbertura)} />
        <Campo rotulo="Data de encerramento" valor={formatarDataHora(item.dataEncerramento)} />
        <Campo rotulo="Valor estimado" valor={formatarMoeda(item.valorEstimado, item.valorSigiloso)} />
        <Campo rotulo="Número de controle PNCP" valor={item.numeroControlePNCP ?? "Não informado"} />
      </dl>

      <div>
        <dt className="text-xs font-medium uppercase tracking-wide text-ink-500 dark:text-ink-400">Objeto completo</dt>
        <dd className="mt-1 whitespace-pre-line text-sm leading-relaxed text-ink-700 dark:text-ink-200">
          {item.objeto ?? "Objeto não informado"}
        </dd>
      </div>

      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-ink-500 dark:text-ink-400">Portal de origem</p>
        <div className="mt-1.5">
          <PortalBadge linkSistemaOrigem={item.linkSistemaOrigem} />
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          variant="secondary"
          leftIcon={<FileSearch className="h-4 w-4" aria-hidden />}
          disabled={!pncpSeguro}
          title={pncpSeguro ? undefined : "Link do PNCP não informado"}
          onClick={() => pncpSeguro && window.open(item.linkPNCP, "_blank", "noopener,noreferrer")}
          fullWidth
        >
          Abrir no PNCP
        </Button>
        <Button
          variant="secondary"
          leftIcon={<ExternalLink className="h-4 w-4" aria-hidden />}
          disabled={!portalSeguro}
          title={portalSeguro ? undefined : "Link do portal de origem não informado"}
          onClick={() => portalSeguro && window.open(item.linkSistemaOrigem, "_blank", "noopener,noreferrer")}
          fullWidth
        >
          Abrir no portal de origem
        </Button>
      </div>
    </div>
  );
}
