// Utilidades de telefone e chatId do WhatsApp (formato OpenWA: 5511999999999@c.us).

export function digitos(valor) {
  return String(valor ?? "").replace(/\D/g, "");
}

/** Telefone (só dígitos) de um chatId de pessoa; null para @lid, grupo, canal etc. */
export function telefoneDoChatId(chatId) {
  const [local = "", host = ""] = String(chatId ?? "").split("@");
  if (host !== "c.us" && host !== "s.whatsapp.net") return null;
  const numero = digitos(local.split(":")[0]); // remove sufixo de aparelho (":12")
  return numero || null;
}

export function chatIdDoTelefone(telefone) {
  return `${digitos(telefone)}@c.us`;
}

// Celular brasileiro pode chegar com ou sem o nono dígito (55 + DDD + 9 + 8 dígitos).
function canonico(numero) {
  if (numero.length === 13 && numero.startsWith("55") && numero[4] === "9") {
    return numero.slice(0, 4) + numero.slice(5);
  }
  return numero;
}

/** Compara dois telefones ignorando formatação e o nono dígito brasileiro. */
export function mesmoTelefone(a, b) {
  const x = digitos(a);
  const y = digitos(b);
  if (!x || !y) return false;
  return canonico(x) === canonico(y);
}

/** Para logs: nunca registrar o telefone completo. */
export function mascarar(telefone) {
  const d = digitos(telefone);
  return d.length > 4 ? `***${d.slice(-4)}` : "***";
}

/**
 * Telefone digitado pelo consultor → só dígitos, com DDI.
 * 10 ou 11 dígitos (DDD + número, sem DDI) recebem o 55 do Brasil, exceto se começar com "+". Zeros à esquerda saem
 * ("021..." vira "21..."). Devolve null fora de 12 a 15 dígitos (10 a 15 quando vem com "+").
 */
export function normalizarTelefoneBR(valor) {
  const comDdi = String(valor ?? "").trim().startsWith("+"); // "+1 555..." já traz o país
  let d = digitos(valor).replace(/^0+/, "");
  if (!comDdi && (d.length === 10 || d.length === 11)) d = `55${d}`;
  const minimo = comDdi ? 10 : 12; // E.164: até 15 dígitos; com "+", aceita DDI de outros países
  return d.length >= minimo && d.length <= 15 ? d : null;
}
