// Disparos ativos do consultor a partir da Ficha 360°: WhatsApp (OpenWA) e e-mail (Resend).
// Cada tentativa fica na linha do tempo (interacoes_cliente): status_envio 'sucesso' ou 'falha'.

import { chatIdDoTelefone, mascarar, mesmoTelefone, normalizarTelefoneBR } from "../lib/telefone.js";
import { htmlParaTexto } from "../lib/proposta.js";
import { ErroLeads, validarId } from "./leads.js";

export const TIPO_WHATSAPP = "whatsapp_enviado";
export const TIPO_EMAIL = "email_enviado";

const LIMITE_WHATSAPP = 4096; // limite do OpenWA
const LIMITE_ASSUNTO = 200;
const LIMITE_HTML = 200_000;
const LIMITE_TEXTO = 100_000;
const EMAIL_VALIDO = /^[^\s@<>,;"()]+@[^\s@<>,;"()]+\.[^\s@<>,;"()]{2,}$/;

function exigirObjeto(entrada) {
  if (!entrada || typeof entrada !== "object" || Array.isArray(entrada)) throw new ErroLeads("Corpo inválido.", 400);
}

function textoObrigatorio(valor, rotulo, limite) {
  if (typeof valor !== "string" || !valor.trim()) throw new ErroLeads(`Informe ${rotulo}.`, 400);
  if (valor.length > limite) throw new ErroLeads(`${rotulo[0].toUpperCase()}${rotulo.slice(1)} passa de ${limite} caracteres.`, 400);
  return valor.trim();
}

/** Chave que o navegador gera por rascunho: o mesmo envio repetido não sai duas vezes. */
function chaveIdempotencia(valor) {
  if (valor === undefined || valor === null || valor === "") return undefined;
  if (typeof valor !== "string" || !/^[\x21-\x7e]{1,200}$/.test(valor)) {
    throw new ErroLeads("idempotencyKey inválida.", 400);
  }
  return valor;
}

export const STATUS_INCERTO = "incerto";
const AVISO_INCERTO = "confira a conversa antes de reenviar.";

/**
 * "falha": com certeza não saiu. "incerto": pode ter saído (tempo esgotado ou o gateway avisou
 * que o resultado é desconhecido): o consultor confere antes de reenviar.
 */
export function classificarFalhaWhatsApp(e) {
  if (e?.name === "TimeoutError" || e?.code === "IDEMPOTENCY_OUTCOME_UNKNOWN" || e?.code === "IDEMPOTENCY_KEY_IN_PROGRESS") {
    return { status: STATUS_INCERTO, texto: `Não dá para saber se o WhatsApp saiu: ${AVISO_INCERTO}` };
  }
  if (e?.code === "SEND_PACING_LIMITED") {
    const espera = e.retryAfterSeconds ? `${e.retryAfterSeconds} segundos` : "alguns instantes";
    return { status: "falha", texto: `O WhatsApp não foi enviado: limite de ritmo de envios. Tente de novo em ${espera}.` };
  }
  return { status: "falha", texto: `O WhatsApp não foi enviado. ${e?.message ?? ""}`.trim() };
}

export function classificarFalhaEmail(e) {
  if (e?.name === "TimeoutError" || e?.nome === "concurrent_idempotent_requests") {
    return { status: STATUS_INCERTO, texto: `Não dá para saber se o e-mail saiu: ${AVISO_INCERTO}` };
  }
  return { status: "falha", texto: `O e-mail não foi enviado. ${e?.message ?? ""}`.trim() };
}

async function carregarOportunidade(db, id) {
  const { rows } = await db.execute({
    sql: "SELECT id, phone_number, whatsapp_contato, email_contato FROM oportunidades WHERE id = ?",
    args: [id],
  });
  if (!rows.length) throw new ErroLeads("Oportunidade não encontrada", 404);
  return rows[0];
}

async function registrar(db, { oportunidadeId, tipo, destinatario, assunto = null, mensagem, status }) {
  const { rows } = await db.execute({
    sql: `INSERT INTO interacoes_cliente (oportunidade_id, tipo, destinatario, assunto, mensagem, status_envio)
          VALUES (?, ?, ?, ?, ?, ?)
          RETURNING id, oportunidade_id, tipo, destinatario, assunto, mensagem, status_envio, created_at`,
    args: [oportunidadeId, tipo, destinatario, assunto, mensagem, status],
  });
  return { ...rows[0], id: Number(rows[0].id), oportunidade_id: Number(rows[0].oportunidade_id) };
}

/** Envio feito, registro falhou: avisa para o consultor NÃO reenviar. */
export const PAPEL_CONSULTOR = "consultor";

async function registrarSucesso(db, dados, canal, { historico = null } = {}) {
  try {
    const interacao = await registrar(db, { ...dados, status: "sucesso" });
    if (historico) {
      await db.execute({
        sql: "INSERT INTO mensagens_historico (phone_number, role, content) VALUES (?, ?, ?)",
        args: [historico, PAPEL_CONSULTOR, dados.mensagem],
      });
    }
    return interacao;
  } catch (e) {
    console.error(`[comunicacao] ${canal} enviado, mas o registro falhou: ${e?.message ?? e}`);
    throw new ErroLeads(`${canal} enviado, mas não foi registrado na linha do tempo. Não reenvie; avise o suporte.`, 500);
  }
}

/**
 * @param {{ db, enviar: typeof import("./whatsappService.js").enviarMensagemWhatsApp }} ctx
 * @param {{ oportunidadeId, telefone?, mensagem, idempotencyKey? }} entrada
 *   telefone opcional: sem ele, usa o WhatsApp do diagnóstico (ou o número que conversou com o bot).
 */
export async function dispararWhatsApp(ctx, entrada) {
  exigirObjeto(entrada);
  const oportunidadeId = validarId(entrada.oportunidadeId);
  const mensagem = textoObrigatorio(entrada.mensagem, "a mensagem", LIMITE_WHATSAPP);
  const chave = chaveIdempotencia(entrada.idempotencyKey);
  const oportunidade = await carregarOportunidade(ctx.db, oportunidadeId);

  const bruto = entrada.telefone ?? oportunidade.whatsapp_contato ?? oportunidade.phone_number;
  const telefone = normalizarTelefoneBR(bruto);
  if (!telefone) throw new ErroLeads("Telefone inválido. Use DDD + número, por exemplo (21) 98888-7777.", 400);

  const dados = { oportunidadeId, tipo: TIPO_WHATSAPP, destinatario: telefone, mensagem };
  let resposta;
  try {
    resposta = await ctx.enviar(chatIdDoTelefone(telefone), mensagem, chave ? { idempotencyKey: `wa-${chave}` } : {});
  } catch (e) {
    console.warn(`[comunicacao] WhatsApp para ${mascarar(telefone)} falhou: ${e?.message ?? e}`);
    const { status, texto } = classificarFalhaWhatsApp(e);
    const interacao = await registrar(ctx.db, { ...dados, status });
    throw new ErroLeads(texto, 502, { interacao });
  }
  const interacao = await registrarSucesso(ctx.db, dados, "WhatsApp", {
    // Mesmo chat da conversa com o bot: a IA passa a ver o que o consultor combinou.
    historico: mesmoTelefone(telefone, oportunidade.phone_number) ? oportunidade.phone_number : null,
  });
  return { success: true, messageId: resposta?.messageId ?? null, interacao };
}

/**
 * @param {{ db, enviarEmail: typeof import("./emailService.js").enviarEmail }} ctx
 * @param {{ oportunidadeId, email?, assunto, corpoHtml, corpoTexto?, idempotencyKey? }} entrada
 *   email opcional: sem ele, usa o e-mail do diagnóstico.
 */
export async function dispararEmail(ctx, entrada) {
  exigirObjeto(entrada);
  const oportunidadeId = validarId(entrada.oportunidadeId);
  // Assunto em uma linha só (quebra de linha em cabeçalho de e-mail é vetor de injeção).
  const assunto = textoObrigatorio(entrada.assunto, "o assunto", LIMITE_ASSUNTO).replace(/[\r\n]+/g, " ");
  const corpoHtml = textoObrigatorio(entrada.corpoHtml, "o corpo do e-mail", LIMITE_HTML);
  const corpoTexto = entrada.corpoTexto == null
    ? htmlParaTexto(corpoHtml)
    : textoObrigatorio(entrada.corpoTexto, "o texto do e-mail", LIMITE_TEXTO);
  const chave = chaveIdempotencia(entrada.idempotencyKey);
  const oportunidade = await carregarOportunidade(ctx.db, oportunidadeId);

  const email = String(entrada.email ?? oportunidade.email_contato ?? "").trim();
  if (!email || email.length > 254 || !EMAIL_VALIDO.test(email)) {
    throw new ErroLeads("E-mail do destinatário inválido.", 400);
  }

  const dados = { oportunidadeId, tipo: TIPO_EMAIL, destinatario: email, assunto, mensagem: corpoHtml };
  let resposta;
  try {
    resposta = await ctx.enviarEmail({
      para: email, assunto, html: corpoHtml, texto: corpoTexto,
      idempotencyKey: chave ? `email-${chave}` : undefined,
    });
  } catch (e) {
    console.warn(`[comunicacao] e-mail falhou: ${e?.message ?? e}`);
    const { status, texto } = classificarFalhaEmail(e);
    const interacao = await registrar(ctx.db, { ...dados, status });
    throw new ErroLeads(texto, 502, { interacao });
  }
  const interacao = await registrarSucesso(ctx.db, dados, "E-mail");
  return { success: true, emailId: resposta?.id ?? null, interacao };
}
