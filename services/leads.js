// Leitura e atualização dos cards do Kanban (tabela `oportunidades`).
// As regras ficam aqui, no servidor: a tela só repete as mesmas checagens para dar retorno rápido.

import { NOMES_FASES, exigeFornecedor } from "../lib/kanban.js";
import { FORNECEDORES } from "../lib/custosParceiros.js";
import { ErroPrecificacao, montarPrecificacao } from "../lib/precificacao.js";

export class ErroLeads extends Error {
  constructor(mensagem, status = 422) {
    super(mensagem);
    this.status = status;
  }
}

export const FILTRO_SEM_PARCEIRO = "sem_parceiro";
const CAMPOS_EDITAVEIS = ["status_kanban", "fornecedor_operacao", "dados_precificacao", "volume_real_mes", "med_real_mes"];

function paraObjeto(linha) {
  const lead = { ...linha };
  lead.id = Number(lead.id);
  lead.saque_terceiros = lead.saque_terceiros === null ? null : Boolean(Number(lead.saque_terceiros));
  try {
    lead.dados_precificacao = lead.dados_precificacao ? JSON.parse(lead.dados_precificacao) : null;
  } catch {
    lead.dados_precificacao = null;
  }
  return lead;
}

/** Lista os cards. Filtros opcionais: status (uma das 7 fases) e fornecedor (ou "sem_parceiro"). */
export async function listarLeads(db, { status, fornecedor } = {}) {
  const where = [];
  const args = [];
  if (status) {
    if (!NOMES_FASES.includes(status)) throw new ErroLeads("Fase inválida.", 400);
    where.push("status_kanban = ?");
    args.push(status);
  }
  if (fornecedor && fornecedor !== "todos") {
    if (fornecedor === FILTRO_SEM_PARCEIRO) {
      where.push("fornecedor_operacao IS NULL");
    } else if (FORNECEDORES.includes(fornecedor)) {
      where.push("fornecedor_operacao = ?");
      args.push(fornecedor);
    } else {
      throw new ErroLeads("Fornecedor inválido.", 400);
    }
  }
  const { rows } = await db.execute({
    sql: `SELECT * FROM oportunidades ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY created_at DESC, id DESC`,
    args,
  });
  return rows.map(paraObjeto);
}

/** Um card com a linha do tempo de interações (mais recentes primeiro). */
export async function obterLead(db, id) {
  const { rows } = await db.execute({ sql: "SELECT * FROM oportunidades WHERE id = ?", args: [id] });
  if (!rows.length) throw new ErroLeads("Lead não encontrado.", 404);
  const interacoes = await db.execute({
    sql: `SELECT id, tipo, destinatario, assunto, mensagem, status_envio, created_at
          FROM interacoes_cliente WHERE oportunidade_id = ? ORDER BY created_at DESC, id DESC`,
    args: [id],
  });
  return { lead: paraObjeto(rows[0]), interacoes: interacoes.rows.map((r) => ({ ...r })) };
}

function numeroNaoNegativo(valor, rotulo) {
  if (typeof valor !== "number" || !Number.isFinite(valor) || valor < 0) {
    throw new ErroLeads(`${rotulo} precisa ser um número maior ou igual a zero.`);
  }
  return valor;
}

/**
 * PATCH de um card. Aceita só: status_kanban, fornecedor_operacao, dados_precificacao,
 * volume_real_mes, med_real_mes.
 * Regras: "Aprovado" e fases seguintes exigem fornecedor; trocar o fornecedor descarta a
 * precificação anterior (ela foi feita sobre outra tabela de custo).
 */
export async function atualizarLead(db, entrada) {
  if (!entrada || typeof entrada !== "object") throw new ErroLeads("Corpo inválido.", 400);
  const id = Number(entrada.id);
  if (!Number.isInteger(id) || id <= 0) throw new ErroLeads("Informe o id do lead.", 400);

  const desconhecidos = Object.keys(entrada).filter((k) => k !== "id" && !CAMPOS_EDITAVEIS.includes(k));
  if (desconhecidos.length) throw new ErroLeads(`Campo não editável: ${desconhecidos.join(", ")}.`, 400);
  const tem = (campo) => Object.hasOwn(entrada, campo);
  if (!CAMPOS_EDITAVEIS.some(tem)) throw new ErroLeads("Nada para atualizar.", 400);

  const tx = await db.transaction("write");
  try {
    const { rows } = await tx.execute({
      sql: "SELECT status_kanban, fornecedor_operacao, dados_precificacao FROM oportunidades WHERE id = ?",
      args: [id],
    });
    if (!rows.length) throw new ErroLeads("Lead não encontrado.", 404);
    const atual = rows[0];

    const status = tem("status_kanban") ? entrada.status_kanban : atual.status_kanban;
    if (!NOMES_FASES.includes(status)) throw new ErroLeads("Fase inválida.", 400);

    const fornecedor = tem("fornecedor_operacao") ? entrada.fornecedor_operacao || null : atual.fornecedor_operacao;
    if (fornecedor !== null && !FORNECEDORES.includes(fornecedor)) {
      throw new ErroLeads(`Fornecedor inválido. Use ${FORNECEDORES.join(" ou ")}.`, 400);
    }
    if (exigeFornecedor(status) && !fornecedor) {
      throw new ErroLeads(`Para mover para "${status}", selecione o fornecedor (${FORNECEDORES.join(" ou ")}).`);
    }

    let precificacao = atual.dados_precificacao;
    if (tem("dados_precificacao")) {
      precificacao = entrada.dados_precificacao === null
        ? null
        : JSON.stringify(montarPrecificacao(fornecedor, entrada.dados_precificacao));
    } else if (fornecedor !== atual.fornecedor_operacao) {
      precificacao = null;
    }

    const sets = ["status_kanban = ?", "fornecedor_operacao = ?", "dados_precificacao = ?"];
    const args = [status, fornecedor, precificacao];
    if (tem("volume_real_mes")) {
      sets.push("volume_real_mes = ?");
      args.push(numeroNaoNegativo(entrada.volume_real_mes, "Volume real do mês"));
    }
    if (tem("med_real_mes")) {
      sets.push("med_real_mes = ?");
      args.push(numeroNaoNegativo(entrada.med_real_mes, "MED real do mês"));
    }
    await tx.execute({ sql: `UPDATE oportunidades SET ${sets.join(", ")} WHERE id = ?`, args: [...args, id] });
    const final = await tx.execute({ sql: "SELECT * FROM oportunidades WHERE id = ?", args: [id] });
    await tx.commit();
    return paraObjeto(final.rows[0]);
  } catch (erro) {
    if (!tx.closed) await tx.rollback();
    if (erro instanceof ErroPrecificacao) throw new ErroLeads(erro.message);
    throw erro;
  } finally {
    tx.close();
  }
}
