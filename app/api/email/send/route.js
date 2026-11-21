// POST /api/email/send  { oportunidadeId, email?, assunto, corpoHtml, corpoTexto?, idempotencyKey? }
// → 201 { success: true, emailId, interacao }
// → 502 { error, interacao }  quando o Resend recusa (a falha fica na linha do tempo)
// Envio REAL pelo Resend (remetente RESEND_FROM_EMAIL). Protegido pelo proxy.js.

import { getDb } from "../../../../lib/db.js";
import { lerJson, respostaErro } from "../../../../lib/respostaApi.js";
import { dispararEmail } from "../../../../services/comunicacao.js";
import { enviarEmail } from "../../../../services/emailService.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const resultado = await dispararEmail({ db: getDb(), enviarEmail }, await lerJson(request));
    return Response.json(resultado, { status: 201 });
  } catch (e) {
    return respostaErro(e, "POST /api/email/send");
  }
}
