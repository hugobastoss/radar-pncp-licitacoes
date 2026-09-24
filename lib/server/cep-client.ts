import type { Endereco } from "@/types/cep";

/**
 * Cliente da BrasilAPI para consulta de CEP — agrega várias fontes
 * (Correios, ViaCEP, WideNet) e devolve a primeira que responder, sem
 * necessidade de autenticação. https://brasilapi.com.br
 */

const BASE_URL = "https://brasilapi.com.br/api/cep/v2";
const TIMEOUT_MS = 8000;
// A BrasilAPI bloqueia (403) requisições sem User-Agent — o fetch do Node,
// ao contrário do navegador, não manda um por padrão (mesma pegadinha já
// descoberta em lib/server/cnpj-client.ts).
const USER_AGENT = "RadarLicitacoes/1.0";

export class CepNaoEncontradoError extends Error {}

interface EnderecoBrasilApi {
  cep?: string;
  state?: string;
  city?: string;
  neighborhood?: string;
  street?: string;
  ibge?: { city?: string };
  location?: { coordinates?: { longitude?: string; latitude?: string } };
}

function mapearParaEndereco(raw: EnderecoBrasilApi, cepDigitos: string): Endereco {
  return {
    cep: raw.cep ?? cepDigitos,
    uf: raw.state ?? "",
    cidade: raw.city ?? "",
    bairro: raw.neighborhood || undefined,
    logradouro: raw.street || undefined,
    codigoIbge: raw.ibge?.city || undefined,
    latitude: raw.location?.coordinates?.latitude || undefined,
    longitude: raw.location?.coordinates?.longitude || undefined,
  };
}

export async function buscarEnderecoPorCep(cepDigitos: string, signal?: AbortSignal): Promise<Endereco> {
  const sinaisAbortar = [AbortSignal.timeout(TIMEOUT_MS)];
  if (signal) sinaisAbortar.push(signal);

  const resposta = await fetch(`${BASE_URL}/${cepDigitos}`, {
    signal: AbortSignal.any(sinaisAbortar),
    headers: { Accept: "application/json", "User-Agent": USER_AGENT },
  });

  if (resposta.status === 404) {
    throw new CepNaoEncontradoError("CEP não encontrado");
  }
  if (!resposta.ok) {
    throw new Error(`BrasilAPI respondeu ${resposta.status}`);
  }

  const corpo = (await resposta.json()) as EnderecoBrasilApi;
  return mapearParaEndereco(corpo, cepDigitos);
}
