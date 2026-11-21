// GET   /api/leads?status=<fase>&fornecedor=<Pushin Pay|Kluubpay|sem_parceiro>&busca=<nome ou documento>
//       → 200 [ {oportunidade}, ... ]   (created_at DESC)
// PATCH /api/leads  { id, status_kanban?, fornecedor_operacao?, dados_precificacao?, volume_real_mes?, med_real_mes? }
//       → 200 {oportunidade atualizada}
// Erros: { error } com 400 (validação/governança), 404 (não encontrada) ou 500.
// Acesso protegido pelo proxy.js (usuário e senha do consultor).

import { getDb } from "../../../lib/db.js";
import { lerJson, respostaErro } from "../../../lib/respostaApi.js";
import { atualizarLead, listarLeads } from "../../../services/leads.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const params = new URL(request.url).searchParams;
    const leads = await listarLeads(getDb(), {
      status: params.get("status") || undefined,
      fornecedor: params.get("fornecedor") || undefined,
      busca: params.get("busca") || undefined,
    });
    return Response.json(leads);
  } catch (e) {
    return respostaErro(e, "GET /api/leads");
  }
}

export async function PATCH(request) {
  try {
    return Response.json(await atualizarLead(getDb(), await lerJson(request)));
  } catch (e) {
    return respostaErro(e, "PATCH /api/leads");
  }
}
