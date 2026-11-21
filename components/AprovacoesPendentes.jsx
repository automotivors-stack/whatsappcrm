"use client";

// Contingência do SIM/NÃO no WhatsApp: diagnósticos concluídos aguardando aprovação aparecem
// no topo do Kanban e do Dashboard. Aprovar/Descartar aqui usa a mesma regra do WhatsApp.

import { useCallback, useEffect, useState } from "react";
import { decidirAprovacao, listarAprovacoes } from "../lib/apiLeads.js";
import { dataHora } from "../lib/formato.js";

const CAMPOS = [
  ["documento", "Documento"],
  ["tipo_pessoa", "Tipo"],
  ["descricao_negocio", "Negócio"],
  ["volume_mensal", "Volume declarado"],
  ["metodos_pagamento", "Métodos"],
  ["taxa_med_operacao", "Taxa MED"],
  ["limite_por_venda", "Limite por venda"],
  ["onde_opera_hoje", "Onde opera hoje"],
];

function Pendencia({ p, ocupado, decidir }) {
  const d = p.dados;
  return (
    <li className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-slate-900">{d.nome_ou_razao_social ?? "Cliente sem nome"}</p>
          <p className="text-xs text-slate-500">#{p.id} · concluído em {dataHora(p.created_at)} · WhatsApp {p.telefone}</p>
        </div>
        {!p.aviso_enviado && (
          <span className="rounded border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-xs font-medium text-amber-900">
            ⚠ Aviso no WhatsApp não foi entregue
          </span>
        )}
      </div>
      <dl className="mt-3 grid gap-x-4 gap-y-1 text-sm sm:grid-cols-2">
        {CAMPOS.filter(([c]) => d[c] !== undefined && d[c] !== null && d[c] !== "").map(([c, rotulo]) => (
          <div key={c} className="flex gap-1">
            <dt className="text-slate-500">{rotulo}:</dt>
            <dd className="text-slate-900">{String(d[c])}</dd>
          </div>
        ))}
      </dl>
      {d.resumo_executivo && <p className="mt-2 text-sm text-slate-700">{d.resumo_executivo}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={ocupado}
          onClick={() => decidir(p, "SIM")}
          className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          Aprovar (SIM)
        </button>
        <button
          type="button"
          disabled={ocupado}
          onClick={() => decidir(p, "NAO")}
          className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          Descartar (NÃO)
        </button>
      </div>
    </li>
  );
}

/** @param {{ onDecidido?: () => void }} props  chamado depois de aprovar ou descartar (recarregar a tela) */
export default function AprovacoesPendentes({ onDecidido }) {
  const [pendencias, setPendencias] = useState([]);
  const [aberto, setAberto] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [mensagem, setMensagem] = useState(null);

  const carregar = useCallback(async () => {
    try {
      setPendencias(await listarAprovacoes());
    } catch {
      // Falha ao buscar não deve quebrar a tela principal; tenta de novo ao voltar à aba.
    }
  }, []);

  useEffect(() => {
    carregar();
    const aoVoltar = () => document.visibilityState === "visible" && carregar();
    document.addEventListener("visibilitychange", aoVoltar);
    window.addEventListener("focus", aoVoltar);
    return () => {
      document.removeEventListener("visibilitychange", aoVoltar);
      window.removeEventListener("focus", aoVoltar);
    };
  }, [carregar]);

  useEffect(() => {
    if (!aberto) return undefined;
    const fechar = (e) => e.key === "Escape" && setAberto(false);
    window.addEventListener("keydown", fechar);
    return () => window.removeEventListener("keydown", fechar);
  }, [aberto]);

  async function decidir(p, decisao) {
    const nome = p.dados.nome_ou_razao_social ?? "este cliente";
    if (decisao === "NAO" && !window.confirm(`Descartar o diagnóstico de ${nome}? Nada será cadastrado no CRM.`)) return;
    setOcupado(true);
    setMensagem(null);
    try {
      await decidirAprovacao(p.id, decisao);
      setMensagem({
        tipo: "ok",
        texto: decisao === "SIM" ? `✅ ${nome} entrou no CRM em "Contato Recebido".` : `🗑️ Diagnóstico de ${nome} descartado.`,
      });
      onDecidido?.();
    } catch (e) {
      setMensagem({ tipo: "erro", texto: e.message });
    } finally {
      setOcupado(false);
      await carregar(); // decidida aqui ou no WhatsApp, sai da lista
    }
  }

  if (pendencias.length === 0 && !aberto) return null;
  const n = pendencias.length;
  const semAviso = pendencias.filter((p) => !p.aviso_enviado).length;

  return (
    <>
      {n > 0 && (
        <button
          type="button"
          onClick={() => { setMensagem(null); setAberto(true); }}
          className="flex w-full flex-wrap items-center justify-between gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-left text-sm text-amber-950 hover:bg-amber-100"
        >
          <span className="font-medium">
            🔔 {n} {n === 1 ? "diagnóstico concluído aguardando aprovação" : "diagnósticos concluídos aguardando aprovação"}
            {semAviso > 0 && ` · ${semAviso} sem aviso no WhatsApp`}
          </span>
          <span className="underline">Ver e decidir</span>
        </button>
      )}

      {aberto && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:items-center">
          <button type="button" aria-label="Fechar" onClick={() => setAberto(false)} className="absolute inset-0 bg-slate-900/40" />
          <div role="dialog" aria-modal="true" aria-labelledby="aprovacoes-titulo" className="relative w-full max-w-2xl rounded-lg bg-slate-50 shadow-xl">
            <div className="flex items-center justify-between gap-2 border-b border-slate-200 px-4 py-3">
              <h2 id="aprovacoes-titulo" className="font-semibold text-slate-900">Diagnósticos aguardando aprovação</h2>
              <button type="button" onClick={() => setAberto(false)} className="rounded-md border border-slate-300 bg-white px-3 py-1 text-sm">
                Fechar
              </button>
            </div>
            <div className="flex max-h-[75vh] flex-col gap-3 overflow-y-auto p-4">
              <p className="text-xs text-slate-500">
                Aprovar aqui é o mesmo que responder SIM no WhatsApp: o card entra em “Contato Recebido”.
              </p>
              {mensagem && (
                <p role="status" className={`rounded-md border px-3 py-2 text-sm ${mensagem.tipo === "erro" ? "border-red-300 bg-red-50 text-red-800" : "border-emerald-300 bg-emerald-50 text-emerald-800"}`}>
                  {mensagem.texto}
                </p>
              )}
              {n === 0 ? (
                <p className="text-sm text-slate-600">Nenhum diagnóstico aguardando.</p>
              ) : (
                <ul className="flex flex-col gap-3">
                  {pendencias.map((p) => <Pendencia key={p.id} p={p} ocupado={ocupado} decidir={decidir} />)}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
