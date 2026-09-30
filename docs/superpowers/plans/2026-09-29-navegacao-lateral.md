# Navegação lateral — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trocar a grade de 13 botões do topo das telas por uma barra fina no topo e um menu lateral com as ferramentas em 3 grupos, recolhível, com as últimas empresas consultadas, e uma gaveta com o mesmo menu no tablet e no celular.

**Architecture:** Um componente único de menu (`MenuFerramentas`) é usado pelo menu lateral do computador (`Sidebar`, no layout das ferramentas) e pela gaveta do celular (aberta pelo ☰ do `Header`, no layout raiz). O estado "recolhido" vive no atributo `data-menu` do `<html>`, aplicado antes da hidratação pelo mesmo script do tema, e o CSS lê esse atributo por uma variante do Tailwind. As empresas recentes ficam no `localStorage`, lidas com `useSyncExternalStore`.

**Tech Stack:** Next.js 16 (App Router), React 19, Tailwind CSS v4 (`@theme`, `@custom-variant`), lucide-react. Testes de unidade com `node --test` (Node 24 roda TypeScript direto) e roteiros no Chrome headless pelo DevTools Protocol — os dois fora do repositório, na pasta de rascunho.

**Spec:** `docs/superpowers/specs/2026-09-29-navegacao-lateral-design.md`

## Global Constraints

- Só a estrutura de navegação muda: cores, fonte, cartões e o conteúdo das telas ficam como estão.
- Sem novas dependências. Sem estrutura de testes no repositório: testes e roteiros ficam em `$RASCUNHO/nav/`.
- `$RASCUNHO` = `C:/Users/hugo2/AppData/Local/Temp/claude/c--GitHub-radar-pncp/0b0c7b5b-944e-4a8f-a392-8c25d045ad92/scratchpad` (já tem `cdp.mjs`, que abre o Chrome headless e exporta `cmd`, `avaliar`, `esperarTexto`, `sleep`, `fim`, `ouvir`, `buscar`).
- O servidor `next dev` na porta 3000 é do usuário: usar, nunca derrubar.
- Não fazer commit nem push sem o usuário pedir. Os passos "Checkpoint" só revisam o diff.
- Breakpoint do menu lateral: `lg` (1024 px). Barra do topo: `h-14` (56 px). Menu: `w-60` (240 px), recolhido `w-16` (64 px). Gaveta pela esquerda: `max-w-xs` (320 px).
- Grupos, nesta ordem: "Licitações e dinheiro público" (Licitações `/`, Atas, Empenhos, Convênios, Emendas), "Empresas e pessoas" (CNPJ, CPF, Sanções, Sinapse), "Consultas de apoio" (CEP, NCM, Produtos p/ Saúde, Nome Técnico).
- Chaves no navegador: `radar-pncp-menu-recolhido` (valor `"1"` quando recolhido; ausente quando expandido) e `radar-pncp-empresas-recentes` (JSON `[{ cnpj, nome }]`). Evento na mesma aba: `radar-pncp:empresas-recentes`.
- Recentes: no máximo 5, a mais nova primeiro, sem repetir; só gravadas pela tela de CNPJ; CPF nunca.
- Todo acesso ao `localStorage` em `try/catch`; com ele bloqueado, nada quebra.
- Código, nomes e comentários em português, no estilo do resto do repositório.

## Review Focus

- **Clique numa recente com a tela de CNPJ já aberta** só muda a URL: a tela precisa consultar a empresa nova (hoje ela só lê a URL ao montar). Teste na Task 5.
- **Armazenamento bloqueado** (aba anônima, política do navegador): recentes somem, recolher vale só na sessão, sem erros no console. Testes nas Tasks 1, 2 e 5.
- **Recarregar com o menu recolhido**: a coluna já nasce com 64 px e o React não reclama de hidratação. Teste na Task 3.
- **Menu recolhido e leitor de tela**: cada item continua com nome acessível (texto em `sr-only`, não `display: none`). Teste na Task 3.
- **Outra aba mexe nas recentes**: o menu desta aba se atualiza pelo evento `storage`. Teste na Task 1.

---

### Task 1: Guardar as empresas recentes

**Files:**
- Create: `lib/empresas-recentes.ts`
- Test: `$RASCUNHO/nav/empresas-recentes.test.ts` (fora do repositório)

**Interfaces:**
- Consumes: nada.
- Produces:
  - `interface EmpresaRecente { cnpj: string; nome: string }` (cnpj com 14 dígitos)
  - `MAXIMO_EMPRESAS_RECENTES = 5`
  - `lerEmpresasRecentes(): EmpresaRecente[]` (mesmo array enquanto nada muda)
  - `lerEmpresasRecentesNoServidor(): EmpresaRecente[]` (sempre vazio)
  - `registrarEmpresaRecente(empresa: EmpresaRecente): void` (aceita CNPJ com máscara)
  - `limparEmpresasRecentes(): void`
  - `inscreverEmpresasRecentes(callback: () => void): () => void`

- [ ] **Step 1: Escrever o teste que falha**

Criar `$RASCUNHO/nav/empresas-recentes.test.ts`:

```ts
import { beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import {
  inscreverEmpresasRecentes,
  lerEmpresasRecentes,
  lerEmpresasRecentesNoServidor,
  limparEmpresasRecentes,
  registrarEmpresaRecente,
} from "file:///C:/GitHub/radar-pncp/lib/empresas-recentes.ts";

class ArmazenamentoFalso {
  dados = new Map<string, string>();
  bloqueado = false;
  getItem(chave: string): string | null {
    if (this.bloqueado) throw new Error("bloqueado");
    return this.dados.get(chave) ?? null;
  }
  setItem(chave: string, valor: string): void {
    if (this.bloqueado) throw new Error("bloqueado");
    this.dados.set(chave, valor);
  }
  removeItem(chave: string): void {
    if (this.bloqueado) throw new Error("bloqueado");
    this.dados.delete(chave);
  }
}

const armazenamento = new ArmazenamentoFalso();
const janela = new EventTarget();
Object.defineProperty(globalThis, "localStorage", { value: armazenamento, configurable: true, writable: true });
Object.defineProperty(globalThis, "window", { value: janela, configurable: true, writable: true });

const CHAVE = "radar-pncp-empresas-recentes";
const A = "00280273000137";
const B = "54464211000104";

beforeEach(() => {
  armazenamento.dados.clear();
  armazenamento.bloqueado = false;
});

test("começa vazia, e no servidor é sempre vazia", () => {
  assert.deepEqual(lerEmpresasRecentes(), []);
  assert.deepEqual(lerEmpresasRecentesNoServidor(), []);
});

test("guarda só os dígitos do CNPJ e o nome sem espaços nas pontas", () => {
  registrarEmpresaRecente({ cnpj: "00.280.273/0001-37", nome: "  SAMSUNG  " });
  assert.deepEqual(lerEmpresasRecentes(), [{ cnpj: A, nome: "SAMSUNG" }]);
});

test("a mais nova primeiro, sem repetir", () => {
  registrarEmpresaRecente({ cnpj: A, nome: "A" });
  registrarEmpresaRecente({ cnpj: B, nome: "B" });
  registrarEmpresaRecente({ cnpj: A, nome: "A de novo" });
  assert.deepEqual(lerEmpresasRecentes(), [
    { cnpj: A, nome: "A de novo" },
    { cnpj: B, nome: "B" },
  ]);
});

test("guarda no máximo 5", () => {
  for (let i = 0; i < 7; i++) registrarEmpresaRecente({ cnpj: String(i).padStart(14, "1"), nome: `E${i}` });
  const lista = lerEmpresasRecentes();
  assert.equal(lista.length, 5);
  assert.deepEqual(lista.map((e) => e.nome), ["E6", "E5", "E4", "E3", "E2"]);
});

test("ignora CNPJ sem 14 dígitos e nome vazio", () => {
  registrarEmpresaRecente({ cnpj: "123", nome: "X" });
  registrarEmpresaRecente({ cnpj: A, nome: "   " });
  assert.deepEqual(lerEmpresasRecentes(), []);
});

test("limpar apaga a lista e a chave", () => {
  registrarEmpresaRecente({ cnpj: A, nome: "A" });
  limparEmpresasRecentes();
  assert.deepEqual(lerEmpresasRecentes(), []);
  assert.equal(armazenamento.dados.has(CHAVE), false);
});

test("JSON inválido e itens fora do formato são ignorados", () => {
  armazenamento.dados.set(CHAVE, "{não é json");
  assert.deepEqual(lerEmpresasRecentes(), []);
  armazenamento.dados.set(
    CHAVE,
    JSON.stringify([{ cnpj: A, nome: "ok" }, { cnpj: "1", nome: "curto" }, "texto", null, { cnpj: B }]),
  );
  assert.deepEqual(lerEmpresasRecentes(), [{ cnpj: A, nome: "ok" }]);
});

test("devolve o mesmo array enquanto nada muda (exigência do useSyncExternalStore)", () => {
  registrarEmpresaRecente({ cnpj: A, nome: "A" });
  const primeira = lerEmpresasRecentes();
  assert.equal(lerEmpresasRecentes(), primeira);
});

test("avisa quem está inscrito: na mesma aba e vindo de outra aba", () => {
  let avisos = 0;
  const sair = inscreverEmpresasRecentes(() => avisos++);
  registrarEmpresaRecente({ cnpj: A, nome: "A" });
  limparEmpresasRecentes();
  janela.dispatchEvent(Object.assign(new Event("storage"), { key: CHAVE }));
  janela.dispatchEvent(Object.assign(new Event("storage"), { key: "outra-chave" }));
  sair();
  registrarEmpresaRecente({ cnpj: B, nome: "B" });
  assert.equal(avisos, 3);
});

test("armazenamento bloqueado: lista vazia e nada quebra", () => {
  armazenamento.bloqueado = true;
  assert.doesNotThrow(() => registrarEmpresaRecente({ cnpj: A, nome: "A" }));
  assert.deepEqual(lerEmpresasRecentes(), []);
  assert.doesNotThrow(() => limparEmpresasRecentes());
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `node --test "$RASCUNHO/nav/empresas-recentes.test.ts"`
Expected: FAIL com `ERR_MODULE_NOT_FOUND` para `lib/empresas-recentes.ts`.

(O Node 24 roda `.ts` direto, tirando os tipos. Como o `package.json` do projeto não tem `"type"`, ele reconhece o arquivo como ESM pela sintaxe. Se aparecer erro de CommonJS ao importar o arquivo do projeto, rodar com `node --experimental-detect-module --test ...`.)

- [ ] **Step 3: Implementar**

Criar `lib/empresas-recentes.ts` (sem imports: o teste roda o arquivo direto no Node):

```ts
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
```

- [ ] **Step 4: Rodar e ver passar**

Run: `node --test "$RASCUNHO/nav/empresas-recentes.test.ts"`
Expected: `pass 10`, `fail 0`.

Run: `npx tsc --noEmit` e `npx eslint lib/empresas-recentes.ts`
Expected: sem saída, código 0.

- [ ] **Step 5: Checkpoint**

Run: `git diff --stat` e conferir que só `lib/empresas-recentes.ts` é novo. Sem commit.

---

### Task 2: Estado "menu recolhido", script inicial e variante de CSS

**Files:**
- Create: `lib/menu-lateral.ts`
- Modify: `app/layout.tsx` (o `<Script id="tema-inicial">`)
- Modify: `app/globals.css` (variante `menu-recolhido` e sombra da gaveta pela esquerda)
- Test: `$RASCUNHO/nav/menu-lateral.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces:
  - `CHAVE_MENU_STORAGE = "radar-pncp-menu-recolhido"`
  - `SCRIPT_INICIALIZACAO_MENU: string`
  - `inscreverMenuRecolhido(callback: () => void): () => void`
  - `lerMenuRecolhido(): boolean`
  - `lerMenuRecolhidoNoServidor(): boolean` (sempre `false`)
  - `definirMenuRecolhido(recolhido: boolean): void`
  - Variante Tailwind `menu-recolhido:` (vale dentro de um elemento com `data-lateral` quando o `<html>` tem `data-menu="recolhido"`)
  - Utilitário `shadow-drawer-esquerda`

- [ ] **Step 1: Escrever o teste que falha**

Criar `$RASCUNHO/nav/menu-lateral.test.ts`:

```ts
import { beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import {
  CHAVE_MENU_STORAGE,
  SCRIPT_INICIALIZACAO_MENU,
  definirMenuRecolhido,
  inscreverMenuRecolhido,
  lerMenuRecolhido,
  lerMenuRecolhidoNoServidor,
} from "file:///C:/GitHub/radar-pncp/lib/menu-lateral.ts";

class ArmazenamentoFalso {
  dados = new Map<string, string>();
  bloqueado = false;
  getItem(chave: string): string | null {
    if (this.bloqueado) throw new Error("bloqueado");
    return this.dados.get(chave) ?? null;
  }
  setItem(chave: string, valor: string): void {
    if (this.bloqueado) throw new Error("bloqueado");
    this.dados.set(chave, valor);
  }
  removeItem(chave: string): void {
    if (this.bloqueado) throw new Error("bloqueado");
    this.dados.delete(chave);
  }
}

const armazenamento = new ArmazenamentoFalso();
const dataset: Record<string, string> = {};
Object.defineProperty(globalThis, "localStorage", { value: armazenamento, configurable: true, writable: true });
Object.defineProperty(globalThis, "document", { value: { documentElement: { dataset } }, configurable: true, writable: true });

const rodarScriptInicial = () => new Function(SCRIPT_INICIALIZACAO_MENU)();

beforeEach(() => {
  armazenamento.dados.clear();
  armazenamento.bloqueado = false;
  for (const chave of Object.keys(dataset)) delete dataset[chave];
});

test("começa expandido, e no servidor é sempre expandido", () => {
  assert.equal(lerMenuRecolhido(), false);
  assert.equal(lerMenuRecolhidoNoServidor(), false);
});

test("recolher marca o <html>, guarda a escolha e avisa", () => {
  let avisos = 0;
  const sair = inscreverMenuRecolhido(() => avisos++);
  definirMenuRecolhido(true);
  sair();
  assert.equal(dataset.menu, "recolhido");
  assert.equal(armazenamento.dados.get(CHAVE_MENU_STORAGE), "1");
  assert.equal(lerMenuRecolhido(), true);
  assert.equal(avisos, 1);
});

test("expandir tira a marca e apaga a chave", () => {
  definirMenuRecolhido(true);
  definirMenuRecolhido(false);
  assert.equal("menu" in dataset, false);
  assert.equal(armazenamento.dados.has(CHAVE_MENU_STORAGE), false);
});

test("o script inicial aplica só a escolha guardada", () => {
  rodarScriptInicial();
  assert.equal("menu" in dataset, false);
  armazenamento.dados.set(CHAVE_MENU_STORAGE, "1");
  rodarScriptInicial();
  assert.equal(dataset.menu, "recolhido");
});

test("armazenamento bloqueado: recolhe na sessão e nada quebra", () => {
  armazenamento.bloqueado = true;
  assert.doesNotThrow(() => definirMenuRecolhido(true));
  assert.equal(dataset.menu, "recolhido");
  assert.doesNotThrow(rodarScriptInicial);
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `node --test "$RASCUNHO/nav/menu-lateral.test.ts"`
Expected: FAIL com `ERR_MODULE_NOT_FOUND` para `lib/menu-lateral.ts`.

- [ ] **Step 3: Implementar `lib/menu-lateral.ts`**

```ts
/**
 * Menu lateral recolhido (só ícones) no computador. A fonte da verdade é o
 * atributo data-menu do <html>, aplicado antes da hidratação pelo script
 * abaixo, então a coluna já nasce com a largura certa. O CSS lê o atributo
 * pela variante `menu-recolhido:` (app/globals.css).
 */
export const CHAVE_MENU_STORAGE = "radar-pncp-menu-recolhido";

/** Roda junto do script do tema (app/layout.tsx), antes da hidratação. */
export const SCRIPT_INICIALIZACAO_MENU = `
(function () {
  try {
    if (localStorage.getItem(${JSON.stringify(CHAVE_MENU_STORAGE)}) === "1") {
      document.documentElement.dataset.menu = "recolhido";
    }
  } catch (e) {}
})();
`;

const ouvintes = new Set<() => void>();

export function inscreverMenuRecolhido(callback: () => void) {
  ouvintes.add(callback);
  return () => {
    ouvintes.delete(callback);
  };
}

export function lerMenuRecolhido(): boolean {
  return document.documentElement.dataset.menu === "recolhido";
}

export function lerMenuRecolhidoNoServidor(): boolean {
  return false;
}

export function definirMenuRecolhido(recolhido: boolean) {
  const { dataset } = document.documentElement;
  if (recolhido) dataset.menu = "recolhido";
  else delete dataset.menu;
  try {
    if (recolhido) localStorage.setItem(CHAVE_MENU_STORAGE, "1");
    else localStorage.removeItem(CHAVE_MENU_STORAGE);
  } catch {
    // localStorage indisponível (modo privado etc.): vale só até recarregar.
  }
  for (const ouvinte of ouvintes) ouvinte();
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `node --test "$RASCUNHO/nav/menu-lateral.test.ts"`
Expected: `pass 5`, `fail 0`.

- [ ] **Step 5: Ligar o script inicial em `app/layout.tsx`**

Import novo, ao lado do de `@/lib/theme`:

```ts
import { SCRIPT_INICIALIZACAO_MENU } from "@/lib/menu-lateral";
```

E o conteúdo do `<Script id="tema-inicial" strategy="beforeInteractive">` passa de `{SCRIPT_INICIALIZACAO_TEMA}` para:

```tsx
          {SCRIPT_INICIALIZACAO_TEMA + SCRIPT_INICIALIZACAO_MENU}
```

- [ ] **Step 6: Variante e sombra em `app/globals.css`**

Logo abaixo da linha `@custom-variant dark (&:where(.dark, .dark *));`:

```css

/*
 * Menu lateral recolhido: o <html> ganha data-menu="recolhido" (lib/menu-lateral.ts).
 * Só vale dentro do menu lateral ([data-lateral]), então a gaveta do celular,
 * que usa o mesmo menu, nunca fica recolhida.
 */
@custom-variant menu-recolhido (&:where([data-menu="recolhido"] [data-lateral], [data-menu="recolhido"] [data-lateral] *));
```

Dentro do `@theme`, logo abaixo de `--shadow-drawer`:

```css
  --shadow-drawer-esquerda: 8px 0 32px -8px rgb(15 23 42 / 0.18);
```

- [ ] **Step 7: Conferir tipos, lint e a página**

Run: `npx tsc --noEmit` e `npx eslint lib/menu-lateral.ts app/layout.tsx`
Expected: sem saída, código 0.

Run: `curl -s http://localhost:3000/cnpj | grep -c "radar-pncp-menu-recolhido"`
Expected: `1` ou mais (o script inicial está na página).

- [ ] **Step 8: Checkpoint**

Run: `git diff --stat`. Sem commit.

---

### Task 3: Menu de ferramentas e menu lateral do computador

**Files:**
- Create: `components/MenuFerramentas.tsx`
- Modify: `components/Sidebar.tsx` (reescrito inteiro)
- Modify: `app/(app)/layout.tsx` (reescrito inteiro)
- Test: `$RASCUNHO/nav/comum.mjs` e `$RASCUNHO/nav/nav-desktop.mjs`

**Interfaces:**
- Consumes: `lerEmpresasRecentes`, `lerEmpresasRecentesNoServidor`, `limparEmpresasRecentes`, `inscreverEmpresasRecentes` (Task 1); `definirMenuRecolhido`, `inscreverMenuRecolhido`, `lerMenuRecolhido`, `lerMenuRecolhidoNoServidor` e a variante `menu-recolhido:` (Task 2).
- Produces: `MenuFerramentas({ recolhido?: boolean; onNavegar?: () => void })` (a Task 4 usa na gaveta) e o `<aside data-lateral>` com `button[aria-controls="menu-lateral"]` (rótulo "Recolher menu"/"Expandir menu").

- [ ] **Step 1: Escrever o apoio comum dos roteiros**

Criar `$RASCUNHO/nav/comum.mjs`:

```js
import { cmd, avaliar, esperarTexto, sleep, fim, ouvir } from "../cdp.mjs";

export { cmd, avaliar, esperarTexto, sleep };
export const BASE = "http://localhost:3000";

const erros = [];
ouvir((m) => {
  if (m.method === "Runtime.exceptionThrown") {
    erros.push("exceção: " + (m.params.exceptionDetails?.exception?.description ?? m.params.exceptionDetails?.text));
  }
  if (m.method === "Runtime.consoleAPICalled" && ["error", "warning"].includes(m.params.type)) {
    erros.push(m.params.type + ": " + m.params.args.map((a) => a.value ?? a.description).join(" ").slice(0, 300));
  }
});

const falhas = [];
export function conferir(ok, descricao) {
  console.log(ok ? "ok      " : "FALHOU  ", descricao);
  if (!ok) falhas.push(descricao);
}

export async function tela(largura) {
  await cmd("Emulation.setDeviceMetricsOverride", { width: largura, height: 900, deviceScaleFactor: 1, mobile: largura < 700 });
}

export async function abrir(caminho, esperar = "Radar Licitações") {
  await cmd("Page.navigate", { url: BASE + caminho });
  await esperarTexto(esperar, 60000);
  // Espera o React hidratar: os botões do cabeçalho ganham as props do React.
  for (let i = 0; i < 80; i++) {
    const hidratou = await avaliar(
      `[...document.querySelectorAll("header button")].some((b) => Object.keys(b).some((k) => k.startsWith("__reactProps")))`,
    );
    if (hidratou) break;
    await sleep(250);
  }
  await sleep(300);
}

export async function clicar(seletor) {
  return avaliar(`(() => { const el = document.querySelector(${JSON.stringify(seletor)}); if (!el) return false; el.click(); return true; })()`);
}

export async function clicarBotaoComTexto(dentro, texto) {
  return avaliar(`(() => {
    const b = [...document.querySelectorAll(${JSON.stringify(dentro + " button")})].find((x) => x.textContent.trim() === ${JSON.stringify(texto)});
    if (!b) return false; b.click(); return true;
  })()`);
}

export async function tecla(nome, codigo) {
  for (const type of ["keyDown", "keyUp"]) {
    await cmd("Input.dispatchKeyEvent", { type, key: nome, code: nome, windowsVirtualKeyCode: codigo, nativeVirtualKeyCode: codigo });
  }
}

export function encerrar() {
  conferir(erros.length === 0, "sem erros no console" + (erros.length ? ":\n    " + erros.join("\n    ") : ""));
  fim();
  if (falhas.length) {
    console.log(`\n${falhas.length} falha(s)`);
    process.exitCode = 1;
  } else console.log("\ntudo ok");
}
```

- [ ] **Step 2: Escrever o roteiro do computador**

Criar `$RASCUNHO/nav/nav-desktop.mjs`:

```js
import { avaliar, sleep, conferir, tela, abrir, clicar, encerrar } from "./comum.mjs";

const largura = () => avaliar(`Math.round(document.querySelector("[data-lateral]")?.getBoundingClientRect().width ?? -1)`);

try {
  await tela(1440);
  await abrir("/cnpj");
  await avaliar(`localStorage.removeItem("radar-pncp-menu-recolhido"); delete document.documentElement.dataset.menu; true`);
  await abrir("/cnpj");

  const texto = await avaliar(`document.querySelector("[data-lateral]")?.textContent ?? ""`);
  const [a, b, c] = ["Licitações e dinheiro público", "Empresas e pessoas", "Consultas de apoio"].map((t) => texto.indexOf(t));
  conferir(a >= 0 && a < b && b < c, "os 3 grupos, na ordem");
  conferir(
    await avaliar(`document.querySelectorAll('a[href="/atas"]').length === 1 && !!document.querySelector('[data-lateral] a[href="/atas"]')`),
    "o único link para Atas está no menu lateral (a grade de botões saiu)",
  );
  conferir(await avaliar(`document.querySelector('[data-lateral] a[href="/sinapse"]')?.textContent.includes("Beta")`), "Sinapse com o selo Beta");

  for (const [caminho, nome] of [["/", "Licitações"], ["/cnpj", "CNPJ"], ["/sinapse", "Sinapse"], ["/empenhos-am", "Empenhos"], ["/empenhos-federal", "Empenhos"]]) {
    await abrir(caminho);
    const ativo = await avaliar(`document.querySelector('[data-lateral] a[aria-current="page"]')?.textContent.trim() ?? ""`);
    conferir(ativo.startsWith(nome), `item ativo em ${caminho}: "${ativo}"`);
  }

  conferir((await largura()) === 240, "menu com 240 px");
  conferir(await clicar('[data-lateral] button[aria-label="Recolher menu"]'), "botão Recolher menu");
  await sleep(500);
  conferir((await largura()) === 64, "recolhido com 64 px");
  conferir((await avaliar(`localStorage.getItem("radar-pncp-menu-recolhido")`)) === "1", "escolha guardada");
  conferir(
    await avaliar(`[...document.querySelectorAll("[data-lateral] nav a")].every((a) => a.textContent.trim().length > 0)`),
    "recolhido, todo item mantém o nome acessível",
  );
  conferir((await avaliar(`document.querySelector('[data-lateral] a[href="/cnpj"]').title`)) === "CNPJ", "recolhido, o item tem title");

  await abrir("/cnpj");
  conferir((await largura()) === 64, "continua recolhido depois de recarregar");
  conferir(
    (await avaliar(`document.querySelector('[data-lateral] button[aria-controls="menu-lateral"]').getAttribute("aria-expanded")`)) === "false",
    "aria-expanded=false quando recolhido",
  );
  await clicar('[data-lateral] button[aria-label="Expandir menu"]');
  await sleep(500);
  conferir((await largura()) === 240, "expande de novo");
  conferir((await avaliar(`localStorage.getItem("radar-pncp-menu-recolhido")`)) === null, "expandir apaga a escolha");

  await abrir("/termos-de-uso", "Termos de Uso");
  conferir(await avaliar(`document.querySelector("[data-lateral]") === null`), "Termos de uso sem menu lateral");
} finally {
  encerrar();
}
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `node "$RASCUNHO/nav/nav-desktop.mjs"`
Expected: `FALHOU` em "os 3 grupos, na ordem", "o único link para Atas está no menu lateral", nos itens ativos, em "botão Recolher menu" e nas larguras (ainda não existe `[data-lateral]`), e `N falha(s)` no fim.

- [ ] **Step 4: Criar `components/MenuFerramentas.tsx`**

```tsx
"use client";

import { useId, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  FileStack,
  Handshake,
  HeartPulse,
  Landmark,
  MapPin,
  Network,
  Receipt,
  Search,
  ShieldAlert,
  Tag,
  Tags,
  UserRound,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/cn";
import {
  inscreverEmpresasRecentes,
  lerEmpresasRecentes,
  lerEmpresasRecentesNoServidor,
  limparEmpresasRecentes,
} from "@/lib/empresas-recentes";
import { formatarCnpj } from "@/lib/formatters";

interface ItemMenu {
  href: string;
  label: string;
  icone: LucideIcon;
  ativoEm?: string[];
  beta?: boolean;
}

const GRUPOS: { titulo: string; itens: ItemMenu[] }[] = [
  {
    titulo: "Licitações e dinheiro público",
    itens: [
      { href: "/", label: "Licitações", icone: Search },
      { href: "/atas", label: "Atas", icone: FileStack },
      // As duas telas de empenhos (Amazonas e federal) têm abas entre si.
      { href: "/empenhos-am", label: "Empenhos", icone: Receipt, ativoEm: ["/empenhos-am", "/empenhos-federal"] },
      { href: "/convenios", label: "Convênios", icone: Handshake },
      { href: "/emendas", label: "Emendas", icone: Landmark },
    ],
  },
  {
    titulo: "Empresas e pessoas",
    itens: [
      { href: "/cnpj", label: "CNPJ", icone: Building2 },
      { href: "/cpf", label: "CPF", icone: UserRound },
      { href: "/sancoes", label: "Sanções", icone: ShieldAlert },
      { href: "/sinapse", label: "Sinapse", icone: Network, beta: true },
    ],
  },
  {
    titulo: "Consultas de apoio",
    itens: [
      { href: "/cep", label: "CEP", icone: MapPin },
      { href: "/ncm", label: "NCM", icone: Tag },
      { href: "/produtos-saude", label: "Produtos p/ Saúde", icone: HeartPulse },
      { href: "/nome-tecnico", label: "Nome Técnico", icone: Tags },
    ],
  },
];

interface MenuFerramentasProps {
  /** Só põe o nome no `title` de cada item; o que some e a largura vêm da variante menu-recolhido (CSS). */
  recolhido?: boolean;
  /** A gaveta do celular fecha ao escolher uma tela. */
  onNavegar?: () => void;
}

/** As ferramentas em grupos e as empresas recentes — o mesmo menu no lateral do computador e na gaveta do celular. */
export function MenuFerramentas({ recolhido = false, onNavegar }: MenuFerramentasProps) {
  const pathname = usePathname();
  const id = useId();
  const recentes = useSyncExternalStore(inscreverEmpresasRecentes, lerEmpresasRecentes, lerEmpresasRecentesNoServidor);

  return (
    <div className="flex flex-col gap-6">
      <nav aria-label="Navegação principal" className="flex flex-col gap-5 menu-recolhido:gap-3">
        {GRUPOS.map((grupo, i) => (
          <div key={grupo.titulo}>
            {i > 0 && <div className="mx-2 mb-3 hidden border-t border-ink-200 dark:border-ink-700 menu-recolhido:block" aria-hidden />}
            <p
              id={`${id}-grupo-${i}`}
              className="mb-1.5 px-3 text-xs font-medium uppercase tracking-wide text-ink-500 dark:text-ink-400 menu-recolhido:sr-only"
            >
              {grupo.titulo}
            </p>
            <ul aria-labelledby={`${id}-grupo-${i}`} className="space-y-0.5">
              {grupo.itens.map(({ href, label, icone: Icone, ativoEm, beta }) => {
                const ativo = ativoEm ? ativoEm.includes(pathname) : pathname === href;
                return (
                  <li key={href}>
                    <Link
                      href={href}
                      onClick={onNavegar}
                      aria-current={ativo ? "page" : undefined}
                      title={recolhido ? label : undefined}
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                        "menu-recolhido:justify-center menu-recolhido:px-0",
                        ativo
                          ? "bg-primary-50 text-primary-700 dark:bg-primary-900 dark:text-primary-300"
                          : "text-ink-600 hover:bg-ink-100 hover:text-ink-900 dark:text-ink-300 dark:hover:bg-ink-800 dark:hover:text-ink-50",
                      )}
                    >
                      <Icone className="h-4 w-4 shrink-0" aria-hidden />
                      <span className="truncate menu-recolhido:sr-only">{label}</span>
                      {beta && (
                        <Badge tone="accent" className="ml-auto menu-recolhido:hidden">
                          Beta
                        </Badge>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {recentes.length > 0 && (
        <section aria-labelledby={`${id}-recentes`} className="menu-recolhido:hidden">
          <div className="flex items-center justify-between px-3">
            <h2 id={`${id}-recentes`} className="text-xs font-medium uppercase tracking-wide text-ink-500 dark:text-ink-400">
              Consultas recentes
            </h2>
            <button
              type="button"
              onClick={limparEmpresasRecentes}
              className="rounded text-xs font-medium text-ink-500 hover:text-ink-900 dark:text-ink-400 dark:hover:text-ink-50"
            >
              Limpar
            </button>
          </div>
          <ul className="mt-1.5 space-y-0.5">
            {recentes.map((e) => (
              <li key={e.cnpj}>
                <Link
                  href={`/cnpj?cnpj=${e.cnpj}`}
                  onClick={onNavegar}
                  className="block rounded-lg px-3 py-1.5 hover:bg-ink-100 dark:hover:bg-ink-800"
                >
                  <span className="block truncate text-sm text-ink-800 dark:text-ink-100">{e.nome}</span>
                  <span className="block text-xs tabular-nums text-ink-500 dark:text-ink-400">{formatarCnpj(e.cnpj)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
```

Conferir antes de seguir que `Badge` aceita `className` (`components/ui/Badge.tsx:22` desestrutura `className`) e que `formatarCnpj` está em `lib/formatters.ts:66`.

- [ ] **Step 5: Reescrever `components/Sidebar.tsx`**

```tsx
"use client";

import { useSyncExternalStore } from "react";
import { ChevronsLeft } from "lucide-react";
import { MenuFerramentas } from "@/components/MenuFerramentas";
import {
  definirMenuRecolhido,
  inscreverMenuRecolhido,
  lerMenuRecolhido,
  lerMenuRecolhidoNoServidor,
} from "@/lib/menu-lateral";

/**
 * Menu lateral do computador (a partir de 1024 px). Abaixo disso o mesmo
 * menu abre na gaveta do cabeçalho (components/Header.tsx). A largura do
 * modo recolhido vem do CSS (variante menu-recolhido); o estado aqui só
 * serve pro aria-expanded, o rótulo do botão e o title dos itens.
 */
export function Sidebar() {
  const recolhido = useSyncExternalStore(inscreverMenuRecolhido, lerMenuRecolhido, lerMenuRecolhidoNoServidor);
  const rotulo = recolhido ? "Expandir menu" : "Recolher menu";

  return (
    <aside
      data-lateral
      className="scrollbar-fina hidden w-60 shrink-0 self-start overflow-y-auto border-r border-ink-200 bg-white transition-[width] duration-200 dark:border-ink-700 dark:bg-ink-900 lg:sticky lg:top-14 lg:block lg:h-[calc(100dvh-3.5rem)] menu-recolhido:w-16"
    >
      <div className="flex justify-end px-2 pt-3 menu-recolhido:justify-center">
        <button
          type="button"
          onClick={() => definirMenuRecolhido(!recolhido)}
          aria-expanded={!recolhido}
          aria-controls="menu-lateral"
          aria-label={rotulo}
          title={rotulo}
          className="rounded-lg p-1.5 text-ink-500 hover:bg-ink-100 hover:text-ink-700 dark:text-ink-400 dark:hover:bg-ink-800 dark:hover:text-ink-200"
        >
          <ChevronsLeft className="h-4 w-4 transition-transform menu-recolhido:rotate-180" aria-hidden />
        </button>
      </div>
      <div id="menu-lateral" className="px-3 pb-6 menu-recolhido:px-2">
        <MenuFerramentas recolhido={recolhido} />
      </div>
    </aside>
  );
}
```

- [ ] **Step 6: Reescrever `app/(app)/layout.tsx`**

```tsx
import type { ReactNode } from "react";
import { Sidebar } from "@/components/Sidebar";

/** Ferramentas: menu lateral à esquerda (só no computador) e a tela à direita. */
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex">
      <Sidebar />
      <div className="min-w-0 flex-1">
        <div className="mx-auto max-w-7xl">{children}</div>
      </div>
    </div>
  );
}
```

- [ ] **Step 7: Rodar e ver passar**

Run: `npx tsc --noEmit` e `npx eslint components/MenuFerramentas.tsx components/Sidebar.tsx "app/(app)/layout.tsx"`
Expected: sem saída, código 0.

Run: `node "$RASCUNHO/nav/nav-desktop.mjs"`
Expected: todas as linhas `ok`, inclusive "sem erros no console", e `tudo ok` no fim.

- [ ] **Step 8: Checkpoint**

Run: `git diff --stat`. Sem commit.

---

### Task 4: Gaveta do celular e barra do topo

**Files:**
- Modify: `components/ui/Drawer.tsx` (prop `lado`)
- Modify: `components/Header.tsx` (reescrito inteiro)
- Test: `$RASCUNHO/nav/nav-celular.mjs`

**Interfaces:**
- Consumes: `MenuFerramentas({ onNavegar })` (Task 3); `shadow-drawer-esquerda` (Task 2); `StatusServicos variante="linha"`, `ThemeToggle variante="linha"` (já existem).
- Produces: `Drawer` com `lado?: "direita" | "esquerda"` (padrão `"direita"`); no cabeçalho, `button[aria-label="Abrir menu"]` e o logo como `a[href="/"]`.

- [ ] **Step 1: Escrever o roteiro do celular**

Criar `$RASCUNHO/nav/nav-celular.mjs`:

```js
import { avaliar, sleep, conferir, tela, abrir, clicar, tecla, encerrar } from "./comum.mjs";

const gaveta = () =>
  avaliar(`(() => {
    const d = document.querySelector('[role="dialog"]');
    if (!d) return null;
    const r = d.getBoundingClientRect();
    return { esquerda: Math.round(r.left), largura: Math.round(r.width), altura: Math.round(r.height), texto: d.textContent };
  })()`);

try {
  await tela(390);
  await abrir("/cnpj");
  conferir((await avaliar(`getComputedStyle(document.querySelector("[data-lateral]")).display`)) === "none", "menu lateral escondido no celular");
  conferir(await avaliar(`!!document.querySelector('header a[href="/"]')`), "logo leva para a tela inicial");
  conferir(await clicar('header button[aria-label="Abrir menu"]'), "botão ☰");
  await sleep(300);

  const caixa = await gaveta();
  conferir(
    caixa?.esquerda === 0 && caixa.largura <= 320 && caixa.altura === 900,
    `gaveta pela esquerda, altura da tela toda (${JSON.stringify(caixa && { ...caixa, texto: undefined })})`,
  );
  conferir(
    ["Licitações e dinheiro público", "Empresas e pessoas", "Consultas de apoio", "Status dos serviços", "Ajuda", "Modo escuro"].every((t) =>
      caixa?.texto.includes(t),
    ),
    "gaveta com os grupos, status, ajuda e tema",
  );
  conferir(await avaliar(`document.activeElement?.closest('[role="dialog"]') !== null`), "foco dentro da gaveta");

  await tecla("Escape", 27);
  await sleep(200);
  conferir((await gaveta()) === null, "Esc fecha a gaveta");

  await clicar('header button[aria-label="Abrir menu"]');
  await sleep(300);
  await clicar('[role="dialog"] a[href="/sancoes"]');
  await sleep(2000);
  conferir((await avaliar("location.pathname")) === "/sancoes", "escolher Sanções navega");
  conferir((await gaveta()) === null, "e fecha a gaveta");

  await clicar('header button[aria-label="Abrir menu"]');
  await sleep(300);
  await clicar('[role="dialog"] a[href="/sancoes"]');
  await sleep(500);
  conferir((await gaveta()) === null, "escolher a tela em que já está também fecha");

  await tela(1440);
  await sleep(300);
  conferir(
    (await avaliar(`getComputedStyle(document.querySelector('header button[aria-label="Abrir menu"]')).display`)) === "none",
    "☰ some no computador",
  );
} finally {
  encerrar();
}
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `node "$RASCUNHO/nav/nav-celular.mjs"`
Expected: `FALHOU` em "logo leva para a tela inicial", "botão ☰" e nas conferências da gaveta.

- [ ] **Step 3: Prop `lado` no `components/ui/Drawer.tsx`**

Na interface:

```ts
interface DrawerProps {
  aberto: boolean;
  onFechar: () => void;
  titulo: string;
  children: ReactNode;
  rodape?: ReactNode;
  /** De que lado o painel entra. Detalhes abrem pela direita; o menu do celular, pela esquerda. */
  lado?: "direita" | "esquerda";
}
```

Na assinatura: `export function Drawer({ aberto, onFechar, titulo, children, rodape, lado = "direita" }: DrawerProps) {`

No JSX, trocar o container e o painel:

```tsx
    <div className={cn("fixed inset-0 z-50 flex", lado === "esquerda" ? "justify-start" : "justify-end")}>
```

```tsx
        className={cn(
          "relative flex h-full w-full flex-col bg-white outline-none dark:bg-ink-900",
          lado === "esquerda" ? "max-w-xs shadow-drawer-esquerda" : "shadow-drawer sm:max-w-lg",
        )}
```

(Com `lado="direita"` as classes ficam as mesmas de hoje: as gavetas das licitações e dos produtos para saúde não mudam.)

- [ ] **Step 4: Reescrever `components/Header.tsx`**

`DICAS_AJUDA`, `PopoverAjuda`, `inscreverRelogio`, `lerAgora`, `lerAgoraNoServidor` e `RelogioBrasilia` ficam exatamente como estão (linhas 11–80 do arquivo atual). Mudam os imports, entra `RodapeGaveta` e o `Header` é substituído:

```tsx
"use client";

import { useCallback, useRef, useState, useSyncExternalStore } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronDown, ChevronUp, CircleHelp, Clock, Menu } from "lucide-react";
import { useClickOutside } from "@/lib/hooks/useClickOutside";
import { MenuFerramentas } from "@/components/MenuFerramentas";
import { Drawer } from "@/components/ui/Drawer";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { StatusServicos } from "@/components/ui/StatusServicos";
import { formatarDataHoraCurta } from "@/lib/formatters";

// ... DICAS_AJUDA, PopoverAjuda, relógio: sem mudança ...

/** O pé da gaveta: o que no computador fica à direita da barra do topo. */
function RodapeGaveta() {
  const [ajudaAberta, setAjudaAberta] = useState(false);

  return (
    <div className="space-y-3">
      <StatusServicos variante="linha" />
      <div className="border-t border-ink-100 pt-3 dark:border-ink-800">
        <button
          type="button"
          onClick={() => setAjudaAberta((v) => !v)}
          aria-expanded={ajudaAberta}
          className="flex w-full items-center justify-between text-sm font-medium text-ink-700 dark:text-ink-200"
        >
          <span className="inline-flex items-center gap-2">
            <CircleHelp className="h-5 w-5 text-ink-500 dark:text-ink-400" aria-hidden />
            Ajuda
          </span>
          {ajudaAberta ? (
            <ChevronUp className="h-4 w-4 text-ink-400 dark:text-ink-500" aria-hidden />
          ) : (
            <ChevronDown className="h-4 w-4 text-ink-400 dark:text-ink-500" aria-hidden />
          )}
        </button>
        {ajudaAberta && (
          <ul className="mt-2 space-y-2 text-sm text-ink-600 dark:text-ink-300">
            {DICAS_AJUDA.map((dica) => (
              <li key={dica}>{dica}</li>
            ))}
          </ul>
        )}
      </div>
      <div className="border-t border-ink-100 pt-3 dark:border-ink-800">
        <ThemeToggle variante="linha" />
      </div>
    </div>
  );
}

export function Header() {
  const [gavetaAberta, setGavetaAberta] = useState(false);
  // Estável entre renderizações: o Drawer refaz o efeito de foco quando `onFechar` muda.
  const fecharGaveta = useCallback(() => setGavetaAberta(false), []);

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-ink-200 bg-white/95 backdrop-blur dark:border-ink-700 dark:bg-ink-900/95">
        <div className="flex h-14 items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-1">
            <button
              type="button"
              className="-ml-2 rounded-lg p-2 text-ink-600 hover:bg-ink-100 dark:text-ink-300 dark:hover:bg-ink-800 lg:hidden"
              aria-label="Abrir menu"
              aria-expanded={gavetaAberta}
              onClick={() => setGavetaAberta(true)}
            >
              <Menu className="h-5 w-5" aria-hidden />
            </button>
            <Link href="/" className="flex min-w-0 items-center gap-3 rounded-lg">
              <Image src="/logo.png" alt="" width={32} height={32} className="h-8 w-8 shrink-0" priority />
              <div className="min-w-0 leading-tight">
                <p className="truncate text-base font-semibold tracking-tight text-ink-900 dark:text-ink-50">
                  Radar Licitações
                </p>
                <p className="hidden truncate text-xs text-ink-500 dark:text-ink-400 sm:block">
                  Pesquisa inteligente de licitações públicas
                </p>
              </div>
            </Link>
          </div>

          <div className="hidden items-center gap-2 sm:flex">
            <StatusServicos />
            <RelogioBrasilia />
            <PopoverAjuda />
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Fora do <header>: o backdrop-blur dele prenderia o position: fixed da gaveta dentro dos 56 px da barra. */}
      <Drawer aberto={gavetaAberta} onFechar={fecharGaveta} titulo="Menu" lado="esquerda" rodape={<RodapeGaveta />}>
        <MenuFerramentas onNavegar={fecharGaveta} />
      </Drawer>
    </>
  );
}
```

- [ ] **Step 5: Rodar e ver passar**

Run: `npx tsc --noEmit` e `npx eslint components/Header.tsx components/ui/Drawer.tsx`
Expected: sem saída, código 0.

Run: `node "$RASCUNHO/nav/nav-celular.mjs"` e de novo `node "$RASCUNHO/nav/nav-desktop.mjs"`
Expected: `tudo ok` nos dois.

- [ ] **Step 6: Checkpoint**

Run: `git diff --stat`. Sem commit.

---

### Task 5: Tela de CNPJ grava as recentes, e a política de privacidade diz isso

**Files:**
- Modify: `components/CnpjClient.tsx` (import; `executarConsulta` ~linha 462; efeito novo depois do efeito da consulta ~linha 503)
- Modify: `app/politica-de-privacidade/page.tsx` (seções 3 e 4, `ATUALIZADO_EM`)
- Test: `$RASCUNHO/nav/recentes.mjs`

**Interfaces:**
- Consumes: `registrarEmpresaRecente({ cnpj, nome })` (Task 1); o menu das Tasks 3 e 4.
- Produces: nada que outra task use.

- [ ] **Step 1: Escrever o roteiro das recentes**

Criar `$RASCUNHO/nav/recentes.mjs`:

```js
import { cmd, avaliar, sleep, conferir, tela, abrir, clicar, clicarBotaoComTexto, encerrar } from "./comum.mjs";

const SAMSUNG = "00280273000137";
const IF = "54464211000104";

const recentes = () =>
  avaliar(`[...document.querySelectorAll('[data-lateral] a[href^="/cnpj?cnpj="]')].map((a) => a.getAttribute("href").split("=")[1])`);
const noConteudo = async (trecho) => {
  for (let i = 0; i < 120; i++) {
    if (await avaliar(`(document.querySelector("[data-lateral] + div")?.innerText ?? "").includes(${JSON.stringify(trecho)})`)) return true;
    await sleep(500);
  }
  return false;
};
const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);

try {
  await tela(1440);
  await abrir("/cnpj");
  await avaliar(`localStorage.removeItem("radar-pncp-empresas-recentes"); true`);
  await abrir("/cnpj");
  conferir(!(await avaliar(`document.querySelector("[data-lateral]").textContent.includes("Consultas recentes")`)), "sem recentes, a seção não aparece");

  await abrir(`/cnpj?cnpj=${SAMSUNG}`);
  conferir(await noConteudo("SAMSUNG"), "consulta da Samsung carregou");
  await sleep(500);
  conferir(igual(await recentes(), [SAMSUNG]), "Samsung entrou nas recentes");
  conferir(await avaliar(`document.querySelector("[data-lateral]").textContent.includes("00.280.273/0001-37")`), "CNPJ formatado nas recentes");

  await abrir(`/cnpj?cnpj=${IF}`);
  conferir(await noConteudo("I F INSTALACOES"), "consulta da I F carregou");
  await sleep(500);
  conferir(igual(await recentes(), [IF, SAMSUNG]), "a mais nova primeiro");

  // Com a tela de CNPJ aberta, o clique na recente só muda a URL: a tela tem que consultar de novo.
  await clicar(`[data-lateral] a[href="/cnpj?cnpj=${SAMSUNG}"]`);
  conferir(await noConteudo("SAMSUNG ELETRONICA"), "clicar numa recente consulta a empresa");
  conferir((await avaliar(`document.querySelector("[data-lateral] + div input")?.value`)) === "00.280.273/0001-37", "o campo mostra o CNPJ clicado");
  await sleep(500);
  conferir(igual(await recentes(), [SAMSUNG, IF]), "consultar de novo não repete e sobe para o topo");

  conferir(await clicarBotaoComTexto("[data-lateral]", "Limpar"), "botão Limpar");
  await sleep(300);
  conferir(!(await avaliar(`document.querySelector("[data-lateral]").textContent.includes("Consultas recentes")`)), "Limpar esvazia e a seção some");
  conferir((await avaliar(`localStorage.getItem("radar-pncp-empresas-recentes")`)) === null, "e apaga a chave");

  // Armazenamento bloqueado (aba anônima, política do navegador): nada quebra.
  const { result } = await cmd("Page.addScriptToEvaluateOnNewDocument", {
    source: `for (const m of ["getItem", "setItem", "removeItem"]) Storage.prototype[m] = () => { throw new DOMException("bloqueado", "SecurityError"); };`,
  });
  await abrir(`/cnpj?cnpj=${SAMSUNG}`);
  conferir(await noConteudo("SAMSUNG"), "armazenamento bloqueado: a consulta funciona");
  conferir(!(await avaliar(`document.querySelector("[data-lateral]").textContent.includes("Consultas recentes")`)), "armazenamento bloqueado: sem recentes");
  await clicar('[data-lateral] button[aria-label="Recolher menu"]');
  await sleep(500);
  conferir((await avaliar(`Math.round(document.querySelector("[data-lateral]").getBoundingClientRect().width)`)) === 64, "armazenamento bloqueado: recolher funciona na sessão");
  await cmd("Page.removeScriptToEvaluateOnNewDocument", { identifier: result.identifier });
  await abrir("/cnpj");
  await avaliar(`localStorage.removeItem("radar-pncp-menu-recolhido"); true`);
} finally {
  encerrar();
}
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `node "$RASCUNHO/nav/recentes.mjs"`
Expected: `FALHOU` em "Samsung entrou nas recentes" e nas seguintes das recentes.

- [ ] **Step 3: Gravar a recente em `components/CnpjClient.tsx`**

Import novo, junto dos de `@/lib`:

```ts
import { registrarEmpresaRecente } from "@/lib/empresas-recentes";
```

Em `executarConsulta`, dentro de `if (resultado.status === "sucesso") {`, logo depois de `setStatus("sucesso");`:

```ts
      // Pro menu lateral (Consultas recentes). Fica só no navegador; CPF nunca vai pra lá.
      registrarEmpresaRecente({
        cnpj: resultado.empresa.cnpj,
        nome: resultado.empresa.nomeFantasia || resultado.empresa.razaoSocial,
      });
```

- [ ] **Step 4: Consultar de novo quando o `?cnpj=` muda com a tela aberta**

Junto das outras refs (depois de `const abortRef = useRef<AbortController | null>(null);`):

```ts
  // Último CNPJ (14 dígitos) consultado, pra distinguir a URL que a própria tela
  // atualizou de um link para outra empresa com a tela já aberta.
  const ultimoConsultadoRef = useRef<string | null>(null);
  const cnpjDaUrl = searchParams.get("cnpj");
```

No efeito da consulta existente, trocar

```ts
    const validacao = validarCnpj(consulta.cnpj);
    if (validacao.valido) router.replace(`${pathname}?cnpj=${validacao.cnpj}`, { scroll: false });
```

por

```ts
    const validacao = validarCnpj(consulta.cnpj);
    if (validacao.valido) {
      ultimoConsultadoRef.current = validacao.cnpj;
      router.replace(`${pathname}?cnpj=${validacao.cnpj}`, { scroll: false });
    }
```

E logo depois desse efeito (antes do efeito que aborta ao desmontar), o efeito novo:

```ts
  // Um link para outra empresa com esta tela aberta (as Consultas recentes do
  // menu lateral) muda só a URL, sem montar a tela de novo: consulta daqui.
  useEffect(() => {
    if (!cnpjDaUrl) return;
    const validacao = validarCnpj(cnpjDaUrl);
    if (!validacao.valido || validacao.cnpj === ultimoConsultadoRef.current) return;
    /* eslint-disable react-hooks/set-state-in-effect -- acompanhar a URL, que muda por fora da tela, é o papel deste efeito. */
    setValor(mascararCnpj(validacao.cnpj));
    setConsulta({ cnpj: validacao.cnpj });
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [cnpjDaUrl]);
```

(Os efeitos rodam na ordem em que aparecem: na montagem, o da consulta marca `ultimoConsultadoRef` antes deste olhar a URL, então a primeira consulta não se repete. `mascararCnpj` já é importado no arquivo.)

- [ ] **Step 5: Atualizar a política de privacidade**

Em `app/politica-de-privacidade/page.tsx`, trocar `const ATUALIZADO_EM = "22 de setembro de 2026";` por:

```ts
const ATUALIZADO_EM = "29 de setembro de 2026";
```

Trocar a seção 3 inteira por:

```tsx
      <SecaoLegal titulo="3. Armazenamento local no seu navegador">
        <p>
          Três informações podem ficar guardadas no armazenamento local do seu navegador (localStorage), só no
          seu dispositivo: a escolha entre modo claro e escuro, se o menu lateral está recolhido e as últimas
          5 empresas consultadas na tela de CNPJ (CNPJ e nome da empresa), para você voltar a elas pelo menu.
          CPFs consultados nunca são guardados. Essas informações nunca são enviadas aos nossos servidores. A
          lista de empresas pode ser apagada pelo botão &quot;Limpar&quot; no menu, e tudo pode ser apagado a
          qualquer momento limpando os dados do site no navegador.
        </p>
      </SecaoLegal>
```

E trocar a seção 4 inteira por:

```tsx
      <SecaoLegal titulo="4. Cookies">
        <p>
          Não utilizamos cookies de rastreamento, publicidade ou análise de comportamento. Tudo o que fica
          guardado no seu navegador é o que está descrito acima.
        </p>
      </SecaoLegal>
```

- [ ] **Step 6: Rodar e ver passar**

Run: `npx tsc --noEmit` e `npx eslint components/CnpjClient.tsx app/politica-de-privacidade/page.tsx`
Expected: sem saída, código 0.

Run: `node "$RASCUNHO/nav/recentes.mjs"`
Expected: `tudo ok`. Se "sem erros no console" falhar só na parte do armazenamento bloqueado, ler a mensagem: erro vindo do próprio Next (overlay de desenvolvimento) não é do app; erro vindo de `lib/` ou `components/` é bug e tem que ser corrigido.

- [ ] **Step 7: Checkpoint**

Run: `git diff --stat`. Sem commit.

---

### Task 6: README e verificação final

**Files:**
- Modify: `README.md:25`
- Test: `$RASCUNHO/nav/gaveta-direita.mjs` e os roteiros das Tasks 3–5

**Interfaces:**
- Consumes: tudo das Tasks 1–5.
- Produces: nada.

- [ ] **Step 1: README**

Depois da linha `- Modo claro/escuro com preferência salva no navegador`, acrescentar:

```md
- Menu lateral com as ferramentas em grupos (recolhível no computador, em gaveta no celular) e as últimas empresas consultadas, guardadas só no navegador
```

- [ ] **Step 2: Roteiro da gaveta pela direita (não pode ter mudado)**

Criar `$RASCUNHO/nav/gaveta-direita.mjs`:

```js
import { avaliar, sleep, conferir, tela, abrir, clicarBotaoComTexto, encerrar } from "./comum.mjs";

try {
  await tela(1440);
  await abrir("/produtos-saude", "Consultar produtos para saúde");
  await avaliar(`(() => {
    const i = document.querySelector('input[placeholder^="Ex.: cateter"]');
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(i, "cateter");
    i.dispatchEvent(new Event("input", { bubbles: true }));
    i.form.requestSubmit();
    return true;
  })()`);
  let achou = false;
  for (let i = 0; i < 60 && !achou; i++) {
    achou = await clicarBotaoComTexto("main", "Ver detalhes");
    if (!achou) await sleep(500);
  }
  conferir(achou, "resultado com Ver detalhes");
  await sleep(500);
  const caixa = await avaliar(`(() => { const r = document.querySelector('[role="dialog"]')?.getBoundingClientRect(); return r && { direita: Math.round(r.right), largura: Math.round(r.width) }; })()`);
  conferir(caixa?.direita === 1440 && caixa.largura === 512, `detalhes continuam pela direita, 512 px (${JSON.stringify(caixa)})`);
} finally {
  encerrar();
}
```

- [ ] **Step 3: Tudo junto**

Run: `node --test "$RASCUNHO/nav/empresas-recentes.test.ts" "$RASCUNHO/nav/menu-lateral.test.ts"`
Expected: `pass 15`, `fail 0`.

Run: `node "$RASCUNHO/nav/nav-desktop.mjs"`, `node "$RASCUNHO/nav/nav-celular.mjs"`, `node "$RASCUNHO/nav/recentes.mjs"`, `node "$RASCUNHO/nav/gaveta-direita.mjs"`
Expected: `tudo ok` nos quatro.

Run: `npx tsc --noEmit`, `npx eslint` e `npx next build`
Expected: sem erros; o build lista as rotas de sempre.

- [ ] **Step 4: Conferência visual**

Tirar prints (com o `foto` dos roteiros antigos, ex.: `roteiro21.mjs`) de `/cnpj` e `/sinapse` em 1440 px (claro, escuro e recolhido) e de `/cnpj` em 390 px com a gaveta aberta, e de `/termos-de-uso` em 1440 px. Olhar cada um: menu alinhado, item ativo legível nos dois temas, nada encavalado com a barra do topo, Termos de uso igual a antes.

- [ ] **Step 5: Checkpoint e relatório**

Run: `git status --short` e `git diff --stat`.
Relatar ao usuário o que mudou, o que foi testado e o resultado. Perguntar se quer commit e push — sem fazer nenhum dos dois antes da resposta.
