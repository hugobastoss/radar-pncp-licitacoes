import { useState } from "react";
import { Download, ExternalLink, FileSearch, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { PortalBadge } from "@/components/PortalBadge";
import { PrazoIndicador } from "@/components/PrazoIndicador";
import {
  formatarDataHora,
  formatarLocal,
  formatarMoeda,
  formatarNumeroLicitacao,
} from "@/lib/formatters";
import { rotuloSituacao } from "@/lib/data/dominio";
import { isLinkExternoSeguro } from "@/lib/portal";
import { buscarDocumentosLicitacao } from "@/lib/api-documentos";
import type { DocumentoLicitacao, Licitacao } from "@/types/licitacao";

type StatusDocumentos = "idle" | "carregando" | "sucesso" | "vazio" | "erro";

/** `linkPNCP` é montado como .../app/editais/{cnpj}/{ano}/{sequencial} (ver lib/server/*-client.ts). */
function extrairIdentificadoresPncp(
  linkPNCP: string | undefined,
): { cnpj: string; ano: string; sequencial: string } | undefined {
  if (!linkPNCP) return undefined;
  const partes = linkPNCP.match(/\/editais\/(\d+)\/(\d+)\/(\d+)\/?$/);
  if (!partes) return undefined;
  return { cnpj: partes[1], ano: partes[2], sequencial: partes[3] };
}

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
  const identificadores = extrairIdentificadoresPncp(item.linkPNCP);

  const [statusDocumentos, setStatusDocumentos] = useState<StatusDocumentos>("idle");
  const [documentos, setDocumentos] = useState<DocumentoLicitacao[]>([]);

  async function verDocumentos() {
    if (!identificadores) return;
    setStatusDocumentos("carregando");
    const resultado = await buscarDocumentosLicitacao(
      identificadores.cnpj,
      identificadores.ano,
      identificadores.sequencial,
    );
    if (resultado.status === "sucesso") {
      setDocumentos(resultado.documentos);
      setStatusDocumentos(resultado.documentos.length > 0 ? "sucesso" : "vazio");
    } else if (resultado.status !== "cancelado") {
      setStatusDocumentos("erro");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-base font-semibold text-ink-900 dark:text-ink-50">
          {formatarNumeroLicitacao(item.modalidade, item.numeroLicitacao)}
        </p>
        <p className="mt-0.5 text-sm text-ink-600 dark:text-ink-300">{item.orgao ?? "Órgão não informado"}</p>
      </div>

      <PrazoIndicador dataEncerramento={item.dataEncerramento} className="self-start" />

      <dl className="grid grid-cols-2 gap-4">
        <Campo rotulo="Modalidade" valor={item.modalidade ?? "Não informada"} />
        <Campo rotulo="Situação" valor={rotuloSituacao(item.situacao, item.dataAbertura)} />
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

      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-ink-500 dark:text-ink-400">Documentos</p>
        <div className="mt-1.5">
          {statusDocumentos === "idle" && (
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<FileText className="h-4 w-4" aria-hidden />}
              disabled={!identificadores}
              title={identificadores ? undefined : "Link do PNCP não informado"}
              onClick={verDocumentos}
            >
              Ver documentos
            </Button>
          )}
          {statusDocumentos === "carregando" && (
            <div className="flex items-center gap-2 text-sm text-ink-500 dark:text-ink-400">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Consultando documentos no PNCP…
            </div>
          )}
          {statusDocumentos === "vazio" && (
            <p className="text-sm text-ink-600 dark:text-ink-300">Nenhum documento encontrado no PNCP.</p>
          )}
          {statusDocumentos === "erro" && (
            <p className="text-sm text-danger-600 dark:text-danger-400">
              Não foi possível consultar os documentos no PNCP.
            </p>
          )}
          {statusDocumentos === "sucesso" && (
            <ul className="space-y-1.5">
              {documentos.map((doc) => (
                <li key={doc.url}>
                  <a
                    href={doc.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm text-primary-600 hover:underline dark:text-primary-400"
                  >
                    <Download className="h-4 w-4 shrink-0" aria-hidden />
                    <span className="truncate">{doc.titulo}</span>
                    {doc.tipo && (
                      <span className="shrink-0 text-xs text-ink-400 dark:text-ink-500">({doc.tipo})</span>
                    )}
                  </a>
                </li>
              ))}
            </ul>
          )}
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
