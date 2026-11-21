// Respostas padronizadas das rotas de API: erros sempre como { error: "..." }.

import { ErroLeads } from "../services/leads.js";

export function respostaErro(e, rota) {
  if (e instanceof ErroLeads) return Response.json({ error: e.message }, { status: e.status });
  // Só a mensagem técnica no log: nunca o corpo da requisição (pode ter dados do cliente).
  console.error(`[${rota}] ${e?.message ?? e}`);
  return Response.json({ error: "Erro interno. Tente de novo." }, { status: 500 });
}

export async function lerJson(request) {
  try {
    return await request.json();
  } catch {
    throw new ErroLeads("JSON inválido.", 400);
  }
}
