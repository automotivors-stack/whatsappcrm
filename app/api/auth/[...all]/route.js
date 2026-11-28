// Rotas do login da área do cliente (Better Auth): cadastro, entrada, Google, sessão e saída.
// Públicas no proxy.js (prefixo /api/auth/); a proteção é a própria sessão do Better Auth.

import { toNextJsHandler } from "better-auth/next-js";
import { getAuth } from "../../../../lib/auth.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request) {
  return toNextJsHandler(await getAuth()).GET(request);
}

export async function POST(request) {
  return toNextJsHandler(await getAuth()).POST(request);
}
