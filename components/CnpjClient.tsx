"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { BadgePercent, Building2, HeartPulse, Loader2, Network, Search, ShieldAlert, ShieldCheck, TriangleAlert, Users } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Campo } from "@/components/LicitacaoDetails";
import { CertidaoTcuSecao } from "@/components/CertidaoTcuSecao";
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

function TextoCnae({ cnae }: { cnae: Cnae }) {
  return (
    <>
      {cnae.codigo && <span className="tabular-nums text-ink-500 dark:text-ink-400">{cnae.codigo} · </span>}
      {cnae.descricao}
    </>
  );
}

function SecaoSancoes({ sancoes }: { sancoes: EstadoSancoes }) {
  return (
    <div className="mt-5 border-t border-ink-100 pt-5 dark:border-ink-800">
      <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-ink-500 dark:text-ink-400">
        <ShieldAlert className="h-3.5 w-3.5" aria-hidden />
        Sanções (CEIS/CNEP)
      </p>

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

// Área de atuação da SUFRAMA: Amazônia Ocidental (AM, RO, RR, AC) e Amapá.
// É onde ficam praticamente todas as inscrições (30.485 na base aberta de
// 2023, uma só fora daqui).
const UFS_AREA_SUFRAMA = new Set(["AM", "RO", "RR", "AC", "AP"]);

/** A CNPJá tem limite apertado — só consulta quando pode acrescentar algo. */
function precisaComplemento(empresa: Empresa): boolean {
  return UFS_AREA_SUFRAMA.has(empresa.uf ?? "") || !empresa.email;
}

function SecaoSuframa({ empresa, complemento }: { empresa: Empresa; complemento: EstadoComplemento }) {
  const naArea = UFS_AREA_SUFRAMA.has(empresa.uf ?? "");
  const inscricoes = complemento.status === "sucesso" ? complemento.complemento.suframa : [];
  // Fora da área, a seção só aparece se a empresa tiver inscrição — "sem SUFRAMA" é o normal lá.
  if (!naArea && inscricoes.length === 0) return null;
  if (complemento.status === "nao_consultado") return null;

  return (
    <div className="mt-5 border-t border-ink-100 pt-5 dark:border-ink-800">
      <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-ink-500 dark:text-ink-400">
        <BadgePercent className="h-3.5 w-3.5" aria-hidden />
        SUFRAMA (Zona Franca de Manaus)
      </p>

      {complemento.status === "carregando" && (
        <p className="mt-2 flex items-center gap-1.5 text-sm text-ink-500 dark:text-ink-400">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Consultando inscrição SUFRAMA…
        </p>
      )}
      {complemento.status === "indisponivel" && (
        <p className="mt-2 text-sm text-ink-500 dark:text-ink-400">
          {complemento.mensagem ?? "Não foi possível consultar a SUFRAMA neste momento."}
        </p>
      )}
      {complemento.status === "sucesso" && inscricoes.length === 0 && (
        <p className="mt-2 text-sm text-ink-600 dark:text-ink-300">Sem inscrição na SUFRAMA.</p>
      )}
      {inscricoes.length > 0 && (
        <ul className="mt-2 space-y-3">
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
                        {i.beneficio && ` — ${i.beneficio}`}
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
      )}
      {complemento.status === "sucesso" && (
        <p className="mt-2 text-xs text-ink-400 dark:text-ink-500">
          Fonte: CNPJá, a partir dos dados da SUFRAMA
          {complemento.complemento.atualizadoEm &&
            ` — atualizados em ${formatarData(complemento.complemento.atualizadoEm)}`}
          . Pode ter até 45 dias de atraso.
        </p>
      )}
    </div>
  );
}

function EmpresaCard({
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
  const ativa = empresa.situacaoCadastral?.toUpperCase() === "ATIVA";
  const telefones = empresa.telefones.map(formatarTelefone).join(" · ");
  const resumoSancoes = sancoes.status === "sucesso" ? resumirSancoes(sancoes.sancoes) : undefined;
  // A Receita (BrasilAPI) muitas vezes vem sem e-mail; a CNPJá costuma ter o corporativo.
  const emailsCnpja = complemento.status === "sucesso" ? complemento.complemento.emails : [];

  return (
    <div className="rounded-2xl border border-ink-200 bg-white p-5 shadow-card dark:border-ink-700 dark:bg-ink-900 sm:p-6">
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
        <Campo rotulo="Simples Nacional" valor={descreverSimples(empresa.simples)} />
        <Campo rotulo="MEI" valor={descreverMei(empresa.mei)} />
        {empresa.regimeTributario && (
          <Campo
            rotulo="Regime tributário"
            valor={`${empresa.regimeTributario.forma} (${empresa.regimeTributario.ano})`}
          />
        )}
        <Campo rotulo={empresa.telefones.length > 1 ? "Telefones" : "Telefone"} valor={telefones || "Não informado"} />
        <Campo
          rotulo="E-mail"
          valor={
            empresa.email ??
            (emailsCnpja.length > 0 ? (
              <>
                {emailsCnpja.join(" · ")}
                <span className="text-xs text-ink-500 dark:text-ink-400"> (via CNPJá)</span>
              </>
            ) : complemento.status === "carregando" ? (
              "Consultando…"
            ) : (
              "Não informado"
            ))
          }
        />
      </dl>

      <DominioEmailLinha estado={dominio} cnpjEmpresa={empresa.cnpj} />

      <div className="mt-5">
        <Campo
          rotulo="Atividade principal"
          valor={empresa.atividadePrincipal ? <TextoCnae cnae={empresa.atividadePrincipal} /> : "Não informada"}
        />
      </div>

      {empresa.atividadesSecundarias.length > 0 && (
        <div className="mt-5">
          <dt className="text-xs font-medium uppercase tracking-wide text-ink-500 dark:text-ink-400">
            Atividades secundárias
          </dt>
          <ul className="mt-1.5 space-y-1 text-sm text-ink-700 dark:text-ink-200">
            {empresa.atividadesSecundarias.map((atividade) => (
              <li key={`${atividade.codigo}-${atividade.descricao}`}>
                <TextoCnae cnae={atividade} />
              </li>
            ))}
          </ul>
        </div>
      )}

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

      <SecaoSuframa empresa={empresa} complemento={complemento} />

      <InscricoesEstaduaisSecao key={empresa.cnpj} cnpj={empresa.cnpj} />

      {empresa.socios.length > 0 && (
        <div className="mt-5 border-t border-ink-100 pt-5 dark:border-ink-800">
          <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-ink-500 dark:text-ink-400">
            <Users className="h-3.5 w-3.5" aria-hidden />
            Quadro de sócios
          </p>
          <ul className="mt-2 space-y-2">
            {empresa.socios.map((socio) => (
              <li key={`${socio.nome}-${socio.qualificacao}`} className="text-sm">
                <span className="font-medium text-ink-900 dark:text-ink-50">{socio.nome}</span>
                <span className="text-ink-500 dark:text-ink-400"> — {socio.qualificacao}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <SecaoSancoes sancoes={sancoes} />

      <CertidaoTcuSecao
        estado={certidaoTcu}
        cnpj={empresa.cnpj}
        className="mt-5 border-t border-ink-100 pt-5 dark:border-ink-800"
      />

      <GovernoFederalSecao estado={governoFederal} cnpj={empresa.cnpj} />

      <TransferenciasEspeciaisSecao estado={transferencias} />

      <ContratosAmSecao estado={contratosAm} cnpj={empresa.cnpj} />
    </div>
  );
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
      <div className="border-b border-ink-200 pb-4 dark:border-ink-700">
        <h1 className="text-base font-semibold text-ink-900 dark:text-ink-50">Consultar CNPJ</h1>
        <p className="mt-1 text-xs text-ink-500 dark:text-ink-400">
          Consulte dados cadastrais de empresas na base da Receita Federal, com as sanções (CEIS/CNEP) e a relação
          com o governo federal — contratos e pagamentos.
        </p>
      </div>

      <form
        onSubmit={pesquisar}
        className="rounded-2xl border border-ink-200 bg-white p-5 shadow-card dark:border-ink-700 dark:bg-ink-900 sm:p-6"
      >
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
        <EmpresaCard
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
