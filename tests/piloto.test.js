// Modo piloto: só entra contato novo vindo do site (frase do formulário/botão) ou número de teste.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const pasta = mkdtempSync(join(tmpdir(), "crm-piloto-"));
const ADMIN = "5511988887777";
Object.assign(process.env, { TURSO_DATABASE_URL: `file:${join(pasta, "piloto.db")}`, ADMIN_WHATSAPP_NUMBER: ADMIN });

const { getDb, migrar } = await import("../lib/db.js");
const { processarEventoOpenWA } = await import("../services/processarMensagem.js");
const { configPiloto, admitidoNoPiloto, normalizarTexto } = await import("../lib/piloto.js");
const { mensagemDiagnostico } = await import("../content/diagnostico.js");
const { WHATSAPP_URL } = await import("../content/contato.js");

const db = getDb();
const chamadasIA = [];
const ctxCom = (piloto) => ({
  db,
  adminNumero: ADMIN,
  piloto,
  enviar: async () => ({ messageId: "m" }),
  agente: async (dados) => { chamadasIA.push(dados.telefone); return { texto: "resposta da IA" }; },
});
const PILOTO = { ativo: true, numerosTeste: ["5511900001111"], gatilho: "quero um diagnostico" };

before(async () => { if (typeof migrar === "function") await migrar(db); });
after(() => { db.close(); rmSync(pasta, { recursive: true, force: true }); });

const evento = (id, de, texto) => ({
  event: "message.received",
  data: { id, from: `${de}@c.us`, body: texto, type: "text", fromMe: false, isGroup: false, kind: "individual" },
});
const contar = async (sql, args = []) => Number((await db.execute({ sql, args })).rows[0].n);

test("configPiloto: desligado por padrão; lista e gatilho lidos do ambiente", () => {
  assert.equal(configPiloto({}).ativo, false);
  const c = configPiloto({ PILOTO_ATIVO: "true", PILOTO_NUMEROS_TESTE: "+55 (11) 90000-1111, 5521999990000", PILOTO_GATILHO: "Olá, CRM" });
  assert.deepEqual(c, { ativo: true, numerosTeste: ["5511900001111", "5521999990000"], gatilho: "ola, crm" });
});

test("a frase do formulário e a do botão flutuante abrem o piloto", () => {
  const doFormulario = mensagemDiagnostico({ nome: "Ana", empresa: "Loja", prioridade: "Reduzir taxas", gargalo: "Chargeback" });
  const doBotao = decodeURIComponent(new URL(WHATSAPP_URL).searchParams.get("text"));
  for (const texto of [doFormulario, doBotao, "QUERO UM DIAGNÓSTICO"]) {
    assert.ok(admitidoNoPiloto(PILOTO, "5511977776666", texto), normalizarTexto(texto));
  }
  assert.equal(admitidoNoPiloto(PILOTO, "5511977776666", "oi, tudo bem?"), false);
  assert.ok(admitidoNoPiloto(PILOTO, "55 11 90000-1111", "oi"), "número de teste entra sem a frase");
  assert.ok(admitidoNoPiloto({ ativo: false }, "5511977776666", "oi"), "piloto desligado não filtra nada");
});

test("piloto ligado: conversa pessoal não grava nada nem chama a IA", async () => {
  const antes = chamadasIA.length;
  const r = await processarEventoOpenWA(ctxCom(PILOTO), evento("p1", "5511966665555", "oi, tudo bem?"));
  assert.equal(r.acao, "ignorado_piloto");
  assert.equal(chamadasIA.length, antes);
  assert.equal(await contar("SELECT COUNT(*) n FROM contatos WHERE phone_number = '5511966665555'"), 0);
  assert.equal(await contar("SELECT COUNT(*) n FROM eventos_processados WHERE message_id = 'p1'"), 0);
});

test("piloto ligado: quem chega pelo site entra e segue a conversa sem repetir a frase", async () => {
  const ctx = ctxCom(PILOTO);
  const r1 = await processarEventoOpenWA(ctx, evento("p2", "5511955554444", "Olá! Quero um diagnóstico do meu departamento comercial."));
  assert.equal(r1.acao, "respondido");
  const r2 = await processarEventoOpenWA(ctx, evento("p3", "5511955554444", "vendo uns 200 mil por mês"));
  assert.equal(r2.acao, "respondido");
  assert.equal(await contar("SELECT COUNT(*) n FROM mensagens_historico WHERE phone_number = '5511955554444' AND role = 'user'"), 2);
});

test("piloto ligado: número de teste entra com qualquer mensagem", async () => {
  const r = await processarEventoOpenWA(ctxCom(PILOTO), evento("p4", "5511900001111", "teste"));
  assert.equal(r.acao, "respondido");
});

test("piloto desligado: qualquer mensagem segue o fluxo normal", async () => {
  const r = await processarEventoOpenWA(ctxCom({ ativo: false }), evento("p5", "5511944443333", "oi"));
  assert.equal(r.acao, "respondido");
});
