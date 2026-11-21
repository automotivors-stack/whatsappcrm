// Spread = taxa negociada (cobrada do cliente) − custo base do parceiro.
// Compartilhado entre a tela (tempo real) e o servidor (validação e gravação).

import { FORNECEDORES, VERSAO_TABELA_CUSTOS, itemDeCusto, tabelaDe } from "./custosParceiros.js";

const arred = (n, casas = 4) => Math.round(n * 10 ** casas) / 10 ** casas;
const numero = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);

/**
 * @param {object} custo  item da matriz (percentual/fixo podem ser null = não informado)
 * @param {{percentual?: number|null, fixo?: number|null}} cobrado  taxa negociada com o cliente
 * @param {number|null} valorReferencia  valor de uma transação típica, em R$ (opcional)
 * @returns {null | { pontosPercentuais: number, fixo: number, porTransacao: number|null }}
 *   null quando o custo não foi informado ou nada foi cobrado ainda.
 */
export function calcularSpread(custo, cobrado, valorReferencia = null) {
  if (!custo || !cobrado) return null;
  const pctCobrado = numero(cobrado.percentual);
  const fixoCobrado = numero(cobrado.fixo);
  if (pctCobrado === null && fixoCobrado === null) return null;
  if (custo.percentual === null || custo.fixo === null) return null; // custo não informado

  const pontosPercentuais = arred((pctCobrado ?? 0) - custo.percentual);
  const fixo = arred((fixoCobrado ?? 0) - custo.fixo);
  const ref = numero(valorReferencia);
  const aplicaValor = custo.moeda === "BRL" && custo.unidade === "por transação" && ref !== null && ref > 0;
  const porTransacao = aplicaValor ? arred((ref * pontosPercentuais) / 100 + fixo, 2) : null;
  return { pontosPercentuais, fixo, porTransacao };
}

export class ErroPrecificacao extends Error {}

/**
 * Valida o que veio da tela e monta o JSON gravado em `dados_precificacao`.
 * Guarda junto o custo base vigente (fotografia) e a versão da tabela.
 */
export function montarPrecificacao(fornecedor, entrada) {
  if (!FORNECEDORES.includes(fornecedor)) {
    throw new ErroPrecificacao("Selecione o fornecedor antes de precificar.");
  }
  if (!entrada || typeof entrada !== "object") throw new ErroPrecificacao("Precificação inválida.");

  const valorReferencia = entrada.valor_referencia ?? null;
  if (valorReferencia !== null && !(numero(valorReferencia) !== null && valorReferencia >= 0)) {
    throw new ErroPrecificacao("Valor de referência inválido.");
  }

  const itens = {};
  for (const [id, cobrado] of Object.entries(entrada.itens ?? {})) {
    const custo = itemDeCusto(fornecedor, id);
    if (!custo) throw new ErroPrecificacao(`Produto "${id}" não existe na tabela de ${fornecedor}.`);
    const percentual = cobrado?.percentual ?? null;
    const fixo = cobrado?.fixo ?? null;
    for (const [nome, v] of [["percentual", percentual], ["fixo", fixo]]) {
      if (v !== null && !(numero(v) !== null && v >= 0 && (nome !== "percentual" || v <= 100))) {
        throw new ErroPrecificacao(`Taxa ${nome} inválida em "${custo.produto}".`);
      }
    }
    if (percentual === null && fixo === null) continue;
    itens[id] = {
      percentual,
      fixo,
      custo_base: { percentual: custo.percentual, fixo: custo.fixo, moeda: custo.moeda },
    };
  }

  return {
    fornecedor,
    versao_tabela: VERSAO_TABELA_CUSTOS,
    valor_referencia: valorReferencia,
    itens,
    atualizado_em: new Date().toISOString(),
  };
}

/** Linhas prontas para a tela: custo + cobrado + spread. */
export function linhasDaMesa(fornecedor, itensCobrados = {}, valorReferencia = null) {
  return (tabelaDe(fornecedor) ?? []).map((custo) => {
    const cobrado = itensCobrados[custo.id] ?? {};
    return { custo, cobrado, spread: calcularSpread(custo, cobrado, valorReferencia) };
  });
}
