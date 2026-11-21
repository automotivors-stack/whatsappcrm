// Chamadas da tela à API de leads.

async function pedir(url, opcoes = {}) {
  const resp = await fetch(url, { cache: "no-store", ...opcoes });
  const dados = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    const erro = new Error(dados.error ?? "Não foi possível concluir.");
    erro.dados = dados; // ex.: a interação de falha devolvida pelos disparos
    erro.status = resp.status; // o servidor respondeu (sem status = a requisição não chegou)
    throw erro;
  }
  return dados;
}

const json = (metodo, corpo) => ({
  method: metodo,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(corpo),
});

export const listarLeads = () => pedir("/api/leads");

export const buscarDossie = (id) => pedir(`/api/leads/${encodeURIComponent(id)}`);

export function patchLead({ id, ...campos }) {
  return pedir(`/api/leads/${encodeURIComponent(id)}`, json("PATCH", campos));
}


export const enviarWhatsApp = (corpo) => pedir("/api/whatsapp/send", json("POST", corpo));

export const enviarEmail = (corpo) => pedir("/api/email/send", json("POST", corpo));

export const buscarMetricas = (periodo) => pedir(`/api/dashboard/metrics?periodo=${encodeURIComponent(periodo)}`);

export const listarAprovacoes = () => pedir("/api/aprovacoes");

export const decidirAprovacao = (id, decisao) =>
  pedir(`/api/aprovacoes/${encodeURIComponent(id)}`, json("POST", { decisao }));
