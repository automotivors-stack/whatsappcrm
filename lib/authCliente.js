"use client";

// Cliente do login no navegador (Better Auth). Mensagens de erro traduzidas para o cliente.
import { createAuthClient } from "better-auth/react";

export const authCliente = createAuthClient();

const MENSAGENS = {
  USER_ALREADY_EXISTS: "Já existe uma conta com este e-mail. Use “Entrar”.",
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: "Já existe uma conta com este e-mail. Use “Entrar”.",
  INVALID_EMAIL_OR_PASSWORD: "E-mail ou senha incorretos.",
  INVALID_EMAIL: "Informe um e-mail válido.",
  PASSWORD_TOO_SHORT: "A senha precisa de pelo menos 8 caracteres.",
  PASSWORD_TOO_LONG: "A senha pode ter até 128 caracteres.",
  ACCOUNT_NOT_LINKED: "Este e-mail já tem cadastro com senha. Entre com e-mail e senha.",
};

/** Texto em português para o erro devolvido pelo Better Auth. */
export function mensagemDeErro(erro) {
  if (!erro) return "Não foi possível concluir. Tente de novo.";
  if (erro.status === 429) return "Muitas tentativas seguidas. Espere um minuto e tente de novo.";
  if (erro.code && MENSAGENS[erro.code]) return MENSAGENS[erro.code];
  // Mensagens das nossas validações (lib/cadastroCliente.js) já vêm em português.
  if (erro.status === 400 && erro.message && /[ãçéêíóú]|Informe|senha|nome|empresa|telefone/i.test(erro.message)) return erro.message;
  return "Não foi possível concluir. Tente de novo.";
}
