// Ponto de entrada da IA usado pelo webhook (processarMensagem.js).
// Contrato: ({ db, telefone, chatId, mensagem }) → null | { texto?, diagnosticoFinal? }
// O motor está em aiDiagnosticService.js (Claude, saída estruturada, qualificação progressiva).

import { criarAgenteDiagnostico } from "./aiDiagnosticService.js";

export const responderComAgente = criarAgenteDiagnostico();
