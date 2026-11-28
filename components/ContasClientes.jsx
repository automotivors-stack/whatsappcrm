"use client";

// Contas da área do cliente aguardando liberação. O consultor libera (vinculando, se quiser, ao card
// do cliente no Kanban) ou recusa. Só depois de liberada a conta mostra o andamento ao cliente.

import { useCallback, useEffect, useState } from "react";
import { decidirContaCliente, listarContasClientes, listarLeads } from "../lib/apiLeads.js";
import { dataHora } from "../lib/formato.js";

const ROTULO_STATUS = { pendente: "Aguardando", liberado: "Liberada", recusado: "Recusada" };

function Conta({ conta, leads, ocupado, decidir }) {
  const [card, setCard] = useState(conta.oportunidade_id ? String(conta.oportunidade_id) : "");
  const pendente = conta.status_acesso === "pendente";
  return (
    <li className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-slate-900">{conta.nome}</p>
          <p className="break-words text-xs text-slate-500">
            {conta.empresa ?? "empresa não informada"} · {conta.email} · {conta.telefone ?? "sem telefone"}
          </p>
          <p className="text-xs text-slate-500">Cadastro em {dataHora(conta.criado_em)}</p>
        </div>
        <span className={`rounded border px-1.5 py-0.5 text-xs font-medium ${pendente ? "border-amber-300 bg-amber-50 text-amber-900" : "border-slate-300 bg-slate-50 text-slate-700"}`}>
          {ROTULO_STATUS[conta.status_acesso] ?? conta.status_acesso}
        </span>
      </div>
      <div className="mt-3 flex flex-wrap items-end gap-2">
        <label className="min-w-0 flex-1 text-sm">
          <span className="text-slate-600">Card do cliente no Kanban (opcional)</span>
          <select value={card} onChange={(e) => setCard(e.target.value)} className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm">
            <option value="">Sem card por enquanto</option>
            {leads.map((l) => (
              <option key={l.id} value={l.id}>{l.nome_ou_razao_social ?? `Card #${l.id}`} · {l.status_kanban}</option>
            ))}
          </select>
        </label>
        <button
          type="button"
          disabled={ocupado}
          onClick={() => decidir(conta, "liberar", card || null)}
          className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
        >
          {pendente ? "Liberar acesso" : "Salvar e liberar"}
        </button>
        {conta.status_acesso !== "recusado" && (
          <button
            type="button"
            disabled={ocupado}
            onClick={() => decidir(conta, "recusar")}
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Recusar
          </button>
        )}
      </div>
    </li>
  );
}

export default function ContasClientes() {
  const [contas, setContas] = useState([]);
  const [leads, setLeads] = useState([]);
  const [aberto, setAberto] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [mensagem, setMensagem] = useState(null);

  const carregar = useCallback(async () => {
    try {
      setContas((await listarContasClientes()).contas);
    } catch {
      // Falha ao buscar não quebra o Kanban; tenta de novo ao voltar à aba.
    }
  }, []);

  useEffect(() => {
    carregar();
    const aoVoltar = () => document.visibilityState === "visible" && carregar();
    document.addEventListener("visibilitychange", aoVoltar);
    return () => document.removeEventListener("visibilitychange", aoVoltar);
  }, [carregar]);

  useEffect(() => {
    if (!aberto) return undefined;
    listarLeads().then((r) => setLeads(r.leads ?? r ?? [])).catch(() => setLeads([]));
    const fechar = (e) => e.key === "Escape" && setAberto(false);
    window.addEventListener("keydown", fechar);
    return () => window.removeEventListener("keydown", fechar);
  }, [aberto]);

  async function decidir(conta, decisao, oportunidadeId = null) {
    if (decisao === "recusar" && !window.confirm(`Recusar o acesso de ${conta.nome}? A pessoa sai da área do cliente.`)) return;
    setOcupado(true);
    setMensagem(null);
    try {
      await decidirContaCliente(conta.id, decisao, oportunidadeId ? Number(oportunidadeId) : null);
      setMensagem({ tipo: "ok", texto: decisao === "liberar" ? `✅ Acesso de ${conta.nome} liberado.` : `Acesso de ${conta.nome} recusado.` });
    } catch (e) {
      setMensagem({ tipo: "erro", texto: e.message });
    } finally {
      setOcupado(false);
      await carregar();
    }
  }

  const pendentes = contas.filter((c) => c.status_acesso === "pendente").length;
  if (contas.length === 0) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => { setMensagem(null); setAberto(true); }}
        className={`flex w-full flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 text-left text-sm ${pendentes ? "border-amber-300 bg-amber-50 text-amber-950 hover:bg-amber-100" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}
      >
        <span className="font-medium">
          🔐 Contas de clientes{pendentes ? ` · ${pendentes} aguardando liberação` : ""}
        </span>
        <span className="underline">Ver contas</span>
      </button>

      {aberto && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:items-center">
          <button type="button" aria-label="Fechar" onClick={() => setAberto(false)} className="absolute inset-0 bg-slate-900/40" />
          <div role="dialog" aria-modal="true" aria-labelledby="contas-titulo" className="relative w-full max-w-2xl rounded-lg bg-slate-50 shadow-xl">
            <div className="flex items-center justify-between gap-2 border-b border-slate-200 px-4 py-3">
              <h2 id="contas-titulo" className="font-semibold text-slate-900">Contas da área do cliente</h2>
              <button type="button" onClick={() => setAberto(false)} className="rounded-md border border-slate-300 bg-white px-3 py-1 text-sm">Fechar</button>
            </div>
            <div className="flex max-h-[75vh] flex-col gap-3 overflow-y-auto p-4">
              <p className="text-xs text-slate-500">
                Com o card vinculado, o cliente vê a etapa do atendimento e as mensagens que já recebeu. Nunca vê custos,
                margem, precificação, fornecedor nem o dossiê.
              </p>
              {mensagem && (
                <p role="status" className={`rounded-md border px-3 py-2 text-sm ${mensagem.tipo === "erro" ? "border-red-300 bg-red-50 text-red-800" : "border-emerald-300 bg-emerald-50 text-emerald-800"}`}>
                  {mensagem.texto}
                </p>
              )}
              <ul className="flex flex-col gap-3">
                {contas.map((c) => <Conta key={c.id} conta={c} leads={leads} ocupado={ocupado} decidir={decidir} />)}
              </ul>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
