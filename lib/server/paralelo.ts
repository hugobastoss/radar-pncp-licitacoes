/** Roda `tarefa` pra cada item com no máximo `limite` ao mesmo tempo; os resultados saem na ordem dos itens. */
export async function emParalelo<T, R>(itens: T[], limite: number, tarefa: (item: T) => Promise<R>): Promise<R[]> {
  const resultados: R[] = new Array(itens.length);
  let proximo = 0;
  await Promise.all(
    Array.from({ length: Math.min(limite, itens.length) }, async () => {
      while (proximo < itens.length) {
        const i = proximo++;
        resultados[i] = await tarefa(itens[i]);
      }
    }),
  );
  return resultados;
}
