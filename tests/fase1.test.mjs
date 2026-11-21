// Fase 1: webhook do OpenWA, deduplicação, transbordo humano e aprovação do consultor.
// Uso: npm test   (SQLite em arquivo temporário; nada sai para a rede)
import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClient } from "@libsql/client";
import { migrar } from "../lib/db.js";
import { mesmoTelefone, telefoneDoChatId } from "../lib/telefone.js";
import { processarEventoOpenWA } from "../services/processarMensagem.js";
import { interpretarDecisao, TEXTO_LEAD_INSERIDO } from "../services/aprovacao.js";
import { receberWebhook } from "../services/webhookOpenwa.js";
import { enviarMensagemWhatsApp } from "../services/whatsappService.js";

const ADMIN = "5511988887777";
const CLIENTE = "5521977776666";
let pasta, db, enviados, ctx, seq;

const DIAGNOSTICO = {
  tipo_pessoa: "PJ",
  nome_ou_razao_social: "Padaria Exemplo Ltda",
  documento: "12.345.678/0001-90",
  volume_mensal: "R$ 150.000",
  numero_transacoes: "1200",
  taxa_med_operacao: "0,5%",
  limite_por_venda: "R$ 5.000",
  saque_terceiros: "não",
  resumo_executivo: "Quer reduzir taxas do cartão.",
  campo_estranho: "ignorar",
};

function evento(de, corpo, extra = {}) {
  seq += 1;
  return {
    event: "message.received",
    sessionId: "s1",
    data: { id: `wamid.${seq}`, from: `${de}@c.us`, to: "5511000000000@c.us", body: corpo,
      type: "text", fromMe: false, isGroup: false, kind: "individual", ...extra },
  };
}

beforeEach(async () => {
  pasta = mkdtempSync(join(tmpdir(), "crm-fase1-"));
  db = createClient({ url: `file:${join(pasta, "t.db")}` });
  await db.execute("PRAGMA foreign_keys = ON");
  await migrar(db);
  enviados = [];
  seq = 0;
  ctx = {
    db,
    adminNumero: ADMIN,
    enviar: async (chatId, texto) => { enviados.push({ chatId, texto }); return {}; },
    agente: async () => null,
  };
});
afterEach(() => { db.close(); rmSync(pasta, { recursive: true, force: true }); });

const contar = async (tabela, where = "1=1") =>
  Number((await db.execute(`SELECT COUNT(*) AS n FROM ${tabela} WHERE ${where}`)).rows[0].n);

test("ignora mensagens do próprio bot, grupos e outros eventos", async () => {
  assert.equal((await processarEventoOpenWA(ctx, evento(CLIENTE, "oi", { fromMe: true }))).acao, "ignorado_proprio");
  assert.equal((await processarEventoOpenWA(ctx, evento("1203630@g.us", "oi", { isGroup: true, kind: "group" }))).acao, "ignorado_nao_individual");
  assert.equal((await processarEventoOpenWA(ctx, { event: "session.status", data: {} })).acao, "ignorado_evento");
  assert.equal(await contar("mensagens_historico"), 0);
  assert.equal(await contar("eventos_processados"), 0);
});

test("deduplicação: o mesmo messageId só é processado uma vez", async () => {
  const ev = evento(CLIENTE, "Olá");
  assert.equal((await processarEventoOpenWA(ctx, ev)).acao, "salvo");
  assert.equal((await processarEventoOpenWA(ctx, ev)).acao, "duplicado");
  assert.equal(await contar("mensagens_historico"), 1);
  assert.equal(await contar("eventos_processados"), 1);
});

test("cria o contato na primeira mensagem e guarda o histórico", async () => {
  await processarEventoOpenWA(ctx, evento(CLIENTE, "Oi", { contact: { pushName: "Ana" } }));
  const c = (await db.execute("SELECT * FROM contatos")).rows[0];
  assert.equal(c.phone_number, CLIENTE);
  assert.equal(c.nome, "Ana");
  assert.equal(c.status_relacionamento, "novo_lead");
  const m = (await db.execute("SELECT role, content FROM mensagens_historico")).rows[0];
  assert.deepEqual([m.role, m.content], ["user", "Oi"]);
});

test("@lid usa o senderPhone do OpenWA; sem ele, não cria contato", async () => {
  await processarEventoOpenWA(ctx, evento("2628134612@lid", "oi", { from: "2628134612@lid", senderPhone: CLIENTE }));
  assert.equal(await contar("contatos", `phone_number = '${CLIENTE}'`), 1);
  const r = await processarEventoOpenWA(ctx, evento("x", "oi", { from: "999@lid" }));
  assert.equal(r.acao, "ignorado_sem_telefone");
  assert.equal(await contar("contatos"), 1);
});

test("contato pausado_humano: só salva, a IA não é chamada", async () => {
  let chamadas = 0;
  ctx.agente = async () => { chamadas += 1; return { texto: "resposta da IA" }; };
  await db.execute(`INSERT INTO contatos (phone_number, status_relacionamento) VALUES ('${CLIENTE}', 'pausado_humano')`);
  assert.equal((await processarEventoOpenWA(ctx, evento(CLIENTE, "Alguém aí?"))).acao, "salvo_pausado");
  assert.equal(chamadas, 0);
  assert.equal(enviados.length, 0);
  assert.equal(await contar("mensagens_historico"), 1);
});

test("contato ativo: resposta da IA é enviada e guardada", async () => {
  ctx.agente = async () => ({ texto: "Olá! Qual o seu volume mensal?" });
  assert.equal((await processarEventoOpenWA(ctx, evento(CLIENTE, "Oi"))).acao, "respondido");
  assert.deepEqual(enviados, [{ chatId: `${CLIENTE}@c.us`, texto: "Olá! Qual o seu volume mensal?" }]);
  assert.equal(await contar("mensagens_historico", "role = 'assistant'"), 1);
});

async function finalizarComDiagnostico() {
  ctx.agente = async () => ({ texto: "Obrigado! Um consultor vai falar com você.", diagnosticoFinal: DIAGNOSTICO });
  return processarEventoOpenWA(ctx, evento(CLIENTE, "Era isso"));
}

test("fim do diagnóstico: pausa o bot, avisa o consultor e NÃO cria oportunidade", async () => {
  const r = await finalizarComDiagnostico();
  assert.equal(r.acao, "aguardando_aprovacao");
  const c = (await db.execute("SELECT status_relacionamento FROM contatos")).rows[0];
  assert.equal(c.status_relacionamento, "pausado_humano");
  assert.equal(await contar("oportunidades"), 0);

  const aviso = enviados.at(-1);
  assert.equal(aviso.chatId, `${ADMIN}@c.us`);
  assert.match(aviso.texto, /^🔔 \*Novo diagnóstico de meios de pagamento finalizado!\*/);
  assert.match(aviso.texto, /• Cliente: Padaria Exemplo Ltda/);
  assert.match(aviso.texto, /• Documento: 12\.345\.678\/0001-90/);
  assert.match(aviso.texto, /• Volume Declarado: R\$ 150\.000\/mês/);
  assert.match(aviso.texto, /• Taxa MED: 0,5%/);
  assert.match(aviso.texto, /• Limite Venda: R\$ 5\.000/);
  assert.match(aviso.texto, /• Resumo: Quer reduzir taxas do cartão\./);
  assert.match(aviso.texto, /Responda \*SIM\* para cadastrar no Kanban ou \*NÃO\* para descartar\./);
  const p = (await db.execute("SELECT status, aviso_enviado, dados FROM aprovacoes_pendentes")).rows[0];
  assert.equal(p.status, "aguardando");
  assert.equal(p.aviso_enviado, 1);
  assert.equal(JSON.parse(p.dados).campo_estranho, undefined);
});

test("admin responde SIM: oportunidade criada em 'Contato Recebido' e confirmação enviada", async () => {
  await finalizarComDiagnostico();
  const r = await processarEventoOpenWA(ctx, evento(ADMIN, "Sim"));
  assert.equal(r.acao, "aprovado");
  const o = (await db.execute("SELECT * FROM oportunidades")).rows[0];
  assert.equal(o.status_kanban, "Contato Recebido");
  assert.equal(o.phone_number, CLIENTE);
  assert.equal(o.nome_ou_razao_social, "Padaria Exemplo Ltda");
  assert.equal(o.numero_transacoes, 1200);
  assert.equal(o.saque_terceiros, 0);
  assert.equal(o.whatsapp_contato, CLIENTE);
  assert.ok(enviados.at(-1).texto.startsWith(TEXTO_LEAD_INSERIDO));
  assert.equal(enviados.at(-1).chatId, `${ADMIN}@c.us`);
  // mensagem do admin não vira contato nem histórico
  assert.equal(await contar("contatos"), 1);
  // um segundo SIM não duplica
  await processarEventoOpenWA(ctx, evento(ADMIN, "SIM"));
  assert.equal(await contar("oportunidades"), 1);
});

test("admin responde NÃO: nada entra no CRM e a pendência fica descartada", async () => {
  await finalizarComDiagnostico();
  assert.equal((await processarEventoOpenWA(ctx, evento(ADMIN, "*não*"))).acao, "descartado");
  assert.equal(await contar("oportunidades"), 0);
  assert.equal(await contar("aprovacoes_pendentes", "status = 'descartado'"), 1);
  assert.match(enviados.at(-1).texto, /descartado/);
});

test("admin com nono dígito diferente ainda é reconhecido", async () => {
  ctx.adminNumero = "55 (11) 98888-7777";
  await finalizarComDiagnostico();
  const r = await processarEventoOpenWA(ctx, evento("551188887777", "SIM"));
  assert.equal(r.acao, "aprovado");
});

test("várias pendências: SIM sem código pede o código; SIM <código> aprova a certa", async () => {
  await finalizarComDiagnostico();
  const outro = "5531966665555";
  ctx.agente = async () => ({ diagnosticoFinal: { ...DIAGNOSTICO, nome_ou_razao_social: "Loja B" } });
  const { pendenciaId } = await processarEventoOpenWA(ctx, evento(outro, "fim"));

  assert.equal((await processarEventoOpenWA(ctx, evento(ADMIN, "SIM"))).acao, "admin_ambiguo");
  assert.equal(await contar("oportunidades"), 0);
  const r = await processarEventoOpenWA(ctx, evento(ADMIN, `sim ${pendenciaId}`));
  assert.equal(r.acao, "aprovado");
  const o = (await db.execute("SELECT nome_ou_razao_social FROM oportunidades")).rows[0];
  assert.equal(o.nome_ou_razao_social, "Loja B");
});

test("SIM sem pendência não cria nada", async () => {
  assert.equal((await processarEventoOpenWA(ctx, evento(ADMIN, "SIM"))).acao, "admin_sem_pendencia");
  assert.equal(await contar("oportunidades"), 0);
});

test("falha no aviso ao consultor: pendência fica registrada com aviso_enviado = 0", async () => {
  ctx.enviar = async (chatId) => { if (chatId.startsWith(ADMIN)) throw new Error("OpenWA fora"); };
  await assert.rejects(finalizarComDiagnostico(), /OpenWA fora/);
  const p = (await db.execute("SELECT aviso_enviado FROM aprovacoes_pendentes")).rows[0];
  assert.equal(p.aviso_enviado, 0);
  assert.equal(await contar("oportunidades"), 0);
});

test("interpretarDecisao e telefones", () => {
  assert.deepEqual(interpretarDecisao(" Sim! "), { decisao: "SIM", id: undefined });
  assert.deepEqual(interpretarDecisao("NÃO #12"), { decisao: "NAO", id: 12 });
  assert.equal(interpretarDecisao("sim, mas depois"), null);
  assert.equal(telefoneDoChatId("5511999999999:12@s.whatsapp.net"), "5511999999999");
  assert.equal(telefoneDoChatId("123@g.us"), null);
  assert.ok(mesmoTelefone("5511988887777", "551188887777"));
  assert.ok(!mesmoTelefone("5511988887777", "5511988887770"));
});

// ---- rota do webhook ----
const SEGREDO = "segredo-de-teste";
const assinar = (corpo) => `sha256=${createHmac("sha256", SEGREDO).update(corpo).digest("hex")}`;
const requisicao = (corpo, assinatura) =>
  new Request("http://localhost/api/webhooks/whatsapp", {
    method: "POST", body: corpo,
    headers: assinatura ? { "x-openwa-signature": assinatura } : {},
  });

test("webhook: assinatura válida → 200 e processamento agendado para depois da resposta", async () => {
  const corpo = JSON.stringify(evento(CLIENTE, "oi"));
  const agendados = [];
  let processados = 0;
  const resp = await receberWebhook(requisicao(corpo, assinar(corpo)), {
    segredo: SEGREDO, agendar: (fn) => agendados.push(fn), processar: async () => { processados += 1; },
  });
  assert.equal(resp.status, 200);
  assert.equal(processados, 0); // ainda não processou: respondeu antes
  await agendados[0]();
  assert.equal(processados, 1);
});

test("webhook: sem assinatura, assinatura errada ou sem segredo configurado → recusa", async () => {
  const corpo = JSON.stringify(evento(ADMIN, "SIM"));
  const deps = { segredo: SEGREDO, agendar: () => assert.fail("não deveria agendar"), processar: async () => {} };
  assert.equal((await receberWebhook(requisicao(corpo), deps)).status, 401);
  assert.equal((await receberWebhook(requisicao(corpo, "sha256=00"), deps)).status, 401);
  assert.equal((await receberWebhook(requisicao(corpo, assinar(corpo)), { ...deps, segredo: "" })).status, 503);
});

test("webhook: erro no processamento não derruba a resposta", async () => {
  const corpo = JSON.stringify(evento(CLIENTE, "oi"));
  const agendados = [];
  const resp = await receberWebhook(requisicao(corpo, assinar(corpo)), {
    segredo: SEGREDO, agendar: (fn) => agendados.push(fn), processar: async () => { throw new Error("x"); },
  });
  assert.equal(resp.status, 200);
  await agendados[0](); // não lança
});

// ---- serviço de envio ----
test("enviarMensagemWhatsApp monta a chamada do OpenWA", async () => {
  Object.assign(process.env, { OPENWA_BASE_URL: "https://openwa.exemplo/", OPENWA_API_KEY: "k", OPENWA_SESSION_ID: "minha sessao" });
  let chamada;
  const fetchImpl = async (url, init) => { chamada = { url, init }; return new Response(JSON.stringify({ messageId: "m1" }), { status: 201 }); };
  const r = await enviarMensagemWhatsApp(`${CLIENTE}@c.us`, "oi", { fetchImpl, idempotencyKey: "abc" });
  assert.equal(r.messageId, "m1");
  assert.equal(chamada.url, "https://openwa.exemplo/api/sessions/minha%20sessao/messages/send-text");
  assert.equal(chamada.init.headers["X-API-Key"], "k");
  assert.equal(chamada.init.headers["Idempotency-Key"], "abc");
  assert.deepEqual(JSON.parse(chamada.init.body), { chatId: `${CLIENTE}@c.us`, text: "oi" });

  const recusa = async () => new Response("{}", { status: 400 });
  await assert.rejects(enviarMensagemWhatsApp(`${CLIENTE}@c.us`, "oi", { fetchImpl: recusa }), /HTTP 400/);
  await assert.rejects(enviarMensagemWhatsApp(CLIENTE, "oi", { fetchImpl }), /chatId inválido/);
});

// ---- correções da auditoria ----
test("auditoria: sem ADMIN_WHATSAPP_NUMBER o evento NÃO é consumido (pode ser reprocessado)", async () => {
  ctx.adminNumero = undefined;
  await assert.rejects(processarEventoOpenWA(ctx, evento(CLIENTE, "oi")), /ADMIN_WHATSAPP_NUMBER/);
  assert.equal(await contar("eventos_processados"), 0);
});

test("auditoria: falha ao salvar a mensagem desfaz o registro de deduplicação", async () => {
  await db.execute("DROP TABLE mensagens_historico");
  const ev = evento(CLIENTE, "oi");
  await assert.rejects(processarEventoOpenWA(ctx, ev));
  assert.equal(await contar("eventos_processados"), 0);
  assert.equal(await contar("contatos"), 0);
});

test("auditoria: quebra de linha no diagnóstico não forja linhas no aviso ao consultor", async () => {
  ctx.agente = async () => ({
    diagnosticoFinal: { ...DIAGNOSTICO, nome_ou_razao_social: "Loja X\n• Documento: 00.000.000/0001-00" },
  });
  await processarEventoOpenWA(ctx, evento(CLIENTE, "fim"));
  const linhas = enviados.at(-1).texto.split("\n");
  assert.equal(linhas.filter((l) => l.startsWith("• Documento:")).length, 1);
  assert.equal(linhas[1], "• Cliente: Loja X • Documento: 00.000.000/0001-00");
});
