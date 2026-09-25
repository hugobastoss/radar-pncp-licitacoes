import { validarCnpj } from "@/lib/cnpj";
import type { TipoBuscaProdutoSaude } from "@/types/produto-saude";

/**
 * Descobre pelo formato o que foi digitado na busca de produtos para saúde:
 * número de registro (11 dígitos), número de processo (17 dígitos), CNPJ da
 * empresa detentora ou, em todo o resto, parte do nome do produto. A
 * pontuação é ignorada — "25351.069231/2025-45" e "25351069231202545" são o
 * mesmo processo. Usado nos dois lados (tela e rota), pra que a tela saiba
 * dizer por que tipo de dado está buscando.
 */
export function interpretarBuscaProdutoSaude(termo: string): { tipo: TipoBuscaProdutoSaude; valor: string } {
  const texto = termo.trim();
  const semPontuacao = texto.replace(/[\s./-]/g, "");

  if (/^\d{11}$/.test(semPontuacao)) return { tipo: "registro", valor: semPontuacao };
  if (/^\d{17}$/.test(semPontuacao)) return { tipo: "processo", valor: semPontuacao };

  const cnpj = validarCnpj(texto);
  if (cnpj.valido) return { tipo: "cnpj", valor: cnpj.cnpj };

  return { tipo: "nome", valor: texto };
}

/** Só a busca por nome ou CNPJ respeita o filtro "só válidos" — quem procura um registro específico quer vê-lo mesmo vencido. */
export function buscaAceitaFiltroValidos(tipo: TipoBuscaProdutoSaude): boolean {
  return tipo === "nome" || tipo === "cnpj";
}
