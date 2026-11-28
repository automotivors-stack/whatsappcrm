// POST /api/contas-clientes/:id  { decisao: "liberar" | "recusar", oportunidadeId?: number }
// Só o consultor (HTTP Basic, proxy.js). → 200 { conta } | 404 { error }

import { getDb } from "../../../../lib/db.js";
import { lerJson, respostaErro } from "../../../../lib/respostaApi.js";
import { decidirConta } from "../../../../services/contasClientes.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request, { params }) {
  try {
    const conta = await decidirConta(getDb(), (await params).id, await lerJson(request));
    return Response.json({ conta });
  } catch (e) {
    return respostaErro(e, "POST /api/contas-clientes/[id]");
  }
}
