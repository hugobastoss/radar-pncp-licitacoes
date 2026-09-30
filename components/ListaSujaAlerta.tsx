import { ExternalLink, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/cn";
import { URL_PAGINA_LISTA_SUJA } from "@/lib/lista-suja";
import type { RegistroListaSuja } from "@/types/fontes-publicas";

/**
 * Alerta de que a empresa ou a pessoa está na "lista suja" do trabalho
 * escravo (Cadastro de Empregadores do MTE). Âmbar, não vermelho: estar na
 * lista não impede contratar por lei. Fora da lista, não desenha nada.
 *
 * `registros: null` é "não foi possível conferir" — avisa, em vez de sumir
 * como se a consulta tivesse dado "fora da lista".
 */
export function ListaSujaAlerta({
  registros,
  className,
}: {
  registros: RegistroListaSuja[] | null;
  className?: string;
}) {
  if (registros === null) {
    return (
      <p className={cn("text-xs text-ink-500 dark:text-ink-400", className)}>
        Não foi possível conferir a lista suja do trabalho escravo (MTE) neste momento.
      </p>
    );
  }
  if (registros.length === 0) return null;

  return (
    <div
      className={cn(
        "rounded-lg border border-warning-200 bg-warning-50 p-3 text-sm dark:border-warning-900 dark:bg-warning-900/30",
        className,
      )}
    >
      <p className="flex items-center gap-1.5 font-medium text-warning-700 dark:text-warning-300">
        <TriangleAlert className="h-4 w-4 shrink-0" aria-hidden />
        Na lista suja do trabalho escravo (MTE)
      </p>
      <ul className="mt-2 space-y-1.5 text-ink-700 dark:text-ink-200">
        {registros.map((r, i) => (
          <li key={`${r.anoAcaoFiscal}-${r.inclusaoEm}-${i}`}>
            {[
              r.anoAcaoFiscal && `Ação fiscal de ${r.anoAcaoFiscal}`,
              r.uf,
              r.trabalhadores &&
                `${r.trabalhadores} ${r.trabalhadores === 1 ? "trabalhador envolvido" : "trabalhadores envolvidos"}`,
              r.inclusaoEm && `incluído na lista em ${r.inclusaoEm}`,
            ]
              .filter(Boolean)
              .join(" · ")}
            {r.estabelecimento && (
              <span className="block text-xs text-ink-500 dark:text-ink-400">{r.estabelecimento}</span>
            )}
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-ink-500 dark:text-ink-400">
        Cadastro de Empregadores que submeteram trabalhadores a condições análogas à de escravo.{" "}
        <a
          href={URL_PAGINA_LISTA_SUJA}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 font-medium text-primary-600 hover:underline dark:text-primary-400"
        >
          Fonte: Ministério do Trabalho e Emprego
          <ExternalLink className="h-3 w-3" aria-hidden />
          <span className="sr-only">(abre em nova aba)</span>
        </a>
      </p>
    </div>
  );
}
