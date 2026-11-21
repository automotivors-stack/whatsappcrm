// Fase 2: fases do Kanban, matriz de custo, spread, regras do PATCH e acesso do consultor.
import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClient } from "@libsql/client";
import { migrar } from "../lib/db.js";
import { NOMES_FASES, exigeFornecedor } from "../lib/kanban.js";
import { KLUUBPAY, PUSHIN_PAY, TABELAS_CUSTO, itemDeCusto } from "../lib/custosParceiros.js";
import { calcularSpread, montarPrecificacao } from "../lib/precificacao.js";
import { lerDecimal } from "../lib/formato.js";
import { atualizarLead, listarLeads, obterDossie } from "../services/leads.js";
import { proxy } from "../proxy.js";

test("as 7 fases oficiais, na ordem", () => {
  assert.deepEqual(NOMES_FASES, [
    "Contato Recebido", "Interessado", "Avançado", "Conta em Análise",
    "Aprovado", "Operando", "Operando dentro das expectativas",
  ]);
  assert.deepEqual(NOMES_FASES.map(exigeFornecedor), [false, false, false, false, true, true, true]);
});

// Cada linha: [id, percentual, fixo] exatamente como no comando da Fase 2.
const ESPERADO = {
  [PUSHIN_PAY]: [
    ["pix_in_f1", 0, 0.35], ["pix_in_f2", 0.7, 0.35], ["pix_in_f3", 0.9, 0.35],
    ["pix_out", 0, 1.2], ["boleto", 0, 2.0],
    ["credito_d30_1x", 4.18, 0.35], ["credito_d30_2a6", 4.26, 0.35], ["credito_d30_7a18", 4.45, 0.35],
    ["credito_d1_1x", 5.45, 0.35], ["credito_d1_2a17", null, 0.35], ["credito_d1_18x", 16.51, 0.35],
    ["debito", 4.52, 0.35],
  ],
  [KLUUBPAY]: [
    ["pix_in", 0, 1.5], ["pix_out", 0, 1.5], ["boleto_saldo", 0, 1.5], ["qrcode_saldo", 0, 1.5],
    ["cripto_usdt", 3.5, 2.5], ["prepago_emissao", 0, 5.0], ["prepago_recarga_pix", 2.5, 2.5],
    ["prepago_recarga_saldo", 3.5, 1.5], ["credito_1x", 2.97, 0], ["credito_2a6", 3.33, 0],
    ["credito_7a18", 3.59, 0], ["credito_antecipacao", 1.8, 0], ["ted", 0, 3.99],
  ],
};

test("matriz de custo: todos os valores conferem com a tabela oficial, nenhum a mais", () => {
  for (const [fornecedor, linhas] of Object.entries(ESPERADO)) {
    assert.deepEqual(
      TABELAS_CUSTO[fornecedor].map((i) => [i.id, i.percentual, i.fixo]),
      linhas,
      fornecedor,
    );
  }
  assert.equal(itemDeCusto(KLUUBPAY, "prepago_emissao").moeda, "USD");
  assert.equal(itemDeCusto(KLUUBPAY, "credito_antecipacao").unidade, "% a.m.");
  for (const id of ["pix_in_f1", "pix_in_f2", "pix_in_f3", "pix_out"]) {
    assert.equal(itemDeCusto(PUSHIN_PAY, id).liquidacao, "D0");
  }
  assert.equal(itemDeCusto(PUSHIN_PAY, "boleto").liquidacao, "D+1");
});

test("spread = taxa negociada − custo base", () => {
  const pixF2 = itemDeCusto(PUSHIN_PAY, "pix_in_f2"); // 0,70% + R$ 0,35
  assert.deepEqual(calcularSpread(pixF2, { percentual: 0.99, fixo: 0.5 }), { pontosPercentuais: 0.29, fixo: 0.15, porTransacao: null });
  // com valor de referência de R$ 1.000: 1000 × 0,29% + 0,15 = 3,05
  assert.equal(calcularSpread(pixF2, { percentual: 0.99, fixo: 0.5 }, 1000).porTransacao, 3.05);
  // só fixo cobrado num produto só fixo
  assert.deepEqual(calcularSpread(itemDeCusto(KLUUBPAY, "ted"), { fixo: 5 }), { pontosPercentuais: 0, fixo: 1.01, porTransacao: null });
  // prejuízo aparece negativo
  assert.equal(calcularSpread(itemDeCusto(PUSHIN_PAY, "pix_out"), { fixo: 1 }).fixo, -0.2);
  // custo não informado: sem spread (não inventa)
  assert.equal(calcularSpread(itemDeCusto(PUSHIN_PAY, "credito_d1_2a17"), { percentual: 10, fixo: 1 }), null);
  // nada cobrado: sem spread
  assert.equal(calcularSpread(pixF2, {}), null);
  // US$ não usa o valor de referência em reais
  assert.equal(calcularSpread(itemDeCusto(KLUUBPAY, "prepago_emissao"), { fixo: 8 }, 100).porTransacao, null);
});

test("montarPrecificacao valida produto, fornecedor e números, e guarda o custo vigente", () => {
  const p = montarPrecificacao(PUSHIN_PAY, { valor_referencia: 100, itens: { debito: { percentual: 5, fixo: 0.5 }, boleto: {} } });
  assert.equal(p.fornecedor, PUSHIN_PAY);
  assert.deepEqual(Object.keys(p.itens), ["debito"]);
  assert.deepEqual(p.itens.debito.custo_base, { percentual: 4.52, fixo: 0.35, moeda: "BRL" });
  assert.throws(() => montarPrecificacao(null, { itens: {} }), /fornecedor/);
  assert.throws(() => montarPrecificacao(PUSHIN_PAY, { itens: { ted: { fixo: 5 } } }), /não existe na tabela/);
  assert.throws(() => montarPrecificacao(KLUUBPAY, { itens: { ted: { fixo: -1 } } }), /inválida/);
  assert.throws(() => montarPrecificacao(KLUUBPAY, { itens: { ted: { percentual: 101 } } }), /inválida/);
});

test("lerDecimal entende o formato brasileiro", () => {
  assert.equal(lerDecimal("1.234,56"), 1234.56);
  assert.equal(lerDecimal("0,35"), 0.35);
  assert.equal(lerDecimal("R$ 2,00"), 2);
  assert.equal(lerDecimal(""), null);
  assert.ok(Number.isNaN(lerDecimal("abc")));
});

// ---- API (services/leads.js) ----
let pasta, db;
beforeEach(async () => {
  pasta = mkdtempSync(join(tmpdir(), "crm-fase2-"));
  db = createClient({ url: `file:${join(pasta, "t.db")}` });
  await migrar(db);
  await db.execute("INSERT INTO contatos (phone_number) VALUES ('5521977776666')");
  await db.execute(`INSERT INTO oportunidades (id, phone_number, nome_ou_razao_social) VALUES
    (1, '5521977776666', 'Loja A'), (2, '5521977776666', 'Loja B'), (3, '5521977776666', 'Loja C')`);
  await db.execute("UPDATE oportunidades SET status_kanban = 'Aprovado', fornecedor_operacao = 'Kluubpay' WHERE id = 3");
});
afterEach(() => { db.close(); rmSync(pasta, { recursive: true, force: true }); });

test("não avança para Aprovado (nem depois) sem fornecedor", async () => {
  for (const fase of ["Aprovado", "Operando", "Operando dentro das expectativas"]) {
    await assert.rejects(atualizarLead(db, { id: 1, status_kanban: fase }), (e) => e.status === 400 && /selecione o fornecedor/.test(e.message));
  }
  const l = await atualizarLead(db, { id: 1, status_kanban: "Avançado" });
  assert.equal(l.status_kanban, "Avançado");
});

test("com fornecedor, avança para Aprovado; não dá para tirar o fornecedor depois", async () => {
  const l = await atualizarLead(db, { id: 1, fornecedor_operacao: PUSHIN_PAY, status_kanban: "Aprovado" });
  assert.equal(l.status_kanban, "Aprovado");
  assert.equal(l.fornecedor_operacao, PUSHIN_PAY);
  await assert.rejects(atualizarLead(db, { id: 1, fornecedor_operacao: null }), /selecione o fornecedor/);
});

test("fase e fornecedor inválidos, campo não editável e lead inexistente são recusados", async () => {
  await assert.rejects(atualizarLead(db, { id: 1, status_kanban: "Ganho" }), (e) => e.status === 400);
  await assert.rejects(atualizarLead(db, { id: 1, fornecedor_operacao: "Outro" }), (e) => e.status === 400);
  await assert.rejects(atualizarLead(db, { id: 1, nome_ou_razao_social: "X" }), /não editável/);
  await assert.rejects(atualizarLead(db, { id: 99, status_kanban: "Interessado" }), (e) => e.status === 404);
  await assert.rejects(atualizarLead(db, { id: 1 }), /Nada para atualizar/);
});

test("precificação é gravada em JSON; trocar o fornecedor a descarta", async () => {
  let l = await atualizarLead(db, {
    id: 3, dados_precificacao: { valor_referencia: 200, itens: { ted: { fixo: 5 } } },
  });
  assert.equal(l.dados_precificacao.fornecedor, KLUUBPAY);
  assert.equal(l.dados_precificacao.itens.ted.fixo, 5);
  assert.equal(l.dados_precificacao.itens.ted.custo_base.fixo, 3.99);

  l = await atualizarLead(db, { id: 3, fornecedor_operacao: PUSHIN_PAY });
  assert.equal(l.dados_precificacao, null);

  // precificação de produto que não existe no fornecedor atual é recusada
  await assert.rejects(atualizarLead(db, { id: 3, dados_precificacao: { itens: { ted: { fixo: 5 } } } }), /não existe na tabela/);
});

test("volume e MED reais: só números não negativos", async () => {
  const l = await atualizarLead(db, { id: 3, volume_real_mes: 150000.5, med_real_mes: 0.35 });
  assert.equal(l.volume_real_mes, 150000.5);
  assert.equal(l.med_real_mes, 0.35);
  await assert.rejects(atualizarLead(db, { id: 3, volume_real_mes: -1 }), /maior ou igual a zero/);
  await assert.rejects(atualizarLead(db, { id: 3, med_real_mes: "0,3" }), /número/);
});

test("GET com filtros por fase e fornecedor; ficha traz as interações", async () => {
  assert.equal((await listarLeads(db)).length, 3);
  assert.deepEqual((await listarLeads(db, { fornecedor: KLUUBPAY })).map((l) => l.id), [3]);
  assert.deepEqual((await listarLeads(db, { fornecedor: "sem_parceiro" })).map((l) => l.id).sort(), [1, 2]);
  assert.deepEqual((await listarLeads(db, { status: "Aprovado" })).map((l) => l.id), [3]);
  await assert.rejects(listarLeads(db, { fornecedor: "X" }), (e) => e.status === 400);

  await db.execute("INSERT INTO interacoes_cliente (oportunidade_id, tipo, assunto) VALUES (3, 'email', 'Proposta')");
  const { lead, interacoes } = await obterDossie(db, 3);
  assert.equal(lead.id, 3);
  assert.equal(interacoes[0].assunto, "Proposta");
});

// ---- acesso do consultor ----
test("proxy: sem credenciais configuradas bloqueia; com senha certa libera", () => {
  const req = (auth) => new Request("http://x/kanban", { headers: auth ? { authorization: auth } : {} });
  const basic = (u, s) => `Basic ${btoa(`${u}:${s}`)}`;
  delete process.env.CRM_USUARIO;
  delete process.env.CRM_SENHA;
  assert.equal(proxy(req(basic("a", "b"))).status, 503);
  Object.assign(process.env, { CRM_USUARIO: "consultor", CRM_SENHA: "s3nh@:com:dois-pontos" });
  assert.equal(proxy(req()).status, 401);
  assert.equal(proxy(req(basic("consultor", "errada"))).status, 401);
  assert.equal(proxy(req(basic("consultor", "s3nh@:com:dois-pontos"))), undefined);
});
