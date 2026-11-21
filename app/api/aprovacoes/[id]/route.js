// POST /api/aprovacoes/:id  { decisao: "SIM" | "NAO" }
// Mesma regra do SIM/NÃO no WhatsApp do consultor (services/aprovacao.js → decidirPendencia).
// → 200 { resultado: "aprovado", oportunidadeId } | { resultado: "descartado" }
// → 409 { error } se já foi decidida (pelo WhatsApp ou por outra aba); 404 se não existe.

import { getDb } from "../../../../lib/db.js";
import { lerJson, respostaErro } from "../../../../lib/respostaApi.js";
import { decidirPendencia } from "../../../../services/aprovacao.js";
import { ErroLeads, validarId } from "../../../../services/leads.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request, { params }) {
  try {
    const id = validarId((await params).id);
    const corpo = await lerJson(request);
    if (!corpo || (corpo.decisao !== "SIM" && corpo.decisao !== "NAO")) {
      throw new ErroLeads('Informe decisao: "SIM" ou "NAO".', 400);
    }
    const r = await decidirPendencia(getDb(), id, corpo.decisao);
    if (r.resultado === "inexistente") throw new ErroLeads("Diagnóstico não encontrado.", 404);
    if (r.resultado === "ja_decidido") throw new ErroLeads("Este diagnóstico já foi decidido.", 409);
    return Response.json(r);
  } catch (e) {
    return respostaErro(e, "POST /api/aprovacoes/[id]");
  }
}
