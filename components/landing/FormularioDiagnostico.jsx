"use client";

// Último bloco da landing: o formulário de conversão. As respostas montam a mensagem de diagnóstico e abrem o WhatsApp
// do especialista; nada é gravado no site (sem banco, sem cadastro). O botão não diz que enviou: quem envia é a pessoa,
// no WhatsApp. A alternativa é escolher um horário na agenda (AGENDA_URL).

import { useId, useRef, useState } from "react";
import { AGENDA_URL } from "../../content/contato.js";
import { GARGALOS, LIMITE_CAMPO, PRIORIDADES, linkDiagnostico, validarDiagnostico } from "../../content/diagnostico.js";

function Visto() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false" className="h-4 w-4 shrink-0">
      <path d="M3.5 8.5 6.5 11.5 12.5 4.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Seta() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false" className="h-4 w-4 shrink-0">
      <path d="M5 11 11 5M6 5h5v5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Calendario() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false" className="h-4 w-4 shrink-0">
      <rect x="2.5" y="3.5" width="11" height="10" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M2.5 6.5h11M5.5 2v3M10.5 2v3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function Opcoes({ legenda, nome, opcoes, valor, aoEscolher }) {
  return (
    <fieldset className="min-w-0">
      <legend className="font-ltb-titulo text-lg font-bold sm:text-xl">{legenda}</legend>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {opcoes.map((opcao) => {
          const marcada = valor === opcao;
          return (
            <label
              key={opcao}
              className={`flex min-h-14 cursor-pointer items-center gap-3 rounded-[12px] border px-4 py-3 text-sm transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ltb-blue-soft ${
                marcada ? "border-ltb-blue bg-ltb-blue/20 font-semibold text-white" : "border-white/15 bg-white/[0.04] text-slate-200 hover:border-white/30 hover:bg-white/[0.07]"
              }`}
            >
              <input type="radio" name={nome} value={opcao} checked={marcada} onChange={() => aoEscolher(opcao)} className="sr-only" />
              <span
                aria-hidden="true"
                className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border ${marcada ? "border-ltb-blue bg-ltb-blue text-white" : "border-slate-400"}`}
              >
                {marcada && <Visto />}
              </span>
              {opcao}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

export default function FormularioDiagnostico() {
  const id = useId();
  const campoNome = useRef(null);
  const [prioridade, setPrioridade] = useState("");
  const [gargalo, setGargalo] = useState("");
  const [nome, setNome] = useState("");
  const [empresa, setEmpresa] = useState("");
  const [erros, setErros] = useState({});
  const [aviso, setAviso] = useState("");

  const enviar = (ev) => {
    ev.preventDefault();
    const r = validarDiagnostico({ nome, empresa, prioridade, gargalo });
    if (r.erros) {
      setErros(r.erros);
      setAviso("");
      campoNome.current?.focus();
      return;
    }
    setErros({});
    const url = linkDiagnostico(r.dados);
    // Abre na hora, dentro do clique (fora dele o navegador bloquearia a aba nova); bloqueada, abre nesta aba.
    const aba = window.open(url, "_blank");
    if (aba) aba.opener = null;
    else window.location.assign(url);
    setAviso("Abrimos o WhatsApp com a sua mensagem pronta. É só enviar por lá.");
  };

  const campo =
    "mt-2 block w-full rounded-[8px] border border-white/15 bg-white/[0.05] px-4 py-3 text-base text-white placeholder:text-slate-400 focus:border-ltb-blue focus:outline-none focus:ring-2 focus:ring-ltb-blue/60";

  return (
    <section id="demonstracao" aria-labelledby="diagnostico-titulo" className="scroll-mt-16 bg-ltb-navy-deep bg-[radial-gradient(70%_60%_at_85%_0%,rgba(37,99,235,0.22),transparent_70%),radial-gradient(60%_50%_at_0%_100%,rgba(11,31,68,0.9),transparent_70%)] px-5 py-20 text-white sm:px-10 sm:py-28">
      <div className="mx-auto max-w-5xl">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-ltb-blue-soft">Diagnóstico comercial</p>
        <h2 id="diagnostico-titulo" className="mt-3 max-w-3xl font-ltb-titulo text-[clamp(2rem,4.8vw,3.5rem)] font-extrabold leading-[1.05] tracking-[-0.03em]">
          Vamos colocar previsibilidade na sua operação comercial?
        </h2>
        <p className="mt-4 max-w-2xl text-slate-300">
          Responda em menos de um minuto e comece a conversa com um especialista já com o seu cenário em mãos.
        </p>

        <form onSubmit={enviar} noValidate className="mt-12 grid gap-10">
          <Opcoes legenda="1. Qual é a sua prioridade agora?" nome="prioridade" opcoes={PRIORIDADES} valor={prioridade} aoEscolher={setPrioridade} />
          <Opcoes legenda="2. Qual é o principal gargalo hoje?" nome="gargalo" opcoes={GARGALOS} valor={gargalo} aoEscolher={setGargalo} />

          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <label htmlFor={`${id}-nome`} className="text-sm font-medium">
                Seu nome
              </label>
              <input
                ref={campoNome}
                id={`${id}-nome`}
                name="nome"
                autoComplete="name"
                maxLength={LIMITE_CAMPO}
                placeholder="Ex.: Marcos Silva"
                value={nome}
                onChange={(e) => {
                  setNome(e.target.value);
                  // o aviso sai assim que o nome fica válido
                  if (erros.nome && e.target.value.trim().length >= 2) setErros({});
                }}
                aria-invalid={erros.nome ? true : undefined}
                aria-describedby={erros.nome ? `${id}-nome-erro` : undefined}
                className={campo}
              />
              {erros.nome && (
                <p id={`${id}-nome-erro`} className="mt-2 inline-flex items-center gap-2 rounded-[8px] bg-amber-100 px-3 py-1.5 text-sm font-medium text-amber-900">
                  <span aria-hidden="true">!</span> {erros.nome}
                </p>
              )}
            </div>
            <div>
              <label htmlFor={`${id}-empresa`} className="text-sm font-medium">
                Empresa <span className="font-normal text-slate-400">(opcional)</span>
              </label>
              <input
                id={`${id}-empresa`}
                name="empresa"
                autoComplete="organization"
                maxLength={LIMITE_CAMPO}
                placeholder="Ex.: nome da sua empresa"
                value={empresa}
                onChange={(e) => setEmpresa(e.target.value)}
                className={campo}
              />
            </div>
          </div>

          <div className="rounded-[12px] border border-white/10 bg-white/[0.04] p-5" aria-live="polite">
            <p className="text-sm font-semibold">Resumo</p>
            <p className="mt-1 text-sm text-slate-300">
              Prioridade: {prioridade || "não selecionada"} · Gargalo: {gargalo || "não selecionado"}
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <button
              type="submit"
              className="ltb-botao-primario min-h-12 gap-2 px-6 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ltb-blue-soft"
            >
              Iniciar conversa com diagnóstico no WhatsApp
              <Seta />
              <span className="sr-only"> (abre em nova aba)</span>
            </button>
            <a
              href={AGENDA_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-white/25 px-6 text-sm font-semibold text-white transition hover:border-white/45 hover:bg-white/[0.06] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ltb-blue-soft"
            >
              <Calendario />
              Prefiro escolher um horário na agenda
              <span className="sr-only"> (abre em nova aba)</span>
            </a>
          </div>

          <div className="-mt-4 grid gap-2 text-sm">
            <p role="status" className="font-medium text-white">
              {aviso}
            </p>
            <p className="text-slate-400">
              Seus dados não ficam salvos neste site: vão só na mensagem que você mesmo envia pelo WhatsApp.
            </p>
          </div>
        </form>
      </div>
    </section>
  );
}
