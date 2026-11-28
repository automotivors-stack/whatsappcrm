// Modo piloto: enquanto o bot roda num chip de teste, a IA só atende quem chegou pelo site
// (mensagem com a frase do formulário ou do botão do WhatsApp) ou um número da lista de teste.
// Desligado por padrão: sem PILOTO_ATIVO=true, o CRM se comporta como sempre.

import { digitos, mesmoTelefone } from "./telefone.js";

export const GATILHO_PADRAO = "quero um diagnostico";

/** Minúsculas, sem acento e com espaços simples, para comparar textos. */
export function normalizarTexto(valor) {
  return String(valor ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Lê a configuração do piloto do ambiente. */
export function configPiloto(env = process.env) {
  return {
    ativo: String(env.PILOTO_ATIVO ?? "").trim().toLowerCase() === "true",
    numerosTeste: String(env.PILOTO_NUMEROS_TESTE ?? "")
      .split(",")
      .map((n) => digitos(n))
      .filter(Boolean),
    gatilho: normalizarTexto(env.PILOTO_GATILHO) || GATILHO_PADRAO,
  };
}

/** Primeira mensagem de um contato novo: entra no piloto? */
export function admitidoNoPiloto(piloto, telefone, texto) {
  if (!piloto?.ativo) return true;
  if ((piloto.numerosTeste ?? []).some((n) => mesmoTelefone(n, telefone))) return true;
  return normalizarTexto(texto).includes(piloto.gatilho || GATILHO_PADRAO);
}
