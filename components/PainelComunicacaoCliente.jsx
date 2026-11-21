"use client";

// Hub de comunicação da Ficha 360°: disparo REAL de WhatsApp (OpenWA) e e-mail (Resend).
// Cada tentativa, com sucesso ou falha, volta do servidor e entra na linha do tempo.

import { useState } from "react";
import { montarProposta, textoParaHtml } from "../lib/proposta.js";
import { enviarEmail, enviarWhatsApp } from "../lib/apiLeads.js";

const LIMITE_WHATSAPP = 4096;

const novaChave = () =>
  globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;

function Aba({ ativa, onClick, children }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={ativa}
      onClick={onClick}
      className={`rounded-md border px-3 py-1.5 text-sm font-medium ${
        ativa ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
      }`}
    >
      {children}
    </button>
  );
}

const campo = "w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm disabled:bg-slate-100";

export default function PainelComunicacaoCliente({ lead, onEnviado }) {
  const [canal, setCanal] = useState("whatsapp");
  const [enviando, setEnviando] = useState(false);
  const [retorno, setRetorno] = useState(null);

  const [telefone, setTelefone] = useState(lead.whatsapp_contato || lead.phone_number || "");
  const [mensagem, setMensagem] = useState("");
  const [chaveWhats, setChaveWhats] = useState(novaChave);

  const [email, setEmail] = useState(lead.email_contato || "");
  const [assunto, setAssunto] = useState("");
  const [corpo, setCorpo] = useState("");
  const [chaveEmail, setChaveEmail] = useState(novaChave);

  const propostaWhats = montarProposta(lead, "whatsapp");
  const propostaEmail = montarProposta(lead, "email");
  const semProposta = !lead.fornecedor_operacao
    ? "Defina o fornecedor e salve a precificação para usar o atalho."
    : "Salve a precificação na mesa para usar o atalho.";

  async function disparar(executar, confirmacao, aoConcluir) {
    if (!window.confirm(confirmacao)) return;
    setEnviando(true);
    setRetorno(null);
    try {
      const r = await executar();
      onEnviado(r.interacao);
      aoConcluir();
      setRetorno({ tipo: "ok", texto: canal === "whatsapp" ? "WhatsApp enviado." : "E-mail enviado." });
    } catch (e) {
      if (e.dados?.interacao) onEnviado(e.dados.interacao); // a falha também vai para a linha do tempo
      setRetorno({ tipo: "erro", texto: e.message });
    } finally {
      setEnviando(false);
    }
  }

  function enviarWhats(e) {
    e.preventDefault();
    disparar(
      () => enviarWhatsApp({ oportunidadeId: lead.id, telefone, mensagem, idempotencyKey: chaveWhats }),
      `Enviar esta mensagem pelo WhatsApp para ${telefone}?`,
      () => {
        setMensagem("");
        setChaveWhats(novaChave());
      },
    );
  }

  function enviarMail(e) {
    e.preventDefault();
    disparar(
      () => enviarEmail({
        oportunidadeId: lead.id, email, assunto,
        corpoHtml: textoParaHtml(corpo), corpoTexto: corpo, idempotencyKey: chaveEmail,
      }),
      `Enviar este e-mail para ${email}?`,
      () => {
        setAssunto("");
        setCorpo("");
        setChaveEmail(novaChave());
      },
    );
  }

  return (
    <div>
      <div role="tablist" aria-label="Canal" className="mb-4 flex flex-wrap gap-2">
        <Aba ativa={canal === "whatsapp"} onClick={() => { setCanal("whatsapp"); setRetorno(null); }}>📱 Enviar WhatsApp</Aba>
        <Aba ativa={canal === "email"} onClick={() => { setCanal("email"); setRetorno(null); }}>✉️ Enviar E-mail</Aba>
      </div>

      {canal === "whatsapp" ? (
        <form onSubmit={enviarWhats} className="flex flex-col gap-3">
          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-700">Telefone (com DDD)</span>
            <input type="tel" value={telefone} disabled={enviando} onChange={(e) => setTelefone(e.target.value)} className={`${campo} max-w-xs`} />
          </label>
          <div>
            <button
              type="button"
              disabled={!propostaWhats || enviando}
              onClick={() => setMensagem(propostaWhats.texto)}
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Inserir proposta de taxas{lead.fornecedor_operacao ? ` (${lead.fornecedor_operacao})` : ""}
            </button>
            {!propostaWhats && <p className="mt-1 text-xs text-slate-500">{semProposta}</p>}
          </div>
          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-700">Mensagem</span>
            <textarea
              rows={8}
              value={mensagem}
              disabled={enviando}
              maxLength={LIMITE_WHATSAPP}
              onChange={(e) => setMensagem(e.target.value)}
              className={campo}
            />
            <span className="mt-1 block text-right text-xs text-slate-500 tabular-nums">{mensagem.length}/{LIMITE_WHATSAPP}</span>
          </label>
          <div>
            <button
              type="submit"
              disabled={enviando || !mensagem.trim() || !telefone.trim()}
              className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {enviando ? "Enviando…" : "Enviar via WhatsApp"}
            </button>
          </div>
        </form>
      ) : (
        <form onSubmit={enviarMail} className="flex flex-col gap-3">
          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-700">E-mail do cliente</span>
            <input type="email" value={email} disabled={enviando} onChange={(e) => setEmail(e.target.value)} className={`${campo} max-w-md`} />
          </label>
          <div>
            <button
              type="button"
              disabled={!propostaEmail || enviando}
              onClick={() => {
                setAssunto(propostaEmail.assunto);
                setCorpo(propostaEmail.texto);
              }}
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Inserir proposta de taxas{lead.fornecedor_operacao ? ` (${lead.fornecedor_operacao})` : ""}
            </button>
            {!propostaEmail && <p className="mt-1 text-xs text-slate-500">{semProposta}</p>}
          </div>
          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-700">Assunto</span>
            <input type="text" value={assunto} maxLength={200} disabled={enviando} onChange={(e) => setAssunto(e.target.value)} className={campo} />
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-700">Texto do e-mail</span>
            <textarea rows={10} value={corpo} disabled={enviando} onChange={(e) => setCorpo(e.target.value)} className={campo} />
            <span className="mt-1 block text-xs text-slate-500">Linha em branco separa parágrafos. O texto é enviado formatado em HTML.</span>
          </label>
          <div>
            <button
              type="submit"
              disabled={enviando || !email.trim() || !assunto.trim() || !corpo.trim()}
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {enviando ? "Enviando…" : "Enviar Proposta por E-mail"}
            </button>
          </div>
        </form>
      )}

      {retorno && (
        <p
          role={retorno.tipo === "erro" ? "alert" : "status"}
          className={`mt-3 rounded-md border px-3 py-2 text-sm ${
            retorno.tipo === "erro" ? "border-red-300 bg-red-50 text-red-800" : "border-emerald-300 bg-emerald-50 text-emerald-800"
          }`}
        >
          {retorno.texto}
        </p>
      )}
    </div>
  );
}
