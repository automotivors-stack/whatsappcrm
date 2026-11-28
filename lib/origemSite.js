// Reconhece a mensagem que o site manda para o WhatsApp (formulário de diagnóstico ou botão
// flutuante) e lê os campos do formulário. Leitura feita pelo servidor, sem depender da IA.
// Formato (content/diagnostico.js → mensagemDiagnostico):
//   Olá! Quero um diagnóstico do meu departamento comercial.
//   Nome: ...  ·  Empresa: ... (opcional)  ·  Prioridade: ...  ·  Principal gargalo hoje: ...

import { GATILHO_PADRAO, normalizarTexto } from "./piloto.js";

export const ORIGEM_SITE = "site";
const LIMITE = 80; // o formulário já corta cada campo em 80 caracteres (LIMITE_CAMPO)
const NAO_SELECIONADO = /^n[aã]o selecionad[ao]$/i;

const ROTULOS = [
  ["nome", /^nome$/],
  ["empresa", /^empresa$/],
  ["prioridade", /^prioridade$/],
  ["gargalo", /^principal gargalo( hoje)?$/],
];

/** Uma linha só, sem marcação do WhatsApp, curta: o texto vem do visitante. */
function limpar(valor) {
  const v = String(valor).replace(/[*_~`<>]/g, "").replace(/\s+/g, " ").trim().slice(0, LIMITE);
  return v && !NAO_SELECIONADO.test(v) ? v : null;
}

/**
 * @returns {null | { origem: "site", formulario: { nome?, empresa?, prioridade?, gargalo? } }}
 *   null quando a mensagem não veio do site.
 */
export function lerMensagemDoSite(texto, gatilho = GATILHO_PADRAO) {
  const bruto = String(texto ?? "");
  if (!normalizarTexto(bruto).includes(gatilho || GATILHO_PADRAO)) return null;
  const formulario = {};
  for (const linha of bruto.split(/\r?\n/)) {
    const i = linha.indexOf(":");
    if (i < 0) continue;
    const rotulo = normalizarTexto(linha.slice(0, i));
    const campo = ROTULOS.find(([, re]) => re.test(rotulo))?.[0];
    if (!campo || formulario[campo]) continue;
    const valor = limpar(linha.slice(i + 1));
    if (valor) formulario[campo] = valor;
  }
  return { origem: ORIGEM_SITE, formulario };
}
