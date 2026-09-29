import { formatarCnpj, formatarMoeda } from "@/lib/formatters";
import type { Empresa } from "@/types/cnpj";
import type { ContratoEstadual } from "@/types/am";
import type { DadosGovernoFederal, Sancao } from "@/types/transparencia";

/**
 * Modelo do modo Sinapse: um grafo de empresas, sócios, órgãos e sanções
 * montado a partir das consultas que o app já faz. Funções puras — a tela
 * (components/SinapseClient.tsx) só desenha o modelo.
 *
 * Cada ponto tem uma chave estável, então o mesmo órgão ou sócio alcançado
 * por duas empresas vira UM ponto — é isso que faz o cruzamento aparecer.
 */

export type TipoNo = "empresa" | "pessoa" | "orgao-federal" | "orgao-am" | "sancao";

export type TipoAresta = "socio" | "federal" | "am" | "sancao" | "mesmo-endereco" | "mesmo-telefone";

export interface NoSinapse {
  id: string;
  tipo: TipoNo;
  rotulo: string;
  /** Linha de apoio no painel (ex.: "Ativa · Manaus/AM", "CEIS · impede contratar"). */
  detalhe?: string;
  /** Ponto que pede atenção: sanção, empresa sancionada ou inativa. */
  alerta?: "perigo" | "atencao";
  /** Só em empresas. */
  cnpj?: string;
  /** Empresa cujas ligações já foram consultadas. */
  expandida?: boolean;
  /** Pares rótulo → valor pro painel de detalhes. */
  info: [string, string][];
}

export interface ArestaSinapse {
  id: string;
  origem: string;
  destino: string;
  tipo: TipoAresta;
  rotulo: string;
  /** Dinheiro envolvido, pra espessura da linha. */
  valor?: number;
}

export interface ModeloSinapse {
  nos: Record<string, NoSinapse>;
  arestas: Record<string, ArestaSinapse>;
}

export const MODELO_VAZIO: ModeloSinapse = { nos: {}, arestas: {} };

// Um fornecedor grande tem dezenas de órgãos — acima disso o mapa vira um novelo.
export const MAXIMO_ORGAOS_POR_EMPRESA = 20;

function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
}

export function idEmpresa(cnpj: string): string {
  return `empresa:${cnpj}`;
}

/** CPF mascarado "***455835**" → "455835": os dígitos que a Receita deixa ver. */
function digitosVisiveis(documento: string | undefined): string {
  return (documento ?? "").replace(/\D/g, "");
}

function comNo(modelo: ModeloSinapse, no: NoSinapse): ModeloSinapse {
  const atual = modelo.nos[no.id];
  // Não rebaixa uma empresa já consultada a um ponto "de passagem" (sócio PJ citado por outra).
  if (atual?.expandida && !no.expandida) return modelo;
  return { ...modelo, nos: { ...modelo.nos, [no.id]: atual ? { ...atual, ...no } : no } };
}

function comAresta(modelo: ModeloSinapse, aresta: ArestaSinapse): ModeloSinapse {
  return { ...modelo, arestas: { ...modelo.arestas, [aresta.id]: aresta } };
}

/** Ponto da empresa ainda sem dados — aparece na hora em que o CNPJ é adicionado. */
export function comEmpresaPendente(modelo: ModeloSinapse, cnpj: string): ModeloSinapse {
  const id = idEmpresa(cnpj);
  if (modelo.nos[id]) return modelo;
  return comNo(modelo, { id, tipo: "empresa", rotulo: formatarCnpj(cnpj) ?? cnpj, cnpj, info: [["CNPJ", formatarCnpj(cnpj) ?? cnpj]] });
}

export function comCadastro(modelo: ModeloSinapse, empresa: Empresa): ModeloSinapse {
  const id = idEmpresa(empresa.cnpj);
  const inativa = Boolean(empresa.situacaoCadastral) && empresa.situacaoCadastral?.toUpperCase() !== "ATIVA";
  const local = [empresa.municipio, empresa.uf].filter(Boolean).join("/");
  // As sanções podem chegar antes do cadastro: "perigo" já marcado não cai para "atenção".
  const alertaAnterior = modelo.nos[id]?.alerta;
  let m = comNo(modelo, {
    id,
    tipo: "empresa",
    rotulo: empresa.nomeFantasia || empresa.razaoSocial,
    detalhe: [empresa.situacaoCadastral, local].filter(Boolean).join(" · "),
    alerta: alertaAnterior === "perigo" ? "perigo" : inativa ? "atencao" : alertaAnterior,
    cnpj: empresa.cnpj,
    expandida: true,
    info: [
      ["Razão social", empresa.razaoSocial],
      ["CNPJ", formatarCnpj(empresa.cnpj) ?? empresa.cnpj],
      ["Situação", empresa.situacaoCadastral ?? "—"],
      ["Atividade", empresa.atividadePrincipal?.descricao ?? "—"],
      ["Endereço", [empresa.endereco, empresa.bairro, local].filter(Boolean).join(", ") || "—"],
      ["Telefone", empresa.telefones.join(" · ") || "—"],
    ],
  });

  for (const socio of empresa.socios) {
    const documento = digitosVisiveis(socio.documento);
    // Sócio empresa: vira um ponto de empresa, que dá pra abrir.
    if (socio.tipo === "pj" && documento.length === 14) {
      m = comNo(m, {
        id: idEmpresa(documento),
        tipo: "empresa",
        rotulo: socio.nome,
        detalhe: "Sócia — clique em Abrir ligações para consultar",
        cnpj: documento,
        info: [["Razão social", socio.nome], ["CNPJ", formatarCnpj(documento) ?? documento]],
      });
      m = comAresta(m, { id: `socio:${documento}>${empresa.cnpj}`, origem: idEmpresa(documento), destino: id, tipo: "socio", rotulo: socio.qualificacao });
      continue;
    }
    // Pessoa: nome + dígitos visíveis do CPF. Dois homônimos com o mesmo miolo de CPF
    // são, na prática, a mesma pessoa; sem CPF, vale só o nome.
    const idPessoa = `pessoa:${normalizar(socio.nome)}|${documento}`;
    m = comNo(m, {
      id: idPessoa,
      tipo: "pessoa",
      rotulo: socio.nome,
      detalhe: socio.tipo === "estrangeiro" ? "Sócio estrangeiro" : "Sócio",
      info: [["Nome", socio.nome], ["CPF", socio.documento ?? "não informado"]],
    });
    m = comAresta(m, { id: `socio:${idPessoa}>${empresa.cnpj}`, origem: idPessoa, destino: id, tipo: "socio", rotulo: socio.qualificacao });
  }
  return comCoincidencias(m);
}

export function comSancoes(modelo: ModeloSinapse, cnpj: string, sancoes: Sancao[]): ModeloSinapse {
  let m = modelo;
  const idE = idEmpresa(cnpj);
  for (const s of sancoes) {
    const id = `sancao:${s.tipo}-${s.id}`;
    m = comNo(m, {
      id,
      tipo: "sancao",
      rotulo: `${s.tipo}: ${s.tipoSancao}`,
      detalhe: [s.orgaoSancionador?.nome, s.dataFimSancao ? `até ${s.dataFimSancao}` : "sem prazo"].filter(Boolean).join(" · "),
      alerta: s.impedeContratar ? "perigo" : "atencao",
      info: [
        ["Cadastro", s.tipo],
        ["Sanção", s.tipoSancao],
        ["Impede contratar", s.impedeContratar ? "Sim" : "Não"],
        ["Órgão sancionador", s.orgaoSancionador?.nome ?? "—"],
        ["Vigência", [s.dataInicioSancao, s.dataFimSancao].filter(Boolean).join(" a ") || "—"],
      ],
    });
    m = comAresta(m, { id: `sancao:${cnpj}>${id}`, origem: idE, destino: id, tipo: "sancao", rotulo: s.impedeContratar ? "impede contratar" : "sanção" });
  }
  if (sancoes.some((s) => s.impedeContratar) && m.nos[idE]) {
    m = { ...m, nos: { ...m.nos, [idE]: { ...m.nos[idE], alerta: "perigo" } } };
  }
  return m;
}

/** "MIDR — Ministério da Integração…" e "Ministério da Integração…" são o mesmo órgão. */
function chaveOrgaoFederal(nome: string): string {
  const semSigla = nome.includes(" — ") ? nome.split(" — ").slice(1).join(" — ") : nome;
  return `orgao-federal:${normalizar(semSigla)}`;
}

export function comGovernoFederal(modelo: ModeloSinapse, cnpj: string, dados: DadosGovernoFederal): ModeloSinapse {
  // Soma contratos e pagamentos por órgão; fica com os maiores.
  const porOrgao = new Map<string, { nome: string; contratos: number; vigentes: number; valorContratos: number; pago: number }>();
  const pegar = (nome: string) => {
    const chave = chaveOrgaoFederal(nome);
    const atual = porOrgao.get(chave) ?? { nome, contratos: 0, vigentes: 0, valorContratos: 0, pago: 0 };
    porOrgao.set(chave, atual);
    return atual;
  };
  for (const c of dados.contratos?.itens ?? []) {
    const nome = c.orgao ?? c.unidadeGestora;
    if (!nome) continue;
    const o = pegar(nome);
    o.contratos++;
    if (c.vigente) o.vigentes++;
    o.valorContratos += c.valorFinal ?? c.valorInicial ?? 0;
  }
  for (const p of dados.pagamentos?.porOrgao ?? []) pegar(p.orgao).pago += p.valor;

  const ordenados = [...porOrgao.entries()].sort(
    (a, b) => b[1].valorContratos + b[1].pago - (a[1].valorContratos + a[1].pago),
  );
  let m = modelo;
  const idE = idEmpresa(cnpj);
  for (const [chave, o] of ordenados.slice(0, MAXIMO_ORGAOS_POR_EMPRESA)) {
    const partes = [
      o.contratos && `${o.contratos} ${o.contratos === 1 ? "contrato" : "contratos"}${o.vigentes ? ` (${o.vigentes} vigente${o.vigentes > 1 ? "s" : ""})` : ""}`,
      o.valorContratos && formatarMoeda(o.valorContratos),
      o.pago && `pago em 12 meses ${formatarMoeda(o.pago)}`,
    ].filter(Boolean);
    m = comNo(m, { id: chave, tipo: "orgao-federal", rotulo: o.nome.split(" — ")[0], detalhe: "Governo federal", info: [["Órgão", o.nome], ["Esfera", "Federal"]] });
    m = comAresta(m, { id: `federal:${cnpj}>${chave}`, origem: idE, destino: chave, tipo: "federal", rotulo: partes.join(" · "), valor: o.valorContratos + o.pago });
  }
  const resto = ordenados.length - MAXIMO_ORGAOS_POR_EMPRESA;
  if (resto > 0 && m.nos[idE]) {
    m = { ...m, nos: { ...m.nos, [idE]: { ...m.nos[idE], info: [...m.nos[idE].info.filter(([k]) => k !== "Órgãos federais fora do mapa"), ["Órgãos federais fora do mapa", `${resto} com valores menores`]] } } };
  }
  return m;
}

export function comContratosAm(modelo: ModeloSinapse, cnpj: string, contratos: ContratoEstadual[]): ModeloSinapse {
  const porUg = new Map<string, { nome: string; sigla?: string; contratos: number; vigentes: number; valor: number }>();
  for (const c of contratos) {
    const atual = porUg.get(c.ug) ?? { nome: c.ugNome ?? c.ug, sigla: c.ugSigla, contratos: 0, vigentes: 0, valor: 0 };
    atual.contratos++;
    if (c.vigente) atual.vigentes++;
    atual.valor += c.valorTotal ?? 0;
    porUg.set(c.ug, atual);
  }
  let m = modelo;
  const idE = idEmpresa(cnpj);
  for (const [ug, o] of [...porUg.entries()].sort((a, b) => b[1].valor - a[1].valor).slice(0, MAXIMO_ORGAOS_POR_EMPRESA)) {
    const id = `orgao-am:${ug}`;
    m = comNo(m, { id, tipo: "orgao-am", rotulo: o.sigla ?? o.nome, detalhe: "Governo do Amazonas", info: [["Órgão", o.nome], ["Esfera", "Estadual (AM)"], ["UG", ug]] });
    m = comAresta(m, {
      id: `am:${cnpj}>${id}`,
      origem: idE,
      destino: id,
      tipo: "am",
      rotulo: [`${o.contratos} ${o.contratos === 1 ? "contrato" : "contratos"}${o.vigentes ? ` (${o.vigentes} vigente${o.vigentes > 1 ? "s" : ""})` : ""}`, o.valor && formatarMoeda(o.valor)].filter(Boolean).join(" · "),
      valor: o.valor,
    });
  }
  return m;
}

/** Liga empresas do mapa que dividem telefone ou endereço — ninguém declara isso, o mapa acha. */
function comCoincidencias(modelo: ModeloSinapse): ModeloSinapse {
  const empresas = Object.values(modelo.nos).filter((n) => n.tipo === "empresa" && n.expandida);
  let m = modelo;
  const valorInfo = (n: NoSinapse, chave: string) => n.info.find(([k]) => k === chave)?.[1];
  for (let i = 0; i < empresas.length; i++) {
    for (let j = i + 1; j < empresas.length; j++) {
      const [a, b] = [empresas[i], empresas[j]];
      const telefones = (n: NoSinapse) => new Set((valorInfo(n, "Telefone") ?? "").split(" · ").map((t) => t.replace(/\D/g, "")).filter((t) => t.length >= 8));
      const ta = telefones(a);
      const comum = [...telefones(b)].find((t) => ta.has(t));
      if (comum) m = comAresta(m, { id: `mesmo-telefone:${a.id}|${b.id}`, origem: a.id, destino: b.id, tipo: "mesmo-telefone", rotulo: "mesmo telefone" });
      const ea = normalizar(valorInfo(a, "Endereço") ?? "");
      if (ea && ea !== "—" && ea === normalizar(valorInfo(b, "Endereço") ?? "")) {
        m = comAresta(m, { id: `mesmo-endereco:${a.id}|${b.id}`, origem: a.id, destino: b.id, tipo: "mesmo-endereco", rotulo: "mesmo endereço" });
      }
    }
  }
  return m;
}

export interface Cruzamento {
  id: string;
  tipo: "socio-comum" | "orgao-comum" | "mesmo-endereco" | "mesmo-telefone" | "sancionada-com-contratos";
  titulo: string;
  descricao: string;
  /** Ponto pra focar ao clicar. */
  foco: string;
  gravidade: "perigo" | "atencao" | "info";
}

/** O que o mapa mostra que nenhuma tela isolada mostra. */
export function encontrarCruzamentos(modelo: ModeloSinapse): Cruzamento[] {
  const arestas = Object.values(modelo.arestas);
  const nome = (id: string) => modelo.nos[id]?.rotulo ?? id;
  const empresasLigadas = (id: string, tipos: TipoAresta[]) =>
    [...new Set(arestas.filter((a) => tipos.includes(a.tipo) && (a.origem === id || a.destino === id)).map((a) => (a.origem === id ? a.destino : a.origem)))]
      .filter((outro) => modelo.nos[outro]?.tipo === "empresa");

  const lista: Cruzamento[] = [];
  for (const no of Object.values(modelo.nos)) {
    if (no.tipo === "pessoa" || (no.tipo === "empresa" && !no.expandida)) {
      const empresas = empresasLigadas(no.id, ["socio"]);
      if (empresas.length >= 2) {
        lista.push({ id: `socio:${no.id}`, tipo: "socio-comum", titulo: `Sócio em comum: ${no.rotulo}`, descricao: empresas.map(nome).join(" · "), foco: no.id, gravidade: "atencao" });
      }
    }
    if (no.tipo === "orgao-federal" || no.tipo === "orgao-am") {
      const empresas = empresasLigadas(no.id, ["federal", "am"]);
      if (empresas.length >= 2) {
        lista.push({ id: `orgao:${no.id}`, tipo: "orgao-comum", titulo: `Órgão em comum: ${no.rotulo}`, descricao: empresas.map(nome).join(" · "), foco: no.id, gravidade: "info" });
      }
    }
    if (no.tipo === "empresa" && no.alerta === "perigo") {
      const orgaos = arestas.filter((a) => a.origem === no.id && (a.tipo === "federal" || a.tipo === "am"));
      if (orgaos.length > 0) {
        lista.push({
          id: `sancionada:${no.id}`,
          tipo: "sancionada-com-contratos",
          titulo: `Sanção que impede contratar: ${no.rotulo}`,
          descricao: `Ligada a ${orgaos.length} ${orgaos.length === 1 ? "órgão" : "órgãos"} por contratos ou pagamentos.`,
          foco: no.id,
          gravidade: "perigo",
        });
      }
    }
  }
  for (const a of arestas) {
    if (a.tipo === "mesmo-endereco" || a.tipo === "mesmo-telefone") {
      lista.push({
        id: a.id,
        tipo: a.tipo,
        titulo: a.tipo === "mesmo-endereco" ? "Mesmo endereço" : "Mesmo telefone",
        descricao: `${nome(a.origem)} · ${nome(a.destino)}`,
        foco: a.origem,
        gravidade: "atencao",
      });
    }
  }
  const peso = { perigo: 0, atencao: 1, info: 2 };
  return lista.sort((x, y) => peso[x.gravidade] - peso[y.gravidade]);
}
