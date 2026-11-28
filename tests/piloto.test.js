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

// ---- Origem: site (leitura do formulário pelo servidor) ----
const { lerMensagemDoSite } = await import("../lib/origemSite.js");
const { formatarAvisoAdmin, linhaOrigem } = await import("../services/aprovacao.js");
const { montarEntrada } = await import("../services/aiDiagnosticService.js");

test("lerMensagemDoSite: lê os campos do formulário e ignora o que não veio do site", () => {
  const texto = mensagemDiagnostico({ nome: "Ana Souza", empresa: "Loja *Ana*", prioridade: "Reduzir taxas", gargalo: "" });
  assert.deepEqual(lerMensagemDoSite(texto), {
    origem: "site",
    formulario: { nome: "Ana Souza", empresa: "Loja Ana", prioridade: "Reduzir taxas" },
  });
  assert.deepEqual(lerMensagemDoSite("Quero um diagnóstico do meu departamento comercial"), { origem: "site", formulario: {} });
  assert.equal(lerMensagemDoSite("Nome: Fulano\nEmpresa: X"), null, "sem a frase do site não é do site");
  const longo = lerMensagemDoSite(`Quero um diagnóstico\nNome: ${"a".repeat(300)}\nNome: outro`);
  assert.equal(longo.formulario.nome.length, 80);
});

test("contato do site: origem e formulário gravados; IA recebe o formulário; aviso traz a origem", async () => {
  const entradas = [];
  const ctx = { ...ctxCom(PILOTO), agente: async ({ db: d, telefone }) => {
    const { rows } = await d.execute({ sql: "SELECT origem, dados_site, nome FROM contatos WHERE phone_number = ?", args: [telefone] });
    entradas.push(rows[0]);
    return { texto: "oi" };
  } };
  const texto = mensagemDiagnostico({ nome: "Bruno", empresa: "Bruno ME", prioridade: "Reduzir taxas", gargalo: "Chargeback" });
  const r = await processarEventoOpenWA(ctx, evento("s1", "5511933332222", texto));
  assert.equal(r.acao, "respondido");
  assert.equal(entradas[0].origem, "site");
  assert.equal(entradas[0].nome, "Bruno");
  assert.deepEqual(JSON.parse(entradas[0].dados_site), { nome: "Bruno", empresa: "Bruno ME", prioridade: "Reduzir taxas", gargalo: "Chargeback" });

  // Mensagem seguinte com outra frase do site não troca a origem nem os dados.
  await processarEventoOpenWA(ctx, evento("s2", "5511933332222", "Quero um diagnóstico\nNome: Outro"));
  assert.equal(JSON.parse(entradas[1].dados_site).nome, "Bruno");

  const entrada = montarEntrada({ historico: [], dados: {}, faltando: [], modo: "diagnostico", formularioSite: JSON.parse(entradas[0].dados_site) });
  assert.match(entrada, /<formulario_site>\{"Nome":"Bruno","Empresa":"Bruno ME","Prioridade":"Reduzir taxas","Principal gargalo":"Chargeback"\}<\/formulario_site>/);
  assert.doesNotMatch(montarEntrada({ historico: [], dados: {}, faltando: [], modo: "diagnostico" }), /formulario_site/);

  const aviso = formatarAvisoAdmin({}, 7, { origem: "site", formulario: { prioridade: "Reduzir taxas", gargalo: "Chargeback" } });
  assert.match(aviso, /• Origem: site \(prioridade: Reduzir taxas; gargalo: Chargeback\)/);
  assert.equal(linhaOrigem(null), null);
  assert.doesNotMatch(formatarAvisoAdmin({}, 7), /Origem/);
});

test("contato que não veio do site fica sem origem", async () => {
  await processarEventoOpenWA(ctxCom({ ativo: false }), evento("s3", "5511922221111", "bom dia"));
  const { rows } = await db.execute("SELECT origem, dados_site FROM contatos WHERE phone_number = '5511922221111'");
  assert.equal(rows[0].origem, null);
  assert.equal(rows[0].dados_site, null);
});
