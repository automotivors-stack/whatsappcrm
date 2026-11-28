// GET /api/contas-clientes → { contas: [...] } (pendentes primeiro). Só o consultor (HTTP Basic, proxy.js).

import { getDb } from "../../../lib/db.js";
import { respostaErro } from "../../../lib/respostaApi.js";
import { listarContas } from "../../../services/contasClientes.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return Response.json({ contas: await listarContas(getDb()) });
  } catch (e) {
    return respostaErro(e, "GET /api/contas-clientes");
  }
}
