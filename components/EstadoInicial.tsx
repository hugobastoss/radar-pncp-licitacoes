import { Radar } from "lucide-react";

export function EstadoInicial() {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-50 text-primary-600">
        <Radar className="h-6 w-6" aria-hidden />
      </span>
      <h3 className="text-base font-semibold text-ink-900">Pronto para pesquisar</h3>
      <p className="max-w-sm text-sm text-ink-500">
        Preencha os filtros acima e clique em &quot;Pesquisar licitações&quot; para consultar o PNCP, ou escolha uma
        das pesquisas rápidas abaixo.
      </p>
    </div>
  );
}
