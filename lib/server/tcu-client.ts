import type { CertidaoTcu, ItemCertidaoTcu } from "@/types/tcu";

/**
 * Consulta consolidada de pessoa jurídica do TCU
 * (certidoes-apf.apps.tcu.gov.br): numa chamada só, quatro cadastros —
 * Licitantes Inidôneos (TCU), CNIA (improbidade administrativa, CNJ), CEIS e
 * CNEP (CGU). Sem chave. É a mesma certidão que os órgãos pedem na
 * habilitação, e a API também devolve o PDF dela.
 *
 * Testado em 2026-09-29:
 * - `situacao` vem "NADA_CONSTA" ou "CONSTAM_REGISTROS"; quando consta,
 *   `observacao` resume o registro ("Impedimento/proibição de contratar com
 *   prazo determinado (14/05/2027) - EPA-ESTADO DO PARÁ").
 * - CNPJ com dígito errado volta 412 com `violacoes`.
 * - A primeira consulta de um CNPJ leva ~6 s (o TCU consulta os quatro
 *   cadastros na hora); as seguintes, ~0,2 s — o TCU guarda a certidão emitida.
 * - `seEmitirPDF=true` traz o PDF em base64 em `certidaoPDF` (~15 KB).
 */

const BASE_URL = "https://certidoes-apf.apps.tcu.gov.br/api/rest/publico/certidoes";
const TIMEOUT_MS = 20000;
const USER_AGENT = "Mozilla/5.0 (compatible; QBuscado/1.0)";

interface CertidaoBruta {
  razaoSocial?: string | null;
  seCnpjEncontradoNaBaseTcu?: boolean;
  certidaoPDF?: string | null;
  certidoes?: {
    tipo?: string;
    descricao?: string;
    emissor?: string;
    situacao?: string;
    observacao?: string | null;
    linkConsultaManual?: string | null;
    dataHoraEmissao?: string;
  }[];
  violacoes?: { mensagem?: string }[];
}

export class CnpjRecusadoTcuError extends Error {}

async function requisitar(cnpj: string, pdf: boolean, signal?: AbortSignal): Promise<CertidaoBruta> {
  const sinais = [AbortSignal.timeout(TIMEOUT_MS)];
  if (signal) sinais.push(signal);
  const resposta = await fetch(`${BASE_URL}/${cnpj}?seEmitirPDF=${pdf}`, {
    signal: AbortSignal.any(sinais),
    headers: { Accept: "application/json", "User-Agent": USER_AGENT },
  });
  const corpo = (await resposta.json().catch(() => ({}))) as CertidaoBruta;
  if (resposta.status === 412) {
    throw new CnpjRecusadoTcuError(corpo.violacoes?.[0]?.mensagem ?? "CNPJ recusado pelo TCU");
  }
  if (!resposta.ok) throw new Error(`TCU (certidões) respondeu ${resposta.status}`);
  return corpo;
}

function situacao(texto: string | undefined): ItemCertidaoTcu["situacao"] {
  if (texto === "NADA_CONSTA") return "nada_consta";
  if (texto === "CONSTAM_REGISTROS") return "consta";
  return "indisponivel";
}

export async function buscarCertidaoTcu(cnpj: string, signal?: AbortSignal): Promise<CertidaoTcu> {
  const raw = await requisitar(cnpj, false, signal);
  const certidoes = raw.certidoes ?? [];
  return {
    razaoSocial: raw.razaoSocial?.trim() || undefined,
    encontrado: raw.seCnpjEncontradoNaBaseTcu !== false,
    emitidaEm: certidoes[0]?.dataHoraEmissao,
    itens: certidoes.map((c) => ({
      tipo: c.tipo ?? "Cadastro",
      descricao: c.descricao ?? c.tipo ?? "Cadastro",
      emissor: c.emissor ?? "",
      situacao: situacao(c.situacao),
      observacao: c.observacao?.trim() || undefined,
      linkConsulta: c.linkConsultaManual?.trim() || undefined,
    })),
  };
}

/** O PDF oficial da certidão, pra baixar. */
export async function baixarCertidaoTcuPdf(cnpj: string, signal?: AbortSignal): Promise<Buffer> {
  const raw = await requisitar(cnpj, true, signal);
  if (!raw.certidaoPDF) throw new Error("TCU (certidões) não devolveu o PDF");
  return Buffer.from(raw.certidaoPDF, "base64");
}
