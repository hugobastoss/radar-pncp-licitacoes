export interface Estado {
  sigla: string;
  nome: string;
}

// Estados priorizados pelo RADAR PNCP nesta primeira versão.
// A lista pode crescer para cobrir todo o Brasil sem alterar a estrutura.
export const ESTADOS: Estado[] = [
  { sigla: "AM", nome: "Amazonas" },
  { sigla: "RR", nome: "Roraima" },
  { sigla: "AC", nome: "Acre" },
  { sigla: "PA", nome: "Pará" },
  { sigla: "RO", nome: "Rondônia" },
];

export const ESTADO_TODOS = "TODOS";
