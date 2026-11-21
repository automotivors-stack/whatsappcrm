// Formulário de diagnóstico da landing (components/landing/FormularioDiagnostico.jsx).
// Nada é gravado no site: as respostas viram a mensagem que a própria pessoa envia pelo WhatsApp.
// As opções são texto de interface (provisório, aprovado pelo time na prévia); troque aqui.

import { linkWhatsApp } from "./contato.js";

export const PRIORIDADES = [
  "Organizar os contatos que chegam pelo WhatsApp",
  "Dar previsibilidade às vendas",
  "Ter visão clara da operação comercial",
];

export const GARGALOS = [
  "Pipeline imprevisível / perfil de cliente difuso",
  "Time comercial travado / meta oscilando",
  "Escalar sem aumentar a equipe",
];

export const LIMITE_CAMPO = 80;

/** Limpa o que a pessoa digitou: uma linha só, sem espaços sobrando, no máximo LIMITE_CAMPO caracteres. */
export function limparCampo(valor) {
  return String(valor ?? "")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim()
    .slice(0, LIMITE_CAMPO);
}

/** Confere as respostas. Devolve { erros } (por campo) ou { dados } limpos. Só o nome é obrigatório. */
export function validarDiagnostico({ nome, empresa, prioridade, gargalo }) {
  const dados = {
    nome: limparCampo(nome),
    empresa: limparCampo(empresa),
    prioridade: PRIORIDADES.includes(prioridade) ? prioridade : "",
    gargalo: GARGALOS.includes(gargalo) ? gargalo : "",
  };
  const erros = {};
  if (dados.nome.length < 2) erros.nome = "Escreva seu nome para o especialista saber com quem fala.";
  return Object.keys(erros).length ? { erros } : { dados };
}

/** O texto que vai para o WhatsApp. */
export function mensagemDiagnostico({ nome, empresa, prioridade, gargalo }) {
  const linhas = ["Olá! Quero um diagnóstico do meu departamento comercial.", "", `Nome: ${nome}`];
  if (empresa) linhas.push(`Empresa: ${empresa}`);
  linhas.push(`Prioridade: ${prioridade || "não selecionada"}`);
  linhas.push(`Principal gargalo hoje: ${gargalo || "não selecionado"}`);
  return linhas.join("\n");
}

export const linkDiagnostico = (dados) => linkWhatsApp(mensagemDiagnostico(dados));
