// Comando 5: Dashboard Executivo (métricas agregadas) e lucro realizado por conta.
import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClient } from "@libsql/client";
import { migrar } from "../lib/db.js";
import { lerPercentual, lerValorBR } from "../lib/numeros.js";
import { metaLucroMensal, obterMetricas, statusMed } from "../services/dashboard.js";
import { atualizarLead } from "../services/leads.js";

test("lerValorBR entende o volume como o lead escreve", () => {
  assert.equal(lerValorBR("R$ 150 mil"), 150000);
  assert.equal(lerValorBR("150k"), 150000);
  assert.equal(lerValorBR("R$ 80.000,00"), 80000);
  assert.equal(lerValorBR("1,2 milhão"), 1200000);
  assert.equal(lerValorBR("R$ 2 mi"), 2000000);
  assert.equal(lerValorBR("100 a 150 mil"), 150000);
  assert.equal(lerValorBR("Não informado / A apurar"), null);
  assert.equal(lerValorBR(null), null);
});

test("lerPercentual pega o teto declarado", () => {
  assert.equal(lerPercentual("0,5%"), 0.5);
  assert.equal(lerPercentual("0.3"), 0.3);
  assert.equal(lerPercentual("entre 0,3% e 0,5%"), 0.5);
  assert.equal(lerPercentual("Não informado / A apurar"), null);
  assert.equal(lerPercentual("não sei"), null);
});

test("statusMed", () => {
  assert.equal(statusMed({ volumeReal: 0, medReal: 0, teto: 0.5 }), "sem_lancamento");
  assert.equal(statusMed({ volumeReal: 1000, medReal: 0.2, teto: null }), "sem_referencia");
  assert.equal(statusMed({ volumeReal: 1000, medReal: 0.6, teto: 0.5 }), "acima");
  assert.equal(statusMed({ volumeReal: 1000, medReal: 0.5, teto: 0.5 }), "dentro");
});

test("meta de lucro vem da configuração (padrão R$ 25.000)", () => {
  assert.equal(metaLucroMensal(), 25000);
  process.env.META_LUCRO_MENSAL = "40000";
  try { assert.equal(metaLucroMensal(), 40000); } finally { delete process.env.META_LUCRO_MENSAL; }
});

let pasta, db;
beforeEach(async () => {
  pasta = mkdtempSync(join(tmpdir(), "crm-dash-"));
  db = createClient({ url: `file:${join(pasta, "t.db")}` });
  await migrar(db);
  await db.execute("INSERT INTO contatos (phone_number) VALUES ('5521900000001')");
  const linhas = [
    // [nome, fase, fornecedor, volume declarado, volume real, med real, teto, lucro, criado há N dias]
    ["A", "Contato Recebido", null, "R$ 50 mil", 0, 0, "0,5%", 0, 1],
    ["B", "Interessado", null, null, 0, 0, null, 0, 1],
    ["C", "Aprovado", "Kluubpay", "R$ 80 mil", 0, 0, "1%", 0, 1],
    ["D", "Operando", "Pushin Pay", "R$ 150 mil", 120000, 0.4, "0,5%", 3000, 1],
    ["E", "Operando dentro das expectativas", "Kluubpay", "R$ 200 mil", 210000, 0.9, "0,5%", 5500, 1],
    ["F", "Operando", "Pushin Pay", "não sei", 50000, 0.2, "A apurar", 0, 1],
    ["G", "Contato Recebido", null, null, 0, 0, null, 0, 200], // antigo: fora de "Este mês" e de 90 dias
  ];
  for (const [nome, fase, forn, decl, real, med, teto, lucro, dias] of linhas) {
    await db.execute({
      sql: `INSERT INTO oportunidades (phone_number, nome_ou_razao_social, status_kanban, fornecedor_operacao, volume_mensal,
              volume_real_mes, med_real_mes, taxa_med_operacao, lucro_real_mes, created_at)
            VALUES ('5521900000001', ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', ?))`,
      args: [nome, fase, forn, decl, real, med, teto, lucro, `-${dias} minutes`],
    });
  }
  // G foi criado há 200 dias (minutos acima só para os do mês não virarem o mês)
  await db.execute("UPDATE oportunidades SET created_at = datetime('now', '-200 days') WHERE nome_ou_razao_social = 'G'");
});
afterEach(() => { db.close(); rmSync(pasta, { recursive: true, force: true }); });

test("funil e conversão seguem o período", async () => {
  const tudo = await obterMetricas(db, { periodo: "tudo" });
  assert.equal(tudo.funil.total, 7);
  assert.deepEqual(tudo.funil.fases.map((f) => f.quantidade), [2, 1, 0, 0, 1, 2, 1]);
  assert.equal(tudo.funil.convertidos, 4); // C, D, E, F
  assert.equal(tudo.funil.conversao, 4 / 7);
  const noventa = await obterMetricas(db, { periodo: "90d" });
  assert.equal(noventa.funil.total, 6);
  await assert.rejects(obterMetricas(db, { periodo: "ano'; DROP TABLE x" }), (e) => e.status === 400);
});

test("TPV, contas em operação e lucro contra a meta", async () => {
  const m = await obterMetricas(db, { periodo: "mes" });
  assert.equal(m.operacao.contas_em_operacao, 3);
  assert.equal(m.operacao.tpv, 380000);
  assert.equal(m.operacao.volume_declarado, 350000); // F ("não sei") não entra
  assert.equal(m.lucro.realizado, 8500);
  assert.equal(m.lucro.meta, 25000);
  assert.equal(m.lucro.progresso, 0.34);
  assert.equal(m.lucro.contas_com_lancamento, 2);
});

test("carteira por parceiro: clientes (todos os cards) e volume (só em operação)", async () => {
  const m = await obterMetricas(db, { periodo: "mes" });
  const por = Object.fromEntries(m.carteira.parceiros.map((p) => [p.rotulo, p]));
  assert.equal(m.carteira.total_clientes, 7);
  assert.deepEqual([por["Pushin Pay"].clientes, por["Pushin Pay"].em_operacao, por["Pushin Pay"].volume], [2, 2, 170000]);
  assert.deepEqual([por.Kluubpay.clientes, por.Kluubpay.em_operacao, por.Kluubpay.volume], [2, 1, 210000]);
  assert.deepEqual([por["Sem parceiro"].clientes, por["Sem parceiro"].volume], [3, 0]);
  assert.equal(por.Kluubpay.percentual_volume, 210000 / 380000);
});

test("auditoria de MED: acima do teto, dentro e sem teto declarado", async () => {
  const m = await obterMetricas(db, { periodo: "mes" });
  const por = Object.fromEntries(m.contas.map((c) => [c.nome, c]));
  assert.equal(por.D.med_status, "dentro");
  assert.equal(por.E.med_status, "acima");
  assert.equal(por.F.med_status, "sem_referencia");
  assert.deepEqual(m.alertas_med, [por.E.id]);
  assert.equal(por.D.atingimento_volume, 0.8);
  assert.equal(por.F.atingimento_volume, null);
  assert.deepEqual(m.contas.map((c) => c.nome), ["E", "D", "F"]); // maior volume primeiro
});

test("lucro realizado: PATCH aceita negativo e recusa texto", async () => {
  const { rows } = await db.execute("SELECT id FROM oportunidades WHERE nome_ou_razao_social = 'D'");
  const id = Number(rows[0].id);
  assert.equal((await atualizarLead(db, { id, lucro_real_mes: -150.5 })).lucro_real_mes, -150.5);
  await assert.rejects(atualizarLead(db, { id, lucro_real_mes: "3000" }), /número/);
});
