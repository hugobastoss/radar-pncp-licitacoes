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

/**
 * Formata uma data-calendário pura ("AAAA-MM-DD", sem instante/fuso
 * associado — ex.: data de abertura de uma empresa) só rearranjando o
 * texto. NÃO usar `new Date(...)` aqui: converteria pra um instante UTC e,
 * ao reformatar em horário de Brasília (ver formatarData), a data podia
 * voltar um dia.
 */
export function formatarDataSimples(data: string | undefined): string | undefined {
  if (!data) return undefined;
  const partes = /^(\d{4})-(\d{2})-(\d{2})/.exec(data);
  if (!partes) return data;
  return `${partes[3]}/${partes[2]}/${partes[1]}`;
}

/**
 * Monta "número/ano" a partir dos campos brutos da API oficial e do
 * Compras.gov.br (`numeroCompra` + `anoCompra`) — alguns órgãos já incluem
 * o ano dentro do próprio `numeroCompra` (ex.: "001/2026"), então
 * concatenar sempre duplicava o ano ("001/2026/2026"). Só concatena
 * quando `numeroCompra` não termina exatamente com "/{ano}".
 */
export function montarNumeroLicitacao(
  numeroCompra: string | undefined,
  ano: number | string | undefined,
): string | undefined {
  if (!numeroCompra) return undefined;
  if (ano === undefined) return numeroCompra;
  return numeroCompra.endsWith(`/${ano}`) ? numeroCompra : `${numeroCompra}/${ano}`;
}

export function formatarCnpj(cnpj: string | undefined): string | undefined {
  if (!cnpj) return undefined;
  const digitos = cnpj.replace(/\D/g, "");
  if (digitos.length !== 14) return cnpj;
  return `${digitos.slice(0, 2)}.${digitos.slice(2, 5)}.${digitos.slice(5, 8)}/${digitos.slice(8, 12)}-${digitos.slice(12, 14)}`;
}

/**
 * Máscara de CNPJ aplicada enquanto o usuário digita (aceita colar com ou
 * sem pontuação) — diferente de `formatarCnpj`, que só formata um CNPJ já
 * completo vindo de uma API.
 */
export function mascararCnpj(valor: string): string {
  const digitos = valor.replace(/\D/g, "").slice(0, 14);
  if (digitos.length <= 2) return digitos;
  if (digitos.length <= 5) return `${digitos.slice(0, 2)}.${digitos.slice(2)}`;
  if (digitos.length <= 8) return `${digitos.slice(0, 2)}.${digitos.slice(2, 5)}.${digitos.slice(5)}`;
  if (digitos.length <= 12) {
    return `${digitos.slice(0, 2)}.${digitos.slice(2, 5)}.${digitos.slice(5, 8)}/${digitos.slice(8)}`;
  }
  return `${digitos.slice(0, 2)}.${digitos.slice(2, 5)}.${digitos.slice(5, 8)}/${digitos.slice(8, 12)}-${digitos.slice(12)}`;
}

/** Máscara de CEP aplicada enquanto o usuário digita (00000-000). */
export function mascararCep(valor: string): string {
  const digitos = valor.replace(/\D/g, "").slice(0, 8);
  if (digitos.length <= 5) return digitos;
  return `${digitos.slice(0, 5)}-${digitos.slice(5)}`;
}

/** Formata um valor em reais no padrão da máscara de valor (sem "R$"), ex.: 1500.5 → "1.500,50". */
export function formatarValorMascara(valor: number | undefined): string {
  if (valor === undefined) return "";
  return valor.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Máscara de valor em reais aplicada enquanto o usuário digita: cada dígito
 * novo entra como centavo (ex.: digitar "150000" mostra "1.500,00"), igual
 * a um campo de valor monetário de caixa eletrônico. O campo em si é
 * controlado pelo número resultante (ver formatarValorMascara para exibir).
 */
export function valorDigitadoParaNumero(valorDigitado: string): number | undefined {
  const digitos = valorDigitado.replace(/\D/g, "");
  if (!digitos) return undefined;
  return Number(digitos) / 100;
}

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
  // porque o Radar Licitações também atende usuários em outros fusos (AM, AC, RR).
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
