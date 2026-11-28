"use client";

// Cadastro da área do cliente: nome, e-mail, telefone, empresa, senha e confirmação, ou Google.
// A conta nasce aguardando a liberação do consultor (lib/auth.js); a tela diz isso antes de criar.

import { useId, useState } from "react";
import { authCliente, mensagemDeErro } from "../../lib/authCliente.js";
import { LIMITES, validarCadastro } from "../../lib/cadastroCliente.js";
import { Aviso, BotaoGoogle, CLASSE_BOTAO, CLASSE_CAMPO, Divisor, Erro } from "./Moldura.jsx";

const CAMPOS = [
  { nome: "nome", rotulo: "Nome completo", tipo: "text", auto: "name", max: LIMITES.nome, dica: "Ex.: Marcos Silva" },
  { nome: "email", rotulo: "E-mail", tipo: "email", auto: "email", max: LIMITES.email, dica: "voce@empresa.com.br" },
  { nome: "telefone", rotulo: "Telefone (WhatsApp)", tipo: "tel", auto: "tel", max: 20, dica: "(11) 99999-9999" },
  { nome: "empresa", rotulo: "Nome da empresa", tipo: "text", auto: "organization", max: LIMITES.empresa, dica: "Ex.: nome da sua empresa" },
  { nome: "senha", rotulo: "Senha", tipo: "password", auto: "new-password", max: LIMITES.senhaMax, dica: "Pelo menos 8 caracteres" },
  { nome: "confirmacao", rotulo: "Confirme a senha", tipo: "password", auto: "new-password", max: LIMITES.senhaMax, dica: "Repita a senha" },
];

export default function FormularioCadastro({ googleAtivo }) {
  const id = useId();
  const [valores, setValores] = useState({ nome: "", email: "", telefone: "", empresa: "", senha: "", confirmacao: "" });
  const [erros, setErros] = useState({});
  const [aviso, setAviso] = useState("");
  const [ocupado, setOcupado] = useState(false);

  async function enviar(ev) {
    ev.preventDefault();
    setAviso("");
    const r = validarCadastro(valores);
    if (r.erros) {
      setErros(r.erros);
      document.getElementById(`${id}-${Object.keys(r.erros)[0]}`)?.focus();
      return;
    }
    setErros({});
    setOcupado(true);
    const { error } = await authCliente.signUp.email({
      name: r.dados.nome,
      email: r.dados.email,
      password: valores.senha,
      telefone: r.dados.telefone,
      empresa: r.dados.empresa,
    });
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
      <h1 className="font-ltb-titulo text-3xl font-extrabold tracking-[-0.03em] sm:text-4xl">Criar sua conta</h1>
      <p className="mt-3 text-slate-300">
        Acompanhe o andamento do seu atendimento. Depois do cadastro, nosso consultor libera o seu acesso.
      </p>

      {googleAtivo && (
        <>
          <div className="mt-8">
            <BotaoGoogle onClick={google} ocupado={ocupado}>Cadastrar com o Google</BotaoGoogle>
          </div>
          <Divisor />
        </>
      )}

      <form onSubmit={enviar} noValidate className={`grid gap-5 ${googleAtivo ? "" : "mt-8"}`}>
        {CAMPOS.map((c) => (
          <div key={c.nome}>
            <label htmlFor={`${id}-${c.nome}`} className="text-sm font-medium">{c.rotulo}</label>
            <input
              id={`${id}-${c.nome}`}
              name={c.nome}
              type={c.tipo}
              autoComplete={c.auto}
              maxLength={c.max}
              placeholder={c.dica}
              value={valores[c.nome]}
              onChange={(e) => {
                setValores((v) => ({ ...v, [c.nome]: e.target.value }));
                if (erros[c.nome]) setErros((er) => ({ ...er, [c.nome]: undefined }));
              }}
              aria-invalid={erros[c.nome] ? true : undefined}
              aria-describedby={erros[c.nome] ? `${id}-${c.nome}-erro` : undefined}
              className={CLASSE_CAMPO}
            />
            <Erro id={`${id}-${c.nome}-erro`}>{erros[c.nome]}</Erro>
          </div>
        ))}
        <Aviso>{aviso}</Aviso>
        <button type="submit" disabled={ocupado} className={CLASSE_BOTAO}>
          {ocupado ? "Criando conta…" : "Criar conta"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-300">
        Já tem conta? <a href="/entrar" className="font-semibold text-ltb-blue-soft underline-offset-4 hover:underline">Entrar</a>
      </p>
    </div>
  );
}
