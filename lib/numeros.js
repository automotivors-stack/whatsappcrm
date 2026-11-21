// Leitura de valores que o diagnóstico guarda como texto livre ("R$ 150 mil", "0,5%").
// Sem certeza, devolve null: o painel mostra "sem referência" em vez de inventar número.

// Aceita o sufixo colado ao número ("150k", "2mi") ou separado ("150 mil").
// \b não serve depois de letra acentuada ("milhão"), por isso o fim é "não seguido de letra".
const FIM = "(?![a-zà-ú])";
const MULTIPLICADORES = [
  [new RegExp(`(?:\\d\\s*|\\b)(bilh(ão|ões|ao|oes)|bi)${FIM}`, "i"), 1e9],
  [new RegExp(`(?:\\d\\s*|\\b)(milh(ão|ões|ao|oes)|mi|mm)${FIM}`, "i"), 1e6],
  [new RegExp(`(?:\\d\\s*|\\b)(mil|k)${FIM}`, "i"), 1e3],
];

/** "1.234,56" → 1234.56 · "150.000" → 150000 · "1,5" → 1.5 · "1.5" → 1.5 */
function numeroBR(texto) {
  let t = texto;
  if (t.includes(",")) t = t.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, "");
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function numerosDoTexto(texto) {
  return (String(texto ?? "").match(/\d[\d.,]*/g) ?? [])
    .map((s) => numeroBR(s.replace(/[.,]$/, "")))
    .filter((n) => n !== null);
}

/**
 * Valor em reais escrito livremente → número. Faixas ("100 a 150 mil") usam o maior valor.
 * "R$ 150 mil" → 150000 · "1,2 milhão" → 1200000 · "R$ 80.000,00" → 80000 · "A apurar" → null
 */
export function lerValorBR(texto) {
  const numeros = numerosDoTexto(texto);
  if (!numeros.length) return null;
  const mult = MULTIPLICADORES.find(([re]) => re.test(String(texto)))?.[1] ?? 1;
  return Math.max(...numeros) * mult;
}

/**
 * Percentual escrito livremente → número (0,5% → 0.5). Faixa ("0,3% a 0,5%") usa o maior: é o teto.
 * Sem número ("A apurar", "não sei") → null.
 */
export function lerPercentual(texto) {
  const numeros = numerosDoTexto(texto);
  if (!numeros.length) return null;
  const maior = Math.max(...numeros);
  return maior <= 100 ? maior : null;
}
