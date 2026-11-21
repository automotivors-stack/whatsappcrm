// Chamadas da tela à API de leads.

async function pedir(url, opcoes = {}) {
  const resp = await fetch(url, { cache: "no-store", ...opcoes });
  const dados = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(dados.error ?? "Não foi possível concluir.");
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

