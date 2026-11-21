// Respostas padronizadas das rotas de API: erros sempre como { error: "..." }.

import { ErroLeads } from "../services/leads.js";

export function respostaErro(e, rota) {
  if (e instanceof ErroLeads) return Response.json({ error: e.message, ...e.dados }, { status: e.status });
  // Só a mensagem técnica no log: nunca o corpo da requisição (pode ter dados do cliente).
  console.error(`[${rota}] ${e?.message ?? e}`);
  return Response.json({ error: "Erro interno. Tente de novo." }, { status: 500 });
}

/**
 * Lê o corpo JSON. Exige Content-Type application/json: um formulário de outro site não consegue
 * mandar esse cabeçalho sem a checagem de CORS do navegador, o que bloqueia disparos forjados
 * (CSRF) usando a senha do consultor guardada no navegador.
 */
export async function lerJson(request) {
  const tipo = request.headers.get("content-type") ?? "";
  if (!/^application\/json\b/i.test(tipo)) {
    throw new ErroLeads("Envie o corpo como JSON (Content-Type: application/json).", 415);
  }
  try {
    return await request.json();
  } catch {
    throw new ErroLeads("JSON inválido.", 400);
  }
}
