// POST /api/whatsapp/send  { oportunidadeId, telefone?, mensagem, idempotencyKey? }
// → 201 { success: true, messageId, interacao }
// → 502 { error, interacao }  quando o OpenWA recusa (a falha fica na linha do tempo)
// Envio REAL pelo OpenWA. Protegido pelo proxy.js (usuário e senha do consultor).

import { getDb } from "../../../../lib/db.js";
import { lerJson, respostaErro } from "../../../../lib/respostaApi.js";
import { dispararWhatsApp } from "../../../../services/comunicacao.js";
import { enviarMensagemWhatsApp } from "../../../../services/whatsappService.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const resultado = await dispararWhatsApp({ db: getDb(), enviar: enviarMensagemWhatsApp }, await lerJson(request));
    return Response.json(resultado, { status: 201 });
  } catch (e) {
    return respostaErro(e, "POST /api/whatsapp/send");
  }
}
