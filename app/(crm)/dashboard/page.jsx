"use client";

// Dashboard Executivo: meta de lucro, TPV, contas em operação, conversão do funil,
// alocação por parceiro e auditoria de risco (MED). Dados de /api/dashboard/metrics.

import { useCallback, useEffect, useState } from "react";
import { buscarMetricas } from "../../../lib/apiLeads.js";
import { KLUUBPAY, PUSHIN_PAY } from "../../../lib/custosParceiros.js";
import ClientDetailView, { BadgeFornecedor } from "../../../components/ClientDetailView.jsx";
import AprovacoesPendentes from "../../../components/AprovacoesPendentes.jsx";

const PERIODOS = [
  ["mes", "Este mês"],
  ["90d", "Últimos 90 dias"],
  ["tudo", "Desde o início"],
];

// Cores por entidade (validadas): sempre acompanhadas do nome escrito ao lado.
const COR_PARCEIRO = { [PUSHIN_PAY]: "#1baf7a", [KLUUBPAY]: "#2a78d6", null: "#a3a29b" };
const COR_FUNIL = "#2a78d6";

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const BRL_COMPACTO = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", notation: "compact", maximumFractionDigits: 1 });
const PCT = new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 1 });
const NUM = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });

const compacto = (v) => (Math.abs(v) >= 10000 ? BRL_COMPACTO.format(v) : BRL.format(v));
const porcento = (v) => (v === null || v === undefined ? "—" : PCT.format(v));

const STATUS_MED = {
  dentro: { rotulo: "Dentro do teto", icone: "✓", classe: "border-green-300 bg-green-50 text-green-800" },
  acima: { rotulo: "Acima do teto", icone: "▲", classe: "border-red-300 bg-red-50 text-red-800" },
  sem_referencia: { rotulo: "Sem teto declarado", icone: "–", classe: "border-slate-300 bg-slate-50 text-slate-700" },
  sem_lancamento: { rotulo: "Sem lançamento", icone: "–", classe: "border-slate-300 bg-slate-50 text-slate-700" },
};

function Tile({ rotulo, valor, detalhe, children, destaque = false }) {
  return (
    <section className={`rounded-lg border bg-white p-4 ${destaque ? "border-slate-400 sm:col-span-2" : "border-slate-200"}`}>
      <h2 className="text-sm font-medium text-slate-600">{rotulo}</h2>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{valor}</p>
      {children}
      {detalhe && <p className="mt-1 text-xs text-slate-500">{detalhe}</p>}
    </section>
  );
}

/** Medidor da meta: trilho claro do mesmo tom; verde ao bater a meta. */
function MedidorMeta({ progresso }) {
  const largura = Math.max(0, Math.min(progresso, 1)) * 100;
  const batida = progresso >= 1;
  return (
    <div className="mt-3">
      <div
        role="meter"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progresso * 100)}
        aria-label="Progresso da meta de lucro"
        className="h-2.5 w-full overflow-hidden rounded-full"
        style={{ background: batida ? "#cfeccf" : "#cde2fb" }}
      >
        <div className="h-full rounded-full" style={{ width: `${largura}%`, background: batida ? "#0ca30c" : "#2a78d6" }} />
      </div>
      <p className="mt-1 text-sm tabular-nums text-slate-700">
        {porcento(Math.max(progresso, 0))} da meta{batida ? " · meta batida ✓" : ""}
      </p>
    </div>
  );
}

function Funil({ funil }) {
  const maior = Math.max(1, ...funil.fases.map((f) => f.quantidade));
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-slate-800">Leads por fase</h2>
      <p className="text-xs text-slate-500">Leads que entraram no CRM no período, pela fase atual.</p>
      <ol className="mt-3 flex flex-col gap-2">
        {funil.fases.map((f, i) => (
          <li key={f.fase} className="grid grid-cols-[minmax(0,11rem)_1fr_2.5rem] items-center gap-2 text-sm" title={`${f.fase}: ${f.quantidade}`}>
            <span className="truncate text-slate-700">{i + 1}. {f.fase}</span>
            <span className="h-3 rounded-r" style={{ width: f.quantidade ? `${(f.quantidade / maior) * 100}%` : "0", minWidth: f.quantidade ? 4 : 0, background: COR_FUNIL }} />
            <span className="text-right tabular-nums text-slate-900">{f.quantidade}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

function BarraSegmentada({ partes, chave, rotulo }) {
  const total = partes.reduce((s, p) => s + p[chave], 0);
  return (
    <div>
      <p className="mb-1 text-xs font-medium text-slate-600">{rotulo}</p>
      {total === 0 ? (
        <div className="h-2 rounded-full bg-slate-100" title="Sem dados" />
      ) : (
        <div className="flex h-2 gap-0.5 overflow-hidden rounded-full" role="img" aria-label={partes.map((p) => `${p.rotulo} ${porcento(p[chave] / total)}`).join(", ")}>
          {partes.filter((p) => p[chave] > 0).map((p) => (
            <span key={p.rotulo} style={{ width: `${(p[chave] / total) * 100}%`, background: COR_PARCEIRO[p.fornecedor] }} title={`${p.rotulo}: ${porcento(p[chave] / total)}`} />
          ))}
        </div>
      )}
    </div>
  );
}

function Parceiros({ carteira }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-slate-800">Alocação por parceiro</h2>
      <p className="text-xs text-slate-500">Carteira atual. Volume = último volume real das contas em operação.</p>
      <div className="mt-3 flex flex-col gap-3">
        <BarraSegmentada partes={carteira.parceiros} chave="clientes" rotulo="Clientes" />
        <BarraSegmentada partes={carteira.parceiros} chave="volume" rotulo="Volume real (TPV)" />
      </div>
      <table className="mt-4 w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
            <th className="py-1.5 font-medium">Parceiro</th>
            <th className="py-1.5 text-right font-medium">Clientes</th>
            <th className="py-1.5 text-right font-medium">Operando</th>
            <th className="py-1.5 text-right font-medium">Volume real</th>
          </tr>
        </thead>
        <tbody>
          {carteira.parceiros.map((p) => (
            <tr key={p.rotulo} className="border-b border-slate-100">
              <td className="py-2">
                <span className="mr-2 inline-block h-2.5 w-2.5 rounded-full align-middle" style={{ background: COR_PARCEIRO[p.fornecedor] }} aria-hidden="true" />
                <span className="text-slate-900">{p.rotulo}</span>
              </td>
              <td className="py-2 text-right tabular-nums text-slate-900">
                {p.clientes} <span className="text-xs text-slate-500">({porcento(p.percentual_clientes)})</span>
              </td>
              <td className="py-2 text-right tabular-nums text-slate-900">{p.em_operacao}</td>
              <td className="py-2 text-right tabular-nums text-slate-900">
                {compacto(p.volume)} <span className="text-xs text-slate-500">({porcento(p.percentual_volume)})</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function BadgeMed({ status }) {
  const s = STATUS_MED[status];
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded border px-1.5 py-0.5 text-xs font-medium ${s.classe}`}>
      <span aria-hidden="true">{s.icone}</span> {s.rotulo}
    </span>
  );
}

function Auditoria({ contas, alertas, abrir }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-200 px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-800">Auditoria operacional e risco</h2>
          <p className="text-xs text-slate-500">Contas em “Operando” e “Operando dentro das expectativas”. Clique para abrir o card.</p>
        </div>
        {alertas > 0 && (
          <p role="alert" className="rounded border border-red-300 bg-red-50 px-2 py-1 text-sm font-medium text-red-800">
            ▲ {alertas} {alertas === 1 ? "conta" : "contas"} com MED acima do teto declarado
          </p>
        )}
      </div>
      {contas.length === 0 ? (
        <p className="px-4 py-6 text-sm text-slate-500">Nenhuma conta em operação ainda.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                <th className="px-4 py-2 font-medium">Cliente</th>
                <th className="px-2 py-2 font-medium">Parceiro</th>
                <th className="px-2 py-2 text-right font-medium">Volume declarado</th>
                <th className="px-2 py-2 text-right font-medium">Volume real</th>
                <th className="px-2 py-2 text-right font-medium">MED real / teto</th>
                <th className="px-2 py-2 text-right font-medium">Lucro no mês</th>
                <th className="px-4 py-2 font-medium">Status do MED</th>
              </tr>
            </thead>
            <tbody>
              {contas.map((c) => (
                <tr
                  key={c.id}
                  onClick={() => abrir(c.id)}
                  className={`cursor-pointer border-b border-slate-100 hover:bg-slate-50 ${c.med_status === "acima" ? "bg-red-50/40" : ""}`}
                >
                  <td className="px-4 py-2">
                    <button type="button" onClick={(e) => { e.stopPropagation(); abrir(c.id); }} className="text-left font-medium text-slate-900 underline-offset-2 hover:underline">
                      {c.nome ?? "Sem nome"}
                    </button>
                    {c.documento && <span className="block text-xs text-slate-500">{c.documento}</span>}
                  </td>
                  <td className="px-2 py-2"><BadgeFornecedor fornecedor={c.fornecedor} /></td>
                  <td className="px-2 py-2 text-right text-slate-700">{c.volume_declarado_texto ?? "—"}</td>
                  <td className="px-2 py-2 text-right tabular-nums text-slate-900">
                    {BRL.format(c.volume_real)}
                    {c.atingimento_volume !== null && (
                      <span className="block text-xs text-slate-500">{porcento(c.atingimento_volume)} do declarado</span>
                    )}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums text-slate-900">
                    {NUM.format(c.med_real)}%
                    <span className="block text-xs text-slate-500">teto {c.med_teto !== null ? `${NUM.format(c.med_teto)}%` : (c.med_teto_texto ?? "não informado")}</span>
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums text-slate-900">{c.lucro_real ? BRL.format(c.lucro_real) : "—"}</td>
                  <td className="px-4 py-2"><BadgeMed status={c.med_status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default function DashboardPage() {
  const [periodo, setPeriodo] = useState("mes");
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState(null);
  const [aberto, setAberto] = useState(null);

  const carregar = useCallback(async () => {
    try {
      setDados(await buscarMetricas(periodo));
      setErro(null);
    } catch (e) {
      setErro(e.message);
    }
  }, [periodo]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  return (
    <main className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-5 sm:px-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Dashboard executivo</h1>
          <p className="text-sm text-slate-500">Funil e conversão pelo período. TPV, lucro e MED: último valor lançado em cada conta.</p>
        </div>
        <div role="group" aria-label="Período" className="flex flex-wrap gap-1">
          {PERIODOS.map(([id, rotulo]) => (
            <button
              key={id}
              type="button"
              aria-pressed={periodo === id}
              onClick={() => setPeriodo(id)}
              className={`rounded-md border px-3 py-1.5 text-sm font-medium ${
                periodo === id ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              {rotulo}
            </button>
          ))}
        </div>
      </header>

      <AprovacoesPendentes onDecidido={carregar} />

      {erro && (
        <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
          {erro} <button type="button" onClick={carregar} className="ml-2 underline">Tentar de novo</button>
        </div>
      )}
      {!dados && !erro && <p className="text-slate-500">Carregando métricas…</p>}

      {dados && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <Tile
              destaque
              rotulo={`Meta de lucro líquido (${BRL.format(dados.lucro.meta)})`}
              valor={BRL.format(dados.lucro.realizado)}
              detalhe={`Lucro lançado em ${dados.lucro.contas_com_lancamento} de ${dados.operacao.contas_em_operacao} contas em operação.`}
            >
              <MedidorMeta progresso={dados.lucro.progresso} />
            </Tile>
            <Tile
              rotulo="TPV mensal transacionado"
              valor={compacto(dados.operacao.tpv)}
              detalhe={dados.operacao.volume_declarado > 0
                ? `${porcento(dados.operacao.atingimento_volume)} do volume declarado (${compacto(dados.operacao.volume_declarado)})`
                : "Volume declarado sem valor numérico"}
            />
            <Tile rotulo="Contas em operação" valor={dados.operacao.contas_em_operacao} detalhe="Fases 6 e 7 do pipeline" />
            <Tile
              rotulo={`Conversão do funil · ${dados.periodo.rotulo.toLowerCase()}`}
              valor={porcento(dados.funil.conversao)}
              detalhe={`${dados.funil.convertidos} de ${dados.funil.total} leads chegaram a Aprovado ou adiante`}
            />
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <Funil funil={dados.funil} />
            <Parceiros carteira={dados.carteira} />
          </div>

          <Auditoria contas={dados.contas} alertas={dados.alertas_med.length} abrir={setAberto} />
        </>
      )}

      {aberto && (
        <ClientDetailView
          key={aberto}
          leadId={aberto}
          onFechar={() => {
            setAberto(null);
            carregar(); // o consultor pode ter lançado volume, MED ou lucro
          }}
          onAtualizado={() => {}}
        />
      )}
    </main>
  );
}
