/**
 * Faixa que se rola arrastando com o mouse, como se arrasta com o dedo no
 * celular (no toque o navegador já faz isso sozinho, então aqui é só mouse).
 * Um arraste não vira clique no item onde começou; um clique parado continua
 * sendo clique.
 *
 * Uso: `ref={arrastarParaRolar}` num elemento com `overflow-x-auto`. É um ref
 * de função com limpeza (React 19): por ser uma função de módulo, fica estável
 * e não religa a cada renderização.
 */
const DISTANCIA_MINIMA = 5;

export function arrastarParaRolar(elemento: HTMLElement | null) {
  if (!elemento) return;
  const el = elemento;
  let pressionado = false;
  let arrastou = false;
  let inicioX = 0;
  let inicioRolagem = 0;

  function aoPressionar(e: PointerEvent) {
    if (e.pointerType !== "mouse" || e.button !== 0) return;
    pressionado = true;
    arrastou = false;
    inicioX = e.clientX;
    inicioRolagem = el.scrollLeft;
  }

  function aoMover(e: PointerEvent) {
    if (!pressionado) return;
    const deslocamento = e.clientX - inicioX;
    if (!arrastou) {
      if (Math.abs(deslocamento) < DISTANCIA_MINIMA) return;
      arrastou = true;
      el.setPointerCapture(e.pointerId);
      el.dataset.arrastando = "true";
    }
    el.scrollLeft = inicioRolagem - deslocamento;
    e.preventDefault();
  }

  function aoSoltar(e: PointerEvent) {
    if (!pressionado) return;
    pressionado = false;
    if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
    delete el.dataset.arrastando;
  }

  // O clique que o navegador dispara ao soltar, depois de um arraste, não abre o item.
  function aoClicar(e: MouseEvent) {
    if (!arrastou) return;
    arrastou = false;
    e.preventDefault();
    e.stopPropagation();
  }

  el.addEventListener("pointerdown", aoPressionar);
  el.addEventListener("pointermove", aoMover);
  el.addEventListener("pointerup", aoSoltar);
  el.addEventListener("pointercancel", aoSoltar);
  el.addEventListener("click", aoClicar, true);
  return () => {
    el.removeEventListener("pointerdown", aoPressionar);
    el.removeEventListener("pointermove", aoMover);
    el.removeEventListener("pointerup", aoSoltar);
    el.removeEventListener("pointercancel", aoSoltar);
    el.removeEventListener("click", aoClicar, true);
  };
}
