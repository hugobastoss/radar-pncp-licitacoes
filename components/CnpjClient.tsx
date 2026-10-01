"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Banknote,
  Building2,
  HeartPulse,
  Loader2,
  Network,
  Search,
  ShieldAlert,
  ShieldCheck,
  TriangleAlert,
  Users,
} from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Tabs } from "@/components/ui/Tabs";
import { Campo } from "@/components/LicitacaoDetails";
import { CertidaoTcuSecao } from "@/components/CertidaoTcuSecao";
import { ConsultasRecentesCard } from "@/components/ConsultasRecentesCard";
import type { EstadoCertidaoTcu } from "@/components/CertidaoTcuSecao";
import { ContratosAmSecao } from "@/components/ContratosAmSecao";
import { DominioEmailLinha } from "@/components/DominioEmailLinha";
import type { EstadoDominio } from "@/components/DominioEmailLinha";
import type { EstadoContratosAm } from "@/components/ContratosAmSecao";
import { GovernoFederalSecao } from "@/components/GovernoFederalSecao";
import { InscricoesEstaduaisSecao } from "@/components/InscricoesEstaduaisSecao";
import { ListaSujaAlerta } from "@/components/ListaSujaAlerta";
import { TransferenciasEspeciaisSecao } from "@/components/TransferenciasEspeciaisSecao";
import type { EstadoTransferencias } from "@/components/TransferenciasEspeciaisSecao";
import type { EstadoGovernoFederal } from "@/components/GovernoFederalSecao";
import { descreverResumoSancoes, resumirSancoes, SancaoItem } from "@/components/SancaoItem";
import { buscarContratosAm } from "@/lib/api-am";
import { buscarComplementoCnpj, buscarEmpresa } from "@/lib/api-cnpj";
import {
  buscarListaSuja,
  buscarOperadoraAns,
  buscarRegistroDominio,
  buscarTransferenciasEspeciais,
} from "@/lib/api-fontes-publicas";
import type { ResultadoListaSuja, ResultadoOperadoraAns } from "@/lib/api-fontes-publicas";
import { buscarDadosGovernoFederal } from "@/lib/api-governo-federal";
import { buscarSancoes } from "@/lib/api-sancoes";
import { buscarCertidaoTcu } from "@/lib/api-tcu";
import { validarCnpj } from "@/lib/cnpj";
import { dominioDoEmail } from "@/lib/dominio-email";
import { registrarEmpresaRecente } from "@/lib/empresas-recentes";
import { useConsulta } from "@/lib/hooks/useConsulta";
import {
  formatarCep,
  formatarCnpj,
  formatarData,
  formatarDataSimples,
  formatarMoeda,
  formatarTelefone,
  mascararCnpj,
} from "@/lib/formatters";
import type { Sancao } from "@/types/transparencia";
import type { Cnae, ComplementoCnpj, Empresa, OpcaoRegime } from "@/types/cnpj";

type Status = "idle" | "carregando" | "sucesso" | "invalido" | "nao_encontrado" | "erro";

type EstadoComplemento =
  | { status: "nao_consultado" }
  | { status: "carregando" }
  | { status: "sucesso"; complemento: ComplementoCnpj }
  | { status: "indisponivel"; mensagem?: string };

type Pendente = { status: "carregando" } | { status: "nao_consultado" };
type EstadoListaSuja = ResultadoListaSuja | Pendente;
type EstadoAns = ResultadoOperadoraAns | Pendente;

type EstadoSancoes =
  | { status: "carregando" }
  | { status: "sucesso"; sancoes: Sancao[] }
  | { status: "nao_configurado" }
  | { status: "erro"; mensagem?: string };

// Mesmo cartão em toda a tela: bloco principal, abas e cada bloco lateral.
const CARTAO = "rounded-[10px] border border-ink-200 bg-white p-5 shadow-card dark:border-ink-700 dark:bg-ink-900 sm:p-6";

function TituloSecao({ icone: Icone, children }: { icone: typeof ShieldAlert; children: React.ReactNode }) {
  return (
    <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-ink-500 dark:text-ink-400">
      <Icone className="h-3.5 w-3.5" aria-hidden />
      {children}
    </p>
  );
}

function descreverSimples(opcao: OpcaoRegime): string {
  if (opcao.optante) {
    return opcao.dataOpcao ? `Optante desde ${formatarDataSimples(opcao.dataOpcao)}` : "Optante";
  }
  if (opcao.dataExclusao) return `Não optante (excluída em ${formatarDataSimples(opcao.dataExclusao)})`;
  return "Não optante";
}

function descreverMei(opcao: OpcaoRegime): string {
  if (opcao.optante) return opcao.dataOpcao ? `Sim, desde ${formatarDataSimples(opcao.dataOpcao)}` : "Sim";
  if (opcao.dataOpcao && opcao.dataExclusao) {
    return `Não (foi MEI de ${formatarDataSimples(opcao.dataOpcao)} a ${formatarDataSimples(opcao.dataExclusao)})`;
  }
  if (opcao.dataExclusao) return `Não (deixou de ser MEI em ${formatarDataSimples(opcao.dataExclusao)})`;
  return "Não";
}

/** Aba "Atividades Econômicas": atividade principal + secundárias, numa tabela só. */
function TabelaAtividades({ empresa }: { empresa: Empresa }) {
  const atividades: (Cnae & { tipo: "Principal" | "Secundária" })[] = [
    ...(empresa.atividadePrincipal ? [{ ...empresa.atividadePrincipal, tipo: "Principal" as const }] : []),
    ...empresa.atividadesSecundarias.map((a) => ({ ...a, tipo: "Secundária" as const })),
  ];

  if (atividades.length === 0) {
    return <p className="text-sm text-ink-500 dark:text-ink-400">Nenhuma atividade econômica informada.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-white dark:bg-ink-900">
          <tr className="border-b border-ink-100 text-left text-xs font-medium uppercase tracking-wide text-ink-500 dark:border-ink-800 dark:text-ink-400">
            <th className="py-2.5 pr-3 font-medium">CNAE</th>
            <th className="py-2.5 pr-3 font-medium">Tipo</th>
            <th className="py-2.5 font-medium">Descrição</th>
          </tr>
        </thead>
        <tbody>
          {atividades.map((a, indice) => (
            <tr key={`${a.codigo}-${indice}`} className="border-b border-ink-50 last:border-0 dark:border-ink-900">
              <td className="whitespace-nowrap py-3 pr-3 tabular-nums text-ink-900 dark:text-ink-50">
                {a.codigo ?? "—"}
              </td>
              <td className="whitespace-nowrap py-3 pr-3 text-ink-700 dark:text-ink-200">{a.tipo}</td>
              <td className="py-3 text-ink-700 dark:text-ink-200">{a.descricao}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Aba "SUFRAMA": inscrições e incentivos (só quando a CNPJá foi consultada). */
function AbaSuframa({ empresa, complemento }: { empresa: Empresa; complemento: EstadoComplemento }) {
  // Área de atuação da SUFRAMA: Amazônia Ocidental (AM, RO, RR, AC) e Amapá.
  const naArea = UFS_AREA_SUFRAMA.has(empresa.uf ?? "");

  if (complemento.status === "nao_consultado") {
    return <p className="text-sm text-ink-500 dark:text-ink-400">Fora da área de atuação da SUFRAMA.</p>;
  }
  if (complemento.status === "carregando") {
    return (
      <p className="flex items-center gap-1.5 text-sm text-ink-500 dark:text-ink-400">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        Consultando inscrição SUFRAMA…
      </p>
    );
  }
  if (complemento.status === "indisponivel") {
    return (
      <p className="text-sm text-ink-500 dark:text-ink-400">
        {complemento.mensagem ?? "Não foi possível consultar a SUFRAMA neste momento."}
      </p>
    );
  }

  const inscricoes = complemento.complemento.suframa;
  if (inscricoes.length === 0) {
    return (
      <p className="text-sm text-ink-600 dark:text-ink-300">
        {naArea ? "Sem inscrição na SUFRAMA." : "Fora da área de atuação da SUFRAMA, e sem inscrição."}
      </p>
    );
  }

  return (
    <>
      <ul className="space-y-3">
        {inscricoes.map((inscricao) => (
          <li key={inscricao.numero} className="text-sm">
            <p className="flex flex-wrap items-center gap-2">
              <span className="font-medium tabular-nums text-ink-900 dark:text-ink-50">
                Inscrição {inscricao.numero}
              </span>
              {inscricao.situacao && (
                <Badge tone={inscricao.situacao.toLowerCase() === "ativa" ? "success" : "danger"}>
                  {inscricao.situacao}
                </Badge>
              )}
              {inscricao.desde && (
                <span className="text-xs text-ink-500 dark:text-ink-400">
                  desde {formatarDataSimples(inscricao.desde)}
                </span>
              )}
            </p>
            {inscricao.incentivos.length > 0 && (
              <ul className="mt-1.5 space-y-1 text-xs text-ink-600 dark:text-ink-300">
                {inscricao.incentivos.map((i) => (
                  <li key={`${i.tributo}-${i.fundamento}`}>
                    <span className="font-medium text-ink-800 dark:text-ink-100">
                      {i.tributo}
                      {i.beneficio && `: ${i.beneficio}`}
                    </span>
                    {i.finalidade && ` para ${i.finalidade.toLowerCase()}`}
                    {i.fundamento && <span className="text-ink-500 dark:text-ink-400"> ({i.fundamento})</span>}
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-ink-400 dark:text-ink-500">
        Fonte: CNPJá, a partir dos dados da SUFRAMA
        {complemento.complemento.atualizadoEm && ` — atualizados em ${formatarData(complemento.complemento.atualizadoEm)}`}
        . Pode ter até 45 dias de atraso.
      </p>
    </>
  );
}

function CabecalhoEmpresaCard({
  empresa,
  sancoes,
  listaSuja,
  ans,
}: {
  empresa: Empresa;
  sancoes: EstadoSancoes;
  listaSuja: EstadoListaSuja;
  ans: EstadoAns;
}) {
  const ativa = empresa.situacaoCadastral?.toUpperCase() === "ATIVA";
  const telefones = empresa.telefones.map(formatarTelefone).join(" · ");
  const resumoSancoes = sancoes.status === "sucesso" ? resumirSancoes(sancoes.sancoes) : undefined;

  return (
    <div className={CARTAO}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-lg font-semibold text-ink-900 dark:text-ink-50">{empresa.razaoSocial}</p>
          {empresa.nomeFantasia && (
            <p className="mt-0.5 text-sm text-ink-600 dark:text-ink-300">{empresa.nomeFantasia}</p>
          )}
          <p className="mt-1 text-xs text-ink-500 dark:text-ink-400">{formatarCnpj(empresa.cnpj)}</p>
          <Link
            href={`/sinapse?cnpj=${empresa.cnpj}`}
            className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-primary-600 hover:underline dark:text-primary-400"
          >
            <Network className="h-3.5 w-3.5" aria-hidden />
            Ver no mapa Sinapse (beta)
          </Link>
        </div>
        <div className="flex flex-wrap gap-2">
          {empresa.matrizOuFilial && <Badge>{empresa.matrizOuFilial}</Badge>}
          {empresa.situacaoCadastral && (
            <Badge tone={ativa ? "success" : "danger"}>{empresa.situacaoCadastral}</Badge>
          )}
          {resumoSancoes &&
            (resumoSancoes.total === 0 ? (
              <Badge tone="success" icon={<ShieldCheck className="h-3.5 w-3.5" aria-hidden />}>
                Sem sanções
              </Badge>
            ) : resumoSancoes.impeditivas > 0 ? (
              // "Impede contratar" sem dizer onde: a abrangência (só num órgão, numa esfera, em todas) fica em cada sanção.
              <Badge tone="danger" icon={<ShieldAlert className="h-3.5 w-3.5" aria-hidden />}>
                Sanção que impede contratar
              </Badge>
            ) : (
              <Badge tone="warning" icon={<ShieldAlert className="h-3.5 w-3.5" aria-hidden />}>
                Sanção sem impedimento
              </Badge>
            ))}
          {listaSuja.status === "sucesso" && listaSuja.registros.length > 0 && (
            <Badge tone="warning" icon={<TriangleAlert className="h-3.5 w-3.5" aria-hidden />}>
              Lista suja do trabalho escravo
            </Badge>
          )}
          {ans.status === "sucesso" && ans.operadora && (
            <Badge
              tone={ans.operadora.ativa ? "success" : "neutral"}
              icon={<HeartPulse className="h-3.5 w-3.5" aria-hidden />}
            >
              Operadora ANS nº {ans.operadora.registro} · {ans.operadora.ativa ? "ativa" : "inativa"}
            </Badge>
          )}
        </div>
      </div>

      {empresa.motivoSituacaoCadastral && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-warning-700 dark:text-warning-300">
          <TriangleAlert className="h-3.5 w-3.5 shrink-0" aria-hidden />
          {empresa.motivoSituacaoCadastral}
          {empresa.dataSituacaoCadastral && ` em ${formatarDataSimples(empresa.dataSituacaoCadastral)}`}
        </p>
      )}

      {listaSuja.status === "sucesso" && <ListaSujaAlerta registros={listaSuja.registros} className="mt-4" />}
      {listaSuja.status === "erro_servidor" && <ListaSujaAlerta registros={null} className="mt-3" />}

      <dl className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Campo rotulo="Natureza jurídica" valor={empresa.naturezaJuridica ?? "Não informada"} />
        {empresa.enteFederativo && <Campo rotulo="Ente federativo" valor={empresa.enteFederativo} />}
        <Campo rotulo="Porte" valor={empresa.porte ?? "Não informado"} />
        <Campo rotulo="Capital social" valor={formatarMoeda(empresa.capitalSocial)} />
        <Campo rotulo="Data de abertura" valor={formatarDataSimples(empresa.dataInicioAtividade) ?? "Não informada"} />
        <Campo rotulo={empresa.telefones.length > 1 ? "Telefones" : "Telefone"} valor={telefones || "Não informado"} />
        <Campo rotulo="E-mail" valor={empresa.email ?? "Não informado"} />
      </dl>

      <div className="mt-5">
        <Campo
          rotulo="Endereço"
          valor={
            [
              empresa.endereco,
              empresa.bairro,
              [empresa.municipio, empresa.uf].filter(Boolean).join(" - "),
              formatarCep(empresa.cep),
            ]
              .filter(Boolean)
              .join(" · ") || "Não informado"
          }
        />
      </div>
    </div>
  );
}

function RegimeTributarioCard({ empresa, complemento }: { empresa: Empresa; complemento: EstadoComplemento }) {
  const emailsCnpja = complemento.status === "sucesso" ? complemento.complemento.emails : [];

  return (
    <div className={CARTAO}>
      <TituloSecao icone={Banknote}>Regime tributário</TituloSecao>
      <dl className="mt-3 space-y-3">
        {empresa.regimeTributario && (
          <Campo
            rotulo="Forma de tributação"
            valor={`${empresa.regimeTributario.forma} (${empresa.regimeTributario.ano})`}
          />
        )}
        <Campo rotulo="Simples Nacional" valor={descreverSimples(empresa.simples)} />
        <Campo rotulo="MEI" valor={descreverMei(empresa.mei)} />
        {!empresa.email && emailsCnpja.length > 0 && (
          <Campo
            rotulo="E-mail corporativo"
            valor={
              <>
                {emailsCnpja.join(" · ")} <span className="text-xs text-ink-500 dark:text-ink-400">(via CNPJá)</span>
              </>
            }
          />
        )}
      </dl>
    </div>
  );
}

function SociosCard({ socios }: { socios: Empresa["socios"] }) {
  if (socios.length === 0) return null;
  return (
    <div className={CARTAO}>
      <TituloSecao icone={Users}>Sócios e administradores</TituloSecao>
      <ul className="mt-3 space-y-2">
        {socios.map((socio) => (
          <li key={`${socio.nome}-${socio.qualificacao}`} className="text-sm">
            <span className="font-medium text-ink-900 dark:text-ink-50">{socio.nome}</span>
            {socio.dataEntrada && (
              <span className="text-ink-500 dark:text-ink-400"> — desde {formatarDataSimples(socio.dataEntrada)}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function SecaoSancoes({ sancoes }: { sancoes: EstadoSancoes }) {
  return (
    <div className={CARTAO}>
      <TituloSecao icone={ShieldAlert}>Sanções (CEIS/CNEP)</TituloSecao>

      {sancoes.status === "carregando" && (
        <p className="mt-2 flex items-center gap-1.5 text-sm text-ink-500 dark:text-ink-400">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Consultando sanções…
        </p>
      )}

      {sancoes.status === "nao_configurado" && (
        <p className="mt-2 text-sm text-ink-500 dark:text-ink-400">
          Consulta de sanções ainda não configurada nesta instância.
        </p>
      )}

      {sancoes.status === "erro" && (
        <p className="mt-2 text-sm text-danger-600 dark:text-danger-400">
          {sancoes.mensagem ?? "Não foi possível consultar sanções neste momento."}
        </p>
      )}

      {sancoes.status === "sucesso" && (
        <>
          {sancoes.sancoes.length === 0 ? (
            <p className="mt-2 flex items-center gap-1.5 text-sm text-success-700 dark:text-success-300">
              <ShieldCheck className="h-4 w-4" aria-hidden />
              Nenhuma sanção encontrada no CEIS ou no CNEP.
            </p>
          ) : (
            <>
              <p className="mt-2 text-sm text-ink-700 dark:text-ink-200">{descreverResumoSancoes(sancoes.sancoes)}</p>
              <ul className="mt-3 space-y-2">
                {sancoes.sancoes.map((sancao) => (
                  <SancaoItem key={`${sancao.tipo}-${sancao.id}`} sancao={sancao} />
                ))}
              </ul>
            </>
          )}
          <p className="mt-3 text-xs text-ink-400 dark:text-ink-500">Fonte: Portal da Transparência (CGU).</p>
        </>
      )}
    </div>
  );
}

function EmpresaResultado({
  empresa,
  sancoes,
  governoFederal,
  complemento,
  contratosAm,
  certidaoTcu,
  listaSuja,
  dominio,
  transferencias,
  ans,
}: {
  empresa: Empresa;
  sancoes: EstadoSancoes;
  governoFederal: EstadoGovernoFederal;
  complemento: EstadoComplemento;
  contratosAm: EstadoContratosAm;
  certidaoTcu: EstadoCertidaoTcu;
  listaSuja: EstadoListaSuja;
  dominio: EstadoDominio;
  transferencias: EstadoTransferencias;
  ans: EstadoAns;
}) {
  const abas = [
    { value: "atividades", label: "Atividades Econômicas", content: <TabelaAtividades empresa={empresa} /> },
    {
      value: "inscricoes",
      label: "Inscrições Estaduais",
      content: <InscricoesEstaduaisSecao key={empresa.cnpj} cnpj={empresa.cnpj} />,
    },
    { value: "suframa", label: "SUFRAMA", content: <AbaSuframa empresa={empresa} complemento={complemento} /> },
  ];

  // O CSS puro não resolve "o card de abas termina na mesma altura da
  // lateral, e rola por dentro se precisar": como as duas colunas têm altura
  // automática (nenhuma é fixa), esticar uma pelo conteúdo da outra exigiria
  // que o navegador soubesse a altura da lateral ANTES de medir o conteúdo
  // das abas — só dá pra fazer isso medindo de verdade. Sem o ResizeObserver,
  // o card de abas cresceria pra caber toda a tabela, empurrando a lateral.
  const cabecalhoRef = useRef<HTMLDivElement>(null);
  const lateralRef = useRef<HTMLDivElement>(null);
  const [alturaAbas, setAlturaAbas] = useState<number>();

  useEffect(() => {
    function recalcular() {
      if (window.innerWidth < 1024 || !cabecalhoRef.current || !lateralRef.current) {
        setAlturaAbas(undefined);
        return;
      }
      const GAP_PX = 16; // gap-4 entre o cabeçalho e o card de abas
      const altura = lateralRef.current.offsetHeight - cabecalhoRef.current.offsetHeight - GAP_PX;
      setAlturaAbas(altura > 0 ? altura : undefined);
    }

    recalcular();
    const observer = new ResizeObserver(recalcular);
    if (cabecalhoRef.current) observer.observe(cabecalhoRef.current);
    if (lateralRef.current) observer.observe(lateralRef.current);
    window.addEventListener("resize", recalcular);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", recalcular);
    };
  }, []);

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
      <div className="flex flex-col gap-4 lg:flex-[2]">
        <div ref={cabecalhoRef}>
          <CabecalhoEmpresaCard empresa={empresa} sancoes={sancoes} listaSuja={listaSuja} ans={ans} />
        </div>
        <div
          className={`${CARTAO} flex flex-col overflow-hidden`}
          style={alturaAbas !== undefined ? { height: alturaAbas } : undefined}
        >
          <Tabs items={abas} className="min-h-0 flex-1" />
        </div>
      </div>

      <div ref={lateralRef} className="flex flex-col gap-4 lg:flex-[1]">
        <RegimeTributarioCard empresa={empresa} complemento={complemento} />
        <DominioEmailLinha estado={dominio} cnpjEmpresa={empresa.cnpj} className={CARTAO} />
        <SociosCard socios={empresa.socios} />
        <SecaoSancoes sancoes={sancoes} />
        <div className={CARTAO}>
          <CertidaoTcuSecao estado={certidaoTcu} cnpj={empresa.cnpj} />
        </div>
        <div className={CARTAO}>
          <GovernoFederalSecao estado={governoFederal} cnpj={empresa.cnpj} />
        </div>
        <TransferenciasEspeciaisSecao estado={transferencias} className={CARTAO} />
        <div className={CARTAO}>
          <ContratosAmSecao estado={contratosAm} cnpj={empresa.cnpj} />
        </div>
        <ConsultasRecentesCard className={CARTAO} />
      </div>
    </div>
  );
}

// Área de atuação da SUFRAMA: Amazônia Ocidental (AM, RO, RR, AC) e Amapá.
// É onde ficam praticamente todas as inscrições (30.485 na base aberta de
// 2023, uma só fora daqui).
const UFS_AREA_SUFRAMA = new Set(["AM", "RO", "RR", "AC", "AP"]);

/** A CNPJá tem limite apertado — só consulta quando pode acrescentar algo. */
function precisaComplemento(empresa: Empresa): boolean {
  return UFS_AREA_SUFRAMA.has(empresa.uf ?? "") || !empresa.email;
}

export function CnpjClient() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Inicializadores preguiçosos: leem a URL uma vez só, na primeira
  // renderização — é assim que o link "CNPJ do órgão" das licitações abre
  // esta página já consultando (/cnpj?cnpj=...).
  const [valor, setValor] = useState(() => mascararCnpj(searchParams.get("cnpj") ?? ""));
  // Objeto novo a cada envio, pra que consultar de novo o mesmo CNPJ também dispare o efeito abaixo.
  const [consulta, setConsulta] = useState<{ cnpj: string } | null>(() => {
    const cnpj = searchParams.get("cnpj");
    return cnpj ? { cnpj } : null;
  });
  const [status, setStatus] = useState<Status>("idle");
  const [empresa, setEmpresa] = useState<Empresa | null>(null);
  const [sancoes, setSancoes] = useState<EstadoSancoes>({ status: "carregando" });
  const [governoFederal, setGovernoFederal] = useState<EstadoGovernoFederal>({ status: "carregando" });
  const [complemento, setComplemento] = useState<EstadoComplemento>({ status: "nao_consultado" });
  const [contratosAm, setContratosAm] = useState<EstadoContratosAm>({ status: "carregando" });
  const [certidaoTcu, setCertidaoTcu] = useState<EstadoCertidaoTcu>({ status: "carregando" });
  const [mensagemErro, setMensagemErro] = useState<string | undefined>();
  const abortRef = useRef<AbortController | null>(null);

  // Fontes que complementam a ficha (ver lib/api-fontes-publicas.ts): cada uma
  // acompanha a empresa exibida e falha sozinha, sem afetar o resto.
  const cnpjExibido = status === "sucesso" && empresa ? empresa.cnpj : undefined;
  const listaSuja = useConsulta(cnpjExibido, buscarListaSuja);
  const transferencias = useConsulta(cnpjExibido, buscarTransferenciasEspeciais);
  const ans = useConsulta(cnpjExibido, buscarOperadoraAns);
  // O e-mail da Receita; na falta, o corporativo que a CNPJá tiver.
  const emailExibido = cnpjExibido
    ? (empresa?.email ?? (complemento.status === "sucesso" ? complemento.complemento.emails[0] : undefined))
    : undefined;
  const dominio = useConsulta(dominioDoEmail(emailExibido), buscarRegistroDominio);
  // Último CNPJ (14 dígitos) consultado, pra distinguir a URL que a própria tela
  // atualizou de um link para outra empresa com a tela já aberta.
  const ultimoConsultadoRef = useRef<string | null>(null);
  const cnpjDaUrl = searchParams.get("cnpj");

  // A consulta não deu certo: a URL deixa de apontar pro CNPJ, pra que um novo clique
  // no mesmo link (as Consultas recentes do menu) volte a consultar.
  const esquecerConsulta = useCallback(() => {
    ultimoConsultadoRef.current = null;
    router.replace(pathname, { scroll: false });
  }, [pathname, router]);

  const executarConsulta = useCallback(async (cnpj: string) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setStatus("carregando");
    setMensagemErro(undefined);
    setSancoes({ status: "carregando" });
    setGovernoFederal({ status: "carregando" });
    setComplemento({ status: "nao_consultado" });
    setContratosAm({ status: "carregando" });
    setCertidaoTcu({ status: "carregando" });

    // A varredura de contratos do AM é a consulta mais lenta — começa junto com o cadastro.
    void buscarContratosAm(cnpj, { signal: controller.signal }).then((r) => {
      if (controller.signal.aborted) return;
      if (r.status === "sucesso") setContratosAm(r);
      else if (r.status === "erro_servidor") setContratosAm({ status: "erro", mensagem: r.mensagem });
    });

    // Sanções e governo federal em paralelo com o cadastro: só aparecem
    // dentro do card da empresa, mas não precisam esperar o cadastro responder.
    void buscarDadosGovernoFederal(cnpj, { signal: controller.signal }).then((resultado) => {
      if (controller.signal.aborted) return;
      if (resultado.status === "sucesso") setGovernoFederal(resultado);
      else if (resultado.status === "nao_configurado") setGovernoFederal({ status: "nao_configurado" });
      else if (resultado.status === "erro_servidor") setGovernoFederal({ status: "erro", mensagem: resultado.mensagem });
    });
    void buscarCertidaoTcu(cnpj, { signal: controller.signal }).then((r) => {
      if (controller.signal.aborted) return;
      if (r.status === "sucesso") setCertidaoTcu(r);
      else if (r.status !== "cancelado") setCertidaoTcu({ status: "erro", mensagem: "mensagem" in r ? r.mensagem : undefined });
    });
    void buscarSancoes(cnpj, { signal: controller.signal }).then((resultado) => {
      if (controller.signal.aborted) return;
      if (resultado.status === "sucesso") {
        setSancoes({ status: "sucesso", sancoes: [...resultado.ceis, ...resultado.cnep] });
      } else if (resultado.status === "nao_configurado") {
        setSancoes({ status: "nao_configurado" });
      } else if (resultado.status === "erro_servidor") {
        setSancoes({ status: "erro", mensagem: resultado.mensagem });
      }
      // "invalido" não chega a aparecer: o cadastro devolve o mesmo erro e o card nem é exibido.
    });

    const resultado = await buscarEmpresa(cnpj, { signal: controller.signal });

    if (controller.signal.aborted) return;

    if (resultado.status === "sucesso") {
      setEmpresa(resultado.empresa);
      setStatus("sucesso");
      // Pro menu lateral (Consultas recentes). Fica só no navegador; CPF nunca vai pra lá.
      registrarEmpresaRecente({
        cnpj: resultado.empresa.cnpj,
        nome: resultado.empresa.nomeFantasia?.trim() || resultado.empresa.razaoSocial,
      });

      // Depois do cadastro, não em paralelo: é o cadastro (UF e e-mail) que
      // diz se vale gastar uma consulta do limite apertado da CNPJá.
      if (precisaComplemento(resultado.empresa)) {
        setComplemento({ status: "carregando" });
        void buscarComplementoCnpj(cnpj, { signal: controller.signal }).then((r) => {
          if (controller.signal.aborted) return;
          if (r.status === "sucesso") setComplemento({ status: "sucesso", complemento: r.complemento });
          else if (r.status === "nao_encontrado") {
            setComplemento({ status: "sucesso", complemento: { suframa: [], emails: [] } });
          } else if (r.status === "limite" || r.status === "erro_servidor") {
            setComplemento({ status: "indisponivel", mensagem: r.mensagem });
          }
        });
      }
    } else if (resultado.status === "invalido") {
      setStatus("invalido");
      setMensagemErro(resultado.mensagem);
      esquecerConsulta();
    } else if (resultado.status === "nao_encontrado") {
      setEmpresa(null);
      setStatus("nao_encontrado");
      esquecerConsulta();
    } else if (resultado.status === "erro_servidor") {
      setStatus("erro");
      setMensagemErro(resultado.mensagem);
      esquecerConsulta();
    }
  }, [esquecerConsulta]);

  useEffect(() => {
    if (!consulta) return;

    // Mesmo padrão de "buscar dados quando uma dependência muda" do
    // DashboardClient: a consulta é assíncrona e o efeito só a dispara.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    executarConsulta(consulta.cnpj);

    // Mantém a URL compartilhável com o último CNPJ válido consultado.
    const validacao = validarCnpj(consulta.cnpj);
    if (validacao.valido) {
      ultimoConsultadoRef.current = validacao.cnpj;
      router.replace(`${pathname}?cnpj=${validacao.cnpj}`, { scroll: false });
    }
  }, [consulta, executarConsulta, pathname, router]);

  // Um link para outra empresa com esta tela aberta (as Consultas recentes do
  // menu lateral) muda só a URL, sem montar a tela de novo: consulta daqui.
  useEffect(() => {
    if (!cnpjDaUrl) return;
    const validacao = validarCnpj(cnpjDaUrl);
    if (!validacao.valido || validacao.cnpj === ultimoConsultadoRef.current) return;
    setValor(mascararCnpj(validacao.cnpj));
    setConsulta({ cnpj: validacao.cnpj });
  }, [cnpjDaUrl]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  function pesquisar(evento: FormEvent) {
    evento.preventDefault();
    if (!valor.trim()) return;
    setConsulta({ cnpj: valor });
  }

  return (
    <div className="flex flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">

      <form onSubmit={pesquisar} className={CARTAO}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Input
              label="CNPJ"
              placeholder="00.000.000/0000-00"
              leftIcon={<Building2 className="h-4 w-4" aria-hidden />}
              value={valor}
              maxLength={18}
              onChange={(e) => setValor(mascararCnpj(e.target.value))}
              onClear={() => setValor("")}
            />
          </div>
          <Button
            type="submit"
            leftIcon={status === "carregando" ? undefined : <Search className="h-4 w-4" aria-hidden />}
            loading={status === "carregando"}
          >
            Consultar
          </Button>
        </div>
      </form>

      {status === "carregando" && (
        <div className="flex items-center gap-2 text-sm text-ink-500 dark:text-ink-400">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Consultando…
        </div>
      )}

      {status === "invalido" && (
        <p className="text-sm text-danger-600 dark:text-danger-400">{mensagemErro ?? "CNPJ inválido."}</p>
      )}

      {status === "nao_encontrado" && (
        <p className="text-sm text-ink-600 dark:text-ink-300">Nenhuma empresa encontrada com esse CNPJ.</p>
      )}

      {status === "erro" && (
        <p className="text-sm text-danger-600 dark:text-danger-400">
          {mensagemErro ?? "Não foi possível consultar o CNPJ neste momento."}
        </p>
      )}

      {status === "sucesso" && empresa && (
        <EmpresaResultado
          empresa={empresa}
          sancoes={sancoes}
          governoFederal={governoFederal}
          complemento={complemento}
          contratosAm={contratosAm}
          certidaoTcu={certidaoTcu}
          listaSuja={listaSuja}
          dominio={dominio}
          transferencias={transferencias}
          ans={ans}
        />
      )}
    </div>
  );
}
