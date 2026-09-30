import { useEffect, useState } from "react";

/**
 * Consulta que acompanha uma chave (um CNPJ, um domínio): refaz quando a
 * chave muda e cancela a anterior. Sem chave, não consulta.
 *
 * O resultado fica guardado junto da chave que o pediu, e "carregando" é
 * deduzido (chave atual sem resultado dela) — assim não é preciso um
 * setState síncrono dentro do efeito só pra marcar o carregamento.
 *
 * `buscar` precisa ser estável entre renderizações (uma função de módulo,
 * como as de lib/api-*.ts).
 */
export function useConsulta<T>(
  chave: string | undefined,
  buscar: (chave: string, options: { signal: AbortSignal }) => Promise<T>,
): T | { status: "carregando" } | { status: "nao_consultado" } {
  const [resultado, setResultado] = useState<{ chave: string; valor: T } | null>(null);

  useEffect(() => {
    if (!chave) return;
    const controller = new AbortController();
    void buscar(chave, { signal: controller.signal }).then((valor) => {
      if (!controller.signal.aborted) setResultado({ chave, valor });
    });
    return () => controller.abort();
  }, [chave, buscar]);

  if (!chave) return { status: "nao_consultado" };
  return resultado?.chave === chave ? resultado.valor : { status: "carregando" };
}
