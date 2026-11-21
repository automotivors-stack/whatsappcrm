// Leitura e atualização dos cards do Kanban (tabela `oportunidades`).
// As regras ficam aqui, no servidor: a tela só repete as mesmas checagens para dar retorno rápido.

import { NOMES_FASES, exigeFornecedor } from "../lib/kanban.js";
import { FORNECEDORES } from "../lib/custosParceiros.js";
import { ErroPrecificacao, montarPrecificacao } from "../lib/precificacao.js";

export class ErroLeads extends Error {
  constructor(mensagem, status = 400) {
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

/** Lista os cards (mais recentes primeiro). Filtros opcionais, todos parametrizados:
 *  status (uma das 7 fases), fornecedor ("Pushin Pay", "Kluubpay" ou "sem_parceiro") e
 *  busca (nome/razão social ou documento; com ou sem pontuação no documento). */
export async function listarLeads(db, { status, fornecedor, busca } = {}) {
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
  const termo = String(busca ?? "").trim();
  if (termo) {
    if (termo.length > TAMANHO_MAXIMO_BUSCA) throw new ErroLeads("Busca muito longa.", 400);
    const padrao = `%${escaparLike(termo)}%`;
    const condicoes = ["nome_ou_razao_social LIKE ? ESCAPE '\\'", "documento LIKE ? ESCAPE '\\'"];
    args.push(padrao, padrao);
    const digitos = termo.replace(/\D/g, "");
    // Só quando o termo parece documento (dígitos e . - /): "100%" não vira busca por dígitos.
    if (/^[\d.\-/\s]+$/.test(termo) && digitos.length >= 3) {
      // "12345678" encontra "12.345.678/0001-90"
      condicoes.push("REPLACE(REPLACE(REPLACE(documento, '.', ''), '/', ''), '-', '') LIKE ?");
      args.push(`%${digitos}%`);
    }
    where.push(`(${condicoes.join(" OR ")})`);
  }
  const { rows } = await db.execute({
    sql: `SELECT * FROM oportunidades ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY created_at DESC, id DESC`,
    args,
  });
  return rows.map(paraObjeto);
}

const TAMANHO_MAXIMO_BUSCA = 100;
const LIMITE_MENSAGENS_DOSSIE = 300;

function escaparLike(texto) {
  return texto.replace(/[\\%_]/g, (c) => `\\${c}`);
}

export function validarId(valor) {
  const id = Number(valor);
  if (!Number.isInteger(id) || id <= 0 || String(valor).trim() !== String(id)) {
    throw new ErroLeads("Id inválido.", 400);
  }
  return id;
}

async function exigirOportunidade(db, id) {
  const { rows } = await db.execute({ sql: "SELECT * FROM oportunidades WHERE id = ?", args: [id] });
  if (!rows.length) throw new ErroLeads("Oportunidade não encontrada", 404);
  return paraObjeto(rows[0]);
}

/** Interações da oportunidade, mais recentes primeiro. */
export async function listarInteracoes(db, id) {
  await exigirOportunidade(db, id);
  return consultarInteracoes(db, id);
}

async function consultarInteracoes(db, id) {
  const { rows } = await db.execute({
    sql: `SELECT id, oportunidade_id, tipo, destinatario, assunto, mensagem, status_envio, created_at
          FROM interacoes_cliente WHERE oportunidade_id = ? ORDER BY created_at DESC, id DESC`,
    args: [id],
  });
  return rows.map((r) => ({ ...r, id: Number(r.id), oportunidade_id: Number(r.oportunidade_id) }));
}

/**
 * Dossiê 360°: a oportunidade, a conversa com a IA no WhatsApp (ordem cronológica, últimas
 * LIMITE_MENSAGENS_DOSSIE) e a linha do tempo de interações (mais recentes primeiro).
 */
export async function obterDossie(db, id) {
  const lead = await exigirOportunidade(db, id);
  const [mensagens, interacoes] = await Promise.all([
    lead.phone_number
      ? db.execute({
          sql: `SELECT id, role, content, created_at FROM (
                  SELECT id, role, content, created_at FROM mensagens_historico
                  WHERE phone_number = ? ORDER BY created_at DESC, id DESC LIMIT ?
                ) ORDER BY created_at ASC, id ASC`,
          args: [lead.phone_number, LIMITE_MENSAGENS_DOSSIE],
        }).then((r) => r.rows.map((m) => ({ ...m, id: Number(m.id) })))
      : Promise.resolve([]),
    consultarInteracoes(db, id),
  ]);
  return { lead, mensagens, interacoes };
}

const LIMITES_INTERACAO = { tipo: 50, destinatario: 200, assunto: 200, mensagem: 10000, status_envio: 30 };

/** Registra uma interação (manual ou automática). Só grava: não envia mensagem nem e-mail. */
export async function criarInteracao(db, id, entrada) {
  if (!entrada || typeof entrada !== "object") throw new ErroLeads("Corpo inválido.", 400);
  if (entrada.oportunidade_id !== undefined && Number(entrada.oportunidade_id) !== id) {
    throw new ErroLeads("oportunidade_id do corpo diferente do da URL.", 400);
  }
  const desconhecidos = Object.keys(entrada).filter((k) => k !== "oportunidade_id" && !(k in LIMITES_INTERACAO));
  if (desconhecidos.length) throw new ErroLeads(`Campo não aceito: ${desconhecidos.join(", ")}.`, 400);

  const valores = {};
  for (const [campo, limite] of Object.entries(LIMITES_INTERACAO)) {
    const v = entrada[campo];
    if (v === undefined || v === null || v === "") continue;
    if (typeof v !== "string") throw new ErroLeads(`"${campo}" precisa ser texto.`, 400);
    if (v.length > limite) throw new ErroLeads(`"${campo}" passa de ${limite} caracteres.`, 400);
    valores[campo] = v.trim();
  }
  if (!valores.tipo) throw new ErroLeads('Informe o "tipo" da interação (ex.: whatsapp, email, ligacao, nota).', 400);
  if (!valores.assunto && !valores.mensagem) throw new ErroLeads('Informe "assunto" ou "mensagem".', 400);

  await exigirOportunidade(db, id);
  const { rows } = await db.execute({
    sql: `INSERT INTO interacoes_cliente (oportunidade_id, tipo, destinatario, assunto, mensagem, status_envio)
          VALUES (?, ?, ?, ?, ?, COALESCE(?, 'sucesso'))
          RETURNING id, oportunidade_id, tipo, destinatario, assunto, mensagem, status_envio, created_at`,
    args: [id, valores.tipo, valores.destinatario ?? null, valores.assunto ?? null, valores.mensagem ?? null, valores.status_envio ?? null],
  });
  return { ...rows[0], id: Number(rows[0].id), oportunidade_id: Number(rows[0].oportunidade_id) };
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
    if (!rows.length) throw new ErroLeads("Oportunidade não encontrada", 404);
    const atual = rows[0];

    const status = tem("status_kanban") ? entrada.status_kanban : atual.status_kanban;
    if (!NOMES_FASES.includes(status)) throw new ErroLeads("Fase inválida.", 400);

    const fornecedor = tem("fornecedor_operacao") ? entrada.fornecedor_operacao || null : atual.fornecedor_operacao;
    if (fornecedor !== null && !FORNECEDORES.includes(fornecedor)) {
      throw new ErroLeads(`Fornecedor inválido. Use ${FORNECEDORES.join(" ou ")}.`, 400);
    }
    if (exigeFornecedor(status) && !fornecedor) {
      throw new ErroLeads(`Para mover para "${status}", selecione o fornecedor (${FORNECEDORES.join(" ou ")}).`, 400);
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
    if (erro instanceof ErroPrecificacao) throw new ErroLeads(erro.message, 400);
    throw erro;
  } finally {
    tx.close();
  }
}
