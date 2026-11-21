// Formatação pt-BR e leitura de números digitados ("1.234,56" → 1234.56).

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const USD = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "USD" });
const NUM = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 4 });

export function dinheiro(valor, moeda = "BRL") {
  if (valor === null || valor === undefined) return "—";
  return (moeda === "USD" ? USD : BRL).format(valor);
}

export function percentual(valor) {
  if (valor === null || valor === undefined) return "—";
  return `${NUM.format(valor)}%`;
}

export function comSinal(texto, valor) {
  return valor > 0 ? `+${texto}` : texto;
}

/** Aceita "1,5", "1.234,56", "1234.56", "" → número ou null. Inválido → NaN. */
export function lerDecimal(texto) {
  const t = String(texto ?? "").trim().replace(/\s|R\$|%/g, "");
  if (t === "") return null;
  const normalizado = t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t;
  if (!/^\d+(\.\d+)?$/.test(normalizado)) return Number.NaN;
  return Number(normalizado);
}

/** Número → texto editável em pt-BR ("1,5"). */
export function paraCampo(valor) {
  if (valor === null || valor === undefined) return "";
  return String(valor).replace(".", ",");
}

export function soDigitos(texto) {
  return String(texto ?? "").replace(/\D/g, "");
}
