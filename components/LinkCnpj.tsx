import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { normalizarCnpj } from "@/lib/cnpj";

/**
 * CNPJ clicável que abre a consulta de CNPJ (/cnpj) já preenchida. Abre em
 * nova aba pra não perder a lista de resultados — voltar pra busca
 * reconsultaria a cascata do PNCP, que é instável.
 */
export function LinkCnpj({ cnpj }: { cnpj: string }) {
  return (
    <Link
      href={`/cnpj?cnpj=${normalizarCnpj(cnpj)}`}
      target="_blank"
      rel="noopener"
      title="Consultar este CNPJ em nova aba"
      className="inline-flex items-center gap-1 text-primary-600 hover:underline dark:text-primary-400"
    >
      {cnpj}
      <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
      <span className="sr-only">(abre em nova aba)</span>
    </Link>
  );
}
