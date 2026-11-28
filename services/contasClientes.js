// Contas da área do cliente: o consultor libera ou recusa e vincula a conta ao card do cliente.
// O cliente só vê dados do card vinculado, e só o que pode ver (regra 5, sigilo comercial):
// fase em linguagem de cliente e as mensagens que já recebeu. Nunca custo, spread, margem,
// precificação, fornecedor ou o dossiê da IA.

import { FASES } from "../lib/kanban.js";
import { htmlParaTexto } from "../lib/proposta.js";
import { chatIdDoTelefone, mascarar } from "../lib/telefone.js";
import { ErroLeads, validarId } from "./leads.js";

/** Fase do Kanban → texto para o cliente (mesma ordem de FASES). */
export const FASES_CLIENTE = {
  "Contato Recebido": "Diagnóstico recebido",
  Interessado: "Em conversa com o consultor",
  "Avançado": "Proposta em análise",
  "Conta em Análise": "Conta em análise (documentação)",
  Aprovado: "Conta aprovada",
  Operando: "Operação iniciada",
  "Operando dentro das expectativas": "Operação em andamento",
};

const COLUNAS_CONTA = `id, name AS nome, email, telefone, empresa, status_acesso, oportunidade_id, "createdAt" AS criado_em, decidido_em`;

function paraConta(r) {
  return {
    id: String(r.id), nome: r.nome, email: r.email, telefone: r.telefone, empresa: r.empresa,
    status_acesso: r.status_acesso, oportunidade_id: r.oportunidade_id == null ? null : Number(r.oportunidade_id),
    criado_em: r.criado_em, decidido_em: r.decidido_em,
  };
}

/** Contas para o painel: pendentes primeiro, depois as últimas decididas. */
export async function listarContas(db) {
  const { rows } = await db.execute(
    `SELECT ${COLUNAS_CONTA} FROM cliente_usuarios
     ORDER BY CASE status_acesso WHEN 'pendente' THEN 0 ELSE 1 END, "createdAt" DESC LIMIT 200`,
  );
  return rows.map(paraConta);
}

/**
 * @param {{ decisao: "liberar"|"recusar", oportunidadeId?: number|null }} entrada
 *   oportunidadeId opcional: sem card, o cliente vê só a conta liberada e o aviso de que o andamento aparece depois.
 */
export async function decidirConta(db, id, entrada) {
  if (!entrada || typeof entrada !== "object") throw new ErroLeads("Corpo inválido.", 400);
  const { decisao } = entrada;
  if (decisao !== "liberar" && decisao !== "recusar") throw new ErroLeads('Informe decisao: "liberar" ou "recusar".', 400);
  const contaId = String(id ?? "").trim();
  if (!contaId || contaId.length > 64) throw new ErroLeads("Conta inválida.", 400);

  let oportunidadeId = null;
  if (decisao === "liberar" && entrada.oportunidadeId != null && entrada.oportunidadeId !== "") {
    oportunidadeId = validarId(entrada.oportunidadeId);
    const existe = await db.execute({ sql: "SELECT 1 FROM oportunidades WHERE id = ?", args: [oportunidadeId] });
    if (!existe.rows.length) throw new ErroLeads("Card não encontrado.", 404);
  }

  const r = await db.execute({
    sql: `UPDATE cliente_usuarios SET status_acesso = ?, oportunidade_id = ?, decidido_em = CURRENT_TIMESTAMP,
            "updatedAt" = CURRENT_TIMESTAMP
          WHERE id = ? RETURNING ${COLUNAS_CONTA}`,
    args: [decisao === "liberar" ? "liberado" : "recusado", oportunidadeId, contaId],
  });
  if (!r.rows.length) throw new ErroLeads("Conta não encontrada.", 404);
  if (decisao === "recusar") {
    // Recusada: encerra as sessões abertas.
    await db.execute({ sql: `DELETE FROM cliente_sessoes WHERE "userId" = ?`, args: [contaId] });
  }
  return paraConta(r.rows[0]);
}

/**
 * Tudo o que a área do cliente mostra, já filtrado. Só traz o card com a conta liberada.
 * @returns {Promise<null | { conta, andamento: null | { empresa, fase, etapa, total, etapas }, mensagens }>}
 */
export async function dadosAreaCliente(db, usuarioId) {
  const c = await db.execute({ sql: `SELECT ${COLUNAS_CONTA} FROM cliente_usuarios WHERE id = ?`, args: [String(usuarioId)] });
  if (!c.rows.length) return null;
  const conta = paraConta(c.rows[0]);
  if (conta.status_acesso !== "liberado" || !conta.oportunidade_id) return { conta, andamento: null, mensagens: [] };

  const o = await db.execute({
    sql: "SELECT nome_ou_razao_social, status_kanban FROM oportunidades WHERE id = ?",
    args: [conta.oportunidade_id],
  });
  if (!o.rows.length) return { conta, andamento: null, mensagens: [] };
  const fase = o.rows[0].status_kanban;
  const indice = FASES.findIndex((f) => f.id === fase);
  const andamento = {
    empresa: o.rows[0].nome_ou_razao_social ?? conta.empresa,
    fase: FASES_CLIENTE[fase] ?? "Em andamento",
    etapa: indice + 1,
    total: FASES.length,
    etapas: FASES.map((f) => FASES_CLIENTE[f.id]),
  };

  // Só o que de fato chegou ao cliente (status 'sucesso'). E-mail vira texto puro.
  const m = await db.execute({
    sql: `SELECT id, tipo, assunto, mensagem, created_at FROM interacoes_cliente
          WHERE oportunidade_id = ? AND status_envio = 'sucesso' ORDER BY created_at DESC, id DESC LIMIT 50`,
    args: [conta.oportunidade_id],
  });
  const mensagens = m.rows.map((r) => ({
    id: Number(r.id),
    canal: String(r.tipo).startsWith("email") ? "E-mail" : "WhatsApp",
    assunto: r.assunto ?? null,
    texto: String(r.tipo).startsWith("email") ? htmlParaTexto(String(r.mensagem ?? "")) : String(r.mensagem ?? ""),
    data: r.created_at,
  }));
  return { conta, andamento, mensagens };
}

export function textoAvisoContaNova(usuario) {
  const linha = (v) => String(v ?? "não informado").replace(/\s+/g, " ").trim().slice(0, 120);
  return [
    "🔐 *Nova conta na área do cliente aguardando liberação*",
    `• Nome: ${linha(usuario.name)}`,
    `• Empresa: ${linha(usuario.empresa)}`,
    `• E-mail: ${linha(usuario.email)}`,
    "",
    "Libere ou recuse no painel: Kanban → Contas de clientes.",
  ].join("\n");
}

/** Aviso ao consultor no WhatsApp (melhor esforço: falha só vai para o log). */
export async function avisarContaNova(usuario, { enviar, adminNumero = process.env.ADMIN_WHATSAPP_NUMBER } = {}) {
  if (!adminNumero) return;
  const envio = enviar ?? (await import("./whatsappService.js")).enviarMensagemWhatsApp;
  await envio(chatIdDoTelefone(adminNumero), textoAvisoContaNova(usuario));
  console.info(`[contas] conta nova avisada (${usuario.telefone ? mascarar(usuario.telefone) : "sem telefone"})`);
}
