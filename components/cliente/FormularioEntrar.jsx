"use client";

// Login da área do cliente: e-mail e senha ou Google.

import { useId, useState } from "react";
import { authCliente, mensagemDeErro } from "../../lib/authCliente.js";
import { Aviso, BotaoGoogle, CLASSE_BOTAO, CLASSE_CAMPO, Divisor } from "./Moldura.jsx";

export default function FormularioEntrar({ googleAtivo, erroInicial = "" }) {
  const id = useId();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [aviso, setAviso] = useState(erroInicial);
  const [ocupado, setOcupado] = useState(false);

  async function enviar(ev) {
    ev.preventDefault();
    if (!email.trim() || !senha) {
      setAviso("Informe o e-mail e a senha.");
      return;
    }
    setOcupado(true);
    setAviso("");
    const { error } = await authCliente.signIn.email({ email: email.trim().toLowerCase(), password: senha });
    if (error) {
      setOcupado(false);
      setAviso(mensagemDeErro(error));
      return;
    }
    window.location.assign("/cliente");
  }

  async function google() {
    setOcupado(true);
    setAviso("");
    const { error } = await authCliente.signIn.social({ provider: "google", callbackURL: "/cliente", errorCallbackURL: "/entrar?erro=google" });
    if (error) {
      setOcupado(false);
      setAviso(mensagemDeErro(error));
    }
  }

  return (
    <div>
      <h1 className="font-ltb-titulo text-3xl font-extrabold tracking-[-0.03em] sm:text-4xl">Entrar</h1>
      <p className="mt-3 text-slate-300">Acesse a área do cliente para acompanhar o seu atendimento.</p>

      {googleAtivo && (
        <>
          <div className="mt-8">
            <BotaoGoogle onClick={google} ocupado={ocupado} />
          </div>
          <Divisor />
        </>
      )}

      <form onSubmit={enviar} noValidate className={`grid gap-5 ${googleAtivo ? "" : "mt-8"}`}>
        <div>
          <label htmlFor={`${id}-email`} className="text-sm font-medium">E-mail</label>
          <input id={`${id}-email`} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={CLASSE_CAMPO} />
        </div>
        <div>
          <label htmlFor={`${id}-senha`} className="text-sm font-medium">Senha</label>
          <input id={`${id}-senha`} type="password" autoComplete="current-password" value={senha} onChange={(e) => setSenha(e.target.value)} className={CLASSE_CAMPO} />
        </div>
        <Aviso>{aviso}</Aviso>
        <button type="submit" disabled={ocupado} className={CLASSE_BOTAO}>{ocupado ? "Entrando…" : "Entrar"}</button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-300">
        Ainda não tem conta? <a href="/cadastro" className="font-semibold text-ltb-blue-soft underline-offset-4 hover:underline">Criar conta</a>
      </p>
      <p className="mt-10 text-center text-xs text-slate-400">
        É consultor da Let&rsquo;s Touch Base? <a href="/dashboard" className="underline underline-offset-4 hover:text-white">Acessar o painel</a>
      </p>
    </div>
  );
}
