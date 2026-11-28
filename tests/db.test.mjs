// Valida o schema num SQLite local em memória. Uso: npm run test:db
import { test } from "node:test";
import assert from "node:assert/strict";
import { createClient } from "@libsql/client";
import { migrar, registrarEventoSeNovo } from "../lib/db.js";

const novoBanco = () => createClient({ url: ":memory:" });

const ESPERADO = {
  contatos: ["phone_number", "nome", "tipo_pessoa", "documento", "descricao_negocio", "volume_mensal",
    "status_relacionamento", "created_at", "updated_at", "dados_diagnostico", "origem", "dados_site"],
  mensagens_historico: ["id", "phone_number", "role", "content", "created_at"],
  oportunidades: ["id", "phone_number", "tipo_pessoa", "nome_ou_razao_social", "documento", "descricao_negocio",
    "onde_opera_hoje", "volume_mensal", "numero_transacoes", "taxas_atuais", "taxa_med_operacao",
    "limite_por_venda", "limite_saque_diario", "saque_terceiros", "metodos_pagamento", "tipo_integracao",
    "whatsapp_contato", "email_contato", "resumo_executivo", "status_kanban", "fornecedor_operacao",
    "dados_precificacao", "volume_real_mes", "med_real_mes", "created_at", "lucro_real_mes"],
  interacoes_cliente: ["id", "oportunidade_id", "tipo", "destinatario", "assunto", "mensagem", "status_envio",
    "created_at"],
  eventos_processados: ["message_id", "provider", "created_at"],
};

test("cria as 5 tabelas com as colunas exatas", async () => {
  const db = novoBanco();
  await migrar(db);
  for (const [tabela, colunas] of Object.entries(ESPERADO)) {
    const { rows } = await db.execute(`PRAGMA table_info(${tabela})`);
    assert.deepEqual(rows.map((r) => r.name), colunas, tabela);
  }
});

test("migração é idempotente", async () => {
  const db = novoBanco();
  assert.equal((await migrar(db)).length, 5);
  assert.equal((await migrar(db)).length, 0);
});

test("valores padrão", async () => {
  const db = novoBanco();
  await migrar(db);
  await db.execute("INSERT INTO contatos (phone_number) VALUES ('5511999990000')");
  const c = (await db.execute("SELECT * FROM contatos")).rows[0];
  assert.equal(c.status_relacionamento, "novo_lead");
  assert.ok(c.created_at && c.updated_at);

  await db.execute("INSERT INTO oportunidades (phone_number) VALUES ('5511999990000')");
  const o = (await db.execute("SELECT * FROM oportunidades")).rows[0];
  assert.equal(o.status_kanban, "Contato Recebido");
  assert.equal(o.fornecedor_operacao, null);
  assert.equal(o.volume_real_mes, 0);
  assert.equal(o.med_real_mes, 0);

  await db.execute("INSERT INTO interacoes_cliente (oportunidade_id) VALUES (1)");
  const i = (await db.execute("SELECT * FROM interacoes_cliente")).rows[0];
  assert.equal(i.status_envio, "sucesso");
});

test("chaves estrangeiras declaradas e aplicadas", async () => {
  const db = novoBanco();
  await migrar(db);
  const fkMsg = (await db.execute("PRAGMA foreign_key_list(mensagens_historico)")).rows[0];
  assert.equal(fkMsg.table, "contatos");
  const fkInt = (await db.execute("PRAGMA foreign_key_list(interacoes_cliente)")).rows[0];
  assert.equal(fkInt.table, "oportunidades");

  await db.execute("PRAGMA foreign_keys = ON");
  await assert.rejects(
    db.execute("INSERT INTO mensagens_historico (phone_number, role, content) VALUES ('000', 'user', 'oi')"),
  );
});

test("deduplicação de webhook: mesmo message_id só entra uma vez", async () => {
  const db = novoBanco();
  await migrar(db);
  assert.equal(await registrarEventoSeNovo("wamid.ABC", "openwa", db), true);
  assert.equal(await registrarEventoSeNovo("wamid.ABC", "openwa", db), false);
  const { rows } = await db.execute("SELECT COUNT(*) AS n FROM eventos_processados");
  assert.equal(Number(rows[0].n), 1);
});
