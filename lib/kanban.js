// As 7 fases oficiais do pipeline, na ordem. Compartilhado entre servidor e tela.

export const FASES = [
  { id: "Contato Recebido", descricao: "Leads aprovados via WhatsApp do consultor" },
  { id: "Interessado", descricao: "Primeiro contato comercial estabelecido" },
  { id: "Avançado", descricao: "Proposta de taxas e condições em debate" },
  { id: "Conta em Análise", descricao: "Documentação no compliance/risco da adquirente" },
  { id: "Aprovado", descricao: "Fornecedor e taxas configurados" },
  { id: "Operando", descricao: "Integração concluída e primeiras liquidações" },
  { id: "Operando dentro das expectativas", descricao: "Volume prometido atingido sem alertas graves de MED" },
];

export const NOMES_FASES = FASES.map((f) => f.id);
export const FASE_APROVADO = "Aprovado";
const INDICE_APROVADO = NOMES_FASES.indexOf(FASE_APROVADO);

/** "Aprovado" e todas as fases depois dela exigem fornecedor definido. */
export function exigeFornecedor(fase) {
  const i = NOMES_FASES.indexOf(fase);
  return i >= INDICE_APROVADO;
}

/** Fases em que o consultor acompanha o volume e o MED reais. */
export const FASES_OPERACAO = ["Operando", "Operando dentro das expectativas"];
