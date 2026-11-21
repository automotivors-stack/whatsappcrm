// GET   /api/leads/:id  → 200 { lead, mensagens, interacoes }   (dossiê 360°)
// PATCH /api/leads/:id  { status_kanban?, fornecedor_operacao?, dados_precificacao?, volume_real_mes?, med_real_mes? }
//       → 200 {oportunidade atualizada}
// 404 { error: "Oportunidade não encontrada" } quando o id não existe.

import { getDb } from "../../../../lib/db.js";
import { lerJson, respostaErro } from "../../../../lib/respostaApi.js";
import { ErroLeads, atualizarLead, obterDossie, validarId } from "../../../../services/leads.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request, { params }) {
  try {
    const id = validarId((await params).id);
    return Response.json(await obterDossie(getDb(), id));
  } catch (e) {
    return respostaErro(e, "GET /api/leads/[id]");
  }
}

export async function PATCH(request, { params }) {
  try {
    const id = validarId((await params).id);
    const corpo = await lerJson(request);
    if (corpo && typeof corpo === "object" && corpo.id !== undefined && Number(corpo.id) !== id) {
      throw new ErroLeads("id do corpo diferente do da URL.", 400);
    }
    return Response.json(await atualizarLead(getDb(), { ...corpo, id }));
  } catch (e) {
    return respostaErro(e, "PATCH /api/leads/[id]");
  }
}
