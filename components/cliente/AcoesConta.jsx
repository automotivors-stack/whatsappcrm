"use client";

// Ações da área logada: sair e completar o cadastro de quem entrou pelo Google.

import { useId, useState } from "react";
import { authCliente, mensagemDeErro } from "../../lib/authCliente.js";
import { validarCadastro } from "../../lib/cadastroCliente.js";
import { Aviso, CLASSE_BOTAO, CLASSE_CAMPO, Erro } from "./Moldura.jsx";

export function BotaoSair() {
  const [ocupado, setOcupado] = useState(false);
  return (
    <button
      type="button"
      disabled={ocupado}
      onClick={async () => {
        setOcupado(true);
        await authCliente.signOut();
        window.location.assign("/entrar");
      }}
      className="rounded-full border border-white/20 px-4 py-2 text-sm font-medium text-slate-100 hover:bg-white/10 disabled:opacity-60"
    >
      Sair
    </button>
  );
}

export function CompletarCadastro({ nome: nomeInicial }) {
  const id = useId();
  const [valores, setValores] = useState({ nome: nomeInicial ?? "", telefone: "", empresa: "" });
  const [erros, setErros] = useState({});
  const [aviso, setAviso] = useState("");
  const [ocupado, setOcupado] = useState(false);

  async function enviar(ev) {
    ev.preventDefault();
    const r = validarCadastro(valores, { exigirSenha: false, exigirEmail: false });
    if (r.erros) {
      setErros(r.erros);
      return;
    }
    setErros({});
    setOcupado(true);
    const { error } = await authCliente.updateUser({ name: r.dados.nome, telefone: r.dados.telefone, empresa: r.dados.empresa });
    if (error) {
      setOcupado(false);
      setAviso(mensagemDeErro(error));
      return;
    }
    window.location.reload();
  }

  const campos = [
    ["nome", "Nome completo", "name", "text"],
    ["telefone", "Telefone (WhatsApp)", "tel", "tel"],
    ["empresa", "Nome da empresa", "organization", "text"],
  ];
  return (
    <form onSubmit={enviar} noValidate className="mt-8 grid gap-5">
      {campos.map(([c, rotulo, auto, tipo]) => (
        <div key={c}>
          <label htmlFor={`${id}-${c}`} className="text-sm font-medium">{rotulo}</label>
          <input
            id={`${id}-${c}`}
            type={tipo}
            autoComplete={auto}
            maxLength={c === "telefone" ? 20 : 120}
            value={valores[c]}
            onChange={(e) => setValores((v) => ({ ...v, [c]: e.target.value }))}
            aria-invalid={erros[c] ? true : undefined}
            aria-describedby={erros[c] ? `${id}-${c}-erro` : undefined}
            className={CLASSE_CAMPO}
          />
          <Erro id={`${id}-${c}-erro`}>{erros[c]}</Erro>
        </div>
      ))}
      <Aviso>{aviso}</Aviso>
      <button type="submit" disabled={ocupado} className={CLASSE_BOTAO}>{ocupado ? "Salvando…" : "Concluir cadastro"}</button>
    </form>
  );
}
