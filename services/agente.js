// Ponto de entrada da IA que conduz o diagnóstico com o lead.
// FASE 1: ainda não há IA. Devolve null (o bot não responde sozinho) e a mensagem só fica no histórico.
//
// Contrato para a fase da IA. Recebe { db, telefone, chatId, mensagem } e devolve null ou:
//   { texto?: string,               // resposta ao cliente
//     diagnosticoFinal?: object }   // quando o atendimento termina: dispara a aprovação do consultor
// Os campos de diagnosticoFinal são os de `oportunidades` (ver CAMPOS_DIAGNOSTICO em aprovacao.js).

export async function responderComAgente() {
  return null;
}
