import type { DocumentoLicitacao } from "@/types/licitacao";

/**
 * Lista e baixa os documentos (edital, anexos) de uma licitação no PNCP —
 * endpoint público, sem autenticação, descoberto por engenharia reversa
 * (testado ao vivo em 2026-09-25). Mesma ressalva das outras fontes não
 * documentadas do PNCP: pode mudar sem aviso.
 *
 * Vive sob `/api/pncp/` — o mesmo domínio classificado em docs/APIS.md como
 * só de escrita, pra entidades credenciadas — mas este sub-recurso
 * específico (`/arquivos`) é de leitura pública, sem token.
 */

const BASE_URL = "https://pncp.gov.br/api/pncp/v1";
const TIMEOUT_MS = 10000;

interface ArquivoBruto {
  url?: string;
  titulo?: string;
  tipoDocumentoNome?: string;
  dataPublicacaoPncp?: string;
}

function mapearDocumento(raw: ArquivoBruto): DocumentoLicitacao | undefined {
  if (!raw.url || !raw.titulo) return undefined;
  return {
    titulo: raw.titulo,
    tipo: raw.tipoDocumentoNome,
    url: raw.url,
    dataPublicacao: raw.dataPublicacaoPncp,
  };
}

export async function buscarArquivosLicitacao(
  cnpj: string,
  ano: string,
  sequencial: string,
  signal?: AbortSignal,
): Promise<DocumentoLicitacao[]> {
  const sinaisAbortar = [AbortSignal.timeout(TIMEOUT_MS)];
  if (signal) sinaisAbortar.push(signal);

  const resposta = await fetch(`${BASE_URL}/orgaos/${cnpj}/compras/${ano}/${sequencial}/arquivos`, {
    signal: AbortSignal.any(sinaisAbortar),
    headers: { Accept: "application/json" },
  });

  // Licitação sem nenhum documento anexado também responde 404 aqui.
  if (resposta.status === 404) return [];
  if (!resposta.ok) throw new Error(`PNCP (arquivos) respondeu ${resposta.status}`);

  const bruto = (await resposta.json()) as ArquivoBruto[];
  return bruto.map(mapearDocumento).filter((doc): doc is DocumentoLicitacao => doc !== undefined);
}
