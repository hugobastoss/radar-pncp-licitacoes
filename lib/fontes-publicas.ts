import type { InscricaoEstadual, OperadoraAns, RegistroDominio, TransferenciaEspecial } from "@/types/fontes-publicas";

/**
 * Conversão das respostas das fontes públicas para os tipos do app. Sem
 * nada do Next aqui (quem chama as fontes são os clientes em lib/server),
 * pra poder ser testado sozinho.
 */

// ---------------------------------------------------------------------------
// registro.br (RDAP)
// ---------------------------------------------------------------------------
interface EntidadeRdap {
  roles?: string[];
  handle?: string;
  publicIds?: { type?: string; identifier?: string }[];
  /** jCard: ["vcard", [["fn", {}, "text", "NOME"], ...]] */
  vcardArray?: [string, unknown[][]];
}

export interface DominioRdapBruto {
  handle?: string;
  ldhName?: string;
  entities?: EntidadeRdap[];
  events?: { eventAction?: string; eventDate?: string }[];
}

export function mapearRegistroDominio(raw: DominioRdapBruto): RegistroDominio {
  const registro: RegistroDominio = { dominio: (raw.handle || raw.ldhName || "").toLowerCase() };

  const titular = (raw.entities ?? []).find((e) => e.roles?.includes("registrant"));
  if (titular) {
    const nome = titular.vcardArray?.[1]?.find((campo) => campo[0] === "fn")?.[3];
    const id = titular.publicIds?.[0];
    const digitos = (id?.identifier ?? "").replace(/\D/g, "");
    const tipo = id?.type === "cnpj" && digitos.length === 14 ? "cnpj" : id?.type === "cpf" ? "cpf" : "outro";
    registro.titular = {
      ...(typeof nome === "string" && nome.trim() ? { nome: nome.trim() } : {}),
      tipo,
      // CPF de titular pessoa física fica no servidor: só o CNPJ segue adiante.
      ...(tipo === "cnpj" ? { cnpj: digitos } : {}),
    };
  }

  const data = (acao: string) => raw.events?.find((e) => e.eventAction === acao)?.eventDate || undefined;
  const criadoEm = data("registration");
  const alteradoEm = data("last changed");
  const expiraEm = data("expiration");
  if (criadoEm) registro.criadoEm = criadoEm;
  if (alteradoEm) registro.alteradoEm = alteradoEm;
  if (expiraEm) registro.expiraEm = expiraEm;
  return registro;
}

// ---------------------------------------------------------------------------
// CNPJ.ws — inscrições estaduais
// ---------------------------------------------------------------------------
export interface CnpjWsBruto {
  estabelecimento?: {
    inscricoes_estaduais?: {
      inscricao_estadual?: string;
      ativo?: boolean;
      atualizado_em?: string;
      estado?: { sigla?: string };
    }[];
  };
}

/** Ativas primeiro; dentro de cada grupo, por UF. */
export function mapearInscricoesEstaduais(raw: CnpjWsBruto): InscricaoEstadual[] {
  return (raw.estabelecimento?.inscricoes_estaduais ?? [])
    .filter((i) => i.inscricao_estadual && i.estado?.sigla)
    .map((i) => ({
      uf: i.estado!.sigla!,
      numero: i.inscricao_estadual!,
      ativa: i.ativo === true,
      ...(i.atualizado_em ? { atualizadoEm: i.atualizado_em } : {}),
    }))
    .sort((a, b) => Number(b.ativa) - Number(a.ativa) || a.uf.localeCompare(b.uf));
}

// ---------------------------------------------------------------------------
// TransfereGov — transferências especiais ("emendas PIX")
// ---------------------------------------------------------------------------
export interface PlanoAcaoEspecialBruto {
  codigo_plano_acao?: string;
  ano_plano_acao?: number;
  situacao_plano_acao?: string;
  motivo_impedimento_plano_acao?: string | null;
  nome_parlamentar_emenda_plano_acao?: string | null;
  numero_emenda_parlamentar_plano_acao?: string | null;
  codigo_descricao_areas_politicas_publicas_plano_acao?: string | null;
  valor_custeio_plano_acao?: number | null;
  valor_investimento_plano_acao?: number | null;
}

/**
 * Só o que a tela mostra. A fonte também devolve banco, agência e conta do
 * beneficiário — esses campos não são pedidos, então nem chegam ao servidor.
 */
export const COLUNAS_TRANSFERENCIA_ESPECIAL = [
  "codigo_plano_acao",
  "ano_plano_acao",
  "situacao_plano_acao",
  "motivo_impedimento_plano_acao",
  "nome_parlamentar_emenda_plano_acao",
  "numero_emenda_parlamentar_plano_acao",
  "codigo_descricao_areas_politicas_publicas_plano_acao",
  "valor_custeio_plano_acao",
  "valor_investimento_plano_acao",
].join(",");

/** "IMPEDIDO_REJEICAO_PLANO_TRABALHO" → "Impedido" (o porquê vem em motivoImpedimento); "CIENTE" → "Ciente". */
function descreverSituacao(codigo: string | undefined): string {
  if (!codigo) return "Não informada";
  if (codigo.startsWith("IMPEDIDO")) return "Impedido";
  const texto = codigo.replace(/_/g, " ").toLowerCase();
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

export function mapearTransferenciaEspecial(raw: PlanoAcaoEspecialBruto): TransferenciaEspecial {
  const emenda = (raw.numero_emenda_parlamentar_plano_acao ?? "").trim();
  return {
    codigo: raw.codigo_plano_acao ?? "",
    ano: raw.ano_plano_acao ?? 0,
    situacao: descreverSituacao(raw.situacao_plano_acao),
    ...(raw.motivo_impedimento_plano_acao?.trim() ? { motivoImpedimento: raw.motivo_impedimento_plano_acao.trim() } : {}),
    ...(raw.nome_parlamentar_emenda_plano_acao?.trim() ? { parlamentar: raw.nome_parlamentar_emenda_plano_acao.trim() } : {}),
    // O mesmo código de 12 dígitos da tela de Emendas; fora desse formato não dá link.
    ...(/^\d{12}$/.test(emenda) ? { numeroEmenda: emenda } : {}),
    ...(raw.codigo_descricao_areas_politicas_publicas_plano_acao?.trim()
      ? { area: raw.codigo_descricao_areas_politicas_publicas_plano_acao.trim() }
      : {}),
    valor: (raw.valor_custeio_plano_acao ?? 0) + (raw.valor_investimento_plano_acao ?? 0),
  };
}

// ---------------------------------------------------------------------------
// ANS — operadoras de planos de saúde
// ---------------------------------------------------------------------------
export interface OperadoraAnsBruta {
  registro_ans?: string;
  razao_social?: string;
  nome_fantasia?: string;
  classificacao_nome?: string;
  ativa?: boolean;
}

export function mapearOperadoraAns(raw: OperadoraAnsBruta): OperadoraAns | undefined {
  if (!raw.registro_ans) return undefined;
  return {
    registro: raw.registro_ans,
    ...(raw.razao_social ? { razaoSocial: raw.razao_social } : {}),
    ...(raw.nome_fantasia ? { nomeFantasia: raw.nome_fantasia } : {}),
    ...(raw.classificacao_nome ? { classificacao: raw.classificacao_nome } : {}),
    ativa: raw.ativa === true,
  };
}
