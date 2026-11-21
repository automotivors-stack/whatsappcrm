// Homologação: os 5 cenários de negócio do Comando 6, sobre a massa de demonstração do seed.
// Rotas REST chamadas como o Next as chama (Request → Response); webhook com assinatura HMAC real.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Banco de teste próprio, definido antes de carregar as rotas (getDb lê o ambiente).
const pasta = mkdtempSync(join(tmpdir(), "crm-homolog-"));
const ADMIN = "5511988887777";
const SEGREDO = "segredo-homologacao";
Object.assign(process.env, { TURSO_DATABASE_URL: `file:${join(pasta, "homolog.db")}`, ADMIN_WHATSAPP_NUMBER: ADMIN });

const { getDb } = await import("../lib/db.js");
const { semear, LEADS_DEMO, PREFIXO_TELEFONE_DEMO } = await import("../scripts/seed.js");
const { receberWebhook } = await import("../services/webhookOpenwa.js");
const { processarEventoOpenWA } = await import("../services/processarMensagem.js");
const { montarProposta } = await import("../lib/proposta.js");
const { itemDeCusto } = await import("../lib/custosParceiros.js");
const { dinheiro, percentual } = await import("../lib/formato.js");
const rotaLead = await import("../app/api/leads/[id]/route.js");
const rotaLeads = await import("../app/api/leads/route.js");
const rotaMetricas = await import("../app/api/dashboard/metrics/route.js");

const db = getDb();
let seed;
const enviados = [];
const chamadasIA = [];
const ctx = {
  db,
  adminNumero: ADMIN,
  enviar: async (chatId, texto) => { enviados.push({ chatId, texto }); return { messageId: "m" }; },
  agente: async (dados) => { chamadasIA.push(dados.telefone); return { texto: "resposta da IA" }; },
};

before(async () => { seed = await semear(db); });
after(() => { db.close(); rmSync(pasta, { recursive: true, force: true }); });

const contar = async (sql, args = []) => Number((await db.execute({ sql, args })).rows[0].n);
const leadDoSeed = async (n) => (await (await rotaLead.GET(new Request("http://x"), { params: Promise.resolve({ id: String(seed.leads[n]) }) })).json()).lead;

/** Entrega um evento ao webhook exatamente como o OpenWA: corpo assinado; processa na hora. */
async function entregarWebhook(evento) {
  const corpo = JSON.stringify(evento);
  const assinatura = `sha256=${createHmac("sha256", SEGREDO).update(corpo).digest("hex")}`;
  const tarefas = [];
  const resposta = await receberWebhook(
    new Request("http://x/api/webhooks/whatsapp", { method: "POST", body: corpo, headers: { "x-openwa-signature": assinatura } }),
    { segredo: SEGREDO, agendar: (fn) => tarefas.push(fn), processar: (p) => processarEventoOpenWA(ctx, p) },
  );
  for (const t of tarefas) await t();
  return resposta;
}
const mensagem = (id, de, texto) => ({
  event: "message.received",
  data: { id, from: `${de}@c.us`, body: texto, type: "text", fromMe: false, isGroup: false, kind: "individual" },
});

test("seed: 7 leads nas fases pedidas, 1 diagnóstico aguardando SIM, interações na linha do tempo", async () => {
  const { rows } = await db.execute({ sql: "SELECT status_kanban, fornecedor_operacao FROM oportunidades WHERE phone_number LIKE ? ORDER BY id", args: [`${PREFIXO_TELEFONE_DEMO}%`] });
  assert.deepEqual(rows.map((r) => r.status_kanban), [
    "Contato Recebido", "Interessado", "Conta em Análise", "Aprovado", "Operando", "Operando", "Operando dentro das expectativas",
  ]);
  assert.equal(await contar("SELECT COUNT(*) n FROM aprovacoes_pendentes WHERE status = 'aguardando'"), 1);
  assert.ok(await contar("SELECT COUNT(*) n FROM interacoes_cliente") >= 8);
  assert.ok(LEADS_DEMO.every((l) => l.nome.startsWith("[EXEMPLO]")));

  // Lead 4: Pix com 0,40 p.p. acima do custo D0 em todas as faixas
  const l4 = await leadDoSeed(4);
  for (const [id, cobrado] of Object.entries(l4.dados_precificacao.itens)) {
    assert.equal(Math.round((cobrado.percentual - itemDeCusto("Pushin Pay", id).percentual) * 100) / 100, 0.4, id);
  }
  // Lead 5: Kluubpay, Pix custo R$ 1,50 cobrando R$ 3,00, volume R$ 150 mil, MED 0,3%
  const l5 = await leadDoSeed(5);
  assert.deepEqual([l5.dados_precificacao.itens.pix_in.custo_base.fixo, l5.dados_precificacao.itens.pix_in.fixo], [1.5, 3]);
  assert.deepEqual([l5.volume_real_mes, l5.med_real_mes], [150000, 0.3]);

  // rodar de novo não duplica nada
  await semear(db);
  assert.equal(await contar("SELECT COUNT(*) n FROM oportunidades WHERE phone_number LIKE ?", [`${PREFIXO_TELEFONE_DEMO}%`]), 7);
  seed = await semear(db);
});

test("Teste A (idempotência): o mesmo messageId no webhook não duplica eventos nem oportunidades", async () => {
  const lead = "5500900009999";
  const ev = mensagem("wamid.homolog.lead", lead, "Oi, quero taxas melhores");
  assert.equal((await entregarWebhook(ev)).status, 200);
  assert.equal((await entregarWebhook(ev)).status, 200); // retentativa do OpenWA
  assert.equal(await contar("SELECT COUNT(*) n FROM eventos_processados WHERE message_id = ?", [ev.data.id]), 1);
  assert.equal(await contar("SELECT COUNT(*) n FROM mensagens_historico WHERE phone_number = ? AND role = 'user'", [lead]), 1);

  // SIM do consultor para o diagnóstico pendente do seed, entregue duas vezes
  const antes = await contar("SELECT COUNT(*) n FROM oportunidades");
  const sim = mensagem("wamid.homolog.sim", ADMIN, "SIM");
  await entregarWebhook(sim);
  await entregarWebhook(sim);
  assert.equal(await contar("SELECT COUNT(*) n FROM oportunidades"), antes + 1);
  assert.equal(await contar("SELECT COUNT(*) n FROM eventos_processados WHERE message_id = ?", [sim.data.id]), 1);
  assert.equal(await contar("SELECT COUNT(*) n FROM aprovacoes_pendentes WHERE id = ? AND status = 'aprovado'", [seed.pendenciaId]), 1);
});

test("Teste B (trava de fornecedor): PATCH para 'Aprovado' sem fornecedor responde HTTP 400", async () => {
  const patch = (id, corpo) => rotaLead.PATCH(
    new Request("http://x", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(corpo) }),
    { params: Promise.resolve({ id: String(id) }) },
  );
  const r1 = await patch(seed.leads[1], { status_kanban: "Aprovado" });
  assert.equal(r1.status, 400);
  assert.match((await r1.json()).error, /selecione o fornecedor/);
  for (const fase of ["Operando", "Operando dentro das expectativas"]) {
    assert.equal((await patch(seed.leads[2], { status_kanban: fase })).status, 400, fase);
  }
  // tirar o fornecedor de quem já está aprovado também é barrado
  assert.equal((await patch(seed.leads[4], { fornecedor_operacao: null })).status, 400);
  // a rota com id no corpo segue a mesma regra
  const r2 = await rotaLeads.PATCH(new Request("http://x", {
    method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: seed.leads[1], status_kanban: "Aprovado" }),
  }));
  assert.equal(r2.status, 400);
  // nada mudou no banco
  assert.equal((await leadDoSeed(1)).status_kanban, "Contato Recebido");
  // com fornecedor, passa
  const ok = await patch(seed.leads[1], { status_kanban: "Aprovado", fornecedor_operacao: "Pushin Pay" });
  assert.equal(ok.status, 200);
  await patch(seed.leads[1], { status_kanban: "Contato Recebido", fornecedor_operacao: null }); // volta ao seed
});

test("Teste C (sigilo do spread): a proposta mostra só a taxa do cliente, nunca custo base nem margem", async () => {
  for (const n of [4, 5, 6, 7]) {
    const lead = await leadDoSeed(n);
    for (const canal of ["whatsapp", "email"]) {
      const { texto } = montarProposta(lead, canal);
      const cobradas = new Set();
      for (const [id, c] of Object.entries(lead.dados_precificacao.itens)) {
        const custo = itemDeCusto(lead.fornecedor_operacao, id);
        if (c.percentual) cobradas.add(percentual(c.percentual));
        if (c.fixo) cobradas.add(dinheiro(c.fixo, custo.moeda));
        assert.ok(texto.includes(c.percentual ? percentual(c.percentual) : dinheiro(c.fixo, custo.moeda)), `${n}/${id}: taxa do cliente presente`);
      }
      for (const id of Object.keys(lead.dados_precificacao.itens)) {
        const custo = itemDeCusto(lead.fornecedor_operacao, id);
        for (const valor of [custo.percentual ? percentual(custo.percentual) : null, custo.fixo ? dinheiro(custo.fixo, custo.moeda) : null]) {
          if (valor && !cobradas.has(valor)) assert.ok(!texto.includes(valor), `${n}/${canal}: vazou custo ${valor} (${id})`);
        }
      }
      assert.ok(!/custo|spread|margem|lucro|p\.p\./i.test(texto), `${n}/${canal}: termo interno no texto`);
    }
  }
  // exemplo concreto: Kluubpay cobra R$ 3,00 no Pix, custo R$ 1,50 não aparece
  const { texto } = montarProposta(await leadDoSeed(5), "whatsapp");
  assert.match(texto, /Pix In: R\$\s3,00/);
  assert.ok(!/1,50/.test(texto));
});

test("Teste D (transbordo humano): contato em 'pausado_humano' não recebe resposta da IA", async () => {
  const telefone = `${PREFIXO_TELEFONE_DEMO}0002`; // Lead 2, pausado pelo seed
  const contato = (await db.execute({ sql: "SELECT status_relacionamento FROM contatos WHERE phone_number = ?", args: [telefone] })).rows[0];
  assert.equal(contato.status_relacionamento, "pausado_humano");
  chamadasIA.length = 0;
  enviados.length = 0;
  await entregarWebhook(mensagem("wamid.homolog.pausado", telefone, "Pode me responder? Reative o robô!"));
  assert.deepEqual(chamadasIA, []);
  assert.deepEqual(enviados, []);
  assert.equal(await contar("SELECT COUNT(*) n FROM mensagens_historico WHERE phone_number = ? AND content = ?", [telefone, "Pode me responder? Reative o robô!"]), 1);
  const depois = (await db.execute({ sql: "SELECT status_relacionamento FROM contatos WHERE phone_number = ?", args: [telefone] })).rows[0];
  assert.equal(depois.status_relacionamento, "pausado_humano"); // o cliente não reativa o bot

  // controle: contato com IA ativa é respondido
  await db.execute({ sql: "UPDATE contatos SET status_relacionamento = 'ia_ativa' WHERE phone_number = ?", args: [telefone] });
  await entregarWebhook(mensagem("wamid.homolog.ativo", telefone, "oi"));
  assert.deepEqual(chamadasIA, [telefone]);
  await db.execute({ sql: "UPDATE contatos SET status_relacionamento = 'pausado_humano' WHERE phone_number = ?", args: [telefone] });
});

test("Teste E (dashboard): TPV, cliente com MED estourado e % da meta de R$ 25.000", async () => {
  const r = await rotaMetricas.GET(new Request("http://x/api/dashboard/metrics?periodo=tudo"));
  assert.equal(r.status, 200);
  const m = await r.json();
  // Operando: Lead 5 (150 mil) + Lead 6 (450 mil); Expectativas: Lead 7 (1,2 milhão)
  assert.equal(m.operacao.contas_em_operacao, 3);
  assert.equal(m.operacao.tpv, 1800000);
  // Lucro: 1.500 + 1.800 + 9.600 = 12.900 → 51,6% da meta
  assert.equal(m.lucro.realizado, 12900);
  assert.equal(m.lucro.meta, 25000);
  assert.equal(m.lucro.progresso, 0.516);
  // Só o Lead 6 estourou o MED (2,8% contra 1,0% declarado)
  assert.deepEqual(m.alertas_med, [seed.leads[6]]);
  const l6 = m.contas.find((c) => c.id === seed.leads[6]);
  assert.deepEqual([l6.med_real, l6.med_teto, l6.med_status], [2.8, 1, "acima"]);
  assert.equal(m.contas.find((c) => c.id === seed.leads[5]).med_status, "dentro");
  assert.equal(m.contas.find((c) => c.id === seed.leads[7]).med_status, "dentro");
  // Carteira por parceiro
  const pushin = m.carteira.parceiros.find((p) => p.fornecedor === "Pushin Pay");
  assert.equal(pushin.volume, 1650000);
  // período inválido
  assert.equal((await rotaMetricas.GET(new Request("http://x/api/dashboard/metrics?periodo=ano"))).status, 400);
});
