/**
 * Últimas empresas consultadas na tela de CNPJ, pro menu lateral. Ficam só no
 * navegador de quem consultou (localStorage). CPF nunca entra aqui (LGPD).
 */
export interface EmpresaRecente {
  /** 14 dígitos, sem máscara. */
  cnpj: string;
  nome: string;
}

export const MAXIMO_EMPRESAS_RECENTES = 5;

const CHAVE = "radar-pncp-empresas-recentes";
// O evento "storage" só chega nas outras abas; este avisa a própria aba.
const EVENTO = "radar-pncp:empresas-recentes";
const VAZIA: EmpresaRecente[] = [];

function valida(item: unknown): item is EmpresaRecente {
  if (typeof item !== "object" || item === null) return false;
  const { cnpj, nome } = item as Record<string, unknown>;
  return typeof cnpj === "string" && /^\d{14}$/.test(cnpj) && typeof nome === "string" && nome.trim() !== "";
}

function interpretar(texto: string | null): EmpresaRecente[] {
  if (!texto) return VAZIA;
  try {
    const dados: unknown = JSON.parse(texto);
    return Array.isArray(dados) ? dados.filter(valida).slice(0, MAXIMO_EMPRESAS_RECENTES) : VAZIA;
  } catch {
    return VAZIA;
  }
}

function lerTexto(): string | null {
  try {
    return localStorage.getItem(CHAVE);
  } catch {
    return null;
  }
}

let textoEmCache: string | null = null;
let listaEmCache: EmpresaRecente[] = VAZIA;

/** Devolve sempre o mesmo array enquanto o texto guardado não muda, como o useSyncExternalStore exige. */
export function lerEmpresasRecentes(): EmpresaRecente[] {
  const texto = lerTexto();
  if (texto !== textoEmCache) {
    textoEmCache = texto;
    listaEmCache = interpretar(texto);
  }
  return listaEmCache;
}

export function lerEmpresasRecentesNoServidor(): EmpresaRecente[] {
  return VAZIA;
}

function gravar(lista: EmpresaRecente[]) {
  try {
    if (lista.length) localStorage.setItem(CHAVE, JSON.stringify(lista));
    else localStorage.removeItem(CHAVE);
  } catch {
    // localStorage indisponível (modo privado etc.): a lista só não fica guardada.
  }
  window.dispatchEvent(new Event(EVENTO));
}

export function registrarEmpresaRecente(empresa: EmpresaRecente) {
  const nova = { cnpj: empresa.cnpj.replace(/\D/g, ""), nome: empresa.nome.trim() };
  if (!valida(nova)) return;
  const resto = lerEmpresasRecentes().filter((e) => e.cnpj !== nova.cnpj);
  gravar([nova, ...resto].slice(0, MAXIMO_EMPRESAS_RECENTES));
}

export function limparEmpresasRecentes() {
  gravar([]);
}

export function inscreverEmpresasRecentes(callback: () => void): () => void {
  const aoMudarEmOutraAba = (e: Event) => {
    const chave = (e as StorageEvent).key;
    if (chave === null || chave === CHAVE) callback();
  };
  window.addEventListener(EVENTO, callback);
  window.addEventListener("storage", aoMudarEmOutraAba);
  return () => {
    window.removeEventListener(EVENTO, callback);
    window.removeEventListener("storage", aoMudarEmOutraAba);
  };
}
