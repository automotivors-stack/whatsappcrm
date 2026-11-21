// Verificação dos serviços reais, um de cada vez, usando o próprio código do CRM.
// Uso: npm run verificar -- <passo> [argumento]
//   ambiente                 confere as variáveis (sem mostrar valores)
//   banco                    conecta no Turso e aplica as migrações (não apaga nada)
//   whatsapp                 envia uma mensagem de teste ao ADMIN_WHATSAPP_NUMBER
//   email <destino>          envia um e-mail de teste pelo Resend
//   ia                       chama o Claude com uma conversa de exemplo (saída estruturada)
//   webhook <url-publica>    cadastra o webhook do CRM no OpenWA (não duplica)
// Nunca imprime chaves, tokens ou senhas.

import { randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";
import { getDb, migrar } from "../lib/db.js";
import { chatIdDoTelefone, mascarar } from "../lib/telefone.js";

const ok = (t) => console.log(`✅ ${t}`);
const aviso = (t) => console.log(`⚠️  ${t}`);
const falha = (t) => { console.error(`❌ ${t}`); process.exitCode = 1; };

const OBRIGATORIAS = [
  ["TURSO_DATABASE_URL", "banco"], ["TURSO_AUTH_TOKEN", "banco (dispensado com file:)"],
  ["OPENWA_BASE_URL", "WhatsApp"], ["OPENWA_API_KEY", "WhatsApp"], ["OPENWA_SESSION_ID", "WhatsApp"],
  ["OPENWA_WEBHOOK_SECRET", "webhook: sem ela o CRM recusa todo evento"],
  ["ADMIN_WHATSAPP_NUMBER", "aprovação SIM/NÃO"],
  ["CRM_USUARIO", "acesso ao painel"], ["CRM_SENHA", "acesso ao painel"],
  ["ANTHROPIC_API_KEY", "IA do diagnóstico"],
  ["RESEND_API_KEY", "e-mail"], ["RESEND_FROM_EMAIL", "e-mail"],
];
const MODELOS_APOSENTADOS = /claude-(3|3-5|3-7|instant|2)|claude-sonnet-4-0|claude-opus-4-0|claude-sonnet-4-2025|claude-opus-4-2025/;

/** Confere o ambiente. Devolve a lista de problemas (vazia = tudo certo). */
export function checarAmbiente(env = process.env) {
  const problemas = [];
  for (const [nome, uso] of OBRIGATORIAS) {
    if (nome === "TURSO_AUTH_TOKEN" && String(env.TURSO_DATABASE_URL ?? "").startsWith("file:")) continue;
    if (!env[nome]) problemas.push(`${nome} vazia (${uso})`);
  }
  if (env.AGENTE_MODELO && MODELOS_APOSENTADOS.test(env.AGENTE_MODELO)) {
    problemas.push(`AGENTE_MODELO=${env.AGENTE_MODELO} é um modelo aposentado. Deixe vazio (padrão claude-sonnet-5-5).`);
  }
  if (env.ADMIN_WHATSAPP_NUMBER && !/^\d{12,15}$/.test(env.ADMIN_WHATSAPP_NUMBER)) {
    problemas.push("ADMIN_WHATSAPP_NUMBER deve ter só dígitos com DDI, ex.: 5511999999999");
  }
  if (env.OPENWA_BASE_URL && env.OPENWA_BASE_URL.endsWith("/")) problemas.push("OPENWA_BASE_URL sem barra no fim");
  if (env.OPENWA_WEBHOOK_SECRET && env.OPENWA_WEBHOOK_SECRET.length < 24) {
    problemas.push("OPENWA_WEBHOOK_SECRET curta: use um valor aleatório longo (openssl rand -hex 32)");
  }
  return problemas;
}

async function ambiente() {
  const problemas = checarAmbiente();
  if (!problemas.length) return ok("Todas as variáveis necessárias estão preenchidas.");
  problemas.forEach(falha);
}

async function banco() {
  const url = process.env.TURSO_DATABASE_URL ?? "";
  const db = getDb();
  const inicio = Date.now();
  const novas = await migrar(db);
  const { rows } = await db.execute("SELECT versao, nome FROM _migracoes ORDER BY versao");
  const contagem = await db.execute(
    "SELECT (SELECT COUNT(*) FROM contatos) c, (SELECT COUNT(*) FROM oportunidades) o, (SELECT COUNT(*) FROM aprovacoes_pendentes WHERE status = 'aguardando') p",
  );
  ok(`Conectado (${url.startsWith("file:") ? "arquivo local" : "Turso remoto"}) em ${Date.now() - inicio} ms.`);
  ok(novas.length ? `Migrações aplicadas agora: ${novas.join(", ")}` : "Banco já estava atualizado.");
  console.log(`   Migrações no banco: ${rows.map((r) => r.versao).join(", ")}`);
  const c = contagem.rows[0];
  console.log(`   Contatos: ${c.c} · Oportunidades: ${c.o} · Aguardando aprovação: ${c.p}`);
}

async function whatsapp() {
  const { enviarMensagemWhatsApp } = await import("../services/whatsappService.js");
  const admin = process.env.ADMIN_WHATSAPP_NUMBER;
  if (!admin) return falha("ADMIN_WHATSAPP_NUMBER vazia.");
  const r = await enviarMensagemWhatsApp(
    chatIdDoTelefone(admin),
    "✅ Teste do CRM: a sessão do OpenWA está conectada e a chave de API funciona. Pode ignorar esta mensagem.",
    { idempotencyKey: `verificar-${randomUUID()}` },
  );
  ok(`OpenWA aceitou a mensagem para ${mascarar(admin)} (messageId ${r.messageId ?? "?"}). Confira no seu WhatsApp.`);
}

async function email(destino) {
  const { enviarEmail } = await import("../services/emailService.js");
  if (!destino) return falha("Informe o destino: npm run verificar -- email voce@seudominio.com.br");
  const r = await enviarEmail({
    para: destino,
    assunto: "Teste do CRM: Resend configurado",
    html: "<p>Se você recebeu este e-mail, a chave do Resend e o remetente estão funcionando.</p>",
    texto: "Se você recebeu este e-mail, a chave do Resend e o remetente estão funcionando.",
    idempotencyKey: `verificar-${randomUUID()}`,
  });
  ok(`Resend aceitou o e-mail (id ${r.id}). Confira a caixa de entrada e o spam de ${destino}.`);
}

async function ia() {
  const { chamarClaude, montarEntrada, MODELO_PADRAO, camposObrigatorios } = await import("../services/aiDiagnosticService.js");
  const inicio = Date.now();
  const saida = await chamarClaude({
    entrada: montarEntrada({
      historico: [{ role: "user", content: "Oi! Tenho uma padaria, a Pão Bom, e vendo uns 80 mil por mês. Quero pagar menos no Pix." }],
      dados: {},
      faltando: camposObrigatorios(),
      secundarios: [],
      modo: "diagnostico",
    }),
  });
  ok(`Claude respondeu em ${((Date.now() - inicio) / 1000).toFixed(1)} s com o modelo ${process.env.AGENTE_MODELO || MODELO_PADRAO}.`);
  console.log(`   Resposta ao lead: "${saida.resposta}"`);
  const extraidos = Object.entries(saida.dados).filter(([, v]) => v !== null);
  console.log(`   Dados extraídos: ${extraidos.map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(", ") || "nenhum"}`);
  console.log(`   Concluir: ${saida.concluir} (esperado: false, ainda faltam dados)`);
}

async function webhook(urlPublica) {
  const base = process.env.OPENWA_BASE_URL?.replace(/\/+$/, "");
  const sessao = process.env.OPENWA_SESSION_ID;
  const chave = process.env.OPENWA_API_KEY;
  const segredo = process.env.OPENWA_WEBHOOK_SECRET;
  if (!base || !sessao || !chave || !segredo) return falha("Preencha OPENWA_BASE_URL, OPENWA_SESSION_ID, OPENWA_API_KEY e OPENWA_WEBHOOK_SECRET.");
  if (!urlPublica) return falha("Informe a URL do CRM: npm run verificar -- webhook https://crm.seudominio.com.br");
  const destino = `${urlPublica.replace(/\/+$/, "")}/api/webhooks/whatsapp`;
  const api = (caminho, init = {}) => fetch(`${base}/api/sessions/${encodeURIComponent(sessao)}/webhooks${caminho}`, {
    ...init, headers: { "Content-Type": "application/json", "X-API-Key": chave }, signal: AbortSignal.timeout(15000),
  });

  const lista = await api("");
  if (!lista.ok) return falha(`OpenWA recusou listar webhooks (HTTP ${lista.status}). Confira a chave e o id da sessão.`);
  const existentes = await lista.json().catch(() => []);
  const igual = (Array.isArray(existentes) ? existentes : existentes.data ?? []).find((w) => w.url === destino);
  if (igual) return ok(`Webhook já cadastrado para ${destino} (id ${igual.id}). Nada a fazer.`);

  const r = await api("", { method: "POST", body: JSON.stringify({ url: destino, events: ["message.received"], secret: segredo }) });
  const corpo = await r.json().catch(() => ({}));
  if (!r.ok) {
    falha(`OpenWA recusou o cadastro (HTTP ${r.status}): ${corpo.message ?? "sem detalhe"}`);
    if (/address|ssrf|allowed/i.test(String(corpo.message))) {
      aviso("Endereço interno bloqueado pelo OpenWA. Use uma URL pública (túnel ou domínio) ou, no servidor do OpenWA, SSRF_ALLOWED_HOSTS=<host do CRM>.");
    }
    return;
  }
  ok(`Webhook cadastrado (id ${corpo.id}) → ${destino}, evento message.received, assinado com OPENWA_WEBHOOK_SECRET.`);
}

const PASSOS = { ambiente, banco, whatsapp, email, ia, webhook };

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [passo, argumento] = process.argv.slice(2);
  if (!PASSOS[passo]) {
    console.log("Uso: npm run verificar -- <ambiente|banco|whatsapp|email <destino>|ia|webhook <url-publica>>");
    process.exitCode = 1;
  } else {
    PASSOS[passo](argumento).catch((e) => falha(e?.message ?? String(e)));
  }
}
