// Orçamento de tempo do webhook na Vercel: o pior caso do processamento depois do 200 precisa caber
// no maxDuration da rota, senão a função é encerrada no meio (lead sem resposta e sem alerta).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { configAgente } from "../services/aiDiagnosticService.js";
import { timeoutOpenWA } from "../services/whatsappService.js";

const rota = readFileSync(new URL("../app/api/webhooks/whatsapp/route.js", import.meta.url), "utf8");
const maxDuration = Number(/export const maxDuration = (\d+);/.exec(rota)?.[1]);

/** Pior caso em ms: banco + IA (todas as tentativas, com espera entre elas) + resposta ao lead + aviso ao consultor. */
function piorCaso(env) {
  const { timeoutMs, tentativasExtras } = configAgente(env);
  const banco = 2_000;
  const esperaEntreTentativas = 1_000 * tentativasExtras;
  return banco + timeoutMs * (1 + tentativasExtras) + esperaEntreTentativas + 2 * timeoutOpenWA(env);
}

test("a rota do webhook declara maxDuration", () => {
  assert.equal(maxDuration, 60);
});

test("com os padrões, o pior caso cabe nos 60 s com folga", () => {
  const ms = piorCaso({});
  assert.ok(ms <= maxDuration * 1000 - 3_000, `pior caso ${ms} ms`);
  assert.deepEqual(configAgente({}), { timeoutMs: 18_000, tentativasExtras: 1 });
  assert.equal(timeoutOpenWA({}), 8_000);
});

test("os tempos são configuráveis e valores absurdos voltam ao padrão", () => {
  assert.deepEqual(configAgente({ AGENTE_TIMEOUT_MS: "45000", AGENTE_TENTATIVAS_EXTRAS: "2" }), { timeoutMs: 45_000, tentativasExtras: 2 });
  assert.deepEqual(configAgente({ AGENTE_TIMEOUT_MS: "10", AGENTE_TENTATIVAS_EXTRAS: "-1" }), { timeoutMs: 18_000, tentativasExtras: 1 });
  assert.equal(timeoutOpenWA({ OPENWA_TIMEOUT_MS: "abc" }), 8_000);
  // exemplo de configuração que NÃO cabe na Vercel com 60 s (serve para VPS):
  assert.ok(piorCaso({ AGENTE_TIMEOUT_MS: "60000", AGENTE_TENTATIVAS_EXTRAS: "2" }) > 60_000);
});
