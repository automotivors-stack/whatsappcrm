"use client";

// Cabeçalho discreto da landing: assinatura em texto (o logotipo vetorial ainda não foi homologado)
// e dois acessos. Fica translúcido sobre o hero e ganha fundo ao rolar.

import { useEffect, useState } from "react";
import { AGENDA_URL } from "../../content/contato.js";

export default function LandingHeader() {
  const [rolou, setRolou] = useState(false);

  useEffect(() => {
    const aoRolar = () => setRolou(window.scrollY > 24);
    aoRolar();
    window.addEventListener("scroll", aoRolar, { passive: true });
    return () => window.removeEventListener("scroll", aoRolar);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-colors duration-300 ${
        rolou ? "bg-ltb-navy-deep/95 backdrop-blur-md shadow-[0_1px_0_rgba(255,255,255,0.06)]" : "bg-transparent"
      }`}
    >
      <a href="#conteudo" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:rounded-md focus:bg-white focus:px-3 focus:py-2 focus:text-ltb-navy">
        Pular para o conteúdo
      </a>
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-5 sm:px-10">
        <a href="#inicio" className="shrink-0 whitespace-nowrap font-ltb-titulo text-base font-extrabold tracking-[-0.02em] text-white sm:text-lg" aria-label="Let's Touch Base, início">
          Let&rsquo;s Touch Base<span className="text-ltb-green">.</span>
        </a>
        <nav aria-label="Acessos" className="flex items-center gap-2 sm:gap-4">
          {/* Área do cliente (login e cadastro). O acesso do consultor fica na tela de login. */}
          <a href="/entrar" className="inline-flex min-h-10 items-center rounded-full border border-white/25 px-4 text-sm font-semibold text-white hover:bg-white/10">
            Login
          </a>
          <a href={AGENDA_URL} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 items-center whitespace-nowrap rounded-full bg-ltb-blue px-4 text-sm font-semibold text-white hover:bg-blue-700">
            {/* Em telas estreitas, texto curto para caber numa linha ao lado da marca. */}
            <span className="sm:hidden">Demonstração</span>
            <span className="hidden sm:inline">Agendar demonstração</span>
            <span className="sr-only"> (abre a agenda em nova aba)</span>
          </a>
        </nav>
      </div>
    </header>
  );
}
