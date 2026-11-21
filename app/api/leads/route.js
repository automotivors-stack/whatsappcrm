// GET  /api/leads                      → { leads }  (filtros: ?status=<fase>&fornecedor=<Pushin Pay|Kluubpay|sem_parceiro>)
// GET  /api/leads?id=12                → { lead, interacoes }
// PATCH /api/leads  { id, status_kanban?, fornecedor_operacao?, dados_precificacao?, volume_real_mes?, med_real_mes? }
// Protegido pelo proxy.js (acesso do consultor).

import { getDb } from "../../../lib/db.js";
import { ErroLeads, atualizarLead, listarLeads, obterLead } from "../../../services/leads.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function erro(e) {
  if (e instanceof ErroLeads) return Response.json({ erro: e.message }, { status: e.status });
  console.error(`[api/leads] ${e?.message ?? e}`);
  return Response.json({ erro: "Não foi possível concluir. Tente de novo." }, { status: 500 });
}

export async function GET(request) {
  try {
    const params = new URL(request.url).searchParams;
    const db = getDb();
    if (params.has("id")) {
      const id = Number(params.get("id"));
      if (!Number.isInteger(id) || id <= 0) throw new ErroLeads("id inválido.", 400);
      return Response.json(await obterLead(db, id));
    }
    const leads = await listarLeads(db, {
      status: params.get("status") || undefined,
      fornecedor: params.get("fornecedor") || undefined,
    });
    return Response.json({ leads });
  } catch (e) {
    return erro(e);
  }
}

export async function PATCH(request) {
  let corpo;
  try {
    corpo = await request.json();
  } catch {
    return Response.json({ erro: "JSON inválido." }, { status: 400 });
  }
  try {
    return Response.json({ lead: await atualizarLead(getDb(), corpo) });
  } catch (e) {
    return erro(e);
  }
}
