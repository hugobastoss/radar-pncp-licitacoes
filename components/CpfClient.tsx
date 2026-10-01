"use client";

import { useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { Check, Landmark, Loader2, Minus, Search, ShieldAlert, ShieldCheck, UserRound } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { descreverResumoSancoes, Linha, SancaoItem } from "@/components/SancaoItem";
import { ItemContrato } from "@/components/GovernoFederalSecao";
import { ListaSujaAlerta } from "@/components/ListaSujaAlerta";
import { consultarCpf } from "@/lib/api-cpf";
import { mascararCpf } from "@/lib/formatters";
import type {
  DadosPessoaFisica,
  PessoaExposta,
  PunicaoCeaf,
  ResumoPessoaFisica,
  VinculoServidor,
} from "@/types/transparencia";

type Status = "idle" | "carregando" | "sucesso" | "invalido" | "limite" | "nao_configurado" | "erro";

const ITENS_RESUMO: { chave: keyof Omit<ResumoPessoaFisica, "semRegistro">; rotulo: string }[] = [
  { chave: "servidor", rotulo: "Servidor federal" },
  { chave: "servidorInativo", rotulo: "Servidor aposentado" },
  { chave: "pensionista", rotulo: "Pensionista" },
  { chave: "instituidorPensao", rotulo: "Instituidor de pensão" },
  { chave: "contratado", rotulo: "Contratos com o governo federal" },
  { chave: "participanteLicitacao", rotulo: "Participou de licitações federais" },
  { chave: "favorecidoDespesas", rotulo: "Recebeu pagamentos federais" },
  { chave: "beneficiarioDiarias", rotulo: "Recebeu diárias" },
  { chave: "portadorCartao", rotulo: "Cartão de pagamento do governo" },
  { chave: "permissionario", rotulo: "Ocupa imóvel funcional" },
];

const CONTRATOS_VISIVEIS = 5;

function Titulo({ icone, children }: { icone?: ReactNode; children: ReactNode }) {
  return (
    <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-ink-500 dark:text-ink-400">
      {icone}
      {children}
    </p>
  );
}

function TextoSecundario({ children }: { children: ReactNode }) {
  return <p className="mt-1.5 text-sm text-ink-500 dark:text-ink-400">{children}</p>;
}

function Secao({ children }: { children: ReactNode }) {
  return <div className="border-t border-ink-100 pt-5 dark:border-ink-800">{children}</div>;
}

function ItemCeaf({ punicao: p }: { punicao: PunicaoCeaf }) {
  const cargo = [p.cargoEfetivo, p.cargoComissao].filter(Boolean).join(" · ");
  return (
    <li className="rounded-lg border border-danger-200 bg-danger-50 p-3 dark:border-danger-900 dark:bg-danger-900/30">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="danger">CEAF</Badge>
        <span className="text-sm font-medium text-ink-900 dark:text-ink-50">{p.tipo}</span>
      </div>
      <div className="mt-2 space-y-1">
        {p.orgao && (
          <Linha rotulo="Órgão">
            {p.orgao}
            {p.uf && ` (${p.uf})`}
          </Linha>
        )}
        {cargo && <Linha rotulo="Cargo">{cargo}</Linha>}
        {p.dataPublicacao && <Linha rotulo="Publicada em">{p.dataPublicacao}</Linha>}
        {p.portaria && <Linha rotulo="Portaria">{p.portaria}</Linha>}
        {p.processo && <Linha rotulo="Processo">{p.processo}</Linha>}
        {p.fundamentacao.length > 0 && <Linha rotulo="Fundamentação legal">{p.fundamentacao.join("; ")}</Linha>}
      </div>
    </li>
  );
}

function Sancoes({ pessoa }: { pessoa: DadosPessoaFisica }) {
  const sancoes = pessoa.sancoes ? [...pessoa.sancoes.ceis, ...pessoa.sancoes.cnep] : [];
  const ceaf = pessoa.ceaf ?? [];
  const falhas = [!pessoa.sancoes && "CEIS e CNEP", !pessoa.ceaf && "CEAF"].filter(Boolean);

  return (
    <div>
      <Titulo icone={<ShieldAlert className="h-3.5 w-3.5" aria-hidden />}>Sanções</Titulo>
      {sancoes.length === 0 && ceaf.length === 0 ? (
        falhas.length < 2 && (
          <p className="mt-2 flex items-center gap-1.5 text-sm text-success-700 dark:text-success-300">
            <ShieldCheck className="h-4 w-4" aria-hidden />
            Nenhuma sanção {falhas.length === 0 ? "no CEIS, no CNEP ou no CEAF" : pessoa.sancoes ? "no CEIS ou no CNEP" : "no CEAF"}.
          </p>
        )
      ) : (
        <>
          {sancoes.length > 0 && (
            <p className="mt-2 text-sm text-ink-700 dark:text-ink-200">{descreverResumoSancoes(sancoes)}</p>
          )}
          <ul className="mt-3 space-y-2">
            {sancoes.map((s) => (
              <SancaoItem key={`${s.tipo}-${s.id}`} sancao={s} />
            ))}
            {ceaf.map((p) => (
              <ItemCeaf key={`CEAF-${p.id}`} punicao={p} />
            ))}
          </ul>
        </>
      )}
      {falhas.length > 0 && (
        <p className="mt-2 text-sm text-danger-600 dark:text-danger-400">
          Não foi possível consultar o {falhas.join(" nem o ")} agora.
        </p>
      )}
      {pessoa.listaSuja !== undefined && <ListaSujaAlerta registros={pessoa.listaSuja} className="mt-3" />}
      <p className="mt-2 text-xs text-ink-400 dark:text-ink-500">
        CEIS e CNEP: impedidos ou punidos de contratar com a administração pública. CEAF: expulsos da administração
        federal (demissão, destituição, cassação de aposentadoria).
      </p>
    </div>
  );
}

function ItemPep({ pep: p }: { pep: PessoaExposta }) {
  const exercicio = [p.inicioExercicio && `desde ${p.inicioExercicio}`, p.fimExercicio && `até ${p.fimExercicio}`]
    .filter(Boolean)
    .join(" ");
  return (
    <li className="rounded-lg border border-warning-200 bg-warning-50 p-3 dark:border-warning-900 dark:bg-warning-900/30">
      <p className="text-sm font-medium text-ink-900 dark:text-ink-50">{p.funcao}</p>
      <div className="mt-1 space-y-1">
        {p.orgao && <Linha rotulo="Órgão">{p.orgao}</Linha>}
        {exercicio && <Linha rotulo="Exercício">{exercicio}</Linha>}
        {p.fimCarencia && <Linha rotulo="Segue PEP até">{p.fimCarencia}</Linha>}
      </div>
    </li>
  );
}

function Peps({ peps }: { peps: PessoaExposta[] | null }) {
  return (
    <div>
      <Titulo>Pessoa politicamente exposta (PEP)</Titulo>
      {!peps ? (
        <p className="mt-2 text-sm text-danger-600 dark:text-danger-400">Não foi possível consultar a lista de PEPs agora.</p>
      ) : peps.length === 0 ? (
        <TextoSecundario>Não consta na lista de PEPs da CGU.</TextoSecundario>
      ) : (
        <ul className="mt-2 space-y-2">
          {peps.map((p, i) => (
            <ItemPep key={`${p.funcao}-${p.inicioExercicio ?? i}`} pep={p} />
          ))}
        </ul>
      )}
      <p className="mt-2 text-xs text-ink-400 dark:text-ink-500">
        Quem ocupa ou ocupou nos últimos 5 anos cargo público relevante. Contratar com PEP pede cuidado redobrado de
        integridade, mas não é proibido.
      </p>
    </div>
  );
}

function ItemVinculo({ vinculo: v }: { vinculo: VinculoServidor }) {
  return (
    <li className="rounded-lg border border-ink-200 p-3 dark:border-ink-700">
      <p className="text-sm text-ink-900 dark:text-ink-50">{v.cargo ?? v.funcao ?? "Cargo não informado"}</p>
      <p className="mt-1 text-xs text-ink-500 dark:text-ink-400">
        {[v.tipo, v.situacao, v.cargo && v.funcao && `função ${v.funcao}`].filter(Boolean).join(" · ")}
      </p>
      {(v.orgaoLotacao || v.orgaoExercicio) && (
        <p className="mt-0.5 text-xs text-ink-500 dark:text-ink-400">
          {[v.orgaoLotacao, v.orgaoExercicio && `em exercício no ${v.orgaoExercicio}`, v.uf].filter(Boolean).join(" · ")}
        </p>
      )}
    </li>
  );
}

function GovernoFederal({ pessoa }: { pessoa: DadosPessoaFisica }) {
  const [todos, setTodos] = useState(false);
  const { resumo, vinculos, contratos } = pessoa;

  if (resumo.semRegistro) {
    return (
      <div>
        <Titulo icone={<Landmark className="h-3.5 w-3.5" aria-hidden />}>Relação com o governo federal</Titulo>
        <TextoSecundario>
          O Portal da Transparência não tem registro deste CPF — a pessoa não tem relação registrada com o governo
          federal. Isso não quer dizer que o CPF não exista.
        </TextoSecundario>
      </div>
    );
  }

  const ordenados = contratos ? [...contratos.itens].sort((a, b) => Number(b.vigente) - Number(a.vigente)) : [];

  return (
    <div className="space-y-5">
      <div>
        <Titulo icone={<Landmark className="h-3.5 w-3.5" aria-hidden />}>Relação com o governo federal</Titulo>
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {ITENS_RESUMO.map(({ chave, rotulo }) => {
            const sim = resumo[chave];
            return (
              <li key={chave}>
                <Badge
                  tone={sim ? "primary" : "neutral"}
                  icon={sim ? <Check className="h-3 w-3" aria-hidden /> : <Minus className="h-3 w-3" aria-hidden />}
                  className={sim ? undefined : "opacity-70"}
                >
                  <span className="sr-only">{sim ? "Sim: " : "Não: "}</span>
                  {rotulo}
                </Badge>
              </li>
            );
          })}
        </ul>
      </div>

      {(vinculos === null || vinculos.length > 0) && (
        <div>
          <Titulo>Vínculo com o Executivo federal</Titulo>
          {vinculos ? (
            <ul className="mt-2 space-y-2">
              {vinculos.map((v, i) => (
                <ItemVinculo key={`${v.orgaoLotacao ?? ""}-${v.cargo ?? ""}-${i}`} vinculo={v} />
              ))}
            </ul>
          ) : (
            <TextoSecundario>Não foi possível consultar o vínculo de servidor agora.</TextoSecundario>
          )}
        </div>
      )}

      {(contratos === null || ordenados.length > 0) && (
        <div>
          <Titulo>Contratos</Titulo>
          {contratos ? (
            <>
              <p className="mt-1.5 text-sm text-ink-700 dark:text-ink-200">
                {ordenados.length}
                {!contratos.completo && "+"} {ordenados.length === 1 ? "contrato" : "contratos"} com o Poder Executivo
                federal
              </p>
              <ul className="mt-2 space-y-2">
                {(todos ? ordenados : ordenados.slice(0, CONTRATOS_VISIVEIS)).map((c) => (
                  <ItemContrato key={c.id} contrato={c} />
                ))}
              </ul>
              {ordenados.length > CONTRATOS_VISIVEIS && (
                <button
                  type="button"
                  onClick={() => setTodos(!todos)}
                  className="mt-2 text-xs font-medium text-primary-600 hover:underline dark:text-primary-400"
                >
                  {todos ? "Mostrar menos" : `Mostrar todos (${ordenados.length})`}
                </button>
              )}
            </>
          ) : (
            <TextoSecundario>Não foi possível consultar os contratos agora.</TextoSecundario>
          )}
        </div>
      )}
    </div>
  );
}

function Resultado({ pessoa }: { pessoa: DadosPessoaFisica }) {
  const sancionado =
    (pessoa.sancoes && pessoa.sancoes.ceis.length + pessoa.sancoes.cnep.length > 0) || (pessoa.ceaf?.length ?? 0) > 0;
  const pep = (pessoa.peps?.length ?? 0) > 0;
  const naListaSuja = (pessoa.listaSuja?.length ?? 0) > 0;

  return (
    <div className="flex flex-col gap-5 rounded-[10px] border border-ink-200 bg-white p-5 shadow-card dark:border-ink-700 dark:bg-ink-900 sm:p-6">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-base font-semibold text-ink-900 dark:text-ink-50">
            {pessoa.nome ??
              (pessoa.resumo.semRegistro ? "CPF sem registro no Portal da Transparência" : "Nome não informado pela CGU")}
          </p>
          {sancionado && <Badge tone="danger">Sancionado</Badge>}
          {pep && <Badge tone="warning">PEP</Badge>}
          {naListaSuja && <Badge tone="warning">Lista suja do trabalho escravo</Badge>}
        </div>
        {pessoa.cpfMascarado && (
          <p className="mt-0.5 text-xs tabular-nums text-ink-500 dark:text-ink-400">CPF {pessoa.cpfMascarado}</p>
        )}
      </div>

      <Secao>
        <Sancoes pessoa={pessoa} />
      </Secao>
      <Secao>
        <Peps peps={pessoa.peps} />
      </Secao>
      <Secao>
        <GovernoFederal pessoa={pessoa} />
      </Secao>

      <p className="text-xs text-ink-400 dark:text-ink-500">
        Fonte: Portal da Transparência (CGU) — só o que o próprio portal já publica. Benefícios sociais, que o portal
        também informa, não aparecem aqui.
      </p>
    </div>
  );
}

export function CpfClient() {
  const [valor, setValor] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [pessoa, setPessoa] = useState<DadosPessoaFisica | null>(null);
  const [mensagemErro, setMensagemErro] = useState<string | undefined>();
  const abortRef = useRef<AbortController | null>(null);

  async function pesquisar(evento: FormEvent) {
    evento.preventDefault();
    if (!valor.trim()) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setStatus("carregando");
    setMensagemErro(undefined);
    setPessoa(null);

    const resposta = await consultarCpf(valor, { signal: controller.signal });

    if (resposta.status === "sucesso") {
      setPessoa(resposta.pessoa);
      setStatus("sucesso");
    } else if (resposta.status === "invalido" || resposta.status === "limite" || resposta.status === "erro_servidor") {
      setStatus(resposta.status === "erro_servidor" ? "erro" : resposta.status);
      setMensagemErro(resposta.mensagem);
    } else if (resposta.status === "nao_configurado") {
      setStatus("nao_configurado");
    }
  }

  return (
    <div className="flex flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <form
        onSubmit={pesquisar}
        className="rounded-[10px] border border-ink-200 bg-white p-5 shadow-card dark:border-ink-700 dark:bg-ink-900 sm:p-6"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Input
              label="CPF"
              placeholder="000.000.000-00"
              inputMode="numeric"
              autoComplete="off"
              leftIcon={<UserRound className="h-4 w-4" aria-hidden />}
              value={valor}
              maxLength={14}
              onChange={(e) => setValor(mascararCpf(e.target.value))}
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
        <p className="mt-3 text-xs text-ink-400 dark:text-ink-500">
          O CPF não é guardado e não vai para o endereço da página. Use só com uma finalidade legítima, como checar um
          fornecedor ou sócio (LGPD).
        </p>
      </form>

      {status === "carregando" && (
        <div className="flex items-center gap-2 text-sm text-ink-500 dark:text-ink-400">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Consultando o Portal da Transparência…
        </div>
      )}

      {(status === "invalido" || status === "limite") && (
        <p className="text-sm text-danger-600 dark:text-danger-400">{mensagemErro ?? "CPF inválido."}</p>
      )}

      {status === "nao_configurado" && (
        <p className="text-sm text-ink-600 dark:text-ink-300">Consulta de CPF ainda não configurada nesta instância.</p>
      )}

      {status === "erro" && (
        <p className="text-sm text-danger-600 dark:text-danger-400">
          {mensagemErro ?? "Não foi possível consultar o CPF neste momento."}
        </p>
      )}

      {status === "sucesso" && pessoa && <Resultado pessoa={pessoa} />}
    </div>
  );
}
