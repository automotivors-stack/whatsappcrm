// Contingência do aviso de novo diagnóstico: falha no WhatsApp do consultor não perde o lead,
// e o painel aprova/descarta com a mesma regra do SIM/NÃO.
import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const pasta = mkdtempSync(join(tmpdir(), "crm-aprov-"));
const ADMIN = "5511988887777";
Object.assign(process.env, { TURSO_DATABASE_URL: `file:${join(pasta, "t.db")}`, ADMIN_WHATSAPP_NUMBER: ADMIN });

const { getDb, migrar } = await import("../lib/db.js");
const { processarEventoOpenWA } = await import("../services/processarMensagem.js");
const rotaLista = await import("../app/api/aprovacoes/route.js");
const rotaDecisao = await import("../app/api/aprovacoes/[id]/route.js");

const db = getDb();
let seq = 0;
let adminFora;
const enviados = [];
const erros = [];
const errorOriginal = console.error;

const ctx = (agente) => ({
  db, adminNumero: ADMIN, agente,
  enviar: async (chatId, texto) => {
    if (adminFora && chatId.startsWith(ADMIN)) throw new Error("Sessão do OpenWA desconectada (HTTP 503)");
    enviados.push({ chatId, texto });
    return { messageId: "m" };
  },
});
const msg = (de, texto) => ({
  event: "message.received",
  data: { id: `w${++seq}`, from: `${de}@c.us`, body: texto, type: "text", fromMe: false, isGroup: false, kind: "individual" },
});
const diagnostico = (nome) => async () => ({
  texto: "Encerrando, o consultor fala com você.",
  diagnosticoFinal: { nome_ou_razao_social: nome, documento: "12.345.678/0001-90", volume_mensal: "R$ 90 mil", resumo_executivo: `Resumo de ${nome}.` },
});
const contar = async (sql, args = []) => Number((await db.execute({ sql, args })).rows[0].n);

const listar = async () => (await rotaLista.GET()).json();
const decidir = (id, corpo, tipo = "application/json") => rotaDecisao.POST(
  new Request("http://x", { method: "POST", headers: { "content-type": tipo }, body: JSON.stringify(corpo) }),
  { params: Promise.resolve({ id: String(id) }) },
);

before(async () => { await migrar(db); console.error = (...a) => erros.push(a.join(" ")); });
after(() => { console.error = errorOriginal; db.close(); rmSync(pasta, { recursive: true, force: true }); });
beforeEach(() => { adminFora = false; enviados.length = 0; erros.length = 0; });

test("WhatsApp do consultor fora: erro no log, lead não se perde e aparece no painel", async () => {
  adminFora = true;
  const r = await processarEventoOpenWA(ctx(diagnostico("Loja Contingência")), msg("5521900000101", "fim"));
  assert.equal(r.acao, "aguardando_aprovacao");
  assert.deepEqual(enviados.map((e) => e.texto), ["Encerrando, o consultor fala com você."]); // o lead foi atendido
  assert.ok(erros.some((e) => /NÃO chegou ao consultor: Sessão do OpenWA desconectada \(HTTP 503\)/.test(e)));
  assert.ok(!erros.some((e) => e.includes("5521900000101")), "log não traz o telefone completo");

  const lista = await listar();
  assert.equal(lista.length, 1);
  assert.equal(lista[0].aviso_enviado, false);
  assert.equal(lista[0].dados.nome_ou_razao_social, "Loja Contingência");
  assert.equal(lista[0].dados.resumo_executivo, "Resumo de Loja Contingência.");
});

test("Aprovar no painel = SIM no WhatsApp: cria o card em 'Contato Recebido'; segunda decisão dá 409", async () => {
  const [p] = await listar();
  const r = await decidir(p.id, { decisao: "SIM" });
  assert.equal(r.status, 200);
  const { resultado, oportunidadeId } = await r.json();
  assert.equal(resultado, "aprovado");
  const card = (await db.execute({ sql: "SELECT * FROM oportunidades WHERE id = ?", args: [oportunidadeId] })).rows[0];
  assert.deepEqual([card.status_kanban, card.nome_ou_razao_social, card.phone_number], ["Contato Recebido", "Loja Contingência", "5521900000101"]);
  assert.deepEqual(await listar(), []); // saiu do aviso

  const de_novo = await decidir(p.id, { decisao: "SIM" });
  assert.equal(de_novo.status, 409);
  assert.match((await de_novo.json()).error, /já foi decidido/);
  // e o SIM atrasado pelo WhatsApp não cria outro card
  await processarEventoOpenWA(ctx(), msg(ADMIN, `SIM ${p.id}`));
  assert.match(enviados.at(-1).texto, /já tinha sido decidido|já foi aprovado/);
  assert.equal(await contar("SELECT COUNT(*) n FROM oportunidades"), 1);
});

test("Descartar no painel = NÃO: nada entra no CRM", async () => {
  await processarEventoOpenWA(ctx(diagnostico("Loja Descartada")), msg("5521900000102", "fim"));
  const [p] = await listar();
  assert.equal(p.aviso_enviado, true); // desta vez o aviso chegou; mesmo assim aparece no painel
  const r = await decidir(p.id, { decisao: "NAO" });
  assert.equal(r.status, 200);
  assert.equal((await r.json()).resultado, "descartado");
  assert.equal(await contar("SELECT COUNT(*) n FROM oportunidades WHERE nome_ou_razao_social = 'Loja Descartada'"), 0);
  assert.equal(await contar("SELECT COUNT(*) n FROM aprovacoes_pendentes WHERE id = ? AND status = 'descartado'", [p.id]), 1);
});

test("aprovar duas vezes ao mesmo tempo (painel e WhatsApp juntos) cria um card só", async () => {
  await processarEventoOpenWA(ctx(diagnostico("Loja Simultânea")), msg("5521900000103", "fim"));
  const [p] = await listar();
  const antes = await contar("SELECT COUNT(*) n FROM oportunidades");
  const respostas = await Promise.all([decidir(p.id, { decisao: "SIM" }), decidir(p.id, { decisao: "SIM" })]);
  assert.deepEqual(respostas.map((r) => r.status).sort(), [200, 409]);
  assert.equal(await contar("SELECT COUNT(*) n FROM oportunidades"), antes + 1);
});

test("validações da rota: decisão inválida 400, inexistente 404, sem JSON 415", async () => {
  assert.equal((await decidir(1, { decisao: "TALVEZ" })).status, 400);
  assert.equal((await decidir(9999, { decisao: "SIM" })).status, 404);
  assert.equal((await decidir(1, { decisao: "SIM" }, "text/plain")).status, 415);
  assert.equal((await decidir("abc", { decisao: "SIM" })).status, 400);
});
