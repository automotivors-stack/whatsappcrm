// Recepção do webhook do OpenWA: confere a assinatura, agenda o processamento e responde 200 na hora.
// O OpenWA assina o corpo exato com HMAC-SHA256 do `secret` do webhook e manda
// `X-OpenWA-Signature: sha256=<hex>`.

import { createHmac, timingSafeEqual } from "node:crypto";

export function assinaturaValida(corpo, cabecalho, segredo) {
  if (!segredo || !cabecalho) return false;
  const esperada = `sha256=${createHmac("sha256", segredo).update(corpo).digest("hex")}`;
  const a = Buffer.from(String(cabecalho));
  const b = Buffer.from(esperada);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * @param {Request} request
 * @param {{ segredo?: string, agendar: (fn: () => Promise<void>) => void, processar: (payload: any) => Promise<any> }} deps
 *   agendar: `after` do Next.js (roda depois da resposta).
 */
export async function receberWebhook(request, { segredo, agendar, processar }) {
  if (!segredo) {
    // Sem segredo não dá para distinguir o OpenWA de um terceiro forjando um "SIM" do consultor.
    console.error("[webhook] OPENWA_WEBHOOK_SECRET não configurado; evento recusado");
    return Response.json({ ok: false }, { status: 503 });
  }
  const corpo = await request.text();
  if (!assinaturaValida(corpo, request.headers.get("x-openwa-signature"), segredo)) {
    return Response.json({ ok: false }, { status: 401 });
  }

  let payload;
  try {
    payload = JSON.parse(corpo);
  } catch {
    return Response.json({ ok: false }, { status: 400 });
  }

  agendar(async () => {
    try {
      await processar(payload);
    } catch (erro) {
      console.error(`[webhook] falha ao processar evento ${payload?.event}: ${erro?.message ?? erro}`);
    }
  });
  return Response.json({ ok: true }, { status: 200 });
}
