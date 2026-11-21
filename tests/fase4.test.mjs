// Comando 4: disparos de WhatsApp e e-mail pela ficha, registro na linha do tempo e proposta.
import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClient } from "@libsql/client";
import { migrar } from "../lib/db.js";
import { normalizarTelefoneBR } from "../lib/telefone.js";
import { montarProposta, textoParaHtml, htmlParaTexto } from "../lib/proposta.js";
import { montarPrecificacao } from "../lib/precificacao.js";
import { lerJson } from "../lib/respostaApi.js";
import { dispararEmail, dispararWhatsApp } from "../services/comunicacao.js";

let pasta, db, envios;
const contar = async (where = "1=1") =>
  Number((await db.execute(`SELECT COUNT(*) AS n FROM interacoes_cliente WHERE ${where}`)).rows[0].n);

beforeEach(async () => {
  pasta = mkdtempSync(join(tmpdir(), "crm-fase4-"));
  db = createClient({ url: `file:${join(pasta, "t.db")}` });
  await migrar(db);
  await db.execute("INSERT INTO contatos (phone_number) VALUES ('5521977776666')");
  await db.execute(`INSERT INTO oportunidades (id, phone_number, nome_ou_razao_social, whatsapp_contato, email_contato)
                    VALUES (1, '5521977776666', 'Padaria Exemplo', '(21) 98888-7777', 'financeiro@padaria.com.br')`);
  envios = [];
});
afterEach(() => { db.close(); rmSync(pasta, { recursive: true, force: true }); });

const ok = async (chatId, texto, opcoes) => { envios.push({ chatId, texto, opcoes }); return { messageId: "wamid.X" }; };
const recusa = async () => { throw new Error("OpenWA recusou o envio (HTTP 400)."); };

test("normalizarTelefoneBR", () => {
  assert.equal(normalizarTelefoneBR("(21) 98888-7777"), "5521988887777");
  assert.equal(normalizarTelefoneBR("+55 21 98888-7777"), "5521988887777");
  assert.equal(normalizarTelefoneBR("021 3333-4444"), "552133334444");
  assert.equal(normalizarTelefoneBR("+1 555 123 4567"), "15551234567"); // com "+", não ganha o 55
  assert.equal(normalizarTelefoneBR("+351 912 345 678"), "351912345678");
  assert.equal(normalizarTelefoneBR("123"), null);
  assert.equal(normalizarTelefoneBR(""), null);
});

test("WhatsApp: envia para o chatId normalizado e registra 'whatsapp_enviado' com sucesso", async () => {
  const r = await dispararWhatsApp({ db, enviar: ok }, {
    oportunidadeId: 1, telefone: "(21) 98888-7777", mensagem: "Olá! Segue a proposta.", idempotencyKey: "k1",
  });
  assert.deepEqual(envios[0], { chatId: "5521988887777@c.us", texto: "Olá! Segue a proposta.", opcoes: { idempotencyKey: "wa-k1" } });
  assert.equal(r.success, true);
  assert.equal(r.messageId, "wamid.X");
  assert.deepEqual(
    [r.interacao.tipo, r.interacao.destinatario, r.interacao.mensagem, r.interacao.status_envio],
    ["whatsapp_enviado", "5521988887777", "Olá! Segue a proposta.", "sucesso"],
  );
});

test("WhatsApp sem telefone no corpo usa o WhatsApp do diagnóstico", async () => {
  await dispararWhatsApp({ db, enviar: ok }, { oportunidadeId: 1, mensagem: "oi" });
  assert.equal(envios[0].chatId, "5521988887777@c.us");
});

test("WhatsApp: falha no OpenWA registra 'falha' e devolve 502 com a interação", async () => {
  await assert.rejects(
    dispararWhatsApp({ db, enviar: recusa }, { oportunidadeId: 1, mensagem: "oi" }),
    (e) => e.status === 502 && /não foi enviado.*HTTP 400/.test(e.message) && e.dados.interacao.status_envio === "falha",
  );
  assert.equal(await contar("status_envio = 'falha' AND tipo = 'whatsapp_enviado'"), 1);
});

test("WhatsApp: validações não chamam o OpenWA nem gravam nada", async () => {
  const casos = [
    [{ oportunidadeId: 1, mensagem: "  " }, 400],
    [{ oportunidadeId: 1, mensagem: "x".repeat(4097) }, 400],
    [{ oportunidadeId: 1, telefone: "123", mensagem: "oi" }, 400],
    [{ oportunidadeId: "abc", mensagem: "oi" }, 400],
    [{ oportunidadeId: 99, mensagem: "oi" }, 404],
    [{ oportunidadeId: 1, mensagem: "oi", idempotencyKey: "com espaço" }, 400],
  ];
  for (const [entrada, status] of casos) {
    await assert.rejects(dispararWhatsApp({ db, enviar: ok }, entrada), (e) => e.status === status, JSON.stringify(entrada).slice(0, 60));
  }
  assert.equal(envios.length, 0);
  assert.equal(await contar(), 0);
});

test("WhatsApp: envio ok mas registro falhou → 500 avisando para não reenviar", async () => {
  await db.execute("DROP TABLE interacoes_cliente");
  await assert.rejects(
    dispararWhatsApp({ db, enviar: ok }, { oportunidadeId: 1, mensagem: "oi" }),
    (e) => e.status === 500 && /Não reenvie/.test(e.message),
  );
  assert.equal(envios.length, 1);
});

test("E-mail: envia pelo serviço e registra 'email_enviado' com assunto e HTML", async () => {
  let enviado;
  const enviarEmail = async (e) => { enviado = e; return { id: "re_123" }; };
  const r = await dispararEmail({ db, enviarEmail }, {
    oportunidadeId: 1, email: "cliente@exemplo.com.br", assunto: "Proposta\r\nBcc: x@y.com",
    corpoHtml: "<p>Olá</p>", idempotencyKey: "k2",
  });
  assert.equal(enviado.para, "cliente@exemplo.com.br");
  assert.equal(enviado.assunto, "Proposta Bcc: x@y.com"); // sem quebra de linha no cabeçalho
  assert.equal(enviado.texto, "Olá"); // versão texto derivada do HTML
  assert.equal(enviado.idempotencyKey, "email-k2");
  assert.equal(r.emailId, "re_123");
  assert.deepEqual(
    [r.interacao.tipo, r.interacao.destinatario, r.interacao.assunto, r.interacao.mensagem, r.interacao.status_envio],
    ["email_enviado", "cliente@exemplo.com.br", "Proposta Bcc: x@y.com", "<p>Olá</p>", "sucesso"],
  );
});

test("E-mail: sem e-mail no corpo usa o do diagnóstico; inválido é recusado", async () => {
  let para;
  await dispararEmail({ db, enviarEmail: async (e) => { para = e.para; return { id: "1" }; } }, { oportunidadeId: 1, assunto: "a", corpoHtml: "<p>b</p>" });
  assert.equal(para, "financeiro@padaria.com.br");
  for (const email of ["sem-arroba", "a@b", "a b@c.com", "x@y.com, z@w.com"]) {
    await assert.rejects(dispararEmail({ db, enviarEmail: async () => ({ id: "1" }) }, { oportunidadeId: 1, email, assunto: "a", corpoHtml: "b" }), /E-mail do destinatário inválido/, email);
  }
  await assert.rejects(dispararEmail({ db, enviarEmail: async () => ({ id: "1" }) }, { oportunidadeId: 1, assunto: "", corpoHtml: "b" }), /assunto/);
});

test("E-mail: falha no Resend registra 'falha' e devolve 502", async () => {
  const falha = async () => { throw new Error("Resend recusou o envio (HTTP 403): domínio não verificado"); };
  await assert.rejects(
    dispararEmail({ db, enviarEmail: falha }, { oportunidadeId: 1, assunto: "a", corpoHtml: "<p>b</p>" }),
    (e) => e.status === 502 && /domínio não verificado/.test(e.message) && e.dados.interacao.tipo === "email_enviado",
  );
  assert.equal(await contar("status_envio = 'falha'"), 1);
});

test("proposta: só taxas negociadas, nunca custo base nem spread", () => {
  const lead = {
    nome_ou_razao_social: "Padaria Exemplo",
    fornecedor_operacao: "Pushin Pay",
    dados_precificacao: montarPrecificacao("Pushin Pay", {
      itens: { pix_in_f2: { percentual: 0.99, fixo: 0.5 }, pix_out: { fixo: 1.5 }, debito: { percentual: 5.1 } },
    }),
  };
  const w = montarProposta(lead, "whatsapp");
  assert.match(w.texto, /\*Pix In \(D0\)\*/);
  assert.match(w.texto, /Faixa 2: acima de R\$ 600,00 até R\$ 2\.000,00: 0,99% \+ R\$\s0,50/);
  assert.match(w.texto, /• R\$\s1,50/);
  assert.match(w.texto, /Débito: 5,10%/);
  // custos da Pushin Pay para esses itens: 0,70% + 0,35 · 1,20 · 4,52% + 0,35
  for (const custo of ["0,70%", "1,20", "4,52%", "0,35"]) assert.ok(!w.texto.includes(custo), `vazou custo ${custo}`);
  const e = montarProposta(lead, "email");
  assert.ok(!e.texto.includes("*"));
  assert.match(e.assunto, /Pushin Pay · Padaria Exemplo/);
  // sem precificação salva, ou feita para outro fornecedor: sem atalho
  assert.equal(montarProposta({ ...lead, dados_precificacao: null }, "whatsapp"), null);
  assert.equal(montarProposta({ ...lead, fornecedor_operacao: "Kluubpay" }, "whatsapp"), null);
});

test("textoParaHtml escapa HTML digitado e htmlParaTexto volta ao texto", () => {
  const html = textoParaHtml("Olá <script>alert(1)</script>\nlinha 2\n\nparágrafo & fim");
  assert.ok(!html.includes("<script>"));
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /linha 2/);
  assert.equal(htmlParaTexto(html), "Olá <script>alert(1)</script>\nlinha 2\n\nparágrafo & fim");
});

test("lerJson exige Content-Type JSON (bloqueia formulário forjado de outro site)", async () => {
  const req = (tipo) => new Request("http://x/api/whatsapp/send", {
    method: "POST", body: '{"a":1}', headers: tipo ? { "content-type": tipo } : {},
  });
  await assert.rejects(lerJson(req("text/plain")), (e) => e.status === 415);
  await assert.rejects(lerJson(req()), (e) => e.status === 415);
  assert.deepEqual(await lerJson(req("application/json; charset=utf-8")), { a: 1 });
});
