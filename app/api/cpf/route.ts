import { NextRequest, NextResponse } from "next/server";
import { validarCpf } from "@/lib/cpf";
import { descreverFalha } from "@/lib/server/erros";
import { criarLimitePorIp, ipDaRequisicao } from "@/lib/server/limite-ip";
import { buscarNaListaSuja } from "@/lib/server/lista-suja-client";
import { buscarPessoaFisica } from "@/lib/server/transparencia-client";

/**
 * Consulta de CPF no Portal da Transparência (CGU): nome, sanções, PEP,
 * vínculo de servidor e contratos federais. Mesma chave das sanções
 * (PORTAL_TRANSPARENCIA_API_KEY) — sem ela, 501. Confere também a "lista
 * suja" do trabalho escravo (MTE), que é consultada na memória do servidor:
 * o CPF não sai daqui pra essa fonte.
 *
 * CPF é dado pessoal (LGPD), então:
 * - vai no corpo de um POST, não na URL — a URL fica nos logs da Vercel;
 * - nada é guardado: sem cache e sem o CPF nos logs de erro;
 * - limite de consultas por IP, pra rota não virar um jeito de descobrir o
 *   nome de CPFs em massa com a cota da nossa chave (400 chamadas/min, e
 *   cada CPF gasta de 5 a 16).
 */
export const dynamic = "force-dynamic";

const CONSULTAS_POR_MINUTO = 10;
const excedeuLimite = criarLimitePorIp(CONSULTAS_POR_MINUTO);

export async function POST(request: NextRequest) {
  const corpo = (await request.json().catch(() => ({}))) as { cpf?: unknown };
  const validacao = validarCpf(typeof corpo.cpf === "string" ? corpo.cpf : "");

  if (!validacao.valido) {
    return NextResponse.json({ erro: validacao.mensagem }, { status: 400 });
  }

  const chave = process.env.PORTAL_TRANSPARENCIA_API_KEY;
  if (!chave) {
    return NextResponse.json({ erro: "Consulta de CPF ainda não configurada nesta instância." }, { status: 501 });
  }

  if (excedeuLimite(ipDaRequisicao(request))) {
    return NextResponse.json(
      { erro: `Limite de ${CONSULTAS_POR_MINUTO} consultas de CPF por minuto atingido. Tente de novo em instantes.` },
      { status: 429, headers: { "Retry-After": "60" } },
    );
  }

  try {
    // A lista suja é outra fonte (MTE): se ela falhar, a consulta da CGU segue valendo e
    // `listaSuja: null` diz à tela que a lista não pôde ser conferida.
    const [pessoa, listaSuja] = await Promise.all([
      buscarPessoaFisica(validacao.cpf, chave, request.signal),
      buscarNaListaSuja(validacao.cpf).catch((erro) => {
        console.error(`[cpf] lista suja: ${descreverFalha(erro)}`);
        return null;
      }),
    ]);
    return NextResponse.json({ pessoa: { ...pessoa, listaSuja } }, { headers: { "Cache-Control": "no-store" } });
  } catch (erro) {
    // `descreverFalha` só tem o endpoint e o status ("Portal da Transparência (pessoa-fisica) respondeu 403"), nunca o CPF.
    const detalhe = descreverFalha(erro);
    console.error(`[cpf] ${detalhe}`);
    return NextResponse.json({ erro: "Não foi possível consultar o CPF neste momento.", detalhe }, { status: 502 });
  }
}
