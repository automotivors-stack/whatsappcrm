// Processamento de um evento do webhook do OpenWA.
// Payload (OpenWA): { event, timestamp, sessionId, idempotencyKey, deliveryId, data: { id, from, to,
//   chatId, body, type, timestamp, fromMe, isGroup, kind, contact?: { name?, pushName? }, senderPhone? } }

import { getDb, registrarEventoSeNovo } from "../lib/db.js";
import { digitos, mascarar, mesmoTelefone, telefoneDoChatId } from "../lib/telefone.js";
import { enviarMensagemWhatsApp } from "./whatsappService.js";
import { responderComAgente } from "./agente.js";
import { finalizarDiagnostico, tratarRespostaAdmin } from "./aprovacao.js";

export const STATUS_PAUSADO = "pausado_humano";

/** Dependências reais; os testes passam versões falsas. */
export function contextoPadrao() {
  return {
    db: getDb(),
    enviar: enviarMensagemWhatsApp,
    adminNumero: process.env.ADMIN_WHATSAPP_NUMBER,
    agente: responderComAgente,
  };
}

/** Telefone do remetente: do chatId (@c.us) ou, para privacy id (@lid), do senderPhone do OpenWA. */
function telefoneDoRemetente(msg) {
  return telefoneDoChatId(msg.from) ?? (digitos(msg.senderPhone) || null);
}

export async function processarEventoOpenWA(ctx, payload) {
  const { db } = ctx;
  if (payload?.event !== "message.received") return { acao: "ignorado_evento" };

  const msg = payload.data ?? {};
  if (msg.fromMe === true) return { acao: "ignorado_proprio" };
  if (!msg.id) return { acao: "ignorado_sem_id" };
  if (msg.isGroup || msg.isStatusBroadcast || (msg.kind && msg.kind !== "individual")) {
    return { acao: "ignorado_nao_individual" };
  }

  // Configuração conferida ANTES de marcar o evento como processado: com ela faltando,
  // a mensagem não pode ser consumida e perdida.
  if (!ctx.adminNumero) throw new Error("ADMIN_WHATSAPP_NUMBER não configurado.");

  const telefone = telefoneDoRemetente(msg);
  if (!telefone) {
    console.warn("[webhook] remetente @lid sem senderPhone; ative RESOLVE_LID_TO_PHONE=true no OpenWA");
    return { acao: "ignorado_sem_telefone" };
  }

  if (mesmoTelefone(telefone, ctx.adminNumero)) {
    // Deduplicação idempotente: o mesmo messageId só é processado uma vez.
    if (!(await registrarEventoSeNovo(msg.id, "openwa", db))) return { acao: "duplicado" };
    return tratarRespostaAdmin(ctx, msg.body);
  }

  // Deduplicação + contato + histórico numa transação só: ou o evento fica registrado junto com
  // a mensagem salva, ou nada fica (antes, uma falha no meio marcava o evento e perdia a mensagem).
  const nome = msg.contact?.pushName || msg.contact?.name || null;
  const conteudo = msg.body ? String(msg.body) : `[${msg.type ?? "mensagem"}]`;
  let status;
  const tx = await db.transaction("write");
  try {
    const novo = await tx.execute({
      sql: "INSERT OR IGNORE INTO eventos_processados (message_id, provider) VALUES (?, 'openwa')",
      args: [msg.id],
    });
    if (novo.rowsAffected === 0) {
      await tx.rollback();
      return { acao: "duplicado" };
    }
    await tx.execute({
      sql: `INSERT INTO contatos (phone_number, nome) VALUES (?, ?)
            ON CONFLICT (phone_number) DO UPDATE
            SET nome = COALESCE(contatos.nome, excluded.nome), updated_at = CURRENT_TIMESTAMP`,
      args: [telefone, nome],
    });
    await tx.execute({
      sql: "INSERT INTO mensagens_historico (phone_number, role, content) VALUES (?, 'user', ?)",
      args: [telefone, conteudo],
    });
    const { rows } = await tx.execute({
      sql: "SELECT status_relacionamento FROM contatos WHERE phone_number = ?",
      args: [telefone],
    });
    status = rows[0]?.status_relacionamento;
    await tx.commit();
  } catch (erro) {
    if (!tx.closed) await tx.rollback();
    throw erro;
  } finally {
    tx.close();
  }

  if (status === STATUS_PAUSADO) {
    // Transbordo humano: a IA não responde; a mensagem fica só no histórico.
    return { acao: "salvo_pausado" };
  }

  const resposta = await ctx.agente({ db, telefone, chatId: msg.from, mensagem: conteudo });

  // O consultor pode ter assumido a conversa enquanto a IA pensava: confere de novo antes de enviar.
  const agora = await db.execute({
    sql: "SELECT status_relacionamento FROM contatos WHERE phone_number = ?",
    args: [telefone],
  });
  if (agora.rows[0]?.status_relacionamento === STATUS_PAUSADO) return { acao: "salvo_pausado" };

  if (resposta?.texto) {
    await ctx.enviar(msg.from, resposta.texto, { idempotencyKey: `resposta-${msg.id}`.slice(0, 255) });
    await db.execute({
      sql: "INSERT INTO mensagens_historico (phone_number, role, content) VALUES (?, 'assistant', ?)",
      args: [telefone, resposta.texto],
    });
  }
  if (resposta?.diagnosticoFinal) {
    const { id } = await finalizarDiagnostico(ctx, telefone, resposta.diagnosticoFinal);
    return { acao: "aguardando_aprovacao", pendenciaId: id };
  }
  console.info(`[webhook] mensagem de ${mascarar(telefone)} registrada`);
  return { acao: resposta?.texto ? "respondido" : "salvo" };
}
