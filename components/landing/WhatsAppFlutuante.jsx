"use client";

// Botão flutuante de WhatsApp: aparece depois do hero (quando ele sai da tela) e some de novo se a pessoa voltar ao topo,
// para não disputar atenção com a abertura. Abre a conversa com o especialista numa aba nova (WHATSAPP_URL).
// Marca: pílula navy com texto claro; o verde fica só no ícone (o manual não usa verde como ação primária).

import { useEffect, useState } from "react";
import { WHATSAPP_URL } from "../../content/contato.js";

function IconeConversa() {
  // balão de conversa com um fone dentro, desenhado aqui (sem logotipo de terceiros)
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" className="h-5 w-5">
      <path
        d="M12 3.2a8.8 8.8 0 0 0-7.6 13.2L3.3 20.7l4.4-1.1A8.8 8.8 0 1 0 12 3.2Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M9.2 8.3c.2-.4.5-.4.7-.4h.5c.2 0 .4.1.5.4l.7 1.6c.1.2 0 .5-.1.6l-.5.6c.6 1.2 1.6 2.1 2.8 2.7l.6-.6c.2-.2.4-.2.6-.1l1.6.7c.3.1.4.3.4.6v.5c0 .3-.1.6-.4.8-.5.4-1.2.6-1.9.5-2.9-.5-5.3-2.9-5.8-5.8-.1-.7.1-1.5.3-2.1Z"
        fill="currentColor"
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
      aria-hidden={!visivel || undefined}
      tabIndex={visivel ? 0 : -1}
      className={`ltb-whatsapp fixed z-40 inline-flex min-h-12 items-center gap-2.5 rounded-full border border-white/15 bg-ltb-navy py-2 pl-2 pr-5 text-sm font-semibold text-white shadow-[0_14px_34px_-12px_rgba(5,13,31,0.75)] transition-[opacity,transform,background-color] duration-300 hover:bg-[#132b5c] ${
        visivel ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-4 opacity-0"
      }`}
    >
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-ltb-green text-ltb-navy-deep">
        <IconeConversa />
      </span>
      Fale com um especialista
      <span className="sr-only"> pelo WhatsApp (abre em nova aba)</span>
    </a>
  );
}
