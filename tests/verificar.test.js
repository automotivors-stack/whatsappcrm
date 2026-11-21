// Checagem de ambiente do roteiro de homologação (npm run verificar -- ambiente).
import { test } from "node:test";
import assert from "node:assert/strict";
import { checarAmbiente } from "../scripts/verificar.mjs";

const COMPLETO = {
  TURSO_DATABASE_URL: "libsql://crm-org.turso.io", TURSO_AUTH_TOKEN: "t",
  OPENWA_BASE_URL: "https://openwa.exemplo.com.br", OPENWA_API_KEY: "k", OPENWA_SESSION_ID: "crm-bot",
  OPENWA_WEBHOOK_SECRET: "a".repeat(64), ADMIN_WHATSAPP_NUMBER: "5511988887777",
  CRM_USUARIO: "consultor", CRM_SENHA: "s", ANTHROPIC_API_KEY: "sk-ant-x", RESEND_API_KEY: "re_x",
  RESEND_FROM_EMAIL: "Comercial <comercial@exemplo.com.br>",
};

test("ambiente completo passa", () => {
  assert.deepEqual(checarAmbiente(COMPLETO), []);
});

test("aponta o que falta, sem exigir token em banco local", () => {
  const p = checarAmbiente({ ...COMPLETO, OPENWA_WEBHOOK_SECRET: "", CRM_SENHA: undefined });
  assert.equal(p.length, 2);
  assert.ok(p.some((x) => x.startsWith("OPENWA_WEBHOOK_SECRET")));
  assert.deepEqual(checarAmbiente({ ...COMPLETO, TURSO_DATABASE_URL: "file:local.db", TURSO_AUTH_TOKEN: "" }), []);
});

test("recusa modelo aposentado e formatos errados", () => {
  for (const m of ["claude-3-5-sonnet-20241022", "claude-3-7-sonnet-latest", "claude-3-opus-20240229"]) {
    assert.ok(checarAmbiente({ ...COMPLETO, AGENTE_MODELO: m }).some((x) => /aposentado/.test(x)), m);
  }
  assert.deepEqual(checarAmbiente({ ...COMPLETO, AGENTE_MODELO: "claude-sonnet-5-5" }), []);
  assert.ok(checarAmbiente({ ...COMPLETO, ADMIN_WHATSAPP_NUMBER: "(11) 98888-7777" }).length);
  assert.ok(checarAmbiente({ ...COMPLETO, OPENWA_BASE_URL: "https://x.com/" }).length);
  assert.ok(checarAmbiente({ ...COMPLETO, OPENWA_WEBHOOK_SECRET: "curta" }).length);
});
