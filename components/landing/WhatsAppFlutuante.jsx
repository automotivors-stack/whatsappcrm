"use client";

// Botão flutuante de WhatsApp: aparece depois do hero (quando ele sai da tela) e some de novo se a pessoa voltar ao topo,
// para não disputar atenção com a abertura. Abre a conversa com o especialista numa aba nova (WHATSAPP_URL).
// Só o símbolo do WhatsApp num círculo verde (pedido do time); o nome acessível diz "Fale com um especialista".

import { useEffect, useState } from "react";
import { WHATSAPP_URL } from "../../content/contato.js";

function SimboloWhatsApp() {
  // o símbolo do WhatsApp (o fone dentro do balão), desenhado aqui
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" focusable="false" className="h-8 w-8">
      <path
        fill="currentColor"
        d="M16 3.5C9.1 3.5 3.5 9.1 3.5 16c0 2.4.7 4.7 1.9 6.6L3.6 28.5l6.1-1.6c1.9 1 4 1.6 6.3 1.6 6.9 0 12.5-5.6 12.5-12.5S22.9 3.5 16 3.5Zm0 22.8c-2 0-3.9-.5-5.6-1.5l-.4-.2-3.6.9 1-3.5-.3-.4A10.2 10.2 0 0 1 5.8 16C5.8 10.4 10.4 5.8 16 5.8S26.2 10.4 26.2 16 21.6 26.3 16 26.3Zm5.6-7.6c-.3-.2-1.8-.9-2.1-1-.3-.1-.5-.2-.7.2-.2.3-.8 1-1 1.2-.2.2-.4.2-.7.1-.3-.2-1.3-.5-2.5-1.5-.9-.8-1.5-1.8-1.7-2.1-.2-.3 0-.5.1-.6l.5-.5c.2-.2.2-.3.3-.5.1-.2.1-.4 0-.6l-1-2.4c-.3-.6-.5-.5-.7-.5h-.6c-.2 0-.6.1-.9.4-.3.3-1.2 1.1-1.2 2.8s1.2 3.2 1.4 3.5c.2.2 2.4 3.7 5.8 5.1.8.4 1.4.6 1.9.7.8.3 1.5.2 2.1.1.6-.1 1.8-.7 2.1-1.5.3-.7.3-1.4.2-1.5-.1-.1-.3-.2-.6-.3Z"
      />
    </svg>
  );
}

export default function WhatsAppFlutuante() {
  const [depoisDoHero, setDepoisDoHero] = useState(false);
  const [ctaNaTela, setCtaNaTela] = useState(false);
  const [estreito, setEstreito] = useState(false);
  // No celular, sai de lado enquanto um botão de arrastar (ou outro botão de agendar) está na tela: os dois ficariam
  // um por cima do outro no rodapé da tela.
  const visivel = depoisDoHero && !(estreito && ctaNaTela);

  useEffect(() => {
    const hero = document.getElementById("inicio");
    // visível só depois que o hero sai (quase) inteiro da tela
    let io = null;
    if (hero) {
      io = new IntersectionObserver(([e]) => setDepoisDoHero(!e.isIntersecting), { threshold: 0, rootMargin: "0px 0px -85% 0px" });
      io.observe(hero);
    } else setDepoisDoHero(true);

    const naTela = new Set();
    const ioCta = new IntersectionObserver((entradas) => {
      entradas.forEach((e) => (e.isIntersecting ? naTela.add(e.target) : naTela.delete(e.target)));
      setCtaNaTela(naTela.size > 0);
    });
    document.querySelectorAll(".scb, #demonstracao .ltb-botao-primario").forEach((el) => ioCta.observe(el));

    const mq = window.matchMedia("(max-width: 639px)");
    const lerTela = () => setEstreito(mq.matches);
    lerTela();
    mq.addEventListener("change", lerTela);
    return () => {
      io?.disconnect();
      ioCta.disconnect();
      mq.removeEventListener("change", lerTela);
    };
  }, []);

  return (
    <a
      href={WHATSAPP_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Fale com um especialista pelo WhatsApp (abre em nova aba)"
      title="Fale com um especialista"
      aria-hidden={!visivel || undefined}
      tabIndex={visivel ? 0 : -1}
      className={`ltb-whatsapp fixed z-40 grid h-14 w-14 place-items-center rounded-full bg-ltb-green text-white shadow-[0_14px_30px_-10px_rgba(5,13,31,0.8)] ring-1 ring-black/10 transition-[opacity,transform,filter] duration-300 hover:brightness-105 ${
        visivel ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-4 opacity-0"
      }`}
    >
      <SimboloWhatsApp />
    </a>
  );
}
