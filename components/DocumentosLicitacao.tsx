"use client";

import { useState } from "react";
import { Download, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
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

/**
 * Seção "Documentos" (edital, anexos) de uma licitação — extraída pra ser
 * reaproveitada tanto no drawer de detalhes (mobile, LicitacaoDetails.tsx)
 * quanto no painel expandido da tabela (desktop, ResultsTable.tsx), que
 * antes tinham esse painel duplicado e ficaram divergentes.
 */
export function DocumentosLicitacao({ item }: { item: Licitacao }) {
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
                  {doc.tipo && <span className="shrink-0 text-xs text-ink-400 dark:text-ink-500">({doc.tipo})</span>}
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
