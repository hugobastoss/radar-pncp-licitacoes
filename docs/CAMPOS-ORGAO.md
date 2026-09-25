# Campos de identificação do órgão — o que cada fonte devolve

Levantamento feito ao vivo (2026-09-25) nas três fontes de licitações, pra
decidir depois se vale a pena capturar mais campos de órgão/unidade do que
capturamos hoje. Cada fonte tem seu próprio cliente em `lib/server/`:
`pncp-search-client.ts` (primária), `pncp-client.ts` (oficial),
`compras-client.ts` (Compras.gov.br) — o mapeamento de cada campo pra
`Licitacao` acontece na função `mapearParaLicitacao` de cada arquivo.

Convenção: ✅ = já capturado e usado no app. Sem marca = a API devolve, mas
não usamos.

## 1. Fonte primária — busca interna (`pncp-search-client.ts`)

Exemplo real (Hospital Ophir Loyola):

```json
{
  "orgao_id": "1991",
  "orgao_cnpj": "08109444000171",
  "orgao_nome": "HOSPITAL OPHIR LOYOLA",
  "orgao_subrogado_id": null,
  "orgao_subrogado_nome": null,
  "unidade_id": "1491350",
  "unidade_codigo": "68",
  "unidade_nome": "Hospital Ophir Loyola",
  "esfera_id": "E",
  "esfera_nome": "Estadual",
  "poder_id": "E",
  "poder_nome": "Executivo"
}
```

| Campo | Usado? | Observação |
|---|---|---|
| `orgao_cnpj` | ✅ (`cnpjOrgao`) | |
| `orgao_nome` | ✅ (`orgao`) | |
| `orgao_id` | não | id interno do PNCP pro órgão |
| `orgao_subrogado_id` / `orgao_subrogado_nome` | não | outro órgão conduzindo em nome do titular — geralmente `null` |
| `unidade_id` / `unidade_codigo` | não | ids internos da unidade |
| `unidade_nome` | não | mais específico que `orgao_nome` (ex.: o hospital em si, não a secretaria) |
| `esfera_id` / `esfera_nome` | não | Federal / Estadual / Municipal |
| `poder_id` / `poder_nome` | não | Executivo / Legislativo / Judiciário |

**12 campos no total, 2 usados.**

## 2. Fonte oficial — consulta (`pncp-client.ts`)

Exemplo real (mesmo órgão, endpoint de detalhe):

```json
{
  "orgaoEntidade": {
    "cnpj": "08109444000171",
    "poderId": "E",
    "esferaId": "E",
    "razaoSocial": "HOSPITAL OPHIR LOYOLA"
  },
  "unidadeOrgao": {
    "ufNome": "Pará",
    "ufSigla": "PA",
    "municipioNome": "Belém",
    "codigoUnidade": "68",
    "nomeUnidade": "Hospital Ophir Loyola",
    "codigoIbge": "1501402"
  },
  "orgaoSubRogado": null,
  "unidadeSubRogada": null
}
```

| Campo | Usado? | Observação |
|---|---|---|
| `orgaoEntidade.cnpj` | ✅ (`cnpjOrgao`) | |
| `orgaoEntidade.razaoSocial` | ✅ (`orgao`) | |
| `unidadeOrgao.ufSigla` | ✅ (`uf`) | |
| `unidadeOrgao.municipioNome` | ✅ (`municipio`) | |
| `unidadeOrgao.codigoIbge` | ✅ (`codigoMunicipioIbge`) | o único das três fontes que devolve o código IBGE real |
| `orgaoEntidade.poderId` | não | |
| `orgaoEntidade.esferaId` | não | |
| `unidadeOrgao.ufNome` | não | nome por extenso do estado (já temos a sigla) |
| `unidadeOrgao.codigoUnidade` / `nomeUnidade` | não | |
| `orgaoSubRogado` (mesmo formato de `orgaoEntidade`) | não | `null` neste exemplo, mas existe quando há subrogação |
| `unidadeSubRogada` (mesmo formato de `unidadeOrgao`) | não | idem |

**10 campos diretos (+10 quando há subrogação), 5 usados.**

## 3. Compras.gov.br (`compras-client.ts`)

Exemplo real (Comando do Exército):

```json
{
  "orgaoEntidadeCnpj": "00394452000103",
  "orgaoSubrogadoCnpj": null,
  "codigoOrgao": 44611,
  "orgaoEntidadeRazaoSocial": "COMANDO DO EXERCITO",
  "orgaoSubrogadoRazaoSocial": null,
  "orgaoEntidadeEsferaId": "F",
  "orgaoSubrogadoEsferaId": null,
  "orgaoEntidadePoderId": "E",
  "orgaoSubrogadoPoderId": null,
  "unidadeOrgaoCodigoUnidade": "160050",
  "unidadeSubrogadaCodigoUnidade": null,
  "unidadeOrgaoNomeUnidade": "HOSPITAL GERAL DE FORTALEZA/MEX - CE",
  "unidadeSubrogadaNomeUnidade": null,
  "unidadeOrgaoUfSigla": "CE",
  "unidadeSubrogadaUfSigla": null,
  "unidadeOrgaoMunicipioNome": "FORTALEZA",
  "unidadeSubrogadaMunicipioNome": null,
  "unidadeOrgaoCodigoIbge": 2304400,
  "unidadeSubrogadaCodigoIbge": null
}
```

| Campo | Usado? | Observação |
|---|---|---|
| `orgaoEntidadeCnpj` | ✅ (`cnpjOrgao`) | |
| `orgaoEntidadeRazaoSocial` | ✅ (`orgao`) | |
| `unidadeOrgaoUfSigla` | ✅ (`uf`) | |
| `unidadeOrgaoMunicipioNome` | ✅ (`municipio`) | |
| `unidadeOrgaoCodigoIbge` | ✅ (`codigoMunicipioIbge`) | |
| `codigoOrgao` | não | id interno |
| `orgaoEntidadeEsferaId` / `orgaoEntidadePoderId` | não | |
| `unidadeOrgaoCodigoUnidade` / `unidadeOrgaoNomeUnidade` | não | |
| `orgaoSubrogadoCnpj` / `orgaoSubrogadoRazaoSocial` / `orgaoSubrogadoEsferaId` / `orgaoSubrogadoPoderId` | não | |
| `unidadeSubrogadaCodigoUnidade` / `NomeUnidade` / `UfSigla` / `MunicipioNome` / `CodigoIbge` | não | |

**18 campos no total (9 pares órgão/subrogado), 5 usados.**

## Resumo — o que as três têm em comum e nunca usamos

- **Esfera** (Federal/Estadual/Municipal) e **Poder** (Executivo/Legislativo/Judiciário) — as três fontes devolvem, nenhuma é usada. Daria pra virar um filtro novo.
- **Nome da unidade** (`unidade_nome` / `nomeUnidade` / `unidadeOrgaoNomeUnidade`) — mais específico que o nome do órgão; hoje mostramos só o órgão "pai".
- **Subrogação** (`orgao_subrogado_*` / `orgaoSubRogado` / `orgaoSubrogado*`) — quando um órgão conduz a licitação em nome de outro. Sempre ignorado; pode estar mostrando o órgão errado nesses casos (o titular, não quem realmente conduz o processo).
