import Link from "next/link";
import { Globe } from "lucide-react";
import { formatarCnpj } from "@/lib/formatters";
import type { ResultadoRegistroDominio } from "@/lib/api-fontes-publicas";

export type EstadoDominio = ResultadoRegistroDominio | { status: "carregando" } | { status: "nao_consultado" };

/**
 * Quem registrou o domínio do e-mail da empresa, segundo o registro.br.
 * Quando é outro CNPJ, vira link pra ficha dele — sem tom de alerta: é
 * comum a empresa cadastrar o e-mail do contador.
 *
 * Não desenha nada enquanto não há o que dizer (domínio fora do .br ou de
 * provedor de e-mail, domínio não registrado, consulta em andamento).
 */
function TituloDominio() {
  return (
    <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-ink-500 dark:text-ink-400">
      <Globe className="h-3.5 w-3.5" aria-hidden />
      Domínio
    </p>
  );
}

export function DominioEmailLinha({
  estado,
  cnpjEmpresa,
  className,
}: {
  estado: EstadoDominio;
  cnpjEmpresa: string;
  className?: string;
}) {
  if (estado.status === "erro_servidor" || estado.status === "limite") {
    return (
      <div className={className}>
        <TituloDominio />
        <p className="mt-2 text-sm text-ink-500 dark:text-ink-400">
          {estado.mensagem ?? "Não foi possível consultar o registro.br neste momento."}
        </p>
      </div>
    );
  }
  if (estado.status !== "sucesso" || !estado.registro?.titular) return null;

  const { dominio, titular, criadoEm } = estado.registro;
  // Matriz e filiais dividem a raiz do CNPJ (os 8 primeiros dígitos): é a mesma empresa.
  const daPropriaEmpresa = titular.cnpj?.slice(0, 8) === cnpjEmpresa.slice(0, 8);
  const desde = criadoEm ? `, desde ${criadoEm.slice(0, 4)}` : "";

  return (
    <div className={className}>
      <TituloDominio />
      <p className="mt-2 text-sm text-ink-600 dark:text-ink-300">
        <span className="font-medium text-ink-800 dark:text-ink-100">{dominio}</span> registrado{" "}
        {daPropriaEmpresa ? (
          <>pela própria empresa{desde}.</>
        ) : titular.cnpj ? (
          <>
            por <span className="font-medium text-ink-800 dark:text-ink-100">{titular.nome ?? "outra empresa"}</span> (
            <Link
              href={`/cnpj?cnpj=${titular.cnpj}`}
              className="font-medium tabular-nums text-primary-600 hover:underline dark:text-primary-400"
            >
              {formatarCnpj(titular.cnpj)}
            </Link>
            ){desde}.
          </>
        ) : (
          <>
            por{" "}
            <span className="font-medium text-ink-800 dark:text-ink-100">
              {titular.nome ?? (titular.tipo === "cpf" ? "uma pessoa física" : "titular não informado")}
            </span>
            {titular.tipo === "cpf" && titular.nome && " (pessoa física)"}
            {desde}.
          </>
        )}
      </p>
      <p className="mt-2 text-xs text-ink-400 dark:text-ink-500">Fonte: registro.br</p>
    </div>
  );
}
