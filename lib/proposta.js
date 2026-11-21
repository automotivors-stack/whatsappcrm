// Atalho de proposta: monta o texto a partir da precificação SALVA do lead.
// Só entram as taxas NEGOCIADAS com o cliente. Custo base e spread são internos e nunca
// aparecem aqui (há teste garantindo isso).

import { tabelaDe } from "./custosParceiros.js";
import { dinheiro, percentual } from "./formato.js";

function taxaCobrada(custo, cobrado) {
  const partes = [];
  if (cobrado.percentual) partes.push(custo.unidade === "% a.m." ? `${percentual(cobrado.percentual)} a.m.` : percentual(cobrado.percentual));
  if (cobrado.fixo) partes.push(dinheiro(cobrado.fixo, custo.moeda));
  if (!partes.length) partes.push(custo.moeda === "USD" ? "US$ 0,00" : "R$ 0,00");
  const unidade = custo.unidade === "por cartão" ? " por cartão" : "";
  return partes.join(" + ") + unidade;
}

/** Itens negociados, agrupados como na mesa: [[grupo, [{ produto, taxa }]]]. */
export function itensDaProposta(lead) {
  const p = lead?.dados_precificacao;
  if (!p || !lead.fornecedor_operacao || p.fornecedor !== lead.fornecedor_operacao) return [];
  const grupos = new Map();
  for (const custo of tabelaDe(lead.fornecedor_operacao) ?? []) {
    const cobrado = p.itens?.[custo.id];
    if (!cobrado || (cobrado.percentual == null && cobrado.fixo == null)) continue;
    if (!grupos.has(custo.grupo)) grupos.set(custo.grupo, []);
    grupos.get(custo.grupo).push({ produto: custo.produto, taxa: taxaCobrada(custo, cobrado) });
  }
  return [...grupos.entries()];
}

function saudacao(lead) {
  const nome = String(lead.nome_ou_razao_social ?? "").trim();
  return nome ? `Olá, ${nome}!` : "Olá!";
}

/**
 * @param {"whatsapp"|"email"} canal  no WhatsApp, títulos em *negrito*
 * @returns {null | { assunto: string, texto: string }}  null quando não há precificação salva
 */
export function montarProposta(lead, canal) {
  const grupos = itensDaProposta(lead);
  if (!grupos.length) return null;
  const negrito = (t) => (canal === "whatsapp" ? `*${t}*` : t);
  const linhas = [
    saudacao(lead),
    "",
    `Segue a proposta de condições para a sua operação com a ${lead.fornecedor_operacao}:`,
  ];
  for (const [grupo, itens] of grupos) {
    linhas.push("", negrito(grupo));
    for (const { produto, taxa } of itens) {
      linhas.push(produto === grupo ? `• ${taxa}` : `• ${produto}: ${taxa}`);
    }
  }
  linhas.push("", "Fico à disposição para tirar dúvidas e seguir com a contratação.");
  return {
    assunto: `Proposta de condições ${lead.fornecedor_operacao}${lead.nome_ou_razao_social ? ` · ${lead.nome_ou_razao_social}` : ""}`,
    texto: linhas.join("\n"),
  };
}

const ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

/** Texto digitado → HTML seguro (escapado), com parágrafos e quebras de linha. */
export function textoParaHtml(texto) {
  const escapado = String(texto ?? "").replace(/[&<>"']/g, (c) => ESCAPES[c]);
  const paragrafos = escapado.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const corpo = paragrafos.map((p) => `<p style="margin:0 0 12px">${p.replace(/\n/g, "<br>")}</p>`).join("\n");
  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#1f2933">\n${corpo}\n</div>`;
}

/** HTML → texto para exibir na linha do tempo (o React escapa; aqui só tiramos as tags). */
export function htmlParaTexto(html) {
  return String(html ?? "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
