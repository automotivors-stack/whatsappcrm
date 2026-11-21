// Métricas do Dashboard Executivo. Consultas agregadas e parametrizadas em `oportunidades`.
//
// Dois recortes diferentes, ditos na resposta:
//  - Funil e conversão: leads que entraram no CRM no PERÍODO escolhido (created_at).
//  - Carteira, TPV, lucro e MED: retrato ATUAL, com o último valor lançado em cada conta
//    (o banco guarda um valor por conta, não o histórico mês a mês).

import { FASES_OPERACAO, NOMES_FASES, exigeFornecedor } from "../lib/kanban.js";
import { FORNECEDORES } from "../lib/custosParceiros.js";
import { lerPercentual, lerValorBR } from "../lib/numeros.js";
import { ErroLeads, FILTRO_SEM_PARCEIRO } from "./leads.js";

/** Período → modificador do datetime() do SQLite (valores fixos; nunca vêm da requisição). */
export const PERIODOS = {
  mes: { rotulo: "Este mês", modificador: "start of month" },
  "90d": { rotulo: "Últimos 90 dias", modificador: "-90 days" },
  tudo: { rotulo: "Desde o início", modificador: null },
};

/** Meta de lucro líquido mensal: configuração (META_LUCRO_MENSAL), padrão R$ 25.000. */
export function metaLucroMensal() {
  const v = Number(process.env.META_LUCRO_MENSAL);
  return Number.isFinite(v) && v > 0 ? v : 25000;
}

const num = (v) => (v === null || v === undefined ? 0 : Number(v));
const pct = (parte, todo) => (todo > 0 ? parte / todo : null);

/** Situação do MED de uma conta em operação. */
export function statusMed({ volumeReal, medReal, teto }) {
  if (volumeReal === 0 && medReal === 0) return "sem_lancamento";
  if (teto === null) return "sem_referencia";
  return medReal > teto ? "acima" : "dentro";
}

export async function obterMetricas(db, { periodo = "mes" } = {}) {
  const p = PERIODOS[periodo];
  if (!p) throw new ErroLeads(`Período inválido. Use ${Object.keys(PERIODOS).join(", ")}.`, 400);
  const filtro = p.modificador ? "WHERE created_at >= datetime('now', ?)" : "";
  const argsPeriodo = p.modificador ? [p.modificador] : [];

  const [fases, parceiros, operando] = await Promise.all([
    db.execute({
      sql: `SELECT status_kanban AS fase, COUNT(*) AS n FROM oportunidades ${filtro} GROUP BY status_kanban`,
      args: argsPeriodo,
    }),
    db.execute({
      sql: `SELECT fornecedor_operacao AS fornecedor, COUNT(*) AS clientes,
              SUM(CASE WHEN status_kanban IN (?, ?) THEN 1 ELSE 0 END) AS em_operacao,
              SUM(CASE WHEN status_kanban IN (?, ?) THEN volume_real_mes ELSE 0 END) AS volume
            FROM oportunidades GROUP BY fornecedor_operacao`,
      args: [...FASES_OPERACAO, ...FASES_OPERACAO],
    }),
    db.execute({
      sql: `SELECT id, nome_ou_razao_social, documento, fornecedor_operacao, status_kanban, volume_mensal,
                   volume_real_mes, med_real_mes, taxa_med_operacao, lucro_real_mes
            FROM oportunidades WHERE status_kanban IN (?, ?)
            ORDER BY volume_real_mes DESC, id`,
      args: FASES_OPERACAO,
    }),
  ]);

  // ---- funil (período) ----
  const contagem = Object.fromEntries(fases.rows.map((r) => [r.fase, num(r.n)]));
  const funil = NOMES_FASES.map((fase) => ({ fase, quantidade: contagem[fase] ?? 0 }));
  const totalPeriodo = funil.reduce((s, f) => s + f.quantidade, 0);
  const convertidos = funil.filter((f) => exigeFornecedor(f.fase)).reduce((s, f) => s + f.quantidade, 0);

  // ---- contas em operação (retrato atual) ----
  const contas = operando.rows.map((r) => {
    const volumeReal = num(r.volume_real_mes);
    const medReal = num(r.med_real_mes);
    const volumeDeclarado = lerValorBR(r.volume_mensal);
    const teto = lerPercentual(r.taxa_med_operacao);
    return {
      id: Number(r.id),
      nome: r.nome_ou_razao_social,
      documento: r.documento,
      fornecedor: r.fornecedor_operacao,
      fase: r.status_kanban,
      volume_declarado_texto: r.volume_mensal,
      volume_declarado: volumeDeclarado,
      volume_real: volumeReal,
      atingimento_volume: volumeDeclarado ? volumeReal / volumeDeclarado : null,
      med_real: medReal,
      med_teto_texto: r.taxa_med_operacao,
      med_teto: teto,
      med_status: statusMed({ volumeReal, medReal, teto }),
      lucro_real: num(r.lucro_real_mes),
    };
  });
  const tpv = contas.reduce((s, c) => s + c.volume_real, 0);
  const volumeDeclaradoTotal = contas.reduce((s, c) => s + (c.volume_declarado ?? 0), 0);
  const lucro = contas.reduce((s, c) => s + c.lucro_real, 0);
  const meta = metaLucroMensal();

  // ---- carteira por parceiro (retrato atual, todos os cards) ----
  const porChave = Object.fromEntries(parceiros.rows.map((r) => [r.fornecedor ?? FILTRO_SEM_PARCEIRO, r]));
  const totalClientes = parceiros.rows.reduce((s, r) => s + num(r.clientes), 0);
  const carteira = [...FORNECEDORES, FILTRO_SEM_PARCEIRO].map((chave) => {
    const r = porChave[chave];
    const clientes = num(r?.clientes);
    const volume = num(r?.volume);
    return {
      fornecedor: chave === FILTRO_SEM_PARCEIRO ? null : chave,
      rotulo: chave === FILTRO_SEM_PARCEIRO ? "Sem parceiro" : chave,
      clientes,
      percentual_clientes: pct(clientes, totalClientes),
      em_operacao: num(r?.em_operacao),
      volume,
      percentual_volume: pct(volume, tpv),
    };
  });

  return {
    periodo: { id: periodo, rotulo: p.rotulo },
    funil: { fases: funil, total: totalPeriodo, convertidos, conversao: pct(convertidos, totalPeriodo) },
    operacao: {
      referencia: "último valor lançado em cada conta",
      contas_em_operacao: contas.length,
      tpv,
      volume_declarado: volumeDeclaradoTotal,
      atingimento_volume: pct(tpv, volumeDeclaradoTotal),
    },
    lucro: {
      realizado: lucro,
      meta,
      progresso: lucro / meta,
      contas_com_lancamento: contas.filter((c) => c.lucro_real !== 0).length,
    },
    carteira: { total_clientes: totalClientes, parceiros: carteira },
    alertas_med: contas.filter((c) => c.med_status === "acima").map((c) => c.id),
    contas,
  };
}
