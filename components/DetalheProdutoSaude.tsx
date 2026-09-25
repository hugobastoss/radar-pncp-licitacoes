"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { ChevronDown, ChevronUp, Loader2, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Campo } from "@/components/LicitacaoDetails";
import { LinkCnpj } from "@/components/LinkCnpj";
import { buscarCaracteristicasUdi, buscarDetalheProdutoSaude } from "@/lib/api-produtos-saude";
import { formatarCnpj, formatarData } from "@/lib/formatters";
import type {
  CaracteristicasUdi,
  CertificadoBoasPraticas,
  DetalheCompletoProdutoSaude,
  ProdutoSaude,
  Udi,
} from "@/types/produto-saude";

/** Situação do registro — "Vencido em…"/"Cancelado em…" dizem mais que o "Inválido" genérico da ANVISA. */
export function SituacaoRegistro({ item }: { item: ProdutoSaude }) {
  if (item.cancelado) {
    return (
      <Badge tone="danger">
        Cancelado{item.dataCancelamento && ` em ${formatarData(item.dataCancelamento)}`}
      </Badge>
    );
  }
  if (item.vencido) {
    return <Badge tone="danger">Vencido{item.dataVencimento && ` em ${formatarData(item.dataVencimento)}`}</Badge>;
  }
  if (!item.situacao) return null;
  return <Badge tone={item.situacao.toLowerCase() === "válido" ? "success" : "danger"}>{item.situacao}</Badge>;
}

export function ClasseRisco({ sigla }: { sigla: string }) {
  return <Badge>Classe {sigla}</Badge>;
}

function capitalizar(texto: string): string {
  const minusculo = texto.toLowerCase();
  return minusculo.charAt(0).toUpperCase() + minusculo.slice(1);
}

function simOuNao(valor: boolean | undefined): string {
  if (valor === undefined) return "Não informado";
  return valor ? "Sim" : "Não";
}

function Secao({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="border-t border-ink-100 pt-5 dark:border-ink-800">
      <h3 className="text-xs font-medium uppercase tracking-wide text-ink-500 dark:text-ink-400">{titulo}</h3>
      <div className="mt-2">{children}</div>
    </section>
  );
}

function Aviso({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-start gap-1.5 rounded-lg bg-warning-50 p-3 text-xs text-warning-700 dark:bg-warning-900/40 dark:text-warning-300">
      <TriangleAlert className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />
      <span>{children}</span>
    </p>
  );
}

function TextoSecundario({ children }: { children: ReactNode }) {
  return <p className="text-sm text-ink-500 dark:text-ink-400">{children}</p>;
}

const MODELOS_VISIVEIS = 12;

function ListaModelos({ modelos, incompletos }: { modelos: string[]; incompletos: boolean }) {
  const [todos, setTodos] = useState(false);

  if (modelos.length === 0) return <TextoSecundario>Nenhum modelo informado.</TextoSecundario>;

  const visiveis = todos ? modelos : modelos.slice(0, MODELOS_VISIVEIS);
  return (
    <>
      <ul className="flex flex-wrap gap-1.5">
        {visiveis.map((modelo, indice) => (
          <li
            key={`${modelo}-${indice}`}
            className="rounded-md bg-ink-100 px-2 py-0.5 text-xs tabular-nums text-ink-700 dark:bg-ink-800 dark:text-ink-200"
          >
            {modelo}
          </li>
        ))}
      </ul>
      {modelos.length > MODELOS_VISIVEIS && (
        <button
          type="button"
          onClick={() => setTodos(!todos)}
          className="mt-2 text-xs font-medium text-primary-600 hover:underline dark:text-primary-400"
        >
          {todos ? "Mostrar menos" : `Mostrar todos (${modelos.length})`}
        </button>
      )}
      {incompletos && (
        <p className="mt-1 text-xs text-ink-400 dark:text-ink-500">
          A ANVISA devolveu só parte das apresentações deste registro — pode haver mais modelos.
        </p>
      )}
    </>
  );
}

const ROTULO_RESSONANCIA: Record<string, string> = { NAOAPLICA: "Não se aplica" };

function Caracteristicas({ caracteristicas: c }: { caracteristicas: CaracteristicasUdi }) {
  return (
    <dl className="mt-2 grid grid-cols-2 gap-3 rounded-lg bg-ink-25 p-3 dark:bg-ink-800/60">
      {c.versaoModelo && <Campo rotulo="Modelo" valor={c.versaoModelo} />}
      {c.categoria && <Campo rotulo="Categoria" valor={capitalizar(c.categoria)} />}
      <Campo rotulo="Estéril" valor={simOuNao(c.esteril)} />
      <Campo rotulo="Uso único" valor={simOuNao(c.usoUnico)} />
      <Campo rotulo="Contém látex" valor={simOuNao(c.contemLatex)} />
      <Campo rotulo="Uso leigo" valor={simOuNao(c.usoLeigo)} />
      {c.compatibilidadeRessonancia && (
        <Campo
          rotulo="Ressonância magnética"
          valor={ROTULO_RESSONANCIA[c.compatibilidadeRessonancia] ?? capitalizar(c.compatibilidadeRessonancia)}
        />
      )}
      {c.unidadesPorEmbalagem !== undefined && (
        <Campo rotulo="Unidades por embalagem" valor={String(c.unidadesPorEmbalagem)} />
      )}
      {c.dataDescontinuacao && <Campo rotulo="Descontinuado em" valor={formatarData(c.dataDescontinuacao)} />}
    </dl>
  );
}

type EstadoCaracteristicas =
  | { status: "fechado" }
  | { status: "carregando" }
  | { status: "sucesso"; caracteristicas: CaracteristicasUdi; aberto: boolean }
  | { status: "erro"; mensagem: string };

// Cada item busca as próprias características só quando alguém pede — cada
// uma é uma requisição à ANVISA, e a maioria dos registros não precisa.
function ItemUdi({ udi }: { udi: Udi }) {
  const [estado, setEstado] = useState<EstadoCaracteristicas>({ status: "fechado" });
  const aberto = estado.status === "carregando" || (estado.status === "sucesso" && estado.aberto);

  async function alternar() {
    if (estado.status === "sucesso") {
      setEstado({ ...estado, aberto: !estado.aberto });
      return;
    }
    if (estado.status === "carregando") return;

    setEstado({ status: "carregando" });
    const resultado = await buscarCaracteristicasUdi(udi.id);
    if (resultado.status === "sucesso") {
      setEstado({ status: "sucesso", caracteristicas: resultado.caracteristicas, aberto: true });
    } else if (resultado.status === "nao_encontrado") {
      setEstado({ status: "erro", mensagem: "A ANVISA não tem as características deste código." });
    } else if (resultado.status === "erro_servidor") {
      setEstado({ status: "erro", mensagem: resultado.mensagem ?? "Não foi possível consultar as características agora." });
    }
  }

  return (
    <li className="rounded-lg border border-ink-200 p-3 dark:border-ink-700">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium tabular-nums text-ink-900 dark:text-ink-50">{udi.gtin}</p>
          {udi.nomeComercial && <p className="mt-0.5 text-xs text-ink-600 dark:text-ink-300">{udi.nomeComercial}</p>}
        </div>
        <button
          type="button"
          onClick={alternar}
          aria-expanded={aberto}
          className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-primary-600 hover:underline dark:text-primary-400"
        >
          {estado.status === "carregando" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          ) : aberto ? (
            <ChevronUp className="h-3.5 w-3.5" aria-hidden />
          ) : (
            <ChevronDown className="h-3.5 w-3.5" aria-hidden />
          )}
          Características
        </button>
      </div>
      {estado.status === "sucesso" && estado.aberto && <Caracteristicas caracteristicas={estado.caracteristicas} />}
      {estado.status === "erro" && <p className="mt-2 text-xs text-danger-600 dark:text-danger-400">{estado.mensagem}</p>}
    </li>
  );
}

function ItemCertificado({ certificado: c }: { certificado: CertificadoBoasPraticas }) {
  const valido = c.status?.toLowerCase() === "válido";
  return (
    <li className="rounded-lg border border-ink-200 p-3 dark:border-ink-700">
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge>{c.tipo}</Badge>
        {c.status && <Badge tone={valido ? "success" : "danger"}>{c.status}</Badge>}
      </div>
      {c.assunto && <p className="mt-1.5 text-xs text-ink-700 dark:text-ink-200">{c.assunto}</p>}
      <p className="mt-1 text-xs text-ink-500 dark:text-ink-400">
        {c.dataValidade && `Validade: ${formatarData(c.dataValidade)}`}
        {c.dataValidade && c.concedidoPor && " · "}
        {c.concedidoPor && `Concedido por ${c.concedidoPor.toLowerCase()}`}
      </p>
    </li>
  );
}

type EstadoDetalhe =
  | { status: "carregando" }
  | ({ status: "sucesso" } & DetalheCompletoProdutoSaude)
  | { status: "nao_encontrado" }
  | { status: "erro"; mensagem?: string };

/**
 * Conteúdo do painel lateral de um registro. Recebe o item da lista (que já
 * tem situação e vencimento) e busca o resto no endpoint de detalhe. Deve
 * ser montado com `key={processo}`, pra recomeçar do "carregando" a cada
 * registro aberto.
 */
export function DetalheProdutoSaude({ produto }: { produto: ProdutoSaude }) {
  const [estado, setEstado] = useState<EstadoDetalhe>(
    produto.processo ? { status: "carregando" } : { status: "nao_encontrado" },
  );

  useEffect(() => {
    if (!produto.processo) return;
    const controller = new AbortController();
    void buscarDetalheProdutoSaude(produto.processo, { signal: controller.signal }).then((resultado) => {
      if (resultado.status === "sucesso") setEstado(resultado);
      else if (resultado.status === "nao_encontrado") setEstado({ status: "nao_encontrado" });
      else if (resultado.status === "erro_servidor") setEstado({ status: "erro", mensagem: resultado.mensagem });
    });
    return () => controller.abort();
  }, [produto.processo]);

  const completo = estado.status === "sucesso" ? estado : undefined;
  const detalhe = completo?.detalhe;
  const risco = detalhe?.risco ?? (produto.siglaRiscoProduto ? { sigla: produto.siglaRiscoProduto } : undefined);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="text-base font-semibold text-ink-900 dark:text-ink-50">{produto.produto}</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <SituacaoRegistro item={produto} />
          {risco && <ClasseRisco sigla={risco.sigla} />}
        </div>
      </div>

      {produto.cancelado && (
        <Aviso>
          Registro cancelado{produto.dataCancelamento && ` em ${formatarData(produto.dataCancelamento)}`}.
        </Aviso>
      )}
      {detalhe?.resolucao && (
        <Aviso>
          {[detalhe.resolucao.situacao, detalhe.resolucao.resolucao, detalhe.resolucao.motivo].filter(Boolean).join(" · ")}
        </Aviso>
      )}
      {detalhe?.processoMedidaCautelar && (
        <Aviso>Há medida cautelar vinculada a este registro (processo {detalhe.processoMedidaCautelar}).</Aviso>
      )}

      <dl className="grid grid-cols-2 gap-4">
        <Campo rotulo="Registro" valor={produto.registro} />
        <Campo rotulo="Processo" valor={produto.processo ?? "Não informado"} />
        <Campo
          rotulo={produto.vencido ? "Venceu em" : "Vencimento"}
          valor={
            produto.dataVencimento ? formatarData(produto.dataVencimento) : produto.vigente ? "Vigente" : "Não informado"
          }
        />
        {detalhe && (
          <Campo
            rotulo="Início da vigência"
            valor={detalhe.dataInicioVigencia ? formatarData(detalhe.dataInicioVigencia) : "Não informado"}
          />
        )}
        {risco && (
          <Campo
            rotulo="Classe de risco"
            valor={risco.descricao ? `${risco.sigla} — ${capitalizar(risco.descricao)}` : risco.sigla}
          />
        )}
        {detalhe?.nomeTecnico && <Campo rotulo="Nome técnico" valor={detalhe.nomeTecnico} />}
      </dl>

      {produto.razaoSocialEmpresa && (
        <Campo
          rotulo="Empresa detentora"
          valor={
            <>
              {produto.razaoSocialEmpresa}
              <span className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-ink-500 dark:text-ink-400">
                {produto.cnpjEmpresa && <LinkCnpj cnpj={formatarCnpj(produto.cnpjEmpresa) ?? produto.cnpjEmpresa} />}
                {detalhe?.autorizacaoEmpresa && <span>· AFE {detalhe.autorizacaoEmpresa}</span>}
              </span>
            </>
          }
        />
      )}

      {estado.status === "carregando" && (
        <p className="flex items-center gap-2 text-sm text-ink-500 dark:text-ink-400">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Carregando fabricantes, modelos, UDI e certificados…
        </p>
      )}
      {estado.status === "nao_encontrado" && (
        <TextoSecundario>A ANVISA não devolveu o detalhe deste registro.</TextoSecundario>
      )}
      {estado.status === "erro" && (
        <p className="text-sm text-danger-600 dark:text-danger-400">
          {estado.mensagem ?? "Não foi possível carregar o detalhe do registro agora."}
        </p>
      )}

      {completo && detalhe && (
        <>
          <Secao titulo={detalhe.fabricantes.length > 1 ? "Fabricantes" : "Fabricante"}>
            {detalhe.fabricantes.length === 0 ? (
              <TextoSecundario>Não informado.</TextoSecundario>
            ) : (
              <ul className="space-y-2">
                {detalhe.fabricantes.map((f, indice) => (
                  <li key={`${f.razaoSocial}-${indice}`} className="text-sm">
                    <span className="font-medium text-ink-900 dark:text-ink-50">{f.razaoSocial}</span>
                    {f.pais && <span className="text-ink-500 dark:text-ink-400"> — {f.pais}</span>}
                    {f.endereco && <p className="text-xs text-ink-500 dark:text-ink-400">{f.endereco}</p>}
                  </li>
                ))}
              </ul>
            )}
          </Secao>

          <Secao titulo={`Modelos e apresentações (${detalhe.modelos.length}${detalhe.modelosIncompletos ? "+" : ""})`}>
            <ListaModelos modelos={detalhe.modelos} incompletos={detalhe.modelosIncompletos} />
          </Secao>

          <Secao titulo="Códigos de barras (UDI)">
            {completo.udis === null ? (
              <TextoSecundario>Não foi possível consultar os códigos UDI agora.</TextoSecundario>
            ) : completo.udis.length === 0 ? (
              <TextoSecundario>
                Nenhum código UDI cadastrado para este registro — o cadastro de UDI na ANVISA ainda está sendo
                implantado aos poucos.
              </TextoSecundario>
            ) : (
              <>
                <ul className="space-y-2">
                  {completo.udis.map((udi) => (
                    <ItemUdi key={udi.id} udi={udi} />
                  ))}
                </ul>
                {completo.totalUdis > completo.udis.length && (
                  <p className="mt-1 text-xs text-ink-400 dark:text-ink-500">
                    Mostrando {completo.udis.length} de {completo.totalUdis} códigos.
                  </p>
                )}
              </>
            )}
          </Secao>

          <Secao titulo="Certificados de boas práticas da detentora">
            {completo.certificados === null ? (
              <TextoSecundario>Não foi possível consultar os certificados agora.</TextoSecundario>
            ) : completo.certificados.length === 0 ? (
              <TextoSecundario>Nenhum certificado encontrado para o CNPJ da empresa detentora.</TextoSecundario>
            ) : (
              <ul className="space-y-2">
                {completo.certificados.map((c) => (
                  <ItemCertificado key={c.id} certificado={c} />
                ))}
              </ul>
            )}
            <p className="mt-2 text-xs text-ink-400 dark:text-ink-500">
              Consulta feita pelo CNPJ da detentora — certificados emitidos para fabricantes estrangeiros não aparecem
              aqui.
            </p>
          </Secao>

          {detalhe.documentos.length > 0 && (
            <Secao titulo="Documentos anexados ao registro">
              <ul className="space-y-1 text-sm text-ink-700 dark:text-ink-200">
                {detalhe.documentos.map((d, indice) => (
                  <li key={`${d.tipo}-${indice}`}>
                    {capitalizar(d.tipo)}
                    {d.dataEnvio && (
                      <span className="text-xs text-ink-500 dark:text-ink-400"> · enviado em {formatarData(d.dataEnvio)}</span>
                    )}
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-ink-400 dark:text-ink-500">
                Os arquivos ficam no portal de consultas da ANVISA — a API não permite baixá-los.
              </p>
            </Secao>
          )}
        </>
      )}
    </div>
  );
}
