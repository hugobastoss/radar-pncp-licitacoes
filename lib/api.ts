import type { FiltrosLicitacao, ResultadoBusca } from "@/types/licitacao";

/**
 * Camada de serviço consumida pelos componentes de tela.
 *
 * Nenhum componente chama `fetch` diretamente: tudo passa por
 * `buscarLicitacoes`, que fala com `/api/licitacoes` (a camada de backend do
 * Next.js) e nunca com o PNCP diretamente — exatamente a arquitetura prevista
 * no briefing. Trocar o mock pela integração real do PNCP acontece dentro da
 * rota `/api/licitacoes`; esta função e o contrato `ResultadoBusca` não
 * precisam mudar.
 */

const TIMEOUT_PRIMEIRA_TENTATIVA_MS = 8000;
const TIMEOUT_SEGUNDA_TENTATIVA_MS = 9000;

function construirQueryString(filtros: FiltrosLicitacao): string {
  const params = new URLSearchParams();

  const set = (chave: string, valor: string | number | undefined | null) => {
    if (valor === undefined || valor === null) return;
    const texto = String(valor).trim();
    if (texto.length === 0) return;
    params.set(chave, texto);
  };

  set("q", filtros.q);
  set("uf", filtros.uf);
  set("municipio", filtros.municipio);
  set("periodo", filtros.periodo);
  set("dataInicial", filtros.dataInicial);
  set("dataFinal", filtros.dataFinal);
  set("valorMinimo", filtros.valorMinimo);
  set("valorMaximo", filtros.valorMaximo);
  set("orgao", filtros.orgao);
  set("numeroLicitacao", filtros.numeroLicitacao);
  set("situacao", filtros.situacao);
  set("ordenarPor", filtros.ordenarPor);
  set("pagina", filtros.pagina);
  set("tamanhoPagina", filtros.tamanhoPagina);
  set("modalidadeRapida", filtros.modalidadeRapida);
  set("localRapido", filtros.localRapido);
  set("portalRapido", filtros.portalRapido);

  for (const modalidade of filtros.modalidades ?? []) {
    if (modalidade) params.append("modalidade", modalidade);
  }
  for (const portal of filtros.portais ?? []) {
    if (portal) params.append("portal", portal);
  }

  return params.toString();
}

type FalhaBusca =
  | { tipo: "timeout" }
  | { tipo: "abortado" }
  | { tipo: "rede" }
  | { tipo: "servidor"; status: number; mensagem?: string };

async function tentarBuscar(
  query: string,
  timeoutMs: number,
  signalExterno?: AbortSignal,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new DOMException("Timeout", "TimeoutError")), timeoutMs);

  const onAbortExterno = () => controller.abort(signalExterno?.reason);
  signalExterno?.addEventListener("abort", onAbortExterno);

  try {
    const resposta = await fetch(`/api/licitacoes?${query}`, {
      method: "GET",
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    return resposta;
  } finally {
    clearTimeout(timer);
    signalExterno?.removeEventListener("abort", onAbortExterno);
  }
}

function classificarFalha(erro: unknown, signalExterno?: AbortSignal): FalhaBusca {
  if (signalExterno?.aborted) return { tipo: "abortado" };
  if (erro instanceof DOMException && erro.name === "TimeoutError") return { tipo: "timeout" };
  if (erro instanceof DOMException && erro.name === "AbortError") return { tipo: "abortado" };
  // Falha de rede real (offline, DNS, CORS) chega como TypeError no fetch.
  return { tipo: "rede" };
}

/**
 * Executa a busca. Só deve ser chamada quando o usuário clicar em
 * "Pesquisar" ou em uma ação equivalente (atalho, refinamento de tabela,
 * paginação, ordenação) — nunca automaticamente a cada tecla digitada.
 */
export async function buscarLicitacoes(
  filtros: FiltrosLicitacao,
  options?: { signal?: AbortSignal },
): Promise<ResultadoBusca> {
  const query = construirQueryString(filtros);

  let resposta: Response;
  try {
    resposta = await tentarBuscar(query, TIMEOUT_PRIMEIRA_TENTATIVA_MS, options?.signal);
  } catch (erro) {
    const falha = classificarFalha(erro, options?.signal);
    if (falha.tipo === "abortado") return { status: "cancelado" };
    if (falha.tipo === "rede") return { status: "erro_conexao" };

    // Timeout na primeira tentativa: nova tentativa automática, como
    // descrito na tela ("Estamos tentando novamente.").
    try {
      resposta = await tentarBuscar(query, TIMEOUT_SEGUNDA_TENTATIVA_MS, options?.signal);
    } catch (segundoErro) {
      const segundaFalha = classificarFalha(segundoErro, options?.signal);
      if (segundaFalha.tipo === "abortado") return { status: "cancelado" };
      if (segundaFalha.tipo === "rede") return { status: "erro_conexao" };
      return { status: "erro_timeout" };
    }
  }

  if (options?.signal?.aborted) return { status: "cancelado" };

  if (!resposta.ok) {
    if (resposta.status === 504) return { status: "erro_timeout" };
    let mensagem: string | undefined;
    try {
      const corpo = (await resposta.json()) as { erro?: string };
      mensagem = corpo?.erro;
    } catch {
      // corpo não é JSON — segue sem mensagem detalhada.
    }
    return { status: "erro_servidor", mensagem };
  }

  const dados = await resposta.json();
  return { status: "sucesso", dados };
}
