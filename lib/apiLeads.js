// Chamadas da tela à API de leads.

export async function patchLead(corpo) {
  const resp = await fetch("/api/leads", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(corpo),
  });
  const dados = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(dados.erro ?? "Não foi possível salvar.");
  return dados.lead;
}

export async function buscarLead(id) {
  const resp = await fetch(`/api/leads?id=${encodeURIComponent(id)}`, { cache: "no-store" });
  const dados = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(dados.erro ?? "Não foi possível abrir o lead.");
  return dados;
}
