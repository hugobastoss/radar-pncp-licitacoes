"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Building2, Loader2, Search, ShieldAlert, ShieldCheck, TriangleAlert, Users } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Campo } from "@/components/LicitacaoDetails";
import { SancaoItem } from "@/components/SancoesClient";
import { buscarEmpresa } from "@/lib/api-cnpj";
import { buscarSancoes } from "@/lib/api-sancoes";
import { validarCnpj } from "@/lib/cnpj";
import {
  formatarCep,
  formatarCnpj,
  formatarDataSimples,
  formatarMoeda,
  formatarTelefone,
  mascararCnpj,
} from "@/lib/formatters";
import type { Sancao } from "@/lib/server/transparencia-client";
import type { Cnae, Empresa, OpcaoRegime } from "@/types/cnpj";

type Status = "idle" | "carregando" | "sucesso" | "invalido" | "nao_encontrado" | "erro";

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
            <ul className="mt-3 space-y-2">
              {sancoes.sancoes.map((sancao) => (
                <SancaoItem key={`${sancao.tipo}-${sancao.id}`} sancao={sancao} />
              ))}
            </ul>
          )}
          <p className="mt-3 text-xs text-ink-400 dark:text-ink-500">Fonte: Portal da Transparência (CGU).</p>
        </>
      )}
    </div>
  );
}

function EmpresaCard({ empresa, sancoes }: { empresa: Empresa; sancoes: EstadoSancoes }) {
  const ativa = empresa.situacaoCadastral?.toUpperCase() === "ATIVA";
  const telefones = empresa.telefones.map(formatarTelefone).join(" · ");

  return (
    <div className="rounded-2xl border border-ink-200 bg-white p-5 shadow-card dark:border-ink-700 dark:bg-ink-900 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-lg font-semibold text-ink-900 dark:text-ink-50">{empresa.razaoSocial}</p>
          {empresa.nomeFantasia && (
            <p className="mt-0.5 text-sm text-ink-600 dark:text-ink-300">{empresa.nomeFantasia}</p>
          )}
          <p className="mt-1 text-xs text-ink-500 dark:text-ink-400">{formatarCnpj(empresa.cnpj)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {empresa.matrizOuFilial && <Badge>{empresa.matrizOuFilial}</Badge>}
          {empresa.situacaoCadastral && (
            <Badge tone={ativa ? "success" : "danger"}>{empresa.situacaoCadastral}</Badge>
          )}
          {sancoes.status === "sucesso" &&
            (sancoes.sancoes.length === 0 ? (
              <Badge tone="success" icon={<ShieldCheck className="h-3.5 w-3.5" aria-hidden />}>
                Sem sanções
              </Badge>
            ) : (
              <Badge tone="danger" icon={<ShieldAlert className="h-3.5 w-3.5" aria-hidden />}>
                {sancoes.sancoes.length === 1 ? "1 sanção" : `${sancoes.sancoes.length} sanções`}
              </Badge>
            ))}
        </div>
      </div>

      {empresa.motivoSituacaoCadastral && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-warning-700 dark:text-warning-300">
          <TriangleAlert className="h-3.5 w-3.5 shrink-0" aria-hidden />
          {empresa.motivoSituacaoCadastral}
          {empresa.dataSituacaoCadastral && ` em ${formatarDataSimples(empresa.dataSituacaoCadastral)}`}
        </p>
      )}

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
        <Campo rotulo="E-mail" valor={empresa.email ?? "Não informado"} />
      </dl>

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
  const [mensagemErro, setMensagemErro] = useState<string | undefined>();
  const abortRef = useRef<AbortController | null>(null);

  const executarConsulta = useCallback(async (cnpj: string) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setStatus("carregando");
    setMensagemErro(undefined);
    setSancoes({ status: "carregando" });

    // Sanções em paralelo com o cadastro: só aparecem dentro do card da
    // empresa, mas não precisam esperar o cadastro responder.
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
    } else if (resultado.status === "invalido") {
      setStatus("invalido");
      setMensagemErro(resultado.mensagem);
    } else if (resultado.status === "nao_encontrado") {
      setEmpresa(null);
      setStatus("nao_encontrado");
    } else if (resultado.status === "erro_servidor") {
      setStatus("erro");
      setMensagemErro(resultado.mensagem);
    }
  }, []);

  useEffect(() => {
    if (!consulta) return;

    // Mesmo padrão de "buscar dados quando uma dependência muda" do
    // DashboardClient: a consulta é assíncrona e o efeito só a dispara.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    executarConsulta(consulta.cnpj);

    // Mantém a URL compartilhável com o último CNPJ válido consultado.
    const validacao = validarCnpj(consulta.cnpj);
    if (validacao.valido) router.replace(`${pathname}?cnpj=${validacao.cnpj}`, { scroll: false });
  }, [consulta, executarConsulta, pathname, router]);

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
          Consulte dados cadastrais de empresas na base da Receita Federal, junto com as sanções do CEIS e do
          CNEP.
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

      {status === "sucesso" && empresa && <EmpresaCard empresa={empresa} sancoes={sancoes} />}
    </div>
  );
}
