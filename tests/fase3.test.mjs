// Comando 3: busca, dossiê 360°, interações e as rotas HTTP com o contrato { error }.
import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClient } from "@libsql/client";
import { migrar } from "../lib/db.js";
import { criarInteracao, listarInteracoes, listarLeads, obterDossie, validarId } from "../services/leads.js";

let pasta, db;
const TEL = "5521977776666";

beforeEach(async () => {
  pasta = mkdtempSync(join(tmpdir(), "crm-fase3-"));
  db = createClient({ url: `file:${join(pasta, "t.db")}` });
  await migrar(db);
  await db.execute({ sql: "INSERT INTO contatos (phone_number) VALUES (?), ('5531900000000')", args: [TEL] });
  await db.execute({
    sql: `INSERT INTO oportunidades (id, phone_number, nome_ou_razao_social, documento) VALUES
          (1, ?, 'Padaria Pão Quente', '12.345.678/0001-90'),
          (2, ?, 'Loja 100% Natural', '98.765.432/0001-10'),
          (3, '5531900000000', 'Ana_Souza', '987.654.321-00')`,
    args: [TEL, TEL],
  });
  for (const [role, content] of [["user", "Oi"], ["assistant", "Olá! Qual seu volume?"], ["user", "150 mil"]]) {
    await db.execute({ sql: "INSERT INTO mensagens_historico (phone_number, role, content) VALUES (?, ?, ?)", args: [TEL, role, content] });
  }
  await db.execute({ sql: "INSERT INTO mensagens_historico (phone_number, role, content) VALUES ('5531900000000', 'user', 'de outro contato')" });
});
afterEach(() => { db.close(); rmSync(pasta, { recursive: true, force: true }); });

const ids = (leads) => leads.map((l) => l.id).sort();

test("busca por nome (sem diferenciar maiúsculas) e por documento com ou sem pontuação", async () => {
  assert.deepEqual(ids(await listarLeads(db, { busca: "padaria" })), [1]);
  assert.deepEqual(ids(await listarLeads(db, { busca: "12.345.678" })), [1]);
  assert.deepEqual(ids(await listarLeads(db, { busca: "12345678" })), [1]);
  assert.deepEqual(ids(await listarLeads(db, { busca: "zzz" })), []);
});

test("busca trata % e _ como texto, não como curinga", async () => {
  assert.deepEqual(ids(await listarLeads(db, { busca: "100%" })), [2]);
  assert.deepEqual(ids(await listarLeads(db, { busca: "%" })), [2]);
  assert.deepEqual(ids(await listarLeads(db, { busca: "_" })), [3]);
});

test("busca é parametrizada: aspas e SQL no termo não quebram nem vazam", async () => {
  assert.deepEqual(ids(await listarLeads(db, { busca: "' OR 1=1 --" })), []);
  assert.equal((await listarLeads(db)).length, 3);
  await assert.rejects(listarLeads(db, { busca: "x".repeat(101) }), (e) => e.status === 400);
});

test("busca combina com filtro de fornecedor", async () => {
  await db.execute("UPDATE oportunidades SET fornecedor_operacao = 'Kluubpay' WHERE id = 1");
  assert.deepEqual(ids(await listarLeads(db, { busca: "padaria", fornecedor: "Kluubpay" })), [1]);
  assert.deepEqual(ids(await listarLeads(db, { busca: "padaria", fornecedor: "sem_parceiro" })), []);
});

test("dossiê 360°: oportunidade + conversa do telefone dela (cronológica) + interações", async () => {
  await db.execute("INSERT INTO interacoes_cliente (oportunidade_id, tipo, assunto) VALUES (1, 'email', 'Proposta')");
  const d = await obterDossie(db, 1);
  assert.equal(d.lead.id, 1);
  assert.deepEqual(d.mensagens.map((m) => m.content), ["Oi", "Olá! Qual seu volume?", "150 mil"]);
  assert.equal(d.interacoes[0].assunto, "Proposta");
  await assert.rejects(obterDossie(db, 99), (e) => e.status === 404 && e.message === "Oportunidade não encontrada");
});

test("interações: cria, lista (mais recente primeiro) e valida", async () => {
  const a = await criarInteracao(db, 1, { tipo: "whatsapp", destinatario: TEL, mensagem: "Enviei a proposta" });
  assert.equal(a.status_envio, "sucesso");
  assert.equal(a.oportunidade_id, 1);
  const b = await criarInteracao(db, 1, { tipo: "email", assunto: "Contrato", status_envio: "falha" });
  const lista = await listarInteracoes(db, 1);
  assert.deepEqual(lista.map((i) => i.id), [b.id, a.id]);

  await assert.rejects(criarInteracao(db, 1, { mensagem: "sem tipo" }), /tipo/);
  await assert.rejects(criarInteracao(db, 1, { tipo: "nota" }), /assunto" ou "mensagem/);
  await assert.rejects(criarInteracao(db, 1, { tipo: "nota", mensagem: "x", oportunidade_id: 2 }), /diferente/);
  await assert.rejects(criarInteracao(db, 1, { tipo: "nota", mensagem: "x", extra: 1 }), /não aceito/);
  await assert.rejects(criarInteracao(db, 1, { tipo: "nota", mensagem: 5 }), /texto/);
  await assert.rejects(criarInteracao(db, 99, { tipo: "nota", mensagem: "x" }), (e) => e.status === 404);
  await assert.rejects(listarInteracoes(db, 99), (e) => e.status === 404);
});

test("validarId recusa id não inteiro", () => {
  assert.equal(validarId("12"), 12);
  for (const v of ["0", "-1", "1.5", "abc", "1 OR 1=1", "01"]) assert.throws(() => validarId(v), /Id inválido/, v);
});
