// Área do cliente. Pública no proxy.js, mas só mostra algo com a sessão do cliente (Better Auth):
// sem sessão, vai para /entrar. Os dados vêm já filtrados de services/contasClientes.js (sigilo comercial).

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAuth } from "../../../lib/auth.js";
import { getDb } from "../../../lib/db.js";
import { dataHora } from "../../../lib/formato.js";
import { dadosAreaCliente } from "../../../services/contasClientes.js";
import { WHATSAPP_URL } from "../../../content/contato.js";
import { Moldura } from "../../../components/cliente/Moldura.jsx";
import { BotaoSair, CompletarCadastro } from "../../../components/cliente/AcoesConta.jsx";

export const dynamic = "force-dynamic";
export const metadata = { title: "Área do cliente · Let's Touch Base.", robots: { index: false } };

function Cartao({ titulo, children }) {
  return (
    <section className="rounded-[16px] border border-white/10 bg-white/[0.04] p-5 sm:p-6">
      {titulo && <h2 className="font-ltb-titulo text-lg font-bold">{titulo}</h2>}
      {children}
    </section>
  );
}

function Andamento({ andamento }) {
  return (
    <Cartao titulo={`Andamento · ${andamento.empresa}`}>
      <p className="mt-2 text-slate-300">
        Etapa {andamento.etapa} de {andamento.total}: <strong className="text-white">{andamento.fase}</strong>
      </p>
      <ol className="mt-5 grid gap-2">
        {andamento.etapas.map((nome, i) => {
          const n = i + 1;
          const estado = n < andamento.etapa ? "concluída" : n === andamento.etapa ? "atual" : "próxima";
          return (
            <li key={nome} className={`flex items-center gap-3 rounded-[8px] px-3 py-2 text-sm ${estado === "atual" ? "bg-ltb-blue/20 font-semibold text-white" : "text-slate-300"}`}>
              <span aria-hidden="true" className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border text-xs ${estado === "concluída" ? "border-ltb-green bg-ltb-green text-ltb-navy-deep" : estado === "atual" ? "border-ltb-blue bg-ltb-blue text-white" : "border-white/25"}`}>
                {estado === "concluída" ? "✓" : n}
              </span>
              <span>{nome}</span>
              <span className="sr-only"> ({estado})</span>
              {estado === "atual" && <span className="ml-auto text-xs font-medium text-ltb-blue-soft" aria-hidden="true">etapa atual</span>}
            </li>
          );
        })}
      </ol>
    </Cartao>
  );
}

function Mensagens({ mensagens }) {
  return (
    <Cartao titulo="Propostas e mensagens recebidas">
      {mensagens.length === 0 ? (
        <p className="mt-2 text-sm text-slate-300">Quando o consultor enviar uma proposta ou mensagem, ela aparece aqui.</p>
      ) : (
        <ul className="mt-4 grid gap-3">
          {mensagens.map((m) => (
            <li key={m.id} className="rounded-[12px] border border-white/10 bg-white/[0.03] p-4">
              <p className="text-xs text-slate-400">{m.canal} · {dataHora(m.data)}</p>
              {m.assunto && <p className="mt-1 font-semibold">{m.assunto}</p>}
              <p className="mt-2 whitespace-pre-wrap break-words text-sm text-slate-100">{m.texto}</p>
            </li>
          ))}
        </ul>
      )}
    </Cartao>
  );
}

export default async function AreaCliente() {
  const auth = await getAuth();
  const sessao = await auth.api.getSession({ headers: await headers() });
  if (!sessao?.user) redirect("/entrar");

  const dados = await dadosAreaCliente(getDb(), sessao.user.id);
  if (!dados) redirect("/entrar");
  const { conta, andamento, mensagens } = dados;
  const primeiroNome = String(conta.nome ?? "").split(" ")[0];
  const incompleto = !conta.telefone || !conta.empresa;

  return (
    <Moldura largura="max-w-3xl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-ltb-blue-soft">Área do cliente</p>
          <h1 className="mt-2 font-ltb-titulo text-3xl font-extrabold tracking-[-0.03em] sm:text-4xl">Olá, {primeiroNome}.</h1>
          <p className="mt-1 text-sm text-slate-400">{conta.email}</p>
        </div>
        <BotaoSair />
      </div>

      <div className="mt-8 grid gap-5">
        {incompleto ? (
          <Cartao titulo="Falta pouco para concluir o seu cadastro">
            <p className="mt-2 text-sm text-slate-300">Informe o seu telefone e o nome da empresa para o consultor identificar o seu atendimento.</p>
            <CompletarCadastro nome={conta.nome} />
          </Cartao>
        ) : conta.status_acesso === "pendente" ? (
          <Cartao titulo="Cadastro recebido">
            <p className="mt-2 text-slate-300">
              Nosso consultor vai conferir e liberar o seu acesso. Assim que for liberado, esta página passa a mostrar o
              andamento do seu atendimento.
            </p>
          </Cartao>
        ) : conta.status_acesso === "recusado" ? (
          <Cartao titulo="Acesso não liberado">
            <p className="mt-2 text-slate-300">
              Não conseguimos liberar o seu acesso. Se acha que é um engano, fale com a gente pelo{" "}
              <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="font-semibold text-ltb-blue-soft underline underline-offset-4">WhatsApp</a>.
            </p>
          </Cartao>
        ) : andamento ? (
          <>
            <Andamento andamento={andamento} />
            <Mensagens mensagens={mensagens} />
          </>
        ) : (
          <Cartao titulo="Acesso liberado">
            <p className="mt-2 text-slate-300">
              Assim que o seu diagnóstico for concluído com o nosso especialista, o andamento aparece aqui.
            </p>
            <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="mt-5 inline-flex min-h-11 items-center rounded-full bg-ltb-blue px-5 text-sm font-semibold text-white hover:bg-blue-700">
              Começar o diagnóstico pelo WhatsApp<span className="sr-only"> (abre em nova aba)</span>
            </a>
          </Cartao>
        )}
      </div>
    </Moldura>
  );
}
