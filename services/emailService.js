// Envio de e-mail pelo Resend (SDK oficial).
// O Resend devolve { data: { id }, error } em vez de lançar exceção: aqui a falha vira exceção.
// "Sucesso" significa que o Resend ACEITOU o e-mail; a entrega na caixa do cliente é posterior.

import { Resend } from "resend";

let cliente = null;

function resend() {
  const chave = process.env.RESEND_API_KEY;
  if (!chave) throw new Error("RESEND_API_KEY não configurada.");
  if (!cliente) cliente = new Resend(chave);
  return cliente;
}

export class FalhaEmail extends Error {}

/**
 * @param {{ para: string, assunto: string, html: string, texto?: string, idempotencyKey?: string }} email
 * @returns {Promise<{ id: string }>}
 */
export async function enviarEmail({ para, assunto, html, texto, idempotencyKey }) {
  const remetente = process.env.RESEND_FROM_EMAIL;
  if (!remetente) throw new Error("RESEND_FROM_EMAIL não configurado.");

  const { data, error } = await resend().emails.send(
    { from: remetente, to: [para], subject: assunto, html, ...(texto ? { text: texto } : {}) },
    idempotencyKey ? { idempotencyKey } : {},
  );
  if (error || !data?.id) {
    // Mensagem do Resend (ex.: domínio não verificado); nunca o conteúdo do e-mail.
    throw new FalhaEmail(`Resend recusou o envio${error?.statusCode ? ` (HTTP ${error.statusCode})` : ""}: ${error?.message ?? "sem detalhe"}`);
  }
  return { id: data.id };
}
