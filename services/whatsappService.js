// Envio de mensagens pela API REST do OpenWA.
// POST {OPENWA_BASE_URL}/api/sessions/{OPENWA_SESSION_ID}/messages/send-text
// Cabeçalho X-API-Key; corpo { chatId, text } (o OpenWA recusa campos extras com 400).

export class FalhaWhatsApp extends Error {
  constructor(mensagem, { status, code, retryAfterSeconds } = {}) {
    super(mensagem);
    this.status = status;
    this.code = code;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

const LIMITE_TEXTO = 4096; // limite do campo `text` no OpenWA
const TEMPO_LIMITE_MS = 15_000;

/**
 * Envia um texto para um chat do WhatsApp.
 * @param {string} chatId  ex.: "5511999999999@c.us" (número puro é recusado pelo OpenWA)
 * @param {string} texto
 * @param {{ idempotencyKey?: string, fetchImpl?: typeof fetch }} [opcoes]
 *   idempotencyKey: o OpenWA guarda por 24 h e não reenvia a mesma chave (evita duplicar em retentativas).
 * @returns {Promise<{ messageId?: string, timestamp?: number }>}
 */
export async function enviarMensagemWhatsApp(chatId, texto, opcoes = {}) {
  const { idempotencyKey, fetchImpl = fetch } = opcoes;
  const baseUrl = process.env.OPENWA_BASE_URL;
  const apiKey = process.env.OPENWA_API_KEY;
  const sessao = process.env.OPENWA_SESSION_ID;

  if (!baseUrl || !apiKey || !sessao) {
    throw new Error("OpenWA não configurado: defina OPENWA_BASE_URL, OPENWA_API_KEY e OPENWA_SESSION_ID.");
  }
  if (!/^[^\s@]+@[^\s@]+$/.test(String(chatId ?? ""))) {
    throw new Error("chatId inválido: use o formato 5511999999999@c.us.");
  }
  if (!texto || typeof texto !== "string") {
    throw new Error("Texto da mensagem vazio.");
  }

  const text = texto.length > LIMITE_TEXTO ? `${texto.slice(0, LIMITE_TEXTO - 1)}…` : texto;
  const url = `${baseUrl.replace(/\/+$/, "")}/api/sessions/${encodeURIComponent(sessao)}/messages/send-text`;
  const headers = { "Content-Type": "application/json", "X-API-Key": apiKey };
  if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;

  const resposta = await fetchImpl(url, {
    method: "POST",
    headers,
    body: JSON.stringify({ chatId, text }),
    signal: AbortSignal.timeout(TEMPO_LIMITE_MS),
  });

  if (!resposta.ok) {
    // O OpenWA manda { statusCode, message, error, code? }. Guardamos só status e código:
    // o texto e o telefone nunca entram no erro, que vai para o log.
    const corpo = await resposta.json().catch(() => ({}));
    const code = typeof corpo?.code === "string" ? corpo.code : undefined;
    throw new FalhaWhatsApp(`OpenWA recusou o envio (HTTP ${resposta.status}${code ? `, ${code}` : ""}).`, {
      status: resposta.status,
      code,
      retryAfterSeconds: Number.isFinite(corpo?.retryAfterSeconds) ? corpo.retryAfterSeconds : undefined,
    });
  }
  return resposta.json().catch(() => ({}));
}
