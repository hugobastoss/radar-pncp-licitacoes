# SEFAZ-AM — Portal da Transparência Fiscal (API informal)

Levantamento feito ao vivo (2026-09-25) no portal de transparência da
SEFAZ-AM, pensando num uso futuro: **consultar empenhos a receber de alguns
órgãos do Amazonas**. Nada disso está implementado ainda — ver o item
correspondente em [TODO.md](TODO.md).

**Não é uma API.** São páginas HTML geradas no servidor (Java Struts 1 +
tabelas displaytag), sem JSON e sem contrato. Mas elas se comportam como uma
API informal: tudo vai por GET na query string, sem login, cookie ou sessão,
e a resposta é rápida. O consumo é por scraping do HTML — pode quebrar sem
aviso se o layout mudar.

| | |
|---|---|
| **Base URL** | `https://sistemas.sefaz.am.gov.br/transpprd/mnt/despesa/` |
| **Autenticação** | Nenhuma |
| **Formato** | HTML, `charset=ISO-8859-1` |
| **Documentação oficial** | Nenhuma de API. Existe um [manual do usuário do portal](https://sistemas.sefaz.am.gov.br/transpprd/estatico/Manual_Portal_Versao25032014.pdf), de 2014 |
| **Página de entrada** | [`execDespAno.do?method=Pesquisar&filter=&anoexercicio=2026&grupo=1&consulta=1&mes=00&detNatureza=N`](https://sistemas.sefaz.am.gov.br/transpprd/mnt/despesa/execDespAno.do?method=Pesquisar&filter=&anoexercicio=2026&grupo=1&consulta=1&mes=00&detNatureza=N) |

## Caminho até o empenho

O portal é uma navegação em níveis (drill-down). Os links da página são
`javascript:` que montam a URL do próximo nível — os endpoints abaixo foram
tirados desse JavaScript e testados chamando direto, sem passar pelos níveis
anteriores.

```
1. Poderes                 execDespAno.do
   └─ 2. Órgãos            execDespAnoPoder.do           ← códigos dos órgãos
      └─ 3. Empenhos       execDespAnoPoderUg.do         ← ⭐ principal pro caso de uso
         └─ 4. Detalhe     execDespAnoPoderUgCredorNe.do ← CNPJ, processo, itens
```

Parâmetros comuns a todos os níveis:

| Parâmetro | Valor | Observação |
|---|---|---|
| `method` | `Pesquisar` | Sempre |
| `anoexercicio` | `2010`–`2026` | Ano da consulta |
| `grupo` | `1` | Visão por Poder (`3` = visão Estado, não usada aqui) |
| `consulta` | `1` | "Órgão e Empenho". Outros valores trocam a página (ver [Outras visões](#outras-visões)) |
| `mes` | `00` | Acumulado do ano. **Mande sempre** — sem ele o detalhe do empenho quebra no meio da página |
| `filter` | vazio | `covid19` restringe às despesas de combate à COVID |
| `detNatureza` | `N` | |

### 1. Poderes — `execDespAno.do`

Totais por Poder (Executivo, Legislativo, Judiciário, Ministério Público).
Só serve pra conferência.

### 2. Órgãos de um Poder — `execDespAnoPoder.do`

Parâmetro extra: `copoder` — `0` Executivo, `1` Legislativo, `2` Judiciário,
`3` Ministério Público.

Uma linha por órgão (122 no Executivo em 2026). O código do órgão só aparece
dentro do link:

```html
<a href="javascript:showUg(document.getElementById('anoexercicio').value,'018202','0')"
   title="AGÊNCIA DE DEFESA AGROPECUÁRIA E FLORESTAL DO ESTADO DO AMAZONAS">
  ADAF
</a>
```

`018202` é o código do órgão (vira `counidadegestora` no nível seguinte),
`ADAF` a sigla e o `title` o nome completo. Alguns códigos: `018202` ADAF,
`028101` SEDUC, `017101` SUSAM, `014103` SEFAZ-EG.

Colunas: Órgão, Dotação Inicial, Autorizado, Empenhado, Liquidado, Pago, Pago
Exercício Anterior, A Pagar Exercício Anterior.

### 3. Empenhos de um órgão — `execDespAnoPoderUg.do` ⭐

Parâmetros extras: `copoder` e `counidadegestora`.

```
https://sistemas.sefaz.am.gov.br/transpprd/mnt/despesa/execDespAnoPoderUg.do?method=Pesquisar&counidadegestora=018202&copoder=0&anoexercicio=2026&grupo=1&consulta=1&mes=00&filter=&detNatureza=N
```

Uma linha por nota de empenho (NE), **todas numa página só**, sem paginação
(conferido: a soma das linhas bate centavo a centavo com o rodapé de
totais).

| Coluna | Exemplo |
|---|---|
| Nota Empenho | `2026NE0000011` |
| Credor | `IMPRENSA OFICIAL DO ESTADO DO AMAZONAS` — só o nome, **sem CNPJ** |
| Empenhado | `200.000,00` |
| Liquidado | `157.628,83` |
| Pago | `146.152,07` |
| Pago Exercício Anterior | `0,00` |
| A Pagar Exercício Anterior | `0,00` |

Estrutura de cada linha:

```html
<tr class="ControlTableRow1">
<td class="defaultTdSemCor" style="width:80px;">
  <a href="javascript:showNotaEmpenho(document.getElementById('anoexercicio').value,document.getElementById('counidadegestora').value,'2021NE0000040', '0')">
    2021NE0000040
  </a>
</td>
<td class="defaultTdSemCor" style="width:340px;">PROBANK SEGURANÇA DE BENS E VALORES EIRELI</td>
<td class="defaultTdSemCor" style="text-align:right">0,00</td>      <!-- Empenhado -->
<td class="defaultTdSemCor" style="text-align:right">0,00</td>      <!-- Liquidado -->
<td class="defaultTdSemCor" style="text-align:right">0,00</td>      <!-- Pago -->
<td class="defaultTdSemCor" style="text-align:right">0,00</td>      <!-- Pago Exercício Anterior -->
<td class="defaultTdSemCor" style="text-align:right">21.717,29</td> <!-- A Pagar Exercício Anterior -->
</tr>
```

A lista de um ano mistura dois tipos de empenho, e nunca os dois na mesma
linha:

- **Do próprio ano** (`2026NE…`): preenchem Empenhado, Liquidado e Pago. As
  colunas "Exercício Anterior" ficam zeradas.
- **De anos anteriores, ou seja, restos a pagar** (`2021NE…`, `2025NE…`):
  Empenhado, Liquidado e Pago zerados. Só preenchem Pago Exercício Anterior e
  A Pagar Exercício Anterior.

No ADAF em 2026 foram 1.631 do ano e 25 de anos anteriores.

O número da NE **recomeça em cada órgão** — `2026NE0000011` existe no ADAF e
na SEDUC. A chave única de um empenho é **órgão + NE**.

Tamanho da resposta cresce com o órgão:

| Órgão | Linhas | HTML | Tempo |
|---|---|---|---|
| ADAF (`018202`) | 1.656 | 1,2 MB | ~0,6 s |
| SUSAM (`017101`) | 3.872 | 2,8 MB | ~1,5 s |
| SEDUC (`028101`) | 7.058 | 5,1 MB | ~1,6 s |

O servidor responde com gzip (a SEDUC trafega ~220 KB), e o `fetch` do Node
já pede gzip por padrão.

### 4. Detalhe de um empenho — `execDespAnoPoderUgCredorNe.do`

Parâmetros extras: `copoder`, `counidadegestora` e `nune` (número da NE).

```
https://sistemas.sefaz.am.gov.br/transpprd/mnt/despesa/execDespAnoPoderUgCredorNe.do?method=Pesquisar&nune=2025NE0000036&counidadegestora=018202&copoder=0&anoexercicio=2026&grupo=1&consulta=1&mes=00&filter=
```

`anoexercicio` é o ano da consulta, não o do empenho — um `2025NE…` que
aparece na lista de 2026 abre com `anoexercicio=2026`.

Os valores ficam em `<input readonly value="…">`, ao lado de um
`<td class="label">` com o nome do campo:

| Campo | Exemplo |
|---|---|
| DATA | `21/01/2025` |
| VALOR | `6.429,72` |
| CREDOR | `02.341.467/0001-20 - AMBAR ENERGIA AMAZONAS S.A.` — **único lugar com o CNPJ do credor** |
| TIPO DE EMPENHO | `9 - Despesa Normal` |
| MODALIDADE | `2 - Estimativo` |
| UNIDADE ORÇAMENTÁRIA | `18202-AGÊNCIA DE DEFESA AGROPECUÁRIA E FLORESTAL DO ESTADO DO AMAZONAS` |
| PROGRAMA DE TRABALHO | `20122000120870001 - Administração de Serviços de Energia Elétrica, Água e Esgoto e Telefonia` |
| FUNÇÃO | `20 - Agricultura` |
| SUBFUNÇÃO | `122 - Administração Geral` |
| NATUREZA DE DESPESA | `33903943 - Serviços De Energia Elétrica` |
| FONTE DE RECURSO | `1501160000000000 - Outros Recursos não Vinculados - FTI` |
| LICITAÇÃO | `5.0 - Dispensa de Licitação` |
| REFERÊNCIA | `Art.24; XXII; Lei 8.666/93` |
| Nº PROCESSO | `018202.001345/2022` |
| DESCRIÇÃO | Texto livre com o objeto do empenho |
| USUÁRIO OPERADOR | Nome do servidor que lançou o empenho |

Depois dos campos vêm duas tabelas:
- **Cronograma de Desembolso** — valor previsto por mês, de janeiro a dezembro.
- **Descrição dos itens** — unidade, descrição, quantidade, valor unitário e
  valor total.

## Calculando o "a receber"

Do ponto de vista do credor, o saldo a receber de cada NE da lista do nível 3
(sempre com `mes=00`):

| Tipo de NE | A receber |
|---|---|
| Do ano | `Empenhado − Pago` |
| De anos anteriores (restos a pagar) | `A Pagar Exercício Anterior` |

Nas NEs do ano dá pra separar o saldo em duas partes, que pesam diferente
numa cobrança:

- **Liquidado a pagar** = `Liquidado − Pago` — o órgão já atestou a entrega,
  só falta pagar.
- **A liquidar** = `Empenhado − Liquidado` — o valor está reservado, mas a
  entrega ainda não foi atestada.

Exemplo real, `2026NE0000011` do ADAF: empenhado 200.000,00, liquidado
157.628,83, pago 146.152,07. A receber = **53.847,93**, sendo 11.476,76
liquidado a pagar e 42.371,17 a liquidar.

"A Pagar Exercício Anterior" parece ser o **saldo restante** do resto a
pagar, e não o valor original: a `2025NE0000036` (AMBAR) tem Pago Exercício
Anterior 5.197,91 e A Pagar 0,00, ou seja, foi quitada em 2026. Isso foi
deduzido desse caso — vale confirmar com mais exemplos antes de confiar.

**Em aberto:** não verificamos se o Empenhado já vem líquido de anulações. O
portal tem uma página separada de empenhos anulados
(`/transpprd/mnt/info/EmpenhosAnulados.do?method=Pesquisar`) que não foi
explorada.

## Identificando o credor

A lista de empenhos do órgão (nível 3) só traz o **nome** do credor. O CNPJ
aparece em dois lugares:

1. **Detalhe do empenho** (nível 4) — uma requisição por NE. Serve pra
   confirmar poucas NEs já filtradas pelo nome.
2. **Visão "Modalidade, Órgão e Credor"** — lista todos os credores de um
   órgão no formato `CNPJ - NOME`, com totais agregados (sem as NEs). Serve
   pra descobrir o nome exato que o portal usa pra um CNPJ:

   ```
   https://sistemas.sefaz.am.gov.br/transpprd/mnt/despesa/execDespAnoPoderModalidadeOrgaoCredor.do?method=Pesquisar&counidadegestora=018202&comodalidade=0090&copoder=0&anoexercicio=2026&grupo=1&consulta=12&mes=00&mesFinal=
   ```

   `comodalidade=0090` é "Aplicações Diretas", onde estão as compras de
   fornecedores (`0091` são operações entre órgãos do próprio estado).
   Pessoa física vem com CPF mascarado (`***.169.682-**`). Colunas: Credor,
   Dotação Inicial, Empenhado, Liquidado, Pago, Pago Exercício Anterior, A
   Pagar Exercício Anterior.

## O que não funciona

| Tentativa | Resultado |
|---|---|
| Header `Accept: application/json` | Ignorado, volta HTML |
| Botões de download PDF/XLS/CSV (`execDespAnoPoderUg.do?method=Consultar&tipoDownload=CSV`) | **403 do nginx**, por GET ou POST, mesmo com cookie de sessão, `Referer` e `User-Agent` de navegador. Bloqueado no servidor |
| Export nativo do displaytag (`d-49489-e=1..5&6578706f7274=1`) | Ignorado, volta a página sem a tabela |
| Empenhos por credor (`execDespAnoPoderUgCredor.do?cocredor=…`) | A página quebra no meio. `cocredor` não é o CNPJ (testado com e sem máscara), e o código certo não aparece em nenhuma das páginas vistas |
| Intervalo de meses na lista do órgão (`mes=01&mesFinal=03`) | `mesFinal` é ignorado nesse nível: `01–01`, `01–03` e `01–12` devolvem as mesmas 204 linhas. Pra saldo, use `mes=00` |

## Pegadinhas de parsing

- **Encoding ISO-8859-1.** `response.text()` assume UTF-8 e estraga os
  acentos. Use `new TextDecoder('latin1').decode(await response.arrayBuffer())`.
- **Números no formato brasileiro:** `1.234.567,89` → tirar os `.` e trocar
  a `,` por `.`.
- **HTML inválido.** O `title` de alguns órgãos tem aspas sem escape —
  `title="FUNDAÇÃO HOSPITAL "ADRIANO JORGE""` — e um parser de DOM corta o
  atributo no lugar errado. Como as linhas têm estrutura fixa, regex sobre o
  trecho entre `<tbody>` e `</tbody>` funcionou bem no protótipo, e ainda
  evita uma dependência nova (o projeto não tem parser de HTML hoje).
- **Erro vem como 200.** Quando falta um parâmetro, o servidor não devolve
  erro HTTP: responde `200` com a página cortada no meio. Pra detectar,
  confira se o HTML contém `</form>` — as páginas completas têm e as
  truncadas não.
- **`;jsessionid=…` nos links internos.** Pode ignorar; nenhuma chamada
  precisa de sessão.
- **TLS válido.** O `fetch` do Node funciona sem ajustes e sem `User-Agent`
  especial.
- **Sem limite de requisições documentado.** Com listas de até 5 MB, vale
  cachear por órgão e não repetir a chamada à toa.

## Outras visões

Com `grupo=1`, o parâmetro `consulta` troca a página de entrada (a lógica
está na função `showPoder` da página inicial). Nenhuma delas é necessária
pro caso de uso, mas ficam anotadas:

| `consulta` | Visão | Endpoint |
|---|---|---|
| 1 | Órgão e Empenho | `execDespAnoPoder.do` |
| 2 | Órgão e Liquidação | `execDespAnoPoderLiquidacao.do` |
| 3 | Órgão e Pagamento | `execDespAnoPoderPagamento.do` |
| 4 | Órgão e Natureza | `execDespAnoPoderOrgao.do` |
| 5 | Fonte, Órgão e Natureza | `execDespAnoPoderFonte.do` |
| 6 / 7 | Função, Subfunção, Órgão e Natureza (7 = detalhada) | `execDespAnoPoderFuncao.do` |
| 8 | Função, Subfunção, Programa, Órgão e Natureza Detalhada | `execDespAnoPoderPTFuncao.do` |
| 9 | Ação e Órgão | `execDespAnoPoderAcao.do` |
| 10 / 11 | Poder e Natureza (11 = detalhada) | `execDespAnoPoderGrupoDespesa.do` |
| 12 | Modalidade, Órgão e Credor | `execDespAnoPoderModalidade.do` |
| 13 | Elemento, Órgão e Credor | `execDespAnoPoderElemento.do` |

## Esboço da implementação futura

- Novo cliente `lib/server/sefaz-am-client.ts`, no padrão dos outros
  `*-client.ts`. O nome `transparencia-client.ts` já é do Portal da
  Transparência da CGU.
- Configuração: lista dos códigos de órgão a acompanhar (ex.: `018202`,
  `028101`).
- Fluxo por órgão:
  1. Um GET na lista de empenhos (nível 3) do ano corrente com `mes=00`.
  2. Calcular o saldo a receber de cada NE e manter só as com saldo > 0.
  3. Opcional: filtrar pelo nome do credor (normalizado).
  4. Buscar o detalhe (nível 4) só das NEs que sobraram, pra confirmar o
     CNPJ e trazer processo, objeto e data.
- Chave de cada empenho: `counidadegestora` + `nune`.
