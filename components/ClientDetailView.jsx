"use client";

// Ficha 360° do cliente: identificação, diagnóstico da IA, resumo, mesa de precificação,
// auditoria operacional e linha do tempo de interações.

import { useEffect, useMemo, useState } from "react";
import { FASES, FASES_OPERACAO, exigeFornecedor } from "../lib/kanban.js";
import { FORNECEDORES, KLUUBPAY, PUSHIN_PAY, VERSAO_TABELA_CUSTOS } from "../lib/custosParceiros.js";
import { linhasDaMesa } from "../lib/precificacao.js";
import { comSinal, dinheiro, lerDecimal, paraCampo, percentual, soDigitos } from "../lib/formato.js";
import { buscarDossie, patchLead } from "../lib/apiLeads.js";

const ESTILO_FORNECEDOR = {
  [PUSHIN_PAY]: { icone: "🟢", classe: "border-emerald-300 bg-emerald-50 text-emerald-800" },
  [KLUUBPAY]: { icone: "🔵", classe: "border-sky-300 bg-sky-50 text-sky-800" },
};

export function BadgeFornecedor({ fornecedor }) {
  const estilo = ESTILO_FORNECEDOR[fornecedor];
  if (!estilo) {
    return (
      <span className="inline-flex items-center gap-1 rounded border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-xs font-medium text-amber-900">
        <span aria-hidden="true">🟡</span> Sem parceiro
      </span>
    );
  }
  return (
    <span className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-xs font-medium ${estilo.classe}`}>
      <span aria-hidden="true">{estilo.icone}</span> {fornecedor}
    </span>
  );
}

// Os 14 pontos do diagnóstico (nome e documento ficam no cabeçalho).
const DIAGNOSTICO = [
  ["tipo_pessoa", "Tipo de pessoa"],
  ["descricao_negocio", "Negócio"],
  ["onde_opera_hoje", "Onde opera hoje"],
  ["volume_mensal", "Volume mensal declarado"],
  ["numero_transacoes", "Transações por mês"],
  ["taxas_atuais", "Taxas atuais"],
  ["taxa_med_operacao", "Taxa de MED declarada"],
  ["limite_por_venda", "Limite por venda"],
  ["limite_saque_diario", "Limite de saque diário"],
  ["saque_terceiros", "Saque para terceiros"],
  ["metodos_pagamento", "Métodos de pagamento"],
  ["tipo_integracao", "Tipo de integração"],
  ["whatsapp_contato", "WhatsApp"],
  ["email_contato", "E-mail"],
];

function valorDiagnostico(lead, campo) {
  const v = lead[campo];
  if (v === null || v === undefined || v === "") return <span className="text-slate-400">Não informado</span>;
  if (campo === "saque_terceiros") return v ? "Sim" : "Não";
  return String(v);
}

function Bloco({ titulo, children, acao }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white">
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-2.5">
        <h3 className="text-sm font-semibold text-slate-800">{titulo}</h3>
        {acao}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function campoInicialPrecificacao(lead) {
  const p = lead?.dados_precificacao;
  if (!p || p.fornecedor !== lead.fornecedor_operacao) return { valorReferencia: "", itens: {} };
  const itens = {};
  for (const [id, v] of Object.entries(p.itens ?? {})) {
    itens[id] = { percentual: paraCampo(v.percentual), fixo: paraCampo(v.fixo) };
  }
  return { valorReferencia: paraCampo(p.valor_referencia), itens };
}

function TextoSpread({ spread, moeda }) {
  if (!spread) return <span className="text-slate-400">—</span>;
  const negativo = spread.pontosPercentuais < 0 || spread.fixo < 0 || (spread.porTransacao ?? 0) < 0;
  const partes = [];
  if (spread.pontosPercentuais !== 0) partes.push(`${comSinal(percentual(spread.pontosPercentuais).replace("%", ""), spread.pontosPercentuais)} p.p.`);
  if (spread.fixo !== 0 || partes.length === 0) partes.push(comSinal(dinheiro(spread.fixo, moeda), spread.fixo));
  return (
    <span className={negativo ? "text-red-700" : "text-emerald-700"}>
      <span className="font-medium">{partes.join(" · ")}</span>
      {spread.porTransacao !== null && (
        <span className="block text-xs">{comSinal(dinheiro(spread.porTransacao), spread.porTransacao)} por transação</span>
      )}
    </span>
  );
}

export default function ClientDetailView({ leadId, faseDesejada, onFechar, onAtualizado }) {
  const [lead, setLead] = useState(null);
  const [interacoes, setInteracoes] = useState([]);
  const [mensagens, setMensagens] = useState([]);
  const [erro, setErro] = useState(null);
  const [mensagem, setMensagem] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [mesa, setMesa] = useState({ valorReferencia: "", itens: {} });
  const [mesaAlterada, setMesaAlterada] = useState(false);
  const [operacao, setOperacao] = useState({ volume: "", med: "" });

  useEffect(() => {
    let ativo = true;
    buscarDossie(leadId)
      .then((dados) => {
        if (!ativo) return;
        setLead(dados.lead);
        setInteracoes(dados.interacoes);
        setMensagens(dados.mensagens);
        setMesa(campoInicialPrecificacao(dados.lead));
        setOperacao({ volume: paraCampo(dados.lead.volume_real_mes), med: paraCampo(dados.lead.med_real_mes) });
      })
      .catch((e) => ativo && setErro(e.message));
    return () => {
      ativo = false;
    };
  }, [leadId]);

  useEffect(() => {
    const fechar = (e) => e.key === "Escape" && onFechar();
    window.addEventListener("keydown", fechar);
    return () => window.removeEventListener("keydown", fechar);
  }, [onFechar]);

  async function salvar(corpo, sucesso) {
    setSalvando(true);
    setMensagem(null);
    try {
      const atualizado = await patchLead({ id: leadId, ...corpo });
      setLead(atualizado);
      onAtualizado(atualizado);
      setMensagem({ tipo: "ok", texto: sucesso });
      return atualizado;
    } catch (e) {
      setMensagem({ tipo: "erro", texto: e.message });
      return null;
    } finally {
      setSalvando(false);
    }
  }

  async function trocarFornecedor(novo) {
    const valor = novo || null;
    if (valor === lead.fornecedor_operacao) return;
    if (!valor && exigeFornecedor(lead.status_kanban)) {
      setMensagem({ tipo: "erro", texto: `Na fase "${lead.status_kanban}" o fornecedor é obrigatório.` });
      return;
    }
    const temPrecificacao = Object.keys(lead.dados_precificacao?.itens ?? {}).length > 0;
    if (temPrecificacao && !window.confirm("Trocar o fornecedor descarta a precificação atual. Continuar?")) return;
    const atualizado = await salvar({ fornecedor_operacao: valor }, valor ? `Fornecedor definido: ${valor}.` : "Fornecedor removido.");
    if (atualizado) {
      setMesa(campoInicialPrecificacao(atualizado));
      setMesaAlterada(false);
    }
  }

  async function trocarFase(fase) {
    if (fase === lead.status_kanban) return;
    if (exigeFornecedor(fase) && !lead.fornecedor_operacao) {
      setMensagem({ tipo: "erro", texto: `Selecione o fornecedor antes de mover para "${fase}".` });
      return;
    }
    await salvar({ status_kanban: fase }, `Movido para "${fase}".`);
  }

  // Valores digitados → números (NaN = inválido).
  const mesaNumerica = useMemo(() => {
    const itens = {};
    for (const [id, v] of Object.entries(mesa.itens)) {
      itens[id] = { percentual: lerDecimal(v.percentual), fixo: lerDecimal(v.fixo) };
    }
    return { valorReferencia: lerDecimal(mesa.valorReferencia), itens };
  }, [mesa]);

  const linhas = useMemo(() => {
    if (!lead?.fornecedor_operacao) return [];
    const ref = Number.isNaN(mesaNumerica.valorReferencia) ? null : mesaNumerica.valorReferencia;
    const itensValidos = Object.fromEntries(
      Object.entries(mesaNumerica.itens).map(([id, v]) => [
        id,
        {
          percentual: Number.isNaN(v.percentual) ? null : v.percentual,
          fixo: Number.isNaN(v.fixo) ? null : v.fixo,
        },
      ]),
    );
    return linhasDaMesa(lead.fornecedor_operacao, itensValidos, ref);
  }, [lead?.fornecedor_operacao, mesaNumerica]);

  const camposInvalidos = Number.isNaN(mesaNumerica.valorReferencia)
    || Object.values(mesaNumerica.itens).some((v) => Number.isNaN(v.percentual) || Number.isNaN(v.fixo));

  function editarItem(id, campo, valor) {
    setMesa((m) => ({ ...m, itens: { ...m.itens, [id]: { ...m.itens[id], [campo]: valor } } }));
    setMesaAlterada(true);
  }

  async function salvarMesa() {
    const itens = {};
    for (const [id, v] of Object.entries(mesaNumerica.itens)) {
      if (v.percentual === null && v.fixo === null) continue;
      itens[id] = { percentual: v.percentual, fixo: v.fixo };
    }
    const ok = await salvar(
      { dados_precificacao: { valor_referencia: mesaNumerica.valorReferencia, itens } },
      "Precificação salva.",
    );
    if (ok) setMesaAlterada(false);
  }

  async function salvarOperacao() {
    const volume = lerDecimal(operacao.volume) ?? 0;
    const med = lerDecimal(operacao.med) ?? 0;
    if (Number.isNaN(volume) || Number.isNaN(med)) {
      setMensagem({ tipo: "erro", texto: "Use só números no volume e no MED (ex.: 150000,00 e 0,35)." });
      return;
    }
    await salvar({ volume_real_mes: volume, med_real_mes: med }, "Acompanhamento operacional salvo.");
  }

  const grupos = useMemo(() => {
    const mapa = new Map();
    for (const linha of linhas) {
      if (!mapa.has(linha.custo.grupo)) mapa.set(linha.custo.grupo, []);
      mapa.get(linha.custo.grupo).push(linha);
    }
    return [...mapa.entries()];
  }, [linhas]);

  const emOperacao = lead && FASES_OPERACAO.includes(lead.status_kanban);
  const whatsapp = lead ? soDigitos(lead.whatsapp_contato || lead.phone_number) : "";
  const versaoAntiga = lead?.dados_precificacao && lead.dados_precificacao.versao_tabela !== VERSAO_TABELA_CUSTOS;

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <button type="button" aria-label="Fechar ficha" onClick={onFechar} className="absolute inset-0 bg-slate-900/40" />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="ficha-titulo"
        className="relative flex h-full w-full max-w-4xl flex-col overflow-y-auto bg-slate-50 shadow-xl"
      >
        {!lead ? (
          <div className="p-6">
            <button type="button" onClick={onFechar} className="text-sm text-slate-600 underline">Fechar</button>
            <p className={`mt-4 ${erro ? "text-red-700" : "text-slate-500"}`}>{erro ?? "Carregando ficha…"}</p>
          </div>
        ) : (
          <>
            {/* Cabeçalho */}
            <header className="sticky top-0 z-10 border-b border-slate-200 bg-white px-4 py-4 sm:px-6">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 id="ficha-titulo" className="truncate text-lg font-semibold text-slate-900">
                    {lead.nome_ou_razao_social ?? "Sem nome"}
                  </h2>
                  <p className="text-sm text-slate-500">
                    {lead.documento ?? "Documento não informado"}
                    {lead.tipo_pessoa ? ` · ${lead.tipo_pessoa}` : ""}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <BadgeFornecedor fornecedor={lead.fornecedor_operacao} />
                    <span className="rounded border border-slate-300 bg-slate-50 px-1.5 py-0.5 text-xs text-slate-700">
                      {lead.status_kanban}
                    </span>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {whatsapp && (
                    <a
                      href={`https://wa.me/${whatsapp}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700"
                    >
                      WhatsApp
                    </a>
                  )}
                  <button type="button" onClick={onFechar} className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50">
                    Fechar
                  </button>
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className="text-sm">
                  <span className="mb-1 block font-medium text-slate-700">Fase</span>
                  <select
                    value={lead.status_kanban}
                    disabled={salvando}
                    onChange={(e) => trocarFase(e.target.value)}
                    className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5"
                  >
                    {FASES.map((f, i) => (
                      <option key={f.id} value={f.id}>{`${i + 1}. ${f.id}`}</option>
                    ))}
                  </select>
                </label>
                <fieldset className="text-sm">
                  <legend className="mb-1 font-medium text-slate-700">Fornecedor da operação</legend>
                  <div className="flex flex-wrap gap-2">
                    {[...FORNECEDORES, null].map((f) => {
                      const ativo = (lead.fornecedor_operacao ?? null) === f;
                      const bloqueado = f === null && exigeFornecedor(lead.status_kanban);
                      return (
                        <button
                          key={f ?? "nenhum"}
                          type="button"
                          aria-pressed={ativo}
                          disabled={salvando || bloqueado}
                          onClick={() => trocarFornecedor(f)}
                          className={`rounded-md border px-3 py-1.5 font-medium disabled:cursor-not-allowed disabled:opacity-50 ${
                            ativo ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                          }`}
                        >
                          {f ? `${ESTILO_FORNECEDOR[f].icone} ${f}` : "Sem parceiro"}
                        </button>
                      );
                    })}
                  </div>
                </fieldset>
              </div>

              {faseDesejada && lead.status_kanban !== faseDesejada && (
                <div className="mt-3 flex flex-wrap items-center gap-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  <span>
                    {lead.fornecedor_operacao
                      ? `Fornecedor definido. Pode mover para "${faseDesejada}".`
                      : `Para mover para "${faseDesejada}", escolha o fornecedor acima.`}
                  </span>
                  {lead.fornecedor_operacao && (
                    <button
                      type="button"
                      disabled={salvando}
                      onClick={() => trocarFase(faseDesejada)}
                      className="rounded-md bg-slate-900 px-3 py-1 font-medium text-white"
                    >
                      Mover para {faseDesejada}
                    </button>
                  )}
                </div>
              )}

              {mensagem && (
                <p role="status" className={`mt-3 text-sm ${mensagem.tipo === "erro" ? "text-red-700" : "text-emerald-700"}`}>
                  {mensagem.texto}
                </p>
              )}
            </header>

            <div className="flex flex-col gap-4 p-4 sm:p-6">
              {/* Bloco 1 */}
              <Bloco titulo="Diagnóstico da IA">
                <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
                  {DIAGNOSTICO.map(([campo, rotulo]) => (
                    <div key={campo} className="min-w-0">
                      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{rotulo}</dt>
                      <dd className="break-words text-sm text-slate-900">{valorDiagnostico(lead, campo)}</dd>
                    </div>
                  ))}
                </dl>
              </Bloco>

              {/* Bloco 2 */}
              <Bloco titulo="Resumo executivo da IA">
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-800">
                  {lead.resumo_executivo || <span className="text-slate-400">Sem resumo.</span>}
                </p>
              </Bloco>

              {/* Bloco 3 */}
              <Bloco
                titulo={`Mesa de precificação${lead.fornecedor_operacao ? ` · ${lead.fornecedor_operacao}` : ""}`}
                acao={
                  lead.fornecedor_operacao && (
                    <button
                      type="button"
                      onClick={salvarMesa}
                      disabled={salvando || !mesaAlterada || camposInvalidos}
                      className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40"
                    >
                      Salvar precificação
                    </button>
                  )
                }
              >
                {!lead.fornecedor_operacao ? (
                  <p className="text-sm text-slate-500">Selecione o fornecedor para carregar a tabela de custos.</p>
                ) : (
                  <>
                    <div className="mb-3 flex flex-wrap items-end gap-3 text-sm">
                      <label>
                        <span className="mb-1 block font-medium text-slate-700">Valor de referência por transação (R$)</span>
                        <input
                          type="text"
                          inputMode="decimal"
                          placeholder="ex.: 150,00"
                          value={mesa.valorReferencia}
                          onChange={(e) => {
                            setMesa((m) => ({ ...m, valorReferencia: e.target.value }));
                            setMesaAlterada(true);
                          }}
                          className="w-40 rounded-md border border-slate-300 bg-white px-2 py-1.5"
                        />
                      </label>
                      <p className="max-w-md text-xs text-slate-500">
                        Opcional. Com ele, o spread também aparece em reais por transação. Tabela de custo de {VERSAO_TABELA_CUSTOS.split("-").reverse().join("/")}.
                      </p>
                    </div>
                    {versaoAntiga && (
                      <p className="mb-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                        Esta precificação foi salva com a tabela de {lead.dados_precificacao.versao_tabela}. Os custos abaixo já são os atuais.
                      </p>
                    )}
                    {camposInvalidos && <p className="mb-3 text-sm text-red-700">Há valores inválidos. Use números, por exemplo 1,25.</p>}
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[680px] text-sm">
                        <thead>
                          <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                            <th className="py-2 pr-3 font-medium">Produto</th>
                            <th className="py-2 pr-3 font-medium">Custo base</th>
                            <th className="py-2 pr-3 font-medium">Cobrado do cliente</th>
                            <th className="py-2 font-medium">Spread (lucro unitário)</th>
                          </tr>
                        </thead>
                        {grupos.map(([grupo, itens]) => (
                          <tbody key={grupo}>
                            <tr>
                              <th colSpan={4} className="bg-slate-50 px-2 py-1.5 text-left text-xs font-semibold text-slate-700">{grupo}</th>
                            </tr>
                            {itens.map(({ custo, spread }) => {
                              const valor = mesa.itens[custo.id] ?? { percentual: "", fixo: "" };
                              const naoInformado = custo.percentual === null || custo.fixo === null;
                              const simbolo = custo.moeda === "USD" ? "US$" : "R$";
                              return (
                                <tr key={custo.id} className="border-b border-slate-100 align-top">
                                  <td className="py-2 pr-3">
                                    <span className="text-slate-900">{custo.produto}</span>
                                    {custo.liquidacao && <span className="ml-1 text-xs text-slate-500">({custo.liquidacao})</span>}
                                    {custo.unidade !== "por transação" && <span className="block text-xs text-slate-500">{custo.unidade}</span>}
                                    {custo.observacao && <span className="block text-xs text-slate-500">{custo.observacao}</span>}
                                  </td>
                                  <td className="py-2 pr-3 whitespace-nowrap text-slate-700">
                                    {naoInformado ? (
                                      <span className="text-amber-700">Custo não informado</span>
                                    ) : (
                                      [
                                        custo.percentual ? percentual(custo.percentual) : null,
                                        custo.fixo || !custo.percentual ? dinheiro(custo.fixo, custo.moeda) : null,
                                      ].filter(Boolean).join(" + ")
                                    )}
                                  </td>
                                  <td className="py-2 pr-3">
                                    <div className="flex items-center gap-1">
                                      <input
                                        type="text"
                                        inputMode="decimal"
                                        aria-label={`${custo.grupo} ${custo.produto}: percentual cobrado`}
                                        placeholder="%"
                                        value={valor.percentual}
                                        onChange={(e) => editarItem(custo.id, "percentual", e.target.value)}
                                        className="w-20 rounded-md border border-slate-300 bg-white px-2 py-1"
                                      />
                                      <span className="text-slate-400">+</span>
                                      <input
                                        type="text"
                                        inputMode="decimal"
                                        aria-label={`${custo.grupo} ${custo.produto}: valor fixo cobrado`}
                                        placeholder={simbolo}
                                        value={valor.fixo}
                                        onChange={(e) => editarItem(custo.id, "fixo", e.target.value)}
                                        className="w-20 rounded-md border border-slate-300 bg-white px-2 py-1"
                                      />
                                    </div>
                                  </td>
                                  <td className="py-2" data-spread={custo.id}>
                                    <TextoSpread spread={spread} moeda={custo.moeda} />
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        ))}
                      </table>
                    </div>
                  </>
                )}
              </Bloco>

              {/* Bloco 4 */}
              <Bloco
                titulo="Auditoria operacional"
                acao={
                  emOperacao && (
                    <button
                      type="button"
                      onClick={salvarOperacao}
                      disabled={salvando}
                      className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40"
                    >
                      Salvar acompanhamento
                    </button>
                  )
                }
              >
                {!emOperacao && (
                  <p className="mb-3 text-sm text-slate-500">Disponível nas fases “Operando” e “Operando dentro das expectativas”.</p>
                )}
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="text-sm">
                    <span className="mb-1 block font-medium text-slate-700">Volume real no mês (R$)</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      disabled={!emOperacao}
                      value={operacao.volume}
                      onChange={(e) => setOperacao((o) => ({ ...o, volume: e.target.value }))}
                      className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 disabled:bg-slate-100"
                    />
                    <span className="mt-1 block text-xs text-slate-500">Declarado no diagnóstico: {lead.volume_mensal ?? "não informado"}</span>
                  </label>
                  <label className="text-sm">
                    <span className="mb-1 block font-medium text-slate-700">MED real no mês (%)</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      disabled={!emOperacao}
                      value={operacao.med}
                      onChange={(e) => setOperacao((o) => ({ ...o, med: e.target.value }))}
                      className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 disabled:bg-slate-100"
                    />
                    <span className="mt-1 block text-xs text-slate-500">Declarado no diagnóstico: {lead.taxa_med_operacao ?? "não informado"}</span>
                  </label>
                </div>
              </Bloco>

              {/* Conversa com a IA */}
              <Bloco titulo={`Conversa no WhatsApp (${mensagens.length})`}>
                {mensagens.length === 0 ? (
                  <p className="text-sm text-slate-500">Nenhuma mensagem registrada.</p>
                ) : (
                  <ol className="flex max-h-96 flex-col gap-2 overflow-y-auto pr-1">
                    {mensagens.map((m) => {
                      const doCliente = m.role === "user";
                      return (
                        <li key={m.id} className={`flex ${doCliente ? "justify-start" : "justify-end"}`}>
                          <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${doCliente ? "bg-white border border-slate-200 text-slate-800" : "bg-emerald-50 border border-emerald-200 text-slate-800"}`}>
                            <p className="text-xs text-slate-500">{doCliente ? "Cliente" : "IA"} · {m.created_at}</p>
                            <p className="whitespace-pre-wrap break-words">{m.content}</p>
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                )}
              </Bloco>

              {/* Linha do tempo */}
              <Bloco titulo="Linha do tempo de interações">
                {interacoes.length === 0 ? (
                  <p className="text-sm text-slate-500">Nenhuma interação registrada ainda.</p>
                ) : (
                  <ol className="flex flex-col gap-3">
                    {interacoes.map((i) => (
                      <li key={i.id} className="border-l-2 border-slate-300 pl-3">
                        <p className="text-xs text-slate-500">
                          {i.created_at} · {i.tipo ?? "interação"}
                          {i.status_envio && i.status_envio !== "sucesso" ? ` · ${i.status_envio}` : ""}
                        </p>
                        {i.assunto && <p className="text-sm font-medium text-slate-900">{i.assunto}</p>}
                        {i.mensagem && <p className="whitespace-pre-wrap text-sm text-slate-700">{i.mensagem}</p>}
                      </li>
                    ))}
                  </ol>
                )}
              </Bloco>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}
