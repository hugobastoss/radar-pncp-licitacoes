import type {
  InscricaoEstadual,
  OperadoraAns,
  RegistroDominio,
  RegistroListaSuja,
  TransferenciasEspeciais,
} from "@/types/fontes-publicas";

/**
 * Camada de serviço das fontes públicas que complementam a ficha do CNPJ
 * (lista suja, registro.br, inscrições estaduais, transferências especiais e
 * ANS) — mesmo padrão de lib/api-cnpj.ts: o componente nunca chama fetch
 * direto. Cada fonte tem a sua rota, então uma fora do ar não afeta as outras.
 */
const TIMEOUT_MS = 20000;

type Falha =
  | { status: "limite"; mensagem?: string }
  | { status: "erro_servidor"; mensagem?: string }
  | { status: "cancelado" };

async function consultar<T>(caminho: string, signal?: AbortSignal): Promise<{ status: "sucesso"; corpo: T } | Falha> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new DOMException("Timeout", "TimeoutError")), TIMEOUT_MS);
  const onAbortExterno = () => controller.abort(signal?.reason);
  signal?.addEventListener("abort", onAbortExterno);

  try {
    const resposta = await fetch(caminho, { signal: controller.signal, headers: { Accept: "application/json" } });
    if (signal?.aborted) return { status: "cancelado" };

    const corpo = (await resposta.json().catch(() => ({}))) as T & { erro?: string };
    if (resposta.status === 429) return { status: "limite", mensagem: corpo.erro };
    if (!resposta.ok) return { status: "erro_servidor", mensagem: corpo.erro };
    return { status: "sucesso", corpo };
  } catch {
    if (signal?.aborted) return { status: "cancelado" };
    return { status: "erro_servidor" };
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onAbortExterno);
  }
}

export type ResultadoListaSuja = { status: "sucesso"; registros: RegistroListaSuja[] } | Falha;

/** Registros do CNPJ na "lista suja" do trabalho escravo (MTE). Vazio quando não está nela. */
export async function buscarListaSuja(cnpj: string, options?: { signal?: AbortSignal }): Promise<ResultadoListaSuja> {
  const r = await consultar<{ registros?: RegistroListaSuja[] }>(`/api/lista-suja?cnpj=${cnpj}`, options?.signal);
  return r.status === "sucesso" ? { status: "sucesso", registros: r.corpo.registros ?? [] } : r;
}

export type ResultadoRegistroDominio = { status: "sucesso"; registro: RegistroDominio | null } | Falha;

/** Quem registrou o domínio .br. `registro: null` quando o domínio não está registrado. */
export async function buscarRegistroDominio(dominio: string, options?: { signal?: AbortSignal }): Promise<ResultadoRegistroDominio> {
  const r = await consultar<{ registro?: RegistroDominio | null }>(
    `/api/dominio?dominio=${encodeURIComponent(dominio)}`,
    options?.signal,
  );
  return r.status === "sucesso" ? { status: "sucesso", registro: r.corpo.registro ?? null } : r;
}

export type ResultadoInscricoesEstaduais = { status: "sucesso"; inscricoes: InscricaoEstadual[] } | Falha;

export async function buscarInscricoesEstaduais(cnpj: string, options?: { signal?: AbortSignal }): Promise<ResultadoInscricoesEstaduais> {
  const r = await consultar<{ inscricoes?: InscricaoEstadual[] }>(`/api/cnpj/inscricoes-estaduais?cnpj=${cnpj}`, options?.signal);
  return r.status === "sucesso" ? { status: "sucesso", inscricoes: r.corpo.inscricoes ?? [] } : r;
}

export type ResultadoTransferenciasEspeciais = { status: "sucesso"; transferencias: TransferenciasEspeciais } | Falha;

/** Transferências especiais ("emendas PIX") recebidas pelo CNPJ. */
export async function buscarTransferenciasEspeciais(
  cnpj: string,
  options?: { signal?: AbortSignal },
): Promise<ResultadoTransferenciasEspeciais> {
  const r = await consultar<Partial<TransferenciasEspeciais>>(`/api/transferencias-especiais?cnpj=${cnpj}`, options?.signal);
  return r.status === "sucesso"
    ? { status: "sucesso", transferencias: { total: r.corpo.total ?? 0, itens: r.corpo.itens ?? [] } }
    : r;
}

export type ResultadoOperadoraAns = { status: "sucesso"; operadora: OperadoraAns | null } | Falha;

/** Operadora de plano de saúde registrada na ANS. `operadora: null` quando o CNPJ não é de operadora. */
export async function buscarOperadoraAns(cnpj: string, options?: { signal?: AbortSignal }): Promise<ResultadoOperadoraAns> {
  const r = await consultar<{ operadora?: OperadoraAns | null }>(`/api/ans?cnpj=${cnpj}`, options?.signal);
  return r.status === "sucesso" ? { status: "sucesso", operadora: r.corpo.operadora ?? null } : r;
}
