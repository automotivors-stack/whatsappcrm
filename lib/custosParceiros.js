// Matriz de custo base dos parceiros, transcrita do comando da Fase 2 (21/11/2026).
// Revisão 2 (21/11/2026): crédito D+1 da Pushin Pay parcela a parcela (1x a 18x), tabela enviada pelo consultor.
// Revisão 3 (21/11/2026): o fixo do cartão Pushin Pay é R$ 0,35 POR PARCELA (rodapé da tabela oficial,
// confirmado pelo consultor). O custo fixo da venda em Nx é 0,35 × N; por isso D+30 também
// passou a ter uma linha por parcela. Tabela válida para Visa e Mastercard.
// REGRA: nenhum valor aqui é estimado. O que a tabela recebida não informa fica `null`
// e aparece na tela como "custo não informado", sem cálculo de spread.
// Mudou a tabela do parceiro? Altere aqui e troque VERSAO_TABELA_CUSTOS: as precificações já
// salvas guardam a versão e o custo vigente no momento em que foram gravadas.

export const VERSAO_TABELA_CUSTOS = "2026-11-21.3";

/** "2026-11-21.2" → "21/11/2026 (revisão 2)"; "2026-11-21" → "21/11/2026". */
export function rotuloVersaoTabela(versao) {
  const [data = "", revisao] = String(versao ?? "").split(".");
  const [a, m, d] = data.split("-");
  if (!a || !m || !d) return String(versao ?? "");
  return `${d}/${m}/${a}${revisao ? ` (revisão ${revisao})` : ""}`;
}

// Crédito D+1 (antecipado) da Pushin Pay, % por número de parcelas (índice 0 = 1x).
const PUSHIN_CREDITO_D1 = [
  5.45, 6.16, 6.8, 7.43, 8.07, 8.7, 9.53, 10.16, 10.8,
  11.43, 12.07, 12.7, 13.34, 13.97, 14.61, 15.24, 15.88, 16.51,
];

// Crédito D+30 da Pushin Pay: 1x 4,18%; 2x a 6x 4,26%; 7x a 18x 4,45%.
const PUSHIN_CREDITO_D30 = Array.from({ length: 18 }, (_, i) => (i === 0 ? 4.18 : i < 6 ? 4.26 : 4.45));

// Fixo do cartão Pushin Pay: R$ 0,35 por parcela. Custo fixo de uma venda em Nx = 0,35 × N.
export const FIXO_POR_PARCELA_PUSHIN = 0.35;

export const PUSHIN_PAY = "Pushin Pay";
export const KLUUBPAY = "Kluubpay";
export const FORNECEDORES = [PUSHIN_PAY, KLUUBPAY];

// percentual: % sobre o valor da transação · fixo: valor fixo por transação, na `moeda`
// unidade "% a.m." = taxa mensal (antecipação), não por transação.
const item = (id, grupo, produto, percentual, fixo, extra = {}) => ({
  id, grupo, produto, percentual, fixo, moeda: "BRL", unidade: "por transação", ...extra,
});

function itemCartaoPushin(prazo, grupo, liquidacao, percentual, parcelas) {
  const fixo = Math.round(FIXO_POR_PARCELA_PUSHIN * parcelas * 100) / 100;
  const observacao = parcelas > 1
    ? `Fixo de R$ 0,35 × ${parcelas} parcelas por venda. Visa e Mastercard.`
    : "Visa e Mastercard.";
  return item(`credito_${prazo}_${parcelas}x`, grupo, `${parcelas}x`, percentual, fixo, { liquidacao, observacao, parcelas });
}

export const TABELAS_CUSTO = {
  [PUSHIN_PAY]: [
    item("pix_in_f1", "Pix In (D0)", "Faixa 1: até R$ 600,00", 0, 0.35, { liquidacao: "D0" }),
    item("pix_in_f2", "Pix In (D0)", "Faixa 2: acima de R$ 600,00 até R$ 2.000,00", 0.7, 0.35, { liquidacao: "D0" }),
    item("pix_in_f3", "Pix In (D0)", "Faixa 3: acima de R$ 2.000,00", 0.9, 0.35, { liquidacao: "D0" }),
    item("pix_out", "Saque / Pix Out", "Saque / Pix Out", 0, 1.2, { liquidacao: "D0" }),
    item("boleto", "Boleto", "Boleto / BolePix (por boleto liquidado)", 0, 2.0, { liquidacao: "D+1" }),
    ...PUSHIN_CREDITO_D30.map((pct, i) => itemCartaoPushin("d30", "Cartão de crédito D+30", "D+30", pct, i + 1)),
    ...PUSHIN_CREDITO_D1.map((pct, i) => itemCartaoPushin("d1", "Cartão de crédito D+1 (antecipado)", "D+1", pct, i + 1)),
    item("debito", "Cartão de débito", "Débito", 4.52, FIXO_POR_PARCELA_PUSHIN, {
      observacao: "Mesma taxa em D+1 e D+30. Visa e Mastercard.",
    }),
  ],
  [KLUUBPAY]: [
    item("pix_in", "Pix", "Pix In", 0, 1.5, { observacao: "Ou taxa negociada conforme perfil." }),
    item("pix_out", "Pix", "Pix Out (saque)", 0, 1.5),
    item("boleto_saldo", "Pagamentos com saldo", "Pagamento de boleto com saldo (por título)", 0, 1.5),
    item("qrcode_saldo", "Pagamentos com saldo", "Pagamento de QR Code com saldo", 0, 1.5),
    item("cripto_usdt", "Cripto", "Pix ➔ USDT", 3.5, 2.5, { observacao: "Mais custos de rede (variáveis, não incluídos)." }),
    item("prepago_emissao", "Cartão pré-pago", "Emissão", 0, 5.0, { moeda: "USD", unidade: "por cartão" }),
    item("prepago_recarga_pix", "Cartão pré-pago", "Recarga por Pix", 2.5, 2.5),
    item("prepago_recarga_saldo", "Cartão pré-pago", "Recarga com saldo", 3.5, 1.5),
    item("credito_1x", "Cartão de crédito", "1x", 2.97, 0, { observacao: "Mais antecipação (ver linha própria)." }),
    item("credito_2a6", "Cartão de crédito", "2x a 6x", 3.33, 0, { observacao: "Mais antecipação (ver linha própria)." }),
    item("credito_7a18", "Cartão de crédito", "7x a 18x", 3.59, 0, { observacao: "Mais antecipação (ver linha própria)." }),
    item("credito_antecipacao", "Cartão de crédito", "Antecipação", 1.8, 0, { unidade: "% a.m." }),
    item("ted", "Transferências", "TED", 0, 3.99),
  ],
};

export function tabelaDe(fornecedor) {
  return TABELAS_CUSTO[fornecedor] ?? null;
}

export function itemDeCusto(fornecedor, id) {
  return tabelaDe(fornecedor)?.find((i) => i.id === id) ?? null;
}
