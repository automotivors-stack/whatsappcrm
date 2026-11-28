// Validação do cadastro da área do cliente. A mesma função roda no navegador (mensagens na hora)
// e no servidor (lib/auth.js), que é quem vale.

import { normalizarTelefoneBR } from "./telefone.js";

export const LIMITES = { nome: 120, empresa: 120, email: 254, senhaMin: 8, senhaMax: 128 };

const umaLinha = (v) => String(v ?? "").replace(/[\u0000-\u001f\u007f<>]/g, " ").replace(/\s+/g, " ").trim();

/**
 * @param {{ nome?, email?, telefone?, empresa?, senha?, confirmacao? }} entrada
 * @param {{ exigirSenha?: boolean, exigirEmail?: boolean }} [opcoes]
 * @returns {{ dados: { nome, email, telefone, empresa } } | { erros: Record<string, string> }}
 */
export function validarCadastro(entrada, { exigirSenha = true, exigirEmail = true } = {}) {
  const erros = {};
  const nome = umaLinha(entrada.nome ?? entrada.name);
  const empresa = umaLinha(entrada.empresa);
  const email = umaLinha(entrada.email).toLowerCase();
  const telefone = normalizarTelefoneBR(entrada.telefone);

  if (nome.length < 2) erros.nome = "Informe seu nome.";
  else if (nome.length > LIMITES.nome) erros.nome = `Nome com até ${LIMITES.nome} caracteres.`;

  if (exigirEmail) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > LIMITES.email) erros.email = "Informe um e-mail válido.";
  }

  if (!telefone) erros.telefone = "Informe um telefone com DDD, ex.: (11) 99999-9999.";

  if (empresa.length < 2) erros.empresa = "Informe o nome da empresa.";
  else if (empresa.length > LIMITES.empresa) erros.empresa = `Nome da empresa com até ${LIMITES.empresa} caracteres.`;

  if (exigirSenha) {
    const senha = String(entrada.senha ?? "");
    if (senha.length < LIMITES.senhaMin) erros.senha = `A senha precisa de pelo menos ${LIMITES.senhaMin} caracteres.`;
    else if (senha.length > LIMITES.senhaMax) erros.senha = `A senha pode ter até ${LIMITES.senhaMax} caracteres.`;
    if (String(entrada.confirmacao ?? "") !== senha) erros.confirmacao = "As senhas não são iguais.";
  }

  return Object.keys(erros).length ? { erros } : { dados: { nome, email, telefone, empresa } };
}
