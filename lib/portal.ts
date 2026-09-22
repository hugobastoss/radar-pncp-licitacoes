/**
 * Identificação do portal de origem a partir de `linkSistemaOrigem`.
 *
 * Função isolada e extensível: para reconhecer um novo portal no futuro,
 * basta acrescentar uma entrada em `REGISTRO_PORTAIS`. Nada fora deste
 * arquivo precisa mudar.
 */

export interface PortalInfo {
  nome: string;
  /** Domínio "canônico" usado para exibição quando o portal não é reconhecido. */
  dominio?: string;
  /** Classe de cor usada pelo PortalBadge (ver components/PortalBadge.tsx). */
  tonalidade: "azul" | "verde" | "roxo" | "ambar" | "neutro";
}

interface RegraPortal {
  /** Trecho de domínio a procurar em `linkSistemaOrigem` (case-insensitive). */
  padrao: string;
  info: PortalInfo;
}

const REGISTRO_PORTAIS: RegraPortal[] = [
  {
    padrao: "licitanet.com.br",
    info: { nome: "LICITANET", tonalidade: "azul" },
  },
  {
    padrao: "compras.gov.br",
    info: { nome: "Compras.gov.br", tonalidade: "verde" },
  },
  {
    padrao: "portaldecompraspublicas.com.br",
    info: { nome: "Portal de Compras Públicas", tonalidade: "roxo" },
  },
  {
    padrao: "bll.org.br",
    info: { nome: "BLL Compras", tonalidade: "ambar" },
  },
  {
    padrao: "comprasbr.com.br",
    info: { nome: "Compras BR", tonalidade: "azul" },
  },
];

const PORTAL_DESCONHECIDO: PortalInfo = { nome: "Outro portal", tonalidade: "neutro" };

/**
 * Identifica o portal a partir do link do sistema de origem.
 * Nunca lança exceção: links ausentes ou inválidos retornam o portal
 * "desconhecido" (com o domínio, quando possível extraí-lo) em vez de travar a tela.
 */
export function identificarPortal(linkSistemaOrigem?: string): PortalInfo {
  if (!linkSistemaOrigem) {
    return PORTAL_DESCONHECIDO;
  }

  const linkNormalizado = linkSistemaOrigem.toLowerCase();

  for (const regra of REGISTRO_PORTAIS) {
    if (linkNormalizado.includes(regra.padrao)) {
      return regra.info;
    }
  }

  const dominio = extrairDominio(linkSistemaOrigem);
  return dominio ? { ...PORTAL_DESCONHECIDO, dominio } : PORTAL_DESCONHECIDO;
}

function extrairDominio(url: string): string | undefined {
  try {
    const semProtocolo = url.includes("://") ? url : `https://${url}`;
    return new URL(semProtocolo).hostname.replace(/^www\./, "");
  } catch {
    return undefined;
  }
}

/**
 * Valida se um link é seguro para abrir em nova aba (apenas http/https).
 * Usado antes de renderizar qualquer botão "Abrir portal" / "Abrir no PNCP",
 * já que `linkSistemaOrigem` vem de terceiros e não deve ser confiado às cegas.
 */
export function isLinkExternoSeguro(url?: string): url is string {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}
