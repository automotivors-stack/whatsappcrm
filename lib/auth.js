// Login da área do cliente (Better Auth): e-mail e senha ou Google.
// Separado do acesso do consultor (HTTP Basic, proxy.js): conta de cliente nunca abre o CRM.
//
// Regras:
//  - Toda conta nasce com status_acesso = 'pendente'; só o consultor libera (services/contasClientes.js).
//  - status_acesso e oportunidade_id não aceitam valor vindo do navegador (input: false).
//  - Cadastro por e-mail exige nome, telefone e empresa; quem entra pelo Google completa depois.
//  - Tabelas próprias (cliente_*), criadas pela migração 6 de lib/db.js.

import { betterAuth } from "better-auth";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { Kysely } from "kysely";
import { getDb } from "./db.js";
import { dialetoLibsql } from "./kyselyLibsql.js";
import { validarCadastro } from "./cadastroCliente.js";

export const STATUS_ACESSO = { PENDENTE: "pendente", LIBERADO: "liberado", RECUSADO: "recusado" };

/** Google só entra com as duas chaves configuradas. */
export function googleConfigurado(env = process.env) {
  return Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
}

/**
 * Opções do Better Auth. Exportadas separadas para o teste e para conferir a migração.
 * @param {{ aoCriarConta?: (usuario: object) => Promise<void> }} [deps]
 */
export function opcoesAuth({ aoCriarConta } = {}) {
  return {
    appName: "Let's Touch Base",
    secret: process.env.BETTER_AUTH_SECRET,
    baseURL: process.env.BETTER_AUTH_URL,
    database: { db: new Kysely({ dialect: dialetoLibsql(getDb) }), type: "sqlite" },
    telemetry: { enabled: false },
    // Na Vercel, x-real-ip/x-forwarded-for vêm da própria plataforma (o limite de tentativas é por IP).
    advanced: { cookiePrefix: "ltb", ipAddress: { ipAddressHeaders: ["x-real-ip", "x-forwarded-for"] } },
    emailAndPassword: { enabled: true, minPasswordLength: 8, maxPasswordLength: 128, autoSignIn: true },
    socialProviders: googleConfigurado()
      ? { google: { clientId: process.env.GOOGLE_CLIENT_ID, clientSecret: process.env.GOOGLE_CLIENT_SECRET, prompt: "select_account" } }
      : {},
    // Sem confirmação de e-mail ainda: não junta automaticamente uma conta do Google com uma de senha
    // do mesmo e-mail (evita que alguém cadastre o e-mail de outra pessoa e depois herde o acesso).
    account: { modelName: "cliente_contas", accountLinking: { enabled: false } },
    user: {
      modelName: "cliente_usuarios",
      additionalFields: {
        telefone: { type: "string", required: false, input: true },
        empresa: { type: "string", required: false, input: true },
        status_acesso: { type: "string", required: false, input: false, defaultValue: STATUS_ACESSO.PENDENTE },
        oportunidade_id: { type: "number", required: false, input: false },
      },
    },
    session: { modelName: "cliente_sessoes", expiresIn: 60 * 60 * 24 * 7, updateAge: 60 * 60 * 24 },
    verification: { modelName: "cliente_verificacoes" },
    rateLimit: { enabled: true, storage: "database", modelName: "cliente_limites", window: 60, max: 30 },
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        if (ctx.path === "/sign-up/email") {
          const r = validarCadastro(ctx.body ?? {}, { exigirSenha: false });
          if (r.erros) throw new APIError("BAD_REQUEST", { message: Object.values(r.erros)[0] });
          Object.assign(ctx.body, { name: r.dados.nome, telefone: r.dados.telefone, empresa: r.dados.empresa });
        }
        if (ctx.path === "/update-user") {
          // Só nome, telefone e empresa mudam pela área do cliente, sempre validados.
          const r = validarCadastro({ nome: ctx.body?.name, telefone: ctx.body?.telefone, empresa: ctx.body?.empresa }, { exigirSenha: false, exigirEmail: false });
          if (r.erros) throw new APIError("BAD_REQUEST", { message: Object.values(r.erros)[0] });
          ctx.body = { name: r.dados.nome, telefone: r.dados.telefone, empresa: r.dados.empresa };
        }
      }),
    },
    databaseHooks: {
      user: {
        create: {
          // Defesa extra: qualquer conta nova nasce pendente e sem vínculo, venha de onde vier.
          before: async (usuario) => ({
            data: { ...usuario, status_acesso: STATUS_ACESSO.PENDENTE, oportunidade_id: null },
          }),
          after: async (usuario) => {
            if (!aoCriarConta) return;
            try {
              await aoCriarConta(usuario);
            } catch (erro) {
              console.error(`[auth] aviso de conta nova não enviado: ${erro?.message ?? erro}`);
            }
          },
        },
      },
    },
  };
}

let authGlobal = null;
/** Instância única do login. O aviso ao consultor fica em services/contasClientes.js. */
export async function getAuth() {
  if (authGlobal) return authGlobal;
  const { avisarContaNova } = await import("../services/contasClientes.js");
  authGlobal = betterAuth(opcoesAuth({ aoCriarConta: avisarContaNova }));
  return authGlobal;
}
