// Acesso do consultor: o Kanban e a API de leads expõem CPF/CNPJ e dados comerciais,
// então ficam atrás de usuário e senha (HTTP Basic) definidos no ambiente.
// O webhook do OpenWA NÃO passa por aqui: ele tem a própria assinatura HMAC.
// Sem CRM_USUARIO/CRM_SENHA configurados, o acesso fica bloqueado (falha fechada).

function iguais(a, b) {
  // Comparação em tempo constante para o tamanho dado.
  if (a.length !== b.length) return false;
  let diferenca = 0;
  for (let i = 0; i < a.length; i += 1) diferenca |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diferenca === 0;
}

export function proxy(request) {
  const usuario = process.env.CRM_USUARIO;
  const senha = process.env.CRM_SENHA;
  if (!usuario || !senha) {
    return new Response("Acesso não configurado: defina CRM_USUARIO e CRM_SENHA.", { status: 503 });
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
  return new Response("Acesso restrito.", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="CRM", charset="UTF-8"' },
  });
}

export const config = {
  // Tudo, menos o webhook do WhatsApp e os arquivos estáticos do Next.
  matcher: ["/((?!api/webhooks|_next/static|_next/image|favicon.ico).*)"],
};
