"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FASES, exigeFornecedor } from "../../lib/kanban.js";
import { KLUUBPAY, PUSHIN_PAY } from "../../lib/custosParceiros.js";
import ClientDetailView, { BadgeFornecedor } from "../../components/ClientDetailView.jsx";
import AprovacoesPendentes from "../../components/AprovacoesPendentes.jsx";
import { listarLeads, patchLead } from "../../lib/apiLeads.js";

const FILTROS = [
  { id: "todos", rotulo: "Todos os Leads", icone: "" },
  { id: PUSHIN_PAY, rotulo: PUSHIN_PAY, icone: "🟢" },
  { id: KLUUBPAY, rotulo: KLUUBPAY, icone: "🔵" },
  { id: "sem_parceiro", rotulo: "Sem Parceiro", icone: "🟡" },
];

function passaNoFiltro(lead, filtro) {
  if (filtro === "todos") return true;
  if (filtro === "sem_parceiro") return !lead.fornecedor_operacao;
  return lead.fornecedor_operacao === filtro;
}

export default function KanbanPage() {
  const [leads, setLeads] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erroCarga, setErroCarga] = useState(null);
  const [filtro, setFiltro] = useState("todos");
  const [aberto, setAberto] = useState(null); // { id, faseDesejada? }
  const [aviso, setAviso] = useState(null);
  const [arrastando, setArrastando] = useState(null);
  const [colunaAlvo, setColunaAlvo] = useState(null);

  const carregar = useCallback(async () => {
    try {
      setLeads(await listarLeads());
      setErroCarga(null);
    } catch (e) {
      setErroCarga(e.message);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregar();
    // Lead aprovado pelo WhatsApp com o Kanban aberto: aparece quando o consultor volta à aba.
    const aoVoltar = () => document.visibilityState === "visible" && carregar();
    document.addEventListener("visibilitychange", aoVoltar);
    window.addEventListener("focus", aoVoltar);
    return () => {
      document.removeEventListener("visibilitychange", aoVoltar);
      window.removeEventListener("focus", aoVoltar);
    };
  }, [carregar]);

  useEffect(() => {
    if (!aviso) return undefined;
    const t = setTimeout(() => setAviso(null), 5000);
    return () => clearTimeout(t);
  }, [aviso]);

  const contadores = useMemo(
    () => Object.fromEntries(FILTROS.map((f) => [f.id, leads.filter((l) => passaNoFiltro(l, f.id)).length])),
    [leads],
  );
  const visiveis = useMemo(() => leads.filter((l) => passaNoFiltro(l, filtro)), [leads, filtro]);

  const substituir = useCallback((lead) => {
    setLeads((atuais) => atuais.map((l) => (l.id === lead.id ? lead : l)));
  }, []);

  /** Move com atualização otimista; desfaz se o servidor recusar. */
  const mover = useCallback(
    async (id, fase) => {
      const lead = leads.find((l) => l.id === id);
      if (!lead || lead.status_kanban === fase) return;
      if (exigeFornecedor(fase) && !lead.fornecedor_operacao) {
        setAberto({ id, faseDesejada: fase });
        setAviso({ tipo: "atencao", texto: `Escolha o fornecedor para mover "${lead.nome_ou_razao_social ?? "o lead"}" para ${fase}.` });
        return;
      }
      const anterior = lead.status_kanban;
      substituir({ ...lead, status_kanban: fase });
      try {
        substituir(await patchLead({ id, status_kanban: fase }));
      } catch (e) {
        setLeads((atuais) => atuais.map((l) => (l.id === id ? { ...l, status_kanban: anterior } : l)));
        setAviso({ tipo: "erro", texto: e.message });
      }
    },
    [leads, substituir],
  );

  return (
    <main className="flex min-h-screen flex-col">
      <header className="border-b border-slate-200 bg-white px-4 py-4 sm:px-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="text-xl font-semibold text-slate-900">Pipeline de Leads</h1>
          <p className="text-sm text-slate-500">{leads.length} lead(s) no total</p>
        </div>
        <nav aria-label="Filtrar por fornecedor" className="mt-4 flex flex-wrap gap-2">
          {FILTROS.map((f) => {
            const ativo = filtro === f.id;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => setFiltro(f.id)}
                aria-pressed={ativo}
                className={`inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${
                  ativo ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                {f.icone && <span aria-hidden="true">{f.icone}</span>}
                {f.rotulo}
                <span className={`rounded px-1.5 text-xs tabular-nums ${ativo ? "bg-white/20" : "bg-slate-100 text-slate-600"}`}>
                  {contadores[f.id]}
                </span>
              </button>
            );
          })}
        </nav>
      </header>

      <div className="mx-4 mt-3 sm:mx-6 empty:hidden">
        <AprovacoesPendentes onDecidido={carregar} />
      </div>

      {aviso && (
        <div
          role="status"
          className={`mx-4 mt-3 rounded-md border px-3 py-2 text-sm sm:mx-6 ${
            aviso.tipo === "erro" ? "border-red-300 bg-red-50 text-red-800" : "border-amber-300 bg-amber-50 text-amber-900"
          }`}
        >
          {aviso.texto}
        </div>
      )}

      {carregando ? (
        <p className="p-6 text-slate-500">Carregando leads…</p>
      ) : erroCarga ? (
        <div className="p-6">
          <p className="text-red-700">{erroCarga}</p>
          <button type="button" onClick={carregar} className="mt-2 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm">
            Tentar de novo
          </button>
        </div>
      ) : (
        <div className="quadro-rolagem flex-1 overflow-x-auto px-4 py-4 sm:px-6">
          <div className="flex min-w-[1750px] flex-nowrap gap-3">
            {FASES.map((fase, indice) => {
              const cards = visiveis.filter((l) => l.status_kanban === fase.id);
              const alvo = colunaAlvo === fase.id;
              return (
                <section
                  key={fase.id}
                  aria-label={fase.id}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setColunaAlvo(fase.id);
                  }}
                  onDragLeave={() => setColunaAlvo((c) => (c === fase.id ? null : c))}
                  onDrop={(e) => {
                    e.preventDefault();
                    setColunaAlvo(null);
                    const id = Number(e.dataTransfer.getData("text/plain"));
                    if (id) mover(id, fase.id);
                  }}
                  className={`flex w-[240px] shrink-0 flex-col rounded-lg border bg-slate-100/70 ${
                    alvo ? "border-slate-500 bg-slate-200/70" : "border-slate-200"
                  }`}
                >
                  <div className="border-b border-slate-200 px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <h2 className="text-sm font-semibold text-slate-800">
                        <span className="mr-1 text-slate-400 tabular-nums">{indice + 1}.</span>
                        {fase.id}
                      </h2>
                      <span className="rounded bg-white px-1.5 text-xs tabular-nums text-slate-600">{cards.length}</span>
                    </div>
                    <p className="mt-0.5 text-xs leading-snug text-slate-500">{fase.descricao}</p>
                  </div>
                  <ul className="flex flex-1 flex-col gap-2 p-2">
                    {cards.map((lead) => (
                      <li key={lead.id}>
                        <button
                          type="button"
                          draggable
                          onDragStart={(e) => {
                            e.dataTransfer.setData("text/plain", String(lead.id));
                            setArrastando(lead.id);
                          }}
                          onDragEnd={() => setArrastando(null)}
                          onClick={() => setAberto({ id: lead.id })}
                          className={`w-full rounded-md border border-slate-200 bg-white p-3 text-left shadow-sm transition hover:border-slate-400 focus-visible:outline-2 focus-visible:outline-slate-900 ${
                            arrastando === lead.id ? "opacity-50" : ""
                          }`}
                        >
                          <p className="truncate text-sm font-medium text-slate-900">
                            {lead.nome_ou_razao_social ?? "Sem nome"}
                          </p>
                          {lead.documento && <p className="truncate text-xs text-slate-500">{lead.documento}</p>}
                          {lead.volume_mensal && (
                            <p className="mt-1 text-xs text-slate-600">Volume: {lead.volume_mensal}/mês</p>
                          )}
                          <div className="mt-2">
                            <BadgeFornecedor fornecedor={lead.fornecedor_operacao} />
                          </div>
                        </button>
                      </li>
                    ))}
                    {cards.length === 0 && <li className="px-1 py-3 text-center text-xs text-slate-400">Nenhum lead</li>}
                  </ul>
                </section>
              );
            })}
          </div>
        </div>
      )}

      {aberto && (
        <ClientDetailView
          key={aberto.id}
          leadId={aberto.id}
          faseDesejada={aberto.faseDesejada}
          onFechar={() => setAberto(null)}
          onAtualizado={substituir}
        />
      )}
    </main>
  );
}
