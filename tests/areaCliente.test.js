// Área do cliente: cadastro (Better Auth de verdade, banco de teste), liberação pelo consultor e
// o que o cliente pode ver (sigilo comercial: nada de custo, margem, precificação ou fornecedor).
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const pasta = mkdtempSync(join(tmpdir(), "crm-cliente-"));
const BASE = "http://localhost:3000";
Object.assign(process.env, {
  TURSO_DATABASE_URL: `file:${join(pasta, "cliente.db")}`,
  BETTER_AUTH_SECRET: "segredo-de-teste-com-mais-de-32-caracteres-123",
  BETTER_AUTH_URL: BASE,
});
delete process.env.ADMIN_WHATSAPP_NUMBER;

const { getDb, migrar } = await import("../lib/db.js");
const { betterAuth } = await import("better-auth");
const { opcoesAuth, STATUS_ACESSO } = await import("../lib/auth.js");
const { validarCadastro } = await import("../lib/cadastroCliente.js");
const { decidirConta, dadosAreaCliente, listarContas, textoAvisoContaNova, FASES_CLIENTE } = await import("../services/contasClientes.js");
const { FASES } = await import("../lib/kanban.js");

const db = getDb();
const avisos = [];
const auth = betterAuth(opcoesAuth({ aoCriarConta: async (u) => avisos.push(u) }));

before(async () => { await migrar(db); });
after(() => { db.close(); rmSync(pasta, { recursive: true, force: true }); });

const post = (caminho, corpo, cookie) => auth.handler(new Request(`${BASE}/api/auth${caminho}`, {
  method: "POST",
  headers: { "content-type": "application/json", origin: BASE, ...(cookie ? { cookie } : {}) },
  body: JSON.stringify(corpo),
}));
const cookieDe = (resp) => resp.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
const usuario = async (email) => (await db.execute({ sql: "SELECT * FROM cliente_usuarios WHERE email = ?", args: [email] })).rows[0];

test("validarCadastro: campos obrigatórios, telefone com DDD, senha e confirmação", () => {
  const ok = validarCadastro({ nome: " Ana  Souza ", email: "ANA@Loja.com", telefone: "(11) 98888-7777", empresa: "Loja <b>", senha: "12345678", confirmacao: "12345678" });
  assert.deepEqual(ok.dados, { nome: "Ana Souza", email: "ana@loja.com", telefone: "5511988887777", empresa: "Loja b" });
  const r = validarCadastro({ nome: "A", email: "x", telefone: "123", empresa: "", senha: "curta", confirmacao: "outra" });
  assert.deepEqual(Object.keys(r.erros).sort(), ["confirmacao", "email", "empresa", "nome", "senha", "telefone"]);
  assert.ok(validarCadastro({ nome: "Ana", telefone: "11988887777", empresa: "Loja" }, { exigirSenha: false, exigirEmail: false }).dados);
});

test("cadastro por e-mail: conta nasce pendente, sem vínculo, e o consultor é avisado", async () => {
  const base = { name: "Ana Souza", email: "ana@loja.com", password: "senha-forte-1", telefone: "(11) 98888-7777", empresa: "Loja da Ana" };
  // Tentativa de se liberar sozinha no cadastro: recusada, nada é criado.
  const forjada = await post("/sign-up/email", { ...base, status_acesso: "liberado", oportunidade_id: 1 });
  assert.equal(forjada.status, 400);
  assert.equal(await usuario("ana@loja.com"), undefined);

  const resp = await post("/sign-up/email", base);
  assert.equal(resp.status, 200);
  const u = await usuario("ana@loja.com");
  assert.ok(u, "conta criada");
  assert.equal(u.status_acesso, STATUS_ACESSO.PENDENTE);
  assert.equal(u.oportunidade_id, null);
  assert.equal(u.telefone, "5511988887777");
  const senha = (await db.execute({ sql: `SELECT password FROM cliente_contas WHERE "userId" = ?`, args: [u.id] })).rows[0].password;
  assert.ok(senha && !senha.includes("senha-forte-1"), "senha guardada só como hash");
  assert.equal(avisos.at(-1)?.email, "ana@loja.com");
  assert.match(textoAvisoContaNova(avisos.at(-1)), /Loja da Ana/);
});

test("cadastro por e-mail sem telefone ou empresa é recusado no servidor", async () => {
  const resp = await post("/sign-up/email", { name: "Bia", email: "bia@x.com", password: "senha-forte-1", telefone: "", empresa: "" });
  assert.equal(resp.status, 400);
  assert.equal(await usuario("bia@x.com"), undefined);
});

test("login e update-user não deixam o cliente mudar o próprio acesso", async () => {
  const entrou = await post("/sign-in/email", { email: "ana@loja.com", password: "senha-forte-1" });
  assert.equal(entrou.status, 200);
  const cookie = cookieDe(entrou);
  const errada = await post("/sign-in/email", { email: "ana@loja.com", password: "errada-123" });
  assert.equal(errada.status, 401);

  const forjada = await post("/update-user", { name: "Ana S.", telefone: "11977776666", empresa: "Loja X", status_acesso: "liberado", oportunidade_id: 1 }, cookie);
  assert.equal(forjada.status, 400);
  const valida = await post("/update-user", { name: "Ana S.", telefone: "11977776666", empresa: "Loja Nova" }, cookie);
  assert.equal(valida.status, 200);
  const u = await usuario("ana@loja.com");
  assert.equal(u.status_acesso, STATUS_ACESSO.PENDENTE);
  assert.equal(u.oportunidade_id, null);
  assert.equal(u.empresa, "Loja Nova");

  const sessao = await auth.api.getSession({ headers: new Headers({ cookie }) });
  assert.equal(sessao.user.email, "ana@loja.com");
});

test("pendente não vê nada do CRM; liberada com card vê só fase e mensagens recebidas", async () => {
  const u = await usuario("ana@loja.com");
  const op = await db.execute({
    sql: `INSERT INTO oportunidades (phone_number, nome_ou_razao_social, status_kanban, fornecedor_operacao, dados_precificacao, taxas_atuais, resumo_executivo)
          VALUES ('5511977776666', '[EXEMPLO] Loja da Ana', 'Avançado', 'Pushin Pay', '{"spread":0.4,"custo":1.1}', 'Débito 1,9%', 'resumo interno') RETURNING id`,
    args: [],
  });
  const opId = Number(op.rows[0].id);
  await db.batch([
    { sql: "INSERT INTO interacoes_cliente (oportunidade_id, tipo, destinatario, mensagem, status_envio) VALUES (?, 'whatsapp_enviado', '5511977776666', 'Proposta: taxa 2,1%', 'sucesso')", args: [opId] },
    { sql: "INSERT INTO interacoes_cliente (oportunidade_id, tipo, destinatario, assunto, mensagem, status_envio) VALUES (?, 'email_enviado', 'ana@loja.com', 'Sua proposta', '<p>Olá <b>Ana</b></p>', 'sucesso')", args: [opId] },
    { sql: "INSERT INTO interacoes_cliente (oportunidade_id, tipo, destinatario, mensagem, status_envio) VALUES (?, 'whatsapp_enviado', '5511977776666', 'não chegou', 'falha')", args: [opId] },
  ]);

  const antes = await dadosAreaCliente(db, u.id);
  assert.equal(antes.andamento, null);
  assert.deepEqual(antes.mensagens, []);

  const conta = await decidirConta(db, u.id, { decisao: "liberar", oportunidadeId: opId });
  assert.equal(conta.status_acesso, "liberado");

  const depois = await dadosAreaCliente(db, u.id);
  assert.equal(depois.andamento.fase, FASES_CLIENTE["Avançado"]);
  assert.equal(depois.andamento.etapa, 3);
  assert.equal(depois.mensagens.length, 2, "só as entregues");
  assert.ok(depois.mensagens.some((m) => m.canal === "E-mail" && !m.texto.includes("<")), "e-mail vira texto puro");
  const tudo = JSON.stringify(depois);
  for (const proibido of ["spread", "custo", "Pushin", "fornecedor", "precificacao", "Débito 1,9%", "resumo interno", "não chegou"]) {
    assert.ok(!tudo.includes(proibido), `área do cliente vazou: ${proibido}`);
  }
});

test("decidirConta: validações e recusa encerra as sessões", async () => {
  const u = await usuario("ana@loja.com");
  await assert.rejects(decidirConta(db, u.id, { decisao: "talvez" }), /liberar/);
  await assert.rejects(decidirConta(db, "nao-existe", { decisao: "recusar" }), /não encontrada/);
  await assert.rejects(decidirConta(db, u.id, { decisao: "liberar", oportunidadeId: 99999 }), /Card não encontrado/);

  await post("/sign-in/email", { email: "ana@loja.com", password: "senha-forte-1" });
  await decidirConta(db, u.id, { decisao: "recusar" });
  const sessoes = await db.execute({ sql: `SELECT COUNT(*) n FROM cliente_sessoes WHERE "userId" = ?`, args: [u.id] });
  assert.equal(Number(sessoes.rows[0].n), 0);
  assert.equal((await dadosAreaCliente(db, u.id)).andamento, null);
  assert.equal((await listarContas(db))[0].status_acesso, "recusado");
});

test("toda fase do Kanban tem texto para o cliente", () => {
  for (const f of FASES) assert.ok(FASES_CLIENTE[f.id], f.id);
});
