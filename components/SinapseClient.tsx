"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { Core, CoseLayoutOptions, StylesheetJson } from "cytoscape";
import { ArrowUpRight, Building2, Landmark, Loader2, Maximize2, Network, Plus, Trash2, TriangleAlert, UserRound } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { buscarContratosAm, buscarEmpenhosAm } from "@/lib/api-am";
import { buscarComplementoCnpj, buscarEmpresa } from "@/lib/api-cnpj";
import { buscarConvenios } from "@/lib/api-convenios";
import { consultarCpf } from "@/lib/api-cpf";
import { buscarDocumentosEmenda, buscarEmendas } from "@/lib/api-emendas";
import { buscarEmpenhosFederais } from "@/lib/api-empenhos-federais";
import { buscarDadosGovernoFederal } from "@/lib/api-governo-federal";
import { buscarSancoes } from "@/lib/api-sancoes";
import { buscarCertidaoTcu } from "@/lib/api-tcu";
import { validarCnpj } from "@/lib/cnpj";
import { validarCpf } from "@/lib/cpf";
import { cn } from "@/lib/cn";
import { FORMATO_CODIGO_EMENDA } from "@/lib/emendas";
import { formatarCnpj, mascararCnpj, mascararCpf } from "@/lib/formatters";
import {
  comBeneficiosFiscais,
  comCadastro,
  comCertidaoTcu,
  comComplemento,
  comContratosAm,
  comConvenios,
  comEmenda,
  comEmpenhosAm,
  comEmpenhosFederais,
  comEmpresaPendente,
  comGovernoFederal,
  comPessoaFisica,
  comSancoes,
  cpfBateComMascara,
  encontrarCruzamentos,
  idEmenda,
  idEmpresa,
  MODELO_VAZIO,
} from "@/lib/sinapse";
import type { Cruzamento, ModeloSinapse, NoSinapse, TipoNo } from "@/lib/sinapse";
import type { Empresa } from "@/types/cnpj";

// Cada empresa aberta custa de 5 a ~30 chamadas às fontes (a CGU tem cota de 400/min pro app inteiro).
const MAXIMO_EMPRESAS = 8;
const MAXIMO_EMENDAS = 5;

// Dois fornecedores da Marinha pagos pela mesma emenda: o exemplo mostra um órgão em comum.
const EXEMPLO = ["54464211000104", "46106851000114"];

// A CNPJá tem limite apertado (5/min por IP): só consulta quando pode acrescentar algo, como na tela de CNPJ.
const UFS_AREA_SUFRAMA = new Set(["AM", "RO", "RR", "AC", "AP"]);
function precisaComplemento(empresa: Empresa): boolean {
  return UFS_AREA_SUFRAMA.has(empresa.uf ?? "") || !empresa.email;
}

type Fonte =
  | "cadastro"
  | "sancoes"
  | "tcu"
  | "federal"
  | "complemento"
  | "am"
  | "empenhosFederais"
  | "empenhosAm"
  | "convenios"
  | "emenda";
type FonteSobDemanda = "empenhosFederais" | "empenhosAm" | "convenios";
type EstadoFonte = "carregando" | "ok" | "vazio" | "limite" | "erro";

const ROTULO_FONTE: Record<Fonte, string> = {
  cadastro: "Cadastro (Receita)",
  sancoes: "Sanções (CGU)",
  tcu: "Certidão do TCU",
  federal: "Governo federal e benefícios fiscais (CGU)",
  complemento: "SUFRAMA e e-mail (CNPJá)",
  am: "Contratos do Governo do Amazonas",
  empenhosFederais: "Empenhos a receber — federal",
  empenhosAm: "Empenhos a receber — Amazonas",
  convenios: "Convênios (CGU)",
  emenda: "Emenda e quem recebeu (CGU)",
};

const ROTULO_ESTADO: Record<EstadoFonte, string> = {
  carregando: "consultando…",
  ok: "no mapa",
  vazio: "nada encontrado",
  limite: "limite de consultas — tente de novo em 1 minuto",
  erro: "não respondeu",
};

const SOB_DEMANDA: { fonte: FonteSobDemanda; botao: string }[] = [
  { fonte: "empenhosFederais", botao: "Empenhos a receber (federal)" },
  { fonte: "empenhosAm", botao: "Empenhos a receber (Amazonas)" },
  { fonte: "convenios", botao: "Convênios desta entidade" },
];

const ROTULO_TIPO: Record<TipoNo, string> = {
  empresa: "Empresa",
  pessoa: "Pessoa",
  "orgao-federal": "Órgão federal",
  "orgao-am": "Órgão do Amazonas",
  sancao: "Sanção",
  beneficio: "Benefício fiscal",
  registro: "Registro (SUFRAMA)",
  parlamentar: "Autor de emenda",
  emenda: "Emenda parlamentar",
  cargo: "Cargo público (PEP)",
};

type EstadoCpf = { status: "carregando" } | { status: "ok" } | { status: "erro"; mensagem: string };

/** "***455835**" → "***.455.835-**", como a tela de CPF mostra. */
function formatarCpfMascarado(documento: string | undefined): string {
  const d = (documento ?? "").replace(/\D/g, "");
  return d.length === 6 ? `***.${d.slice(0, 3)}.${d.slice(3)}-**` : (documento ?? "");
}

// ---------------------------------------------------------------------------
// Cores do grafo: o Cytoscape desenha em canvas e precisa de cores prontas, então
// elas saem das variáveis do tema (app/globals.css), com o valor do tema de reserva.
// ---------------------------------------------------------------------------

function ehEscuro(): boolean {
  return document.documentElement.classList.contains("dark");
}

function cores(escuro: boolean) {
  const estilo = getComputedStyle(document.documentElement);
  const v = (nome: string, reserva: string) => estilo.getPropertyValue(`--color-${nome}`).trim() || reserva;
  return {
    texto: escuro ? v("ink-200", "#e2e8f0") : v("ink-700", "#334155"),
    fundo: escuro ? v("ink-900", "#0f172a") : "#ffffff",
    empresa: v("primary-600", "#2563eb"),
    pessoa: escuro ? v("ink-400", "#94a3b8") : v("ink-500", "#64748b"),
    orgaoFederal: v("accent-600", "#7c3aed"),
    orgaoAm: escuro ? v("accent-900", "#4c1d95") : v("accent-100", "#ede9fe"),
    beneficio: v("primary-300", "#93c5fd"),
    registro: escuro ? v("ink-500", "#64748b") : v("ink-400", "#94a3b8"),
    parlamentar: escuro ? v("ink-200", "#e2e8f0") : v("ink-800", "#1e293b"),
    emenda: v("success-600", "#059669"),
    receber: v("primary-400", "#60a5fa"),
    perigo: v("danger-600", "#dc2626"),
    atencao: v("warning-600", "#d97706"),
    linha: escuro ? v("ink-600", "#475569") : v("ink-300", "#cbd5e1"),
    linhaSancao: escuro ? v("danger-900", "#7f1d1d") : v("danger-200", "#fecaca"),
    foco: v("primary-500", "#3b82f6"),
  };
}

function estilos(c: ReturnType<typeof cores>): StylesheetJson {
  return [
    {
      selector: "node",
      style: {
        label: "data(rotulo)",
        "font-size": 11,
        "font-family": 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
        color: c.texto,
        "text-valign": "bottom",
        "text-margin-y": 6,
        "text-wrap": "ellipsis",
        "text-max-width": "130px",
        "text-background-color": c.fundo,
        "text-background-opacity": 0.85,
        "text-background-padding": "2px",
        "text-background-shape": "roundrectangle",
        width: 22,
        height: 22,
        "border-width": 0,
      },
    },
    { selector: 'node[tipo = "empresa"]', style: { shape: "round-rectangle", "background-color": c.empresa, width: 30, height: 30 } },
    { selector: 'node[tipo = "empresa"][?expandida]', style: { width: 40, height: 40, "font-weight": 600 } },
    // Empresa só citada (sócia de outra, ou quem recebeu uma emenda), ainda não aberta: contorno tracejado.
    {
      selector: 'node[tipo = "empresa"][!expandida]',
      style: { "background-color": c.fundo, "border-width": 2, "border-style": "dashed", "border-color": c.empresa },
    },
    { selector: 'node[tipo = "pessoa"]', style: { shape: "ellipse", "background-color": c.pessoa } },
    { selector: 'node[tipo = "orgao-federal"]', style: { shape: "round-hexagon", "background-color": c.orgaoFederal, width: 26, height: 26 } },
    {
      selector: 'node[tipo = "orgao-am"]',
      style: { shape: "round-diamond", "background-color": c.orgaoAm, "border-width": 2, "border-color": c.orgaoFederal, width: 26, height: 26 },
    },
    { selector: 'node[tipo = "sancao"]', style: { shape: "round-octagon", "background-color": c.perigo, width: 20, height: 20 } },
    { selector: 'node[tipo = "beneficio"]', style: { shape: "round-tag", "background-color": c.beneficio } },
    { selector: 'node[tipo = "registro"]', style: { shape: "barrel", "background-color": c.registro } },
    { selector: 'node[tipo = "parlamentar"]', style: { shape: "round-pentagon", "background-color": c.parlamentar, width: 30, height: 30 } },
    { selector: 'node[tipo = "emenda"]', style: { shape: "rhomboid", "background-color": c.emenda, width: 32, height: 22 } },
    { selector: 'node[tipo = "cargo"]', style: { shape: "star", "background-color": c.atencao, width: 24, height: 24 } },
    { selector: 'node[alerta = "perigo"]', style: { "border-width": 4, "border-color": c.perigo, "border-style": "solid" } },
    { selector: 'node[alerta = "atencao"]', style: { "border-width": 4, "border-color": c.atencao, "border-style": "solid" } },
    { selector: "node:selected", style: { "overlay-color": c.foco, "overlay-opacity": 0.2, "overlay-padding": 6 } },
    {
      selector: "edge",
      style: { width: "data(largura)", "line-color": c.linha, "curve-style": "bezier", opacity: 0.85 },
    },
    { selector: 'edge[tipo = "sancao"]', style: { "line-color": c.linhaSancao } },
    { selector: 'edge[tipo = "a-receber"]', style: { "line-style": "dotted", "line-color": c.receber } },
    { selector: 'edge[tipo = "emenda-pagamento"]', style: { "line-color": c.emenda } },
    { selector: 'edge[tipo = "pep"], edge[tipo = "servidor"]', style: { "line-style": "dashed" } },
    {
      selector: 'edge[tipo = "mesmo-endereco"], edge[tipo = "mesmo-telefone"], edge[tipo = "mesmo-email"]',
      style: { "line-style": "dashed", "line-color": c.atencao, width: 2 },
    },
    // O texto de cada ligação fica no painel: no desenho ele cobria os pontos.
    { selector: "edge.destaque", style: { "line-color": c.foco, opacity: 1, "z-index": 10 } },
    { selector: ".apagado", style: { opacity: 0.22 } },
  ];
}

/** Espessura da linha pelo dinheiro: R$ 1 mil → 1,5px; R$ 1 milhão → 4,5px; teto de 6px. */
function largura(valor: number | undefined): number {
  if (!valor || valor <= 0) return 1.5;
  return 1.5 + Math.min(4.5, Math.max(0, Math.log10(valor) - 3));
}

const LAYOUT: CoseLayoutOptions = {
  name: "cose",
  animate: true,
  animationDuration: 450,
  randomize: false,
  fit: true,
  padding: 40,
  nodeDimensionsIncludeLabels: true,
  nodeRepulsion: () => 9000,
  idealEdgeLength: () => 90,
};

// ---------------------------------------------------------------------------

function Legenda() {
  const itens: [string, string][] = [
    ["Empresa", "h-3 w-3 rounded-sm bg-primary-600"],
    ["Empresa ainda não aberta", "h-3 w-3 rounded-sm border-2 border-dashed border-primary-600"],
    ["Pessoa", "h-3 w-3 rounded-full bg-ink-500 dark:bg-ink-400"],
    ["Órgão federal", "h-3 w-3 rotate-45 rounded-sm bg-accent-600"],
    ["Órgão do Amazonas", "h-3 w-3 rotate-45 rounded-sm border-2 border-accent-600 bg-accent-100 dark:bg-accent-900"],
    ["Sanção", "h-3 w-3 rounded-full bg-danger-600"],
    ["Benefício fiscal", "h-3 w-3 rounded-sm bg-primary-300"],
    ["SUFRAMA", "h-3 w-3 rounded bg-ink-400 dark:bg-ink-500"],
    ["Autor de emenda", "h-3 w-3 rounded-sm bg-ink-800 dark:bg-ink-200"],
    ["Emenda", "h-3 w-3 -skew-x-12 bg-success-600"],
    ["Cargo público (PEP)", "h-3 w-3 rotate-45 bg-warning-600"],
  ];
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-ink-600 dark:text-ink-300">
      {itens.map(([rotulo, classe]) => (
        <li key={rotulo} className="inline-flex items-center gap-1.5">
          <span className={cn("inline-block shrink-0", classe)} aria-hidden />
          {rotulo}
        </li>
      ))}
      <li className="inline-flex items-center gap-1.5">
        <span className="inline-block w-4 border-t-2 border-dotted border-primary-400" aria-hidden />
        Empenho a receber
      </li>
      <li className="inline-flex items-center gap-1.5">
        <span className="inline-block h-3 w-3 rounded-sm border-2 border-danger-600 bg-primary-600" aria-hidden />
        Contorno vermelho: sanção · âmbar: atenção (inativa, PEP)
      </li>
    </ul>
  );
}

const TOM_CRUZAMENTO = { perigo: "danger", atencao: "warning", info: "primary" } as const;
const ROTULO_CRUZAMENTO: Record<Cruzamento["tipo"], string> = {
  "socio-comum": "Sócio",
  "orgao-comum": "Órgão",
  "beneficio-comum": "Benefício",
  "mesmo-endereco": "Endereço",
  "mesmo-telefone": "Telefone",
  "mesmo-email": "E-mail",
  "sancionada-com-contratos": "Sanção",
  "emenda-para-sancionada": "Emenda",
  "socio-com-alerta": "Sócio",
};

function ListaCruzamentos({ cruzamentos, onFocar, pontos }: { cruzamentos: Cruzamento[]; onFocar: (id: string) => void; pontos: number }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-ink-500 dark:text-ink-400">Cruzamentos encontrados</p>
      {cruzamentos.length === 0 ? (
        <p className="mt-1.5 text-sm text-ink-500 dark:text-ink-400">
          {pontos < 2
            ? "Adicione outra empresa ou uma emenda para o mapa procurar sócios, órgãos, endereço, telefone ou e-mail em comum."
            : "Nenhum cruzamento no mapa até agora."}
        </p>
      ) : (
        <ul className="mt-2 space-y-2">
          {cruzamentos.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => onFocar(c.foco)}
                className="w-full rounded-lg border border-ink-200 p-2.5 text-left hover:bg-ink-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:border-ink-700 dark:hover:bg-ink-800"
              >
                <span className="flex items-center gap-1.5">
                  <Badge tone={TOM_CRUZAMENTO[c.gravidade]}>{ROTULO_CRUZAMENTO[c.tipo]}</Badge>
                  <span className="text-sm font-medium text-ink-900 dark:text-ink-50">{c.titulo}</span>
                </span>
                <span className="mt-1 block text-xs text-ink-500 dark:text-ink-400">{c.descricao}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ListaFontes({ fontes }: { fontes: Partial<Record<Fonte, EstadoFonte>> }) {
  return (
    <ul className="space-y-0.5 text-xs text-ink-500 dark:text-ink-400">
      {(Object.keys(fontes) as Fonte[]).map((f) => (
        <li key={f} className="flex items-center gap-1.5">
          {fontes[f] === "carregando" ? (
            <Loader2 className="h-3 w-3 shrink-0 animate-spin" aria-hidden />
          ) : (
            <span
              className={cn(
                "h-1.5 w-1.5 shrink-0 rounded-full",
                fontes[f] === "erro" || fontes[f] === "limite"
                  ? "bg-danger-600"
                  : fontes[f] === "vazio"
                    ? "bg-ink-300 dark:bg-ink-600"
                    : "bg-success-600",
              )}
              aria-hidden
            />
          )}
          {ROTULO_FONTE[f]}: {ROTULO_ESTADO[fontes[f] ?? "vazio"]}
        </li>
      ))}
    </ul>
  );
}

/** CPF completo de um sócio, conferido com os dígitos que a Receita mostra antes de consultar. */
function ConsultaCpfSocio({
  no,
  estado,
  onConsultar,
}: {
  no: NoSinapse;
  estado?: EstadoCpf;
  onConsultar: (idPessoa: string, documento: string | undefined, cpf: string) => void;
}) {
  const [cpf, setCpf] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (cpf.trim()) onConsultar(no.id, no.documento, cpf);
      }}
      className="rounded-lg border border-ink-200 p-3 dark:border-ink-700"
    >
      <Input
        label="CPF completo deste sócio"
        placeholder="000.000.000-00"
        inputMode="numeric"
        autoComplete="off"
        leftIcon={<UserRound className="h-4 w-4" aria-hidden />}
        value={cpf}
        maxLength={14}
        error={estado?.status === "erro" ? estado.mensagem : undefined}
        onChange={(e) => setCpf(mascararCpf(e.target.value))}
        onClear={() => setCpf("")}
      />
      <p className="mt-1.5 text-xs text-ink-500 dark:text-ink-400">
        Precisa bater com os dígitos que a Receita mostra ({formatarCpfMascarado(no.documento)}). Traz sanções, PEP e vínculo
        de servidor. O CPF não fica guardado.
      </p>
      <Button type="submit" size="sm" className="mt-2" loading={estado?.status === "carregando"}>
        Consultar CPF
      </Button>
    </form>
  );
}

function PainelNo({
  no,
  modelo,
  fontes,
  estadoCpf,
  onSelecionar,
  onAbrir,
  onCentralizar,
  onCarregar,
  onConsultarCpf,
}: {
  no: NoSinapse;
  modelo: ModeloSinapse;
  fontes?: Partial<Record<Fonte, EstadoFonte>>;
  estadoCpf?: EstadoCpf;
  onSelecionar: (id: string) => void;
  onAbrir: (cnpj: string) => void;
  onCentralizar: (id: string) => void;
  onCarregar: (cnpj: string, fonte: FonteSobDemanda, razaoSocial?: string) => void;
  onConsultarCpf: (idPessoa: string, documento: string | undefined, cpf: string) => void;
}) {
  const ligacoes = Object.values(modelo.arestas)
    .filter((a) => a.origem === no.id || a.destino === no.id)
    .map((a) => ({ aresta: a, outro: modelo.nos[a.origem === no.id ? a.destino : a.origem] }))
    .filter((l) => l.outro);
  const razaoSocial = no.info.find(([k]) => k === "Razão social")?.[1];
  const pendentes = no.tipo === "empresa" && no.expandida && no.cnpj ? SOB_DEMANDA.filter((s) => !fontes?.[s.fonte]) : [];
  // Só sócio pessoa física com CPF mascarado de verdade pode ser conferido.
  const podeConsultarCpf = no.tipo === "pessoa" && !no.cpfConsultado && (no.documento ?? "").replace(/\D/g, "").length === 6;

  return (
    <div className="space-y-4">
      <div>
        <p className="flex flex-wrap items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-ink-500 dark:text-ink-400">
          {ROTULO_TIPO[no.tipo]}
          {no.alerta === "perigo" && <Badge tone="danger">Atenção</Badge>}
          {no.alerta === "atencao" && <Badge tone="warning">Atenção</Badge>}
        </p>
        <p className="mt-1 text-base font-semibold text-ink-900 dark:text-ink-50">{no.rotulo}</p>
        {no.detalhe && <p className="mt-0.5 text-xs text-ink-500 dark:text-ink-400">{no.detalhe}</p>}
      </div>

      <dl className="space-y-1 text-sm">
        {no.info.map(([rotulo, valor]) => (
          <div key={rotulo} className="flex gap-2">
            <dt className="w-28 shrink-0 text-xs text-ink-500 dark:text-ink-400">{rotulo}</dt>
            <dd className="min-w-0 break-words text-ink-700 dark:text-ink-200">{valor}</dd>
          </div>
        ))}
      </dl>

      {fontes && <ListaFontes fontes={fontes} />}

      <div className="flex flex-wrap gap-2">
        {no.tipo === "empresa" && no.cnpj && !no.expandida && (
          <Button size="sm" leftIcon={<Plus className="h-4 w-4" aria-hidden />} onClick={() => onAbrir(no.cnpj!)}>
            Abrir ligações desta empresa
          </Button>
        )}
        {pendentes.map((s) => (
          <Button
            key={s.fonte}
            size="sm"
            variant="secondary"
            leftIcon={<Plus className="h-4 w-4" aria-hidden />}
            onClick={() => onCarregar(no.cnpj!, s.fonte, razaoSocial)}
          >
            {s.botao}
          </Button>
        ))}
        <Button size="sm" variant="ghost" onClick={() => onCentralizar(no.id)}>
          Centralizar
        </Button>
        {no.tipo === "empresa" && no.cnpj && (
          <Link
            href={`/cnpj?cnpj=${no.cnpj}`}
            target="_blank"
            rel="noopener"
            className="inline-flex h-8 items-center gap-1 px-1 text-sm font-medium text-primary-600 hover:underline dark:text-primary-400"
          >
            Consulta completa
            <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
            <span className="sr-only">(abre em nova aba)</span>
          </Link>
        )}
      </div>
      {pendentes.length > 0 && (
        <p className="text-xs text-ink-400 dark:text-ink-500">
          Empenhos e convênios são consultas pesadas: só entram no mapa quando você pede. Convênios procura pelo nome da
          entidade, então só acham prefeituras, secretarias e entidades que recebem repasse.
        </p>
      )}

      {podeConsultarCpf && <ConsultaCpfSocio no={no} estado={estadoCpf} onConsultar={onConsultarCpf} />}

      {ligacoes.length > 0 && (
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-ink-500 dark:text-ink-400">Ligações ({ligacoes.length})</p>
          <ul className="mt-1.5 space-y-1">
            {ligacoes.map(({ aresta, outro }) => (
              <li key={aresta.id}>
                <button
                  type="button"
                  onClick={() => onSelecionar(outro.id)}
                  className="w-full rounded-md px-2 py-1.5 text-left hover:bg-ink-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:hover:bg-ink-800"
                >
                  <span className="block text-sm text-ink-900 dark:text-ink-50">{outro.rotulo}</span>
                  <span className="block text-xs text-ink-500 dark:text-ink-400">{aresta.rotulo}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function listaDaUrl(valor: string | null): string[] {
  return (valor ?? "")
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean);
}

export function SinapseClient() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<Core | null>(null);
  const layoutTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const iniciais = useRef({ cnpjs: listaDaUrl(searchParams.get("cnpj")), emendas: listaDaUrl(searchParams.get("emenda")) });

  const [pronto, setPronto] = useState(false);
  const [modelo, setModelo] = useState<ModeloSinapse>(MODELO_VAZIO);
  // Fontes da verdade do que está aberto: os estados só servem pra redesenhar a tela.
  const abertasRef = useRef<string[]>([]);
  const emendasRef = useRef<string[]>([]);
  const [abertas, setAbertas] = useState<string[]>([]);
  const [emendas, setEmendas] = useState<string[]>([]);
  const [fontes, setFontes] = useState<Record<string, Partial<Record<Fonte, EstadoFonte>>>>({});
  const [consultasCpf, setConsultasCpf] = useState<Record<string, EstadoCpf>>({});
  const [selecionado, setSelecionado] = useState<string | null>(null);
  const [modo, setModo] = useState<"cnpj" | "emenda">("cnpj");
  const [valor, setValor] = useState("");
  const [incluirAm, setIncluirAm] = useState(true);
  const [erroForm, setErroForm] = useState<string | undefined>();

  const cruzamentos = useMemo(() => encontrarCruzamentos(modelo), [modelo]);
  const consultando = Object.values(fontes).reduce(
    (s, f) => s + Object.values(f).filter((e) => e === "carregando").length,
    0,
  );

  // Monta o Cytoscape só no navegador (ele mexe no DOM e no canvas).
  useEffect(() => {
    let cancelado = false;
    let cy: Core | undefined;
    (async () => {
      const { default: cytoscape } = await import("cytoscape");
      if (cancelado || !containerRef.current) return;
      cy = cytoscape({
        container: containerRef.current,
        style: estilos(cores(ehEscuro())),
        minZoom: 0.2,
        maxZoom: 3,
        boxSelectionEnabled: false,
      });
      cy.on("tap", "node", (e) => setSelecionado(e.target.id()));
      cy.on("tap", (e) => {
        if (e.target === cy) setSelecionado(null);
      });
      cyRef.current = cy;
      setPronto(true);
    })();

    // O tema troca pela classe .dark no <html>: redesenha com as cores do novo tema.
    const observador = new MutationObserver(() => cyRef.current?.style(estilos(cores(ehEscuro()))));
    observador.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    // O canvas não acompanha sozinho a caixa (celular girando, painel abrindo): ajusta e reenquadra.
    const redimensionar = new ResizeObserver(() => {
      const atual = cyRef.current;
      if (!atual) return;
      atual.resize();
      if (atual.elements().nonempty()) atual.fit(undefined, 40);
    });
    if (containerRef.current) redimensionar.observe(containerRef.current);

    return () => {
      cancelado = true;
      observador.disconnect();
      redimensionar.disconnect();
      clearTimeout(layoutTimer.current);
      cy?.destroy();
      cyRef.current = null;
    };
  }, []);

  // Leva o modelo pro grafo: acrescenta o que é novo, atualiza o resto e reorganiza.
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy || !pronto) return;
    const ids = new Set<string>();
    let novos = 0;
    cy.batch(() => {
      for (const no of Object.values(modelo.nos)) {
        ids.add(no.id);
        const dados = { id: no.id, rotulo: no.rotulo, tipo: no.tipo, alerta: no.alerta ?? "", expandida: Boolean(no.expandida) };
        const el = cy.getElementById(no.id);
        if (el.nonempty()) {
          el.data(dados);
          continue;
        }
        // Nasce perto de um vizinho já desenhado, pra não voar do canto da tela.
        const ligacao = Object.values(modelo.arestas).find((a) => a.origem === no.id || a.destino === no.id);
        const vizinho = ligacao ? cy.getElementById(ligacao.origem === no.id ? ligacao.destino : ligacao.origem) : undefined;
        const base = vizinho?.nonempty() ? vizinho.position() : { x: 0, y: 0 };
        cy.add({
          group: "nodes",
          data: dados,
          position: { x: base.x + (Math.random() - 0.5) * 120, y: base.y + (Math.random() - 0.5) * 120 },
        });
        novos++;
      }
      for (const a of Object.values(modelo.arestas)) {
        if (!ids.has(a.origem) || !ids.has(a.destino)) continue;
        ids.add(a.id);
        const dados = { id: a.id, source: a.origem, target: a.destino, tipo: a.tipo, rotulo: a.rotulo, largura: largura(a.valor) };
        const el = cy.getElementById(a.id);
        if (el.nonempty()) el.data({ rotulo: dados.rotulo, largura: dados.largura });
        else {
          cy.add({ group: "edges", data: dados });
          novos++;
        }
      }
      cy.elements().forEach((el) => {
        if (!ids.has(el.id())) el.remove();
      });
    });
    if (novos > 0) {
      // As respostas chegam em rajadas: espera um instante pra reorganizar uma vez só.
      clearTimeout(layoutTimer.current);
      layoutTimer.current = setTimeout(() => cyRef.current?.layout(LAYOUT).run(), 150);
    }
  }, [modelo, pronto]);

  // Destaca o ponto escolhido e as ligações dele; apaga o resto.
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy || !pronto) return;
    cy.elements().removeClass("destaque apagado").unselect();
    if (!selecionado) return;
    const no = cy.getElementById(selecionado);
    if (no.empty()) return;
    no.select();
    cy.elements().not(no.closedNeighborhood()).addClass("apagado");
    no.connectedEdges().addClass("destaque");
  }, [selecionado, modelo, pronto]);

  const marcarFonte = useCallback((chave: string, fonte: Fonte, estado: EstadoFonte) => {
    setFontes((f) => ({ ...f, [chave]: { ...f[chave], [fonte]: estado } }));
  }, []);

  /** Uma consulta de uma fonte: `aplicar` põe o resultado no modelo e diz o estado; erro vira "não respondeu". */
  const consultarFonte = useCallback(
    <T,>(chave: string, fonte: Fonte, promessa: Promise<T>, aplicar: (r: T) => EstadoFonte) => {
      marcarFonte(chave, fonte, "carregando");
      promessa.then((r) => marcarFonte(chave, fonte, aplicar(r))).catch(() => marcarFonte(chave, fonte, "erro"));
    },
    [marcarFonte],
  );

  const abrirEmpresa = useCallback(
    (entrada: string, selecionar = true) => {
      const validacao = validarCnpj(entrada);
      if (!validacao.valido) {
        setErroForm(validacao.mensagem);
        return;
      }
      const cnpj = validacao.cnpj;
      setErroForm(undefined);
      if (selecionar) setSelecionado(idEmpresa(cnpj));

      if (abertasRef.current.includes(cnpj)) return;
      if (abertasRef.current.length >= MAXIMO_EMPRESAS) {
        setErroForm(`Nesta versão beta o mapa abre até ${MAXIMO_EMPRESAS} empresas. Limpe o mapa para começar outro.`);
        return;
      }
      abertasRef.current = [...abertasRef.current, cnpj];
      setAbertas(abertasRef.current);
      setModelo((m) => comEmpresaPendente(m, cnpj));

      consultarFonte(cnpj, "cadastro", buscarEmpresa(cnpj), (r) => {
        if (r.status === "erro_servidor") throw new Error("cadastro");
        if (r.status !== "sucesso") return "vazio";
        setModelo((m) => comCadastro(m, r.empresa));
        if (precisaComplemento(r.empresa)) {
          consultarFonte(cnpj, "complemento", buscarComplementoCnpj(cnpj), (rc) => {
            if (rc.status === "limite") return "limite";
            if (rc.status === "erro_servidor") throw new Error("complemento");
            if (rc.status !== "sucesso") return "vazio";
            setModelo((m) => comComplemento(m, cnpj, rc.complemento));
            return rc.complemento.suframa.length || rc.complemento.emails.length ? "ok" : "vazio";
          });
        }
        return "ok";
      });
      consultarFonte(cnpj, "sancoes", buscarSancoes(cnpj), (r) => {
        if (r.status === "erro_servidor") throw new Error("sanções");
        if (r.status !== "sucesso") return "vazio";
        const todas = [...r.ceis, ...r.cnep];
        setModelo((m) => comSancoes(m, cnpj, todas));
        return todas.length ? "ok" : "vazio";
      });
      consultarFonte(cnpj, "tcu", buscarCertidaoTcu(cnpj), (r) => {
        if (r.status === "erro_servidor") throw new Error("TCU");
        if (r.status !== "sucesso") return "vazio";
        setModelo((m) => comCertidaoTcu(m, cnpj, r));
        return r.itens.some((i) => i.situacao === "consta" && i.tipo !== "CEIS" && i.tipo !== "CNEP") ? "ok" : "vazio";
      });
      consultarFonte(cnpj, "federal", buscarDadosGovernoFederal(cnpj), (r) => {
        if (r.status === "erro_servidor") throw new Error("governo federal");
        if (r.status !== "sucesso") return "vazio";
        setModelo((m) => {
          const comFederal = comGovernoFederal(m, cnpj, r);
          return r.beneficiosFiscais ? comBeneficiosFiscais(comFederal, cnpj, r.beneficiosFiscais) : comFederal;
        });
        const temAlgo =
          r.contratos?.itens.length ||
          r.pagamentos?.porOrgao.length ||
          r.beneficiosFiscais?.regimes.length ||
          r.beneficiosFiscais?.renunciasPorAno.length;
        return temAlgo ? "ok" : "vazio";
      });
      if (incluirAm) {
        consultarFonte(cnpj, "am", buscarContratosAm(cnpj), (r) => {
          if (r.status === "erro_servidor") throw new Error("Amazonas");
          if (r.status !== "sucesso") return "vazio";
          setModelo((m) => comContratosAm(m, cnpj, r.contratos));
          return r.contratos.length ? "ok" : "vazio";
        });
      }
    },
    [incluirAm, consultarFonte],
  );

  /** Empenhos e convênios: pesados demais pra entrar sozinhos; o painel da empresa pede. */
  const carregarSobDemanda = useCallback(
    (cnpj: string, fonte: FonteSobDemanda, razaoSocial?: string) => {
      if (fonte === "empenhosFederais") {
        consultarFonte(cnpj, fonte, buscarEmpenhosFederais(cnpj), (r) => {
          if (r.status === "limite") return "limite";
          if (r.status === "erro_servidor") throw new Error("empenhos federais");
          if (r.status !== "sucesso") return "vazio";
          setModelo((m) => comEmpenhosFederais(m, cnpj, r));
          return r.totais.aReceber > 0 ? "ok" : "vazio";
        });
      } else if (fonte === "empenhosAm") {
        consultarFonte(cnpj, fonte, buscarEmpenhosAm(cnpj), (r) => {
          if (r.status === "erro_servidor") throw new Error("empenhos AM");
          if (r.status !== "sucesso") return "vazio";
          setModelo((m) => comEmpenhosAm(m, cnpj, r));
          return r.totais.aReceber > 0 ? "ok" : "vazio";
        });
      } else if (razaoSocial) {
        consultarFonte(cnpj, fonte, buscarConvenios({ convenente: razaoSocial, pagina: 1 }), (r) => {
          if (r.status === "erro_servidor") throw new Error("convênios");
          if (r.status !== "sucesso") return "vazio";
          setModelo((m) => comConvenios(m, cnpj, r.itens));
          return r.itens.length ? "ok" : "vazio";
        });
      }
    },
    [consultarFonte],
  );

  const abrirEmenda = useCallback(
    (entrada: string, selecionar = true) => {
      const codigo = entrada.replace(/\D/g, "");
      if (!FORMATO_CODIGO_EMENDA.test(codigo)) {
        setErroForm("Código da emenda inválido: são 12 dígitos, como aparece na tela de Emendas (ex.: 202471040014).");
        return;
      }
      setErroForm(undefined);
      const id = idEmenda(codigo);
      if (selecionar) setSelecionado(id);
      if (emendasRef.current.includes(codigo)) return;
      if (emendasRef.current.length >= MAXIMO_EMENDAS) {
        setErroForm(`Nesta versão beta o mapa abre até ${MAXIMO_EMENDAS} emendas. Limpe o mapa para começar outro.`);
        return;
      }
      emendasRef.current = [...emendasRef.current, codigo];
      setEmendas(emendasRef.current);

      const busca = Promise.all([buscarEmendas({ codigo, pagina: 1 }), buscarDocumentosEmenda(codigo)]);
      consultarFonte(id, "emenda", busca, ([re, rd]) => {
        if (re.status === "erro_servidor") throw new Error("emenda");
        const emenda = re.status === "sucesso" ? re.itens[0] : undefined;
        if (!emenda) {
          setErroForm(`A emenda ${codigo} não foi encontrada no Portal da Transparência.`);
          emendasRef.current = emendasRef.current.filter((c) => c !== codigo);
          setEmendas(emendasRef.current);
          return "vazio";
        }
        setModelo((m) => comEmenda(m, emenda, rd.status === "sucesso" ? rd : null));
        return "ok";
      });
    },
    [consultarFonte],
  );

  const consultarCpfDoSocio = useCallback(async (idPessoa: string, documento: string | undefined, cpf: string) => {
    const validacao = validarCpf(cpf);
    const erro = (mensagem: string) => setConsultasCpf((c) => ({ ...c, [idPessoa]: { status: "erro", mensagem } }));
    if (!validacao.valido) return erro(validacao.mensagem);
    if (!cpfBateComMascara(validacao.cpf, documento)) {
      return erro(`Esse CPF não bate com os dígitos que a Receita mostra para este sócio (${formatarCpfMascarado(documento)}).`);
    }
    setConsultasCpf((c) => ({ ...c, [idPessoa]: { status: "carregando" } }));
    const r = await consultarCpf(validacao.cpf);
    if (r.status === "sucesso") {
      setModelo((m) => comPessoaFisica(m, idPessoa, r.pessoa));
      setConsultasCpf((c) => ({ ...c, [idPessoa]: { status: "ok" } }));
    } else if (r.status !== "cancelado") {
      erro("mensagem" in r && r.mensagem ? r.mensagem : "Não foi possível consultar o CPF agora.");
    }
  }, []);

  // Abre o que veio na URL (/sinapse?cnpj=A,B&emenda=C) quando o grafo fica pronto.
  useEffect(() => {
    if (!pronto) return;
    const { cnpjs, emendas: codigos } = iniciais.current;
    iniciais.current = { cnpjs: [], emendas: [] };
    const sozinho = cnpjs.length + codigos.length === 1;
    for (const c of cnpjs) abrirEmpresa(c, sozinho);
    for (const c of codigos) abrirEmenda(c, sozinho);
  }, [pronto, abrirEmpresa, abrirEmenda]);

  // A URL guarda o que está aberto, pra dar pra compartilhar o mapa.
  useEffect(() => {
    if (!pronto) return;
    const partes = [abertas.length && `cnpj=${abertas.join(",")}`, emendas.length && `emenda=${emendas.join(",")}`].filter(Boolean);
    router.replace(partes.length ? `${pathname}?${partes.join("&")}` : pathname, { scroll: false });
  }, [abertas, emendas, pathname, router, pronto]);

  function adicionar(evento: FormEvent) {
    evento.preventDefault();
    if (!valor.trim()) return;
    if (modo === "cnpj") abrirEmpresa(valor);
    else abrirEmenda(valor);
    setValor("");
  }

  function limpar() {
    abertasRef.current = [];
    emendasRef.current = [];
    setModelo(MODELO_VAZIO);
    setAbertas([]);
    setEmendas([]);
    setFontes({});
    setConsultasCpf({});
    setSelecionado(null);
    setErroForm(undefined);
  }

  function centralizar(id: string) {
    const cy = cyRef.current;
    const el = cy?.getElementById(id);
    if (cy && el?.nonempty()) cy.animate({ center: { eles: el }, zoom: Math.max(cy.zoom(), 1.2) }, { duration: 300 });
  }

  function focar(id: string) {
    setSelecionado(id);
    centralizar(id);
  }

  const noSelecionado = selecionado ? modelo.nos[selecionado] : undefined;
  const totalNos = Object.keys(modelo.nos).length;
  const totalArestas = Object.keys(modelo.arestas).length;
  const fontesDoSelecionado = noSelecionado?.cnpj
    ? fontes[noSelecionado.cnpj]
    : noSelecionado?.tipo === "emenda"
      ? fontes[noSelecionado.id]
      : undefined;

  return (
    <div className="flex flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <div className="border-b border-ink-200 pb-4 dark:border-ink-700">
        <h1 className="flex items-center gap-2 text-base font-semibold text-ink-900 dark:text-ink-50">
          Sinapse
          <Badge tone="accent">Beta</Badge>
        </h1>
        <p className="mt-1 text-xs text-ink-500 dark:text-ink-400">
          Mapa de relações: empresas, sócios, órgãos, sanções, benefícios, emendas e o dinheiro entre eles num só desenho.
          Adicione mais de uma empresa ou emenda para ver o que elas têm em comum.
        </p>
      </div>

      <form
        onSubmit={adicionar}
        className="rounded-2xl border border-ink-200 bg-white p-5 shadow-card dark:border-ink-700 dark:bg-ink-900 sm:p-6"
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[12rem_minmax(0,1fr)_auto] sm:items-end">
          <Select
            label="Adicionar"
            value={modo}
            onChange={(e) => {
              setModo(e.target.value as "cnpj" | "emenda");
              setValor("");
              setErroForm(undefined);
            }}
          >
            <option value="cnpj">Empresa (CNPJ)</option>
            <option value="emenda">Emenda (código)</option>
          </Select>
          <Input
            label={modo === "cnpj" ? "CNPJ" : "Código da emenda"}
            placeholder={modo === "cnpj" ? "00.000.000/0000-00" : "Ex.: 202471040014"}
            inputMode="numeric"
            leftIcon={
              modo === "cnpj" ? <Building2 className="h-4 w-4" aria-hidden /> : <Landmark className="h-4 w-4" aria-hidden />
            }
            value={valor}
            maxLength={modo === "cnpj" ? 18 : 12}
            error={erroForm}
            onChange={(e) => setValor(modo === "cnpj" ? mascararCnpj(e.target.value) : e.target.value.replace(/\D/g, ""))}
            onClear={() => setValor("")}
          />
          <Button type="submit" leftIcon={<Plus className="h-4 w-4" aria-hidden />}>
            Adicionar ao mapa
          </Button>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
          <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-ink-700 dark:text-ink-200">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-ink-300 text-primary-600 focus-visible:ring-2 focus-visible:ring-primary-500 dark:border-ink-600 dark:bg-ink-800"
              checked={incluirAm}
              onChange={(e) => setIncluirAm(e.target.checked)}
            />
            Incluir contratos do Governo do Amazonas
            <span className="text-xs text-ink-400 dark:text-ink-500">(mais lento)</span>
          </label>
          {totalNos === 0 && (
            <button
              type="button"
              onClick={() => EXEMPLO.forEach((cnpj) => abrirEmpresa(cnpj, false))}
              className="text-sm font-medium text-primary-600 hover:underline dark:text-primary-400"
            >
              Ver um exemplo com duas empresas
            </button>
          )}
        </div>
      </form>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="relative min-w-0 self-start overflow-hidden rounded-2xl border border-ink-200 bg-white shadow-card dark:border-ink-700 dark:bg-ink-900">
          <div
            ref={containerRef}
            role="img"
            aria-label={`Mapa de relações com ${totalNos} pontos e ${totalArestas} ligações. Os cruzamentos e os detalhes de cada ponto estão no painel ao lado.`}
            className="h-[420px] w-full lg:h-[600px]"
          />
          {totalNos === 0 && (
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center">
              <Network className="h-8 w-8 text-ink-300 dark:text-ink-600" aria-hidden />
              <p className="text-sm text-ink-500 dark:text-ink-400">
                Adicione um CNPJ ou uma emenda para começar o mapa. Cada empresa traz sócios, órgãos que contratam com
                ela, sanções e benefícios; cada emenda traz o autor e quem recebeu o dinheiro.
              </p>
            </div>
          )}
          {totalNos > 0 && (
            <div className="absolute right-3 top-3 flex gap-2">
              <Button
                size="sm"
                variant="secondary"
                leftIcon={<Maximize2 className="h-4 w-4" aria-hidden />}
                onClick={() => cyRef.current?.animate({ fit: { eles: cyRef.current.elements(), padding: 40 } }, { duration: 300 })}
              >
                Ajustar
              </Button>
              <Button size="sm" variant="secondary" leftIcon={<Trash2 className="h-4 w-4" aria-hidden />} onClick={limpar}>
                Limpar
              </Button>
            </div>
          )}
          {consultando > 0 && (
            <p className="absolute bottom-3 left-3 flex items-center gap-1.5 rounded-lg bg-white/95 px-2.5 py-1.5 text-xs text-ink-600 shadow-card dark:bg-ink-900/95 dark:text-ink-300">
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              Consultando {consultando} {consultando === 1 ? "fonte" : "fontes"}…
            </p>
          )}
        </div>

        <aside className="flex min-w-0 flex-col gap-5 rounded-2xl border border-ink-200 bg-white p-5 shadow-card scrollbar-fina dark:border-ink-700 dark:bg-ink-900 lg:max-h-[600px] lg:overflow-y-auto">
          {noSelecionado ? (
            <PainelNo
              key={noSelecionado.id}
              no={noSelecionado}
              modelo={modelo}
              fontes={fontesDoSelecionado}
              estadoCpf={consultasCpf[noSelecionado.id]}
              onSelecionar={focar}
              onAbrir={abrirEmpresa}
              onCentralizar={centralizar}
              onCarregar={carregarSobDemanda}
              onConsultarCpf={consultarCpfDoSocio}
            />
          ) : (
            <p className="text-sm text-ink-500 dark:text-ink-400">
              Clique num ponto do mapa para ver os detalhes e as ligações dele.
            </p>
          )}
          <div className="border-t border-ink-100 pt-5 dark:border-ink-800">
            <ListaCruzamentos cruzamentos={cruzamentos} onFocar={focar} pontos={abertas.length + emendas.length} />
          </div>
        </aside>
      </div>

      <div className="flex flex-col gap-3">
        <Legenda />
        <p className="flex items-start gap-1.5 text-xs text-ink-400 dark:text-ink-500">
          <TriangleAlert className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />
          Versão beta. Fontes: Receita Federal (BrasilAPI), CNPJá, Portal da Transparência (CGU), TCU e SEFAZ-AM. O CPF dos
          sócios vem mascarado da Receita, então o mapa liga pessoas pelo nome e pelos dígitos visíveis do CPF — só entre
          pontos que estão no mapa. Cada empresa mostra até 20 órgãos, os de maior valor.
          {abertas.length > 0 && ` Empresas abertas: ${abertas.map((c) => formatarCnpj(c)).join(", ")}.`}
          {emendas.length > 0 && ` Emendas: ${emendas.join(", ")}.`}
        </p>
      </div>
    </div>
  );
}
