// GET /api/dashboard/metrics?periodo=mes|90d|tudo → métricas do Dashboard Executivo.
// Funil/conversão seguem o período; carteira, TPV, lucro e MED são o retrato atual.
// Protegido pelo proxy.js (usuário e senha do consultor).

import { getDb } from "../../../../lib/db.js";
import { respostaErro } from "../../../../lib/respostaApi.js";
import { obterMetricas } from "../../../../services/dashboard.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const periodo = new URL(request.url).searchParams.get("periodo") || "mes";
    return Response.json(await obterMetricas(getDb(), { periodo }));
  } catch (e) {
    return respostaErro(e, "GET /api/dashboard/metrics");
  }
}
