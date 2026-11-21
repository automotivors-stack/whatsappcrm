// Formulário de diagnóstico da landing: validação e mensagem que vai para o WhatsApp.
import test from "node:test";
import assert from "node:assert/strict";
import { validarDiagnostico, mensagemDiagnostico, linkDiagnostico, PRIORIDADES, GARGALOS, LIMITE_CAMPO } from "../content/diagnostico.js";
import { WHATSAPP_NUMERO, WHATSAPP_URL } from "../content/contato.js";

test("nome é obrigatório; o resto é opcional", () => {
  assert.deepEqual(validarDiagnostico({ nome: " " }).erros.nome !== undefined, true);
  const { dados } = validarDiagnostico({ nome: "Ana" });
  assert.equal(dados.nome, "Ana");
  assert.equal(dados.prioridade, "");
});

test("limpa quebras de linha e corta campos longos", () => {
  const { dados } = validarDiagnostico({ nome: "Ana\nSouza", empresa: "x".repeat(200) });
  assert.equal(dados.nome, "Ana Souza");
  assert.equal(dados.empresa.length, LIMITE_CAMPO);
});

test("só aceita as opções da lista", () => {
  const { dados } = validarDiagnostico({ nome: "Ana", prioridade: "inventada", gargalo: GARGALOS[1] });
  assert.equal(dados.prioridade, "");
  assert.equal(dados.gargalo, GARGALOS[1]);
});

test("mensagem e link do WhatsApp", () => {
  const dados = { nome: "Ana", empresa: "Loja & Cia", prioridade: PRIORIDADES[0], gargalo: "" };
  const msg = mensagemDiagnostico(dados);
  assert.match(msg, /Nome: Ana/);
  assert.match(msg, /Empresa: Loja & Cia/);
  assert.match(msg, /Principal gargalo hoje: não selecionado/);
  const link = linkDiagnostico(dados);
  assert.ok(link.startsWith(`https://wa.me/${WHATSAPP_NUMERO}?text=`));
  assert.equal(decodeURIComponent(link.split("?text=")[1]), msg); // o & da empresa não quebra o link
});

test("o link do botão flutuante segue o mesmo", () => {
  assert.equal(
    WHATSAPP_URL,
    "https://wa.me/5511971621758?text=Quero%20um%20diagn%C3%B3stico%20do%20meu%20departamento%20comercial",
  );
});
