// GET  /api/leads/:id/interacoes → 200 [ {interacao}, ... ]  (created_at DESC)
// POST /api/leads/:id/interacoes { tipo, destinatario?, assunto?, mensagem?, status_envio? }
//      → 201 {interacao criada}. Só registra na linha do tempo: não envia WhatsApp nem e-mail.

import { getDb } from "../../../../../lib/db.js";
import { lerJson, respostaErro } from "../../../../../lib/respostaApi.js";
import { criarInteracao, listarInteracoes, validarId } from "../../../../../services/leads.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request, { params }) {
  try {
    const id = validarId((await params).id);
    return Response.json(await listarInteracoes(getDb(), id));
  } catch (e) {
    return respostaErro(e, "GET /api/leads/[id]/interacoes");
  }
}

export async function POST(request, { params }) {
  try {
    const id = validarId((await params).id);
    const interacao = await criarInteracao(getDb(), id, await lerJson(request));
    return Response.json(interacao, { status: 201 });
  } catch (e) {
    return respostaErro(e, "POST /api/leads/[id]/interacoes");
  }
}
