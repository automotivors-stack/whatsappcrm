// Sinergia entre os 4 módulos: do WhatsApp do lead até a linha do tempo do card.
// Usa os clientes REAIS do OpenWA (fetch) e do Resend (SDK), apontados para um servidor local.
import { test, before, after, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClient } from "@libsql/client";

// ---- gateways falsos (OpenWA + Resend) num servidor local ----
let respostaOpenWA = { status: 201, corpo: { messageId: "wamid.OK" } };
let respostaResend = { status: 200, corpo: { id: "re_OK" } };
const recebidos = [];
const servidor = http.createServer((req, res) => {
  let b = "";
  req.on("data", (c) => (b += c));
  req.on("end", () => {
    recebidos.push({ url: req.url, headers: req.headers, corpo: JSON.parse(b || "{}") });
    const r = req.url.endsWith("/emails") ? respostaResend : respostaOpenWA;
    res.writeHead(r.status, { "content-type": "application/json" });
    res.end(JSON.stringify(r.corpo));
  });
});
await new Promise((ok) => servidor.listen(0, "127.0.0.1", ok));
const BASE = `http://127.0.0.1:${servidor.address().port}`;
Object.assign(process.env, {
  OPENWA_BASE_URL: BASE, OPENWA_API_KEY: "chave", OPENWA_SESSION_ID: "s1",
  RESEND_BASE_URL: BASE, RESEND_API_KEY: "re_teste", RESEND_FROM_EMAIL: "Comercial <comercial@exemplo.com.br>",
});
// O SDK do Resend lê RESEND_BASE_URL ao carregar: importar depois de definir.
const { migrar } = await import("../lib/db.js");
const { processarEventoOpenWA } = await import("../services/processarMensagem.js");
const { listarLeads, obterDossie, listarInteracoes } = await import("../services/leads.js");
const { dispararWhatsApp, dispararEmail } = await import("../services/comunicacao.js");
const { enviarMensagemWhatsApp } = await import("../services/whatsappService.js");
const { enviarEmail } = await import("../services/emailService.js");
const { dataHora } = await import("../lib/formato.js");
const { proxy } = await import("../proxy.js");
const { receberWebhook } = await import("../services/webhookOpenwa.js");

after(() => servidor.close());

const ADMIN = "5511988887777";
const LEAD = "5521977776666";
let pasta, db, seq;

beforeEach(async () => {
  pasta = mkdtempSync(join(tmpdir(), "crm-integ-"));
  db = createClient({ url: `file:${join(pasta, "t.db")}` });
  await migrar(db);
  recebidos.length = 0;
  seq = 0;
  respostaOpenWA = { status: 201, corpo: { messageId: "wamid.OK" } };
  respostaResend = { status: 200, corpo: { id: "re_OK" } };
});
afterEach(() => { db.close(); rmSync(pasta, { recursive: true, force: true }); });

const evento = (de, corpo) => ({
  event: "message.received",
  data: { id: `wamid.in.${++seq}`, from: `${de}@c.us`, body: corpo, type: "text", fromMe: false, isGroup: false, kind: "individual" },
});

/** Ciclo da Ação 2: conversa do lead → diagnóstico → SIM do consultor. Devolve o id do card. */
async function leadAprovado() {
  const ctx = { db, adminNumero: ADMIN, enviar: enviarMensagemWhatsApp, agente: async () => null };
  await processarEventoOpenWA(ctx, evento(LEAD, "Oi, quero reduzir minhas taxas"));
  ctx.agente = async () => ({
    texto: "Obrigado! Um consultor vai falar com você.",
    diagnosticoFinal: {
      nome_ou_razao_social: "Padaria Integração", documento: "12.345.678/0001-90",
      whatsapp_contato: "(21) 97777-6666", email_contato: "financeiro@padaria.exemplo",
      resumo_executivo: "Quer Pix mais barato.",
    },
  });
  await processarEventoOpenWA(ctx, evento(LEAD, "Faturo 150 mil por mês"));
  ctx.agente = async () => null;
  const r = await processarEventoOpenWA(ctx, evento(ADMIN, "SIM"));
  assert.equal(r.acao, "aprovado");
  return r.oportunidadeId;
}

test("trilha completa: WhatsApp do lead → SIM → card → dossiê → disparo → linha do tempo", async () => {
  const id = await leadAprovado();
  assert.equal(typeof id, "number");

  // Ação 3: o card aparece na listagem com o id numérico e o phone_number do contato
  const [card] = await listarLeads(db);
  assert.equal(card.id, id);
  assert.equal(card.phone_number, LEAD);
  assert.equal(card.status_kanban, "Contato Recebido");

  // Dossiê: o phone_number do card é a mesma chave do histórico (mensagens do lead + resposta da IA)
  const dossie = await obterDossie(db, id);
  assert.deepEqual(dossie.mensagens.map((m) => [m.role, m.content]), [
    ["user", "Oi, quero reduzir minhas taxas"],
    ["user", "Faturo 150 mil por mês"],
    ["assistant", "Obrigado! Um consultor vai falar com você."],
  ]);

  // Ação 4: disparo pelo card com o id do card e o WhatsApp do diagnóstico (formatado, sem 55)
  recebidos.length = 0;
  const w = await dispararWhatsApp({ db, enviar: enviarMensagemWhatsApp }, { oportunidadeId: card.id, mensagem: "Segue a proposta." });
  assert.equal(recebidos[0].corpo.chatId, "5521977776666@c.us");
  assert.equal(recebidos[0].headers["x-api-key"], "chave");
  const e = await dispararEmail({ db, enviarEmail }, { oportunidadeId: card.id, assunto: "Proposta", corpoHtml: "<p>Segue.</p>" });
  assert.deepEqual(recebidos[1].corpo.to, ["financeiro@padaria.exemplo"]);

  // A listagem de interações devolve exatamente o que o disparo gravou (mesmo formato)
  const linha = await listarInteracoes(db, id);
  assert.deepEqual(linha.map((i) => i.id).sort(), [w.interacao.id, e.interacao.id].sort());
  const doBanco = linha.find((i) => i.id === w.interacao.id);
  assert.deepEqual(doBanco, w.interacao);
  assert.deepEqual((await obterDossie(db, id)).interacoes.map((i) => i.tipo).sort(), ["email_enviado", "whatsapp_enviado"]);
});

test("OpenWA recusa: falha registrada, 502 e o código do gateway na mensagem", async () => {
  const id = await leadAprovado();
  respostaOpenWA = { status: 400, corpo: { statusCode: 400, message: "Bad Request", error: "Bad Request" } };
  await assert.rejects(
    dispararWhatsApp({ db, enviar: enviarMensagemWhatsApp }, { oportunidadeId: id, mensagem: "oi" }),
    (err) => err.status === 502 && err.dados.interacao.status_envio === "falha" && /HTTP 400/.test(err.message),
  );
});

test("OpenWA com resultado incerto (409 IDEMPOTENCY_OUTCOME_UNKNOWN): registra 'incerto' e pede conferência", async () => {
  const id = await leadAprovado();
  respostaOpenWA = { status: 409, corpo: { statusCode: 409, code: "IDEMPOTENCY_OUTCOME_UNKNOWN", message: "x" } };
  await assert.rejects(
    dispararWhatsApp({ db, enviar: enviarMensagemWhatsApp }, { oportunidadeId: id, mensagem: "oi", idempotencyKey: "k" }),
    (err) => err.dados.interacao.status_envio === "incerto" && /confira a conversa antes de reenviar/.test(err.message),
  );
});

test("OpenWA sem resposta no prazo: 'incerto' (pode ter saído)", async () => {
  const id = await leadAprovado();
  const estoura = () => { const e = new Error("timeout"); e.name = "TimeoutError"; throw e; };
  await assert.rejects(
    dispararWhatsApp({ db, enviar: () => estoura() }, { oportunidadeId: id, mensagem: "oi" }),
    (err) => err.dados.interacao.status_envio === "incerto",
  );
});

test("OpenWA limitando o ritmo (429): falha com o tempo de espera", async () => {
  const id = await leadAprovado();
  respostaOpenWA = { status: 429, corpo: { statusCode: 429, code: "SEND_PACING_LIMITED", retryAfterSeconds: 30 } };
  await assert.rejects(
    dispararWhatsApp({ db, enviar: enviarMensagemWhatsApp }, { oportunidadeId: id, mensagem: "oi" }),
    (err) => err.dados.interacao.status_envio === "falha" && /Tente de novo em 30 segundos/.test(err.message),
  );
});

test("Resend com chave inválida (401): falha registrada com o motivo", async () => {
  const id = await leadAprovado();
  respostaResend = { status: 401, corpo: { statusCode: 401, name: "validation_error", message: "API key is invalid" } };
  await assert.rejects(
    dispararEmail({ db, enviarEmail }, { oportunidadeId: id, assunto: "a", corpoHtml: "<p>b</p>" }),
    (err) => err.status === 502 && err.dados.interacao.status_envio === "falha" && /HTTP 401.*API key is invalid/.test(err.message),
  );
});

test("Resend sem remetente configurado: falha registrada e nada sai", async () => {
  const id = await leadAprovado();
  const antes = process.env.RESEND_FROM_EMAIL;
  delete process.env.RESEND_FROM_EMAIL;
  recebidos.length = 0;
  try {
    await assert.rejects(
      dispararEmail({ db, enviarEmail }, { oportunidadeId: id, assunto: "a", corpoHtml: "<p>b</p>" }),
      (err) => err.dados.interacao.status_envio === "falha" && /RESEND_FROM_EMAIL não configurado/.test(err.message),
    );
    assert.equal(recebidos.length, 0);
  } finally {
    process.env.RESEND_FROM_EMAIL = antes;
  }
});

test("datas do SQLite (UTC) aparecem no horário de Brasília", () => {
  assert.equal(dataHora("2026-11-21 14:30:52"), "21/11/2026, 11:30");
  assert.equal(dataHora(""), "");
  assert.equal(dataHora("lixo"), "lixo");
});

test("contrato { error }: bloqueio por senha nas APIs e erros do webhook", async () => {
  Object.assign(process.env, { CRM_USUARIO: "u", CRM_SENHA: "s" });
  const api = proxy(new Request("http://x/api/leads"));
  assert.equal(api.status, 401);
  assert.deepEqual(await api.json(), { error: "Acesso restrito." });
  assert.ok(api.headers.get("www-authenticate"));
  const pagina = proxy(new Request("http://x/kanban"));
  assert.equal(await pagina.text(), "Acesso restrito.");

  const r = await receberWebhook(new Request("http://x", { method: "POST", body: "{}" }), { segredo: "x", agendar: () => {}, processar: async () => {} });
  assert.deepEqual(await r.json(), { error: "Assinatura inválida." });
});
