// Política de acesso: TUDO exige usuário e senha do consultor (HTTP Basic), exceto a lista
// explícita ROTAS_PUBLICAS abaixo. Rota nova nasce protegida. O Kanban, o dashboard e as APIs expõem
// CPF/CNPJ e dados comerciais. Sem CRM_USUARIO/CRM_SENHA configurados, o CRM fica bloqueado
// (falha fechada); as rotas públicas continuam abrindo.
// tests/acessoPublico.test.js percorre todas as rotas do app e falha se alguma fora da lista abrir sem senha.

/**
 * Únicas exceções, por caminho EXATO e método:
 *  - "/" (GET/HEAD): landing institucional; não lê banco nem dados do CRM.
 *  - "/api/webhooks/whatsapp" (POST): eventos do OpenWA, protegidos pela assinatura HMAC (webhookOpenwa.js).
 */
export const ROTAS_PUBLICAS = [
  { caminho: "/", metodos: ["GET", "HEAD"] },
  { caminho: "/api/webhooks/whatsapp", metodos: ["POST"] },
];

export function rotaPublica(metodo, caminho) {
  return ROTAS_PUBLICAS.some((r) => r.caminho === caminho && r.metodos.includes(metodo));
}

function iguais(a, b) {
  // Comparação em tempo constante para o tamanho dado.
  if (a.length !== b.length) return false;
  let diferenca = 0;
  for (let i = 0; i < a.length; i += 1) diferenca |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diferenca === 0;
}

function recusar(request, status, mensagem, cabecalhos = {}) {
  // Rotas de API respondem no padrão { error }; páginas, em texto.
  const ehApi = new URL(request.url).pathname.startsWith("/api/");
  return ehApi
    ? Response.json({ error: mensagem }, { status, headers: cabecalhos })
    : new Response(mensagem, { status, headers: cabecalhos });
}

export function proxy(request) {
  if (rotaPublica(request.method, new URL(request.url).pathname)) return undefined;

  const usuario = process.env.CRM_USUARIO;
  const senha = process.env.CRM_SENHA;
  if (!usuario || !senha) {
    return recusar(request, 503, "Acesso não configurado: defina CRM_USUARIO e CRM_SENHA.");
  }

  const cabecalho = request.headers.get("authorization") ?? "";
  if (cabecalho.startsWith("Basic ")) {
    let decodificado = "";
    try {
      // UTF-8, para senhas com acento ou "ç" funcionarem.
      const bytes = Uint8Array.from(atob(cabecalho.slice(6).trim()), (c) => c.charCodeAt(0));
      decodificado = new TextDecoder().decode(bytes);
    } catch {
      decodificado = "";
    }
    const separador = decodificado.indexOf(":");
    if (separador > 0) {
      const u = decodificado.slice(0, separador);
      const s = decodificado.slice(separador + 1);
      if (iguais(u, usuario) && iguais(s, senha)) return undefined; // segue para a rota
    }
  }
  return recusar(request, 401, "Acesso restrito.", { "WWW-Authenticate": 'Basic realm="CRM", charset="UTF-8"' });
}

export const config = {
  // Passa por aqui TODA requisição, menos os arquivos estáticos gerados no build do Next
  // (JS, CSS, fontes) e o favicon. As exceções públicas ficam em ROTAS_PUBLICAS, não no matcher.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
