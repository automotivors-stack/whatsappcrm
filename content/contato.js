// Contatos públicos da landing. Valores de configuração: troque aqui, nunca espalhados pelo código.

// Agenda do Google para marcar a conversa com um consultor (enviada pelo time em 21/11/2026).
export const AGENDA_URL = "https://calendar.app.google/ZfK4STi4di3AREDo6";

// WhatsApp do especialista (enviado pelo time em 21/11/2026): só dígitos, com DDI e DDD.
export const WHATSAPP_NUMERO = "5511971621758";

// Mensagem padrão do botão flutuante.
export const WHATSAPP_MENSAGEM_PADRAO = "Quero um diagnóstico do meu departamento comercial";

export const linkWhatsApp = (texto) => `https://wa.me/${WHATSAPP_NUMERO}?text=${encodeURIComponent(texto)}`;

export const WHATSAPP_URL = linkWhatsApp(WHATSAPP_MENSAGEM_PADRAO);
