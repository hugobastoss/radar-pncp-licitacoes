/**
 * Relógio do cabeçalho, para o useSyncExternalStore. Duas leituras seguidas
 * têm que dar o mesmo valor: o React confere depois de cada renderização e, se
 * mudou, renderiza de novo — com Date.now() direto isso vira um laço sem fim
 * ("Maximum update depth exceeded"). Então o horário só anda quando o
 * intervalo avisa.
 */
let agoraEmCache = Date.now();

export function inscreverRelogio(callback: () => void) {
  const atualizar = () => {
    agoraEmCache = Date.now();
    callback();
  };
  // Acerta o horário ao montar: o valor guardado pode ser de quando o módulo carregou.
  atualizar();
  const intervalo = setInterval(atualizar, 10000);
  return () => clearInterval(intervalo);
}

export function lerAgora() {
  return agoraEmCache;
}

export function lerAgoraNoServidor() {
  return null;
}
