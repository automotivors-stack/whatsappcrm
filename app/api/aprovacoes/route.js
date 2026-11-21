// GET /api/aprovacoes → [ { id, telefone, dados, aviso_enviado, created_at } ]
// Diagnósticos concluídos pela IA aguardando o SIM/NÃO do consultor (fallback do WhatsApp).
// Protegido pelo proxy.js (usuário e senha do consultor).

import { getDb } from "../../../lib/db.js";
import { respostaErro } from "../../../lib/respostaApi.js";
import { listarPendencias } from "../../../services/aprovacao.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return Response.json(await listarPendencias(getDb()));
  } catch (e) {
    return respostaErro(e, "GET /api/aprovacoes");
  }
}
