# Cinco fontes públicas novas no QBuscado

Data: 30/09/2026 · Situação: aguardando revisão

## Objetivo

Ligar ao QBuscado cinco fontes de dados públicos que não exigem chave nem banco de dados, escolhidas no levantamento em [docs/FONTES-PUBLICAS.md](../../FONTES-PUBLICAS.md):

1. **Lista suja do trabalho escravo** (MTE).
2. **Dono do domínio do e-mail** (registro.br).
3. **Inscrições estaduais** (CNPJ.ws).
4. **Transferências especiais recebidas**, as "emendas PIX" (TransfereGov).
5. **Operadora de plano de saúde** (ANS).

**Pronto quando:** na ficha de um CNPJ, cada fonte mostra o que tem sobre a empresa (ou não mostra nada, quando não há); a lista suja também aparece nas telas de Sanções e de CPF; a lista suja e o dono do domínio entram no Sinapse; uma fonte fora do ar não afeta as outras nem o resto da ficha.

## Fora do escopo

- PGFN, TSE e IBAMA: só existem como arquivos grandes e exigem banco de dados.
- Inscrições estaduais, transferências especiais e ANS no Sinapse.
- Domínios fora do `.br` (o registro.br só responde pelos `.br`).
- Novas linhas no indicador "Status dos serviços".

## O que aparece e onde

### 1. Lista suja (MTE)

- **Ficha do CNPJ:** alerta âmbar junto dos selos do topo ("Na lista suja do trabalho escravo"), com uma linha por registro: ano da ação fiscal, UF, trabalhadores envolvidos e data de inclusão. Link para a página do MTE. Fora da lista, não aparece nada.
- **Tela de Sanções:** na consulta por CNPJ, os registros entram como mais um bloco de resultado, abaixo do CEIS/CNEP.
- **Tela de CPF:** quando o CPF consultado está na lista, aparece junto das sanções (CEIS, CNEP, CEAF).
- **Sinapse:** ponto de sanção ligado à empresa (ou à pessoa cujo CPF foi consultado), com alerta **âmbar** (`atencao`). A lista não impede contratar por lei, então não usa o vermelho. Conta para o cruzamento "sócio com alerta" — cujo título hoje só distingue "sanção" (vermelho) de "pessoa politicamente exposta" (âmbar) e precisa passar a dizer "Sócio na lista suja do trabalho escravo" quando for esse o motivo.
- **Texto:** exibir como o governo publica. Não cruzar a lista com outras bases além do que está descrito aqui.

### 2. Dono do domínio (registro.br)

- **De onde vem o domínio:** do e-mail da empresa (o da Receita; na falta, o da CNPJá). Usa o que vem depois do `@`, em minúsculas.
- **Quando não consulta:** domínio que não termina em `.br`; domínio de provedor de e-mail (lista fixa: `uol.com.br`, `bol.com.br`, `terra.com.br`, `ig.com.br`, `yahoo.com.br`, `hotmail.com.br`, `outlook.com.br`, `live.com.br`, `globo.com.br`, `zipmail.com.br`, `oi.com.br`, `msn.com.br`, `r7.com.br`); empresa sem e-mail.
- **Ficha do CNPJ:** uma linha abaixo do e-mail: "Domínio `empresa.com.br` registrado por NOME (CNPJ), desde AAAA". Se o titular for a própria empresa (mesma raiz de CNPJ, os 8 primeiros dígitos), o texto é neutro. Se for **outro CNPJ**, fica destacado e o CNPJ vira link para a ficha dele. Titular pessoa física: mostra o nome que o registro.br publica, sem documento.
- **Sinapse:** consultado ao abrir uma empresa (depois do cadastro). Quando o titular é outro CNPJ, cria a ligação "domínio registrado por" até um ponto de empresa (tracejado se ainda não aberta). Quando é a própria empresa, só acrescenta o domínio aos detalhes. Cruzamento novo **"Mesmo dono de domínio"**: dois ou mais pontos de empresa ligados ao mesmo titular. Tom **informativo** (`info`), não de alerta: muitas empresas cadastram o e-mail do contador, então o mesmo dono costuma ser o mesmo escritório de contabilidade.
- O registro.br resolve subdomínios (`mail.empresa.com.br` responde como `empresa.com.br`) e devolve 404 para domínio inexistente (testado em 30/09/2026).

### 3. Inscrições estaduais (CNPJ.ws)

- **Ficha do CNPJ:** seção "Inscrições estaduais" com um botão "Consultar inscrições estaduais". Só consulta ao clicar.
- Depois de consultar: lista com UF, número e situação (ativa/inativa), as ativas primeiro. Sem inscrições: "Nenhuma inscrição estadual encontrada".
- Limite estourado (HTTP 429): aviso "Limite de consultas da fonte atingido — tente de novo em um minuto" e o botão continua disponível.
- Rodapé da seção: "Fonte: CNPJ.ws".

### 4. Transferências especiais recebidas (TransfereGov)

- **Ficha do CNPJ:** seção "Transferências especiais recebidas (emendas PIX)", consultada junto com o resto da ficha. **Só aparece quando há resultado.**
- Mostra o total de planos de ação e os 50 mais recentes (ano decrescente). Cada linha: ano, parlamentar, área (política pública), valor (custeio + investimento), situação e o número da emenda.
- O número da emenda (12 dígitos, o mesmo formato da tela de Emendas) tem dois links: "Ver a emenda" (`/emendas?codigo=…`) e "Ver no mapa Sinapse" (`/sinapse?emenda=…`).
- **Não mostrar nem trafegar** os dados bancários que a fonte devolve (banco, agência, conta): a consulta pede só as colunas usadas (`select=`).
- **Tela de Emendas:** passa a ler `?codigo=` da URL e abrir já consultando esse código.

### 5. Operadora de plano de saúde (ANS)

- **Ficha do CNPJ:** selo junto dos selos do topo: "Operadora ANS nº 326305 · ativa" (tom de sucesso) ou "· inativa" (tom neutro). Consultado junto com o resto da ficha. CNPJ que não é operadora: nada aparece.

## Peças

### Servidor

| Arquivo | Responsabilidade |
|---|---|
| `lib/lista-suja.ts` | Puro, sem imports: `lerListaSuja(csv: string)` devolve os registros; `indexarListaSuja(registros)` devolve um `Map` por documento só com dígitos. Testável fora do Next |
| `lib/server/lista-suja-client.ts` | Baixa o CSV do MTE (Latin-1), usa `lib/lista-suja.ts`, guarda o índice em memória por 24 h e expõe `buscarNaListaSuja(documento)` |
| `lib/dominio-email.ts` | Puro: `dominioDoEmail(email)` devolve o domínio consultável ou `undefined` (fora do `.br`, provedor, vazio) |
| `lib/server/registro-br-client.ts` | `buscarDominio(dominio)`: RDAP do registro.br. 404 devolve `undefined`; 429 lança erro de limite |
| `lib/server/cnpjws-client.ts` | `buscarInscricoesEstaduais(cnpj)`. 429 lança erro de limite |
| `lib/server/transferegov-client.ts` | `buscarTransferenciasEspeciais(cnpj)`: até 50 planos de ação e o total (`Prefer: count=exact`) |
| `lib/server/ans-client.ts` | `buscarOperadoraAns(cnpj)`: a operadora ou `undefined` |
| `app/api/lista-suja/route.ts` | `GET ?cnpj=` |
| `app/api/dominio/route.ts` | `GET ?dominio=`, com limite por visitante |
| `app/api/cnpj/inscricoes-estaduais/route.ts` | `GET ?cnpj=`, com limite por visitante |
| `app/api/transferencias-especiais/route.ts` | `GET ?cnpj=` |
| `app/api/ans/route.ts` | `GET ?cnpj=` |
| `app/api/cpf/route.ts` | Passa a conferir o CPF na lista suja (o CPF continua no corpo do POST, nunca na URL) |
| `vercel.json` | As cinco rotas novas em `gru1` |

Cache: `next: { revalidate }` no `fetch`, como os clientes atuais. 24 h para lista suja, domínio, inscrições e ANS; 1 h para transferências. Identificação: `User-Agent: QBuscado/1.0`. Tempo limite de 8 s por chamada.

As funções de conversão de cada resposta (RDAP, CNPJ.ws, TransfereGov, ANS) ficam exportadas e sem depender do Next, para serem testadas fora dele.

### Tipos

`types/fontes-publicas.ts`: `RegistroListaSuja`, `RegistroDominio`, `InscricaoEstadual`, `TransferenciaEspecial` (e o resultado com total), `OperadoraAns`.

### Navegador

| Arquivo | Responsabilidade |
|---|---|
| `lib/api-fontes-publicas.ts` | As cinco consultas do lado do navegador, no padrão de `lib/api-cnpj.ts` (resultado com `status`: `sucesso`, `nao_encontrado`, `limite`, `erro_servidor`, `cancelado`) |
| `components/ListaSujaAlerta.tsx` | O alerta, usado na ficha do CNPJ, na tela de Sanções e na de CPF |
| `components/DominioEmailLinha.tsx` | A linha do domínio na ficha |
| `components/InscricoesEstaduaisSecao.tsx` | A seção com o botão |
| `components/TransferenciasEspeciaisSecao.tsx` | A seção de emendas PIX |
| `components/CnpjClient.tsx` | Dispara as consultas (lista suja, domínio, transferências e ANS junto com as demais; inscrições só no botão) e encaixa os componentes e o selo da ANS |
| `components/SancoesClient.tsx`, `components/CpfClient.tsx` | Mostram a lista suja |
| `components/EmendasClient.tsx` | Lê `?codigo=` |
| `lib/sinapse.ts` | `comListaSuja`, `comDominio`, o tipo de aresta `dominio` e o cruzamento `mesmo-dono-dominio` |
| `components/SinapseClient.tsx` | Consulta as duas fontes ao abrir uma empresa; rótulos, estilo da aresta e legenda |

### Documentação

`docs/APIS.md` ganha uma seção por fonte. `README.md` ganha os itens na lista de funcionalidades. `docs/FONTES-PUBLICAS.md` marca as cinco como "em uso".

## Falhas

- Fonte fora do ar, tempo esgotado ou resposta inesperada: a rota devolve 502 com a mensagem; a seção mostra "Não foi possível consultar … neste momento" e o resto da ficha segue normal. No Sinapse, a fonte aparece como "não respondeu" na lista de fontes da empresa.
- Limite da fonte (429): a rota devolve 429; a seção avisa e permite tentar de novo.
- CSV da lista suja com formato diferente do esperado (sem a coluna "CNPJ/CPF"): o leitor lança erro e a rota devolve 502 — melhor avisar que não conseguiu do que dizer "fora da lista" sem ter conferido.
- Falha da lista suja dentro da consulta de CPF: a consulta de CPF responde normalmente e indica que a lista suja não pôde ser conferida.

## Privacidade

- A lista suja traz pessoas físicas com CPF. É uma lista oficial pública; o site a exibe como publicada.
- O CPF consultado continua indo só no corpo do POST.
- Os dados bancários da TransfereGov não são pedidos à fonte.
- Nenhuma dessas consultas guarda nada no navegador.

## Verificação

Testes fora do repositório, como na navegação lateral (o projeto não tem estrutura de testes e esta mudança não a cria).

1. **Unidade** (`node --test`):
   - leitor da lista suja: cabeçalho, Latin-1 já convertido, separador `;`, CNPJ e CPF com máscara virando só dígitos, mesmo documento com mais de um registro, arquivo sem a coluna esperada;
   - `dominioDoEmail`: `.br` comum, maiúsculas, provedor, fora do `.br`, e-mail inválido ou vazio;
   - conversão das respostas do RDAP (titular CNPJ, titular pessoa física, sem titular), da CNPJ.ws (ordem ativas primeiro), da TransfereGov (soma de custeio e investimento; nenhum campo bancário no resultado) e da ANS.
2. **Navegador** (Chrome headless contra o `next dev`), com casos reais:
   - um CNPJ que está na lista suja: alerta na ficha, bloco na tela de Sanções e ponto âmbar no Sinapse;
   - um CNPJ com e-mail `.br`: linha do domínio; e um caso em que o titular é outro CNPJ;
   - botão de inscrições estaduais: lista depois do clique;
   - Estado do Amazonas (`04312369000190`): seção de transferências com total e links; `/emendas?codigo=` abre consultando;
   - Amil (`29309127000179`): selo da ANS; um CNPJ comum: sem selo;
   - um CNPJ comum fora de tudo: nenhuma seção nova aparece e não há erro;
   - sem erros no console.
3. `tsc --noEmit`, `eslint` e `next build` limpos.
