/**
 * Formatação e regras de apresentação. Centralizado aqui para que nenhum
 * componente decida sozinho como um valor ausente deve aparecer na tela.
 */

const formatadorMoeda = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const formatadorData = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "America/Sao_Paulo",
});

const formatadorDataHora = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Sao_Paulo",
});

const formatadorHora = new Intl.DateTimeFormat("pt-BR", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Sao_Paulo",
});

export function formatarMoeda(valor: number | undefined, sigiloso?: boolean): string {
  if (sigiloso) return "Valor sigiloso";
  if (valor === undefined || valor === null || Number.isNaN(valor)) return "Valor não informado";
  return formatadorMoeda.format(valor);
}

export function formatarData(isoDate: string | undefined): string {
  if (!isoDate) return "Data não informada";
  const data = new Date(isoDate);
  if (Number.isNaN(data.getTime())) return "Data não informada";
  return formatadorData.format(data);
}

/** Data + hora compactas, sem o sufixo "(horário de Brasília)" — para espaços apertados como células de tabela. */
export function formatarDataHoraCurta(isoDate: string | undefined): string {
  if (!isoDate) return "Data não informada";
  const data = new Date(isoDate);
  if (Number.isNaN(data.getTime())) return "Data não informada";
  return `${formatadorData.format(data)} · ${formatadorHora.format(data)}`;
}

export function formatarDataHora(isoDate: string | Date | undefined): string {
  if (!isoDate) return "—";
  const data = typeof isoDate === "string" ? new Date(isoDate) : isoDate;
  if (Number.isNaN(data.getTime())) return "—";
  // O PNCP publica horários no fuso de Brasília; deixamos isso explícito
  // porque o RADAR PNCP também atende usuários em outros fusos (AM, AC, RR).
  return `${formatadorDataHora.format(data)} (horário de Brasília)`;
}

export function formatarNumeroLicitacao(
  modalidade: string | undefined,
  numero: string | undefined,
): string {
  if (!numero) return "Número não informado";
  return modalidade ? `${modalidade} nº ${numero}` : `Nº ${numero}`;
}

export function formatarLocal(municipio: string | undefined, uf: string | undefined): string {
  if (municipio && uf) return `${municipio} - ${uf}`;
  if (uf) return uf;
  if (municipio) return municipio;
  return "Local não informado";
}

export function truncarTexto(texto: string | undefined, maxCaracteres: number): {
  truncado: string;
  foiTruncado: boolean;
} {
  if (!texto) return { truncado: "Objeto não informado", foiTruncado: false };
  if (texto.length <= maxCaracteres) return { truncado: texto, foiTruncado: false };
  return { truncado: `${texto.slice(0, maxCaracteres).trimEnd()}…`, foiTruncado: true };
}

export type UrgenciaPrazo = "encerrada" | "critico" | "atencao" | "confortavel" | "indefinido";

/**
 * Classifica a urgência do prazo de encerramento para reforçar a cor com
 * texto (nunca só cor), conforme a diretriz de acessibilidade do produto.
 */
export function calcularUrgenciaPrazo(
  dataEncerramento: string | undefined,
  agora: Date = new Date(),
): { urgencia: UrgenciaPrazo; rotulo: string } {
  if (!dataEncerramento) return { urgencia: "indefinido", rotulo: "Prazo não informado" };

  const encerramento = new Date(dataEncerramento);
  if (Number.isNaN(encerramento.getTime())) {
    return { urgencia: "indefinido", rotulo: "Prazo não informado" };
  }

  const diffMs = encerramento.getTime() - agora.getTime();
  const diffHoras = diffMs / (1000 * 60 * 60);

  if (diffHoras <= 0) return { urgencia: "encerrada", rotulo: "Encerrada" };
  if (diffHoras <= 48) return { urgencia: "critico", rotulo: "Encerra em breve" };
  if (diffHoras <= 24 * 7) return { urgencia: "atencao", rotulo: "Encerra esta semana" };
  return { urgencia: "confortavel", rotulo: "Recebendo propostas" };
}

export function formatarQuantidade(valor: number): string {
  return new Intl.NumberFormat("pt-BR").format(valor);
}
