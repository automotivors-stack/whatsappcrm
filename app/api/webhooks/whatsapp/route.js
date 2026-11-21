// Webhook do OpenWA. Configure no OpenWA:
//   POST {OPENWA_BASE_URL}/api/sessions/{OPENWA_SESSION_ID}/webhooks
//   { "url": "https://<seu-dominio>/api/webhooks/whatsapp", "events": ["message.received"],
//     "secret": "<OPENWA_WEBHOOK_SECRET>" }
// Responde 200 assim que a assinatura confere; o processamento roda depois, com `after`.

import { after } from "next/server";
import { receberWebhook } from "../../../../services/webhookOpenwa.js";
import { contextoPadrao, processarEventoOpenWA } from "../../../../services/processarMensagem.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Vercel: o trabalho depois do 200 (`after`) conta dentro deste limite. 60 s cabe em todos os planos;
// os tempos da IA e do OpenWA (configAgente, timeoutOpenWA) foram dimensionados para caber aqui.
// Se o seu plano permitir mais, aumente este valor e os tempos juntos (tests/orcamento.test.js confere).
export const maxDuration = 60;

export async function POST(request) {
  return receberWebhook(request, {
    segredo: process.env.OPENWA_WEBHOOK_SECRET,
    agendar: after,
    processar: (payload) => processarEventoOpenWA(contextoPadrao(), payload),
  });
}
