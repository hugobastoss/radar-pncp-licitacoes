# Navegação lateral no estilo do cnpja.com

Data: 29/09/2026 · Situação: aguardando revisão

## Objetivo

Trocar a grade de 13 botões que fica em cima de cada tela por uma navegação no estilo do cnpja.com: barra fina no topo e menu lateral com as ferramentas em grupos, mais uma seção de empresas consultadas recentemente.

Só a estrutura de navegação muda. Cores, tipografia, cartões e o conteúdo das telas continuam como estão. Não copiamos a marca do cnpja (logo, nome, ilustrações).

**Pronto quando:** em qualquer uma das 13 ferramentas, dá para ir para outra pelo menu lateral (no computador) ou pela gaveta (tablet e celular), e a grade de botões não existe mais.

## Fora do escopo

- Busca global no topo (Ctrl+K): descartada.
- Menus suspensos na barra do topo: descartados, duplicariam o menu lateral.
- Mudanças de cores, fonte ou layout interno das telas.
- Menu lateral nas páginas de Termos de uso e Política de privacidade: elas continuam sem ele (a barra do topo com o ☰ aparece nelas no celular, como em todo o site).

## Estrutura da tela

### Computador (largura ≥ 1024 px)

- **Barra do topo:** 56 px de altura (hoje são 64), largura total, fixa ao rolar (como hoje). À esquerda, logo e "Radar Licitações" (o subtítulo continua), agora como link para a tela inicial. À direita, os utilitários de hoje: status dos serviços, relógio de Brasília, ajuda e tema.
- **Menu lateral:** coluna de 240 px encostada à esquerda, abaixo da barra do topo, fixa ao rolar a página (`sticky`), com rolagem própria se passar da altura da tela. Borda à direita separando do conteúdo.
- **Conteúdo:** ocupa o resto da largura. As telas mantêm o próprio espaçamento interno.
- **Recolher:** um botão com seta no topo do menu reduz a coluna a 64 px, só com os ícones (o nome vira `title` e `aria-label`). A escolha fica guardada no navegador e vale para as próximas visitas.
- **Rodapé:** continua onde está, embaixo de tudo, na largura toda.

### Tablet e celular (largura < 1024 px)

- O menu lateral não aparece.
- A barra do topo ganha um botão ☰ à esquerda do logo, que abre uma gaveta pela esquerda.
- A gaveta tem o mesmo menu (grupos e recentes) e, no pé, o status dos serviços, a ajuda e o tema (o que hoje fica no menu suspenso do celular, que deixa de existir).
- A gaveta fecha ao escolher uma tela, com Esc, no X ou tocando fora. O foco fica preso nela enquanto está aberta (comportamento que o `Drawer` já tem).

## Menu

Três grupos, cada um com um título pequeno em caixa alta:

| Grupo | Ferramentas (nesta ordem) |
|---|---|
| Licitações e dinheiro público | Licitações (`/`), Atas, Empenhos, Convênios, Emendas |
| Empresas e pessoas | CNPJ, CPF, Sanções, Sinapse |
| Consultas de apoio | CEP, NCM, Produtos p/ Saúde, Nome Técnico |

- Cada item: ícone (os mesmos de hoje) e nome.
- Item ativo: fundo e texto azuis, com as cores de hoje (`bg-primary-50 text-primary-700`, e no escuro `bg-primary-900 text-primary-300`), e `aria-current="page"`.
- "Empenhos" fica ativo em `/empenhos-am` e `/empenhos-federal`, como hoje.
- Sinapse mantém o selo "Beta".
- Com o menu recolhido, os títulos dos grupos viram uma linha divisória.

## Consultas recentes

- Seção "Consultas recentes" abaixo dos grupos, com até 5 empresas, a mais nova primeiro.
- Cada linha: nome (uma linha, cortado com reticências) e CNPJ formatado embaixo. O clique abre `/cnpj?cnpj=<14 dígitos>`, que já consulta ao carregar.
- Botão "Limpar" apaga a lista.
- Sem empresas guardadas, a seção não aparece. Com o menu recolhido, também não aparece.
- **Quando grava:** na tela de CNPJ, quando o cadastro da empresa chega com sucesso. Nome gravado: nome fantasia, ou a razão social se não houver.
- **Só empresas.** CPF nunca é gravado (LGPD). Outras telas não gravam nada.
- Consultar de novo uma empresa que já está na lista a leva para o topo, sem repetir.

## Peças

| Arquivo | O que muda |
|---|---|
| `components/MenuFerramentas.tsx` (novo) | Único lugar que define os grupos e itens. Desenha os grupos e as recentes. Props: `recolhido?: boolean` (só põe o `title` com o nome em cada item; o que some e a largura vêm do CSS) e `onNavegar?: () => void` (a gaveta usa para fechar). |
| `components/Sidebar.tsx` | Reescrito: vira o menu lateral do computador (`hidden lg:block`, com o atributo `data-lateral`), com o botão de recolher e o `MenuFerramentas`. |
| `components/Header.tsx` | Largura total (sai o `max-w-7xl`). Ganha o ☰ (`lg:hidden`) e a gaveta com `MenuFerramentas` e, no rodapé da gaveta, `StatusServicos variante="linha"`, as dicas de ajuda e `ThemeToggle variante="linha"`. Sai o menu suspenso do celular. |
| `components/ui/Drawer.tsx` | Nova prop `lado?: "direita" \| "esquerda"` (padrão `"direita"`, então a gaveta de filtros das licitações não muda). Pela esquerda: painel encostado à esquerda, largura máxima de 20rem e sombra espelhada. |
| `app/(app)/layout.tsx` | Duas colunas no computador: `Sidebar` e o conteúdo. Sai o `mx-auto max-w-7xl` que centralizava a grade. |
| `lib/empresas-recentes.ts` (novo) | `lerEmpresasRecentes()`, `registrarEmpresaRecente({ cnpj, nome })`, `limparEmpresasRecentes()` e `inscreverEmpresasRecentes(callback)`. Chave `radar-pncp-empresas-recentes`. |
| `lib/menu-lateral.ts` (novo) | Chave `radar-pncp-menu-recolhido`, leitura/gravação/inscrição e `SCRIPT_INICIALIZACAO_MENU`, que aplica `data-menu="recolhido"` no `<html>` antes da hidratação. |
| `app/layout.tsx` | O `<Script id="tema-inicial">` passa a rodar `SCRIPT_INICIALIZACAO_TEMA + SCRIPT_INICIALIZACAO_MENU` (um script só, sem criar outro). |
| `app/globals.css` | Variante `menu-recolhido`: `@custom-variant menu-recolhido (&:where([data-menu="recolhido"] [data-lateral], [data-menu="recolhido"] [data-lateral] *));`. Vale só dentro do menu lateral, então a gaveta nunca fica recolhida. Com ela: largura de 64 px, nomes em `sr-only` (o nome acessível continua), títulos de grupo viram divisória, recentes somem. |
| `components/CnpjClient.tsx` | Uma chamada a `registrarEmpresaRecente` quando `buscarEmpresa` volta com sucesso. E passa a consultar de novo quando o `?cnpj=` da URL muda com a tela já aberta (hoje só lê a URL ao montar), senão clicar numa recente estando na tela de CNPJ não faria nada. |
| `app/politica-de-privacidade/page.tsx` | As seções 3 e 4 dizem que o único dado guardado no navegador é o tema. Passam a citar também o menu recolhido e as empresas recentes (só CNPJ e nome, nunca CPF, nunca enviados ao servidor, apagáveis pelo "Limpar"). Data de atualização: 29 de setembro de 2026. |
| `README.md` | Um item na lista de funcionalidades sobre o menu lateral e as consultas recentes. |

## Dados e sincronização

- **Recentes:** guardadas em `localStorage` como JSON `[{ cnpj, nome }]`. O menu lê com `useSyncExternalStore`. O retrato no servidor é a lista vazia, então não há erro de hidratação. O retrato no navegador é guardado pelo texto cru, para devolver sempre o mesmo array enquanto nada muda. `registrar` e `limpar` disparam um evento próprio (`radar-pncp:empresas-recentes`), que atualiza o menu na mesma aba. O evento `storage` atualiza as outras abas.
- **Menu recolhido:** o estado verdadeiro é o atributo `data-menu` no `<html>`, aplicado pelo script inicial, então a largura já nasce certa. O botão lê o estado com `useSyncExternalStore` (servidor: expandido) só para o `aria-expanded` e o ícone da seta. Ao clicar, troca o atributo, grava no `localStorage` e avisa quem estiver inscrito.

## Falhas

- `localStorage` indisponível (aba anônima, bloqueio): toda leitura e gravação fica em `try/catch`. As recentes só não aparecem e o menu não lembra que foi recolhido. Nada quebra.
- JSON inválido ou fora do formato: é ignorado (lista vazia). Cada item precisa de `cnpj` com 14 dígitos e `nome` em texto.

## Verificação

O projeto não tem testes automatizados, e esta mudança não justifica criar essa estrutura. A verificação é:

1. `tsc --noEmit`, `eslint` e `next build` sem erros.
2. Roteiro no navegador (Chrome headless, como nos roteiros anteriores):
   - Computador: os 3 grupos aparecem na ordem da tabela. O item ativo está certo em `/`, `/cnpj`, `/sinapse`, `/empenhos-am` e `/empenhos-federal`. A grade de botões não existe mais.
   - Recolher e expandir. Depois de recarregar, continua recolhido, sem pular de largura.
   - Consultar um CNPJ: ele aparece nas recentes. Consultar de novo não repete. Com 6 empresas, sobram 5. "Limpar" esvazia e a seção some.
   - Celular (390 px): o menu lateral não aparece. O ☰ abre a gaveta pela esquerda. Esc fecha. Escolher uma tela navega e fecha. O rodapé da gaveta tem status, ajuda e tema.
   - A gaveta de filtros das licitações continua abrindo pela direita.
   - Temas claro e escuro.
   - Termos de uso e Política de privacidade continuam com a aparência de hoje.
   - Sem erros no console.
