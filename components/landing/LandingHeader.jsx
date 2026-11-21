"use client";

// Cabeçalho discreto da landing: assinatura em texto (o logotipo vetorial ainda não foi homologado)
// e dois acessos. Fica translúcido sobre o hero e ganha fundo ao rolar.

import { useEffect, useState } from "react";

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
        <a href="#inicio" className="font-ltb-titulo text-lg font-extrabold tracking-[-0.02em] text-white" aria-label="Let's Touch Base, início">
          Let&rsquo;s Touch Base<span className="text-ltb-green">.</span>
        </a>
        <nav aria-label="Acessos" className="flex items-center gap-2 sm:gap-4">
          {/* <a> comum (sem prefetch): a área do consultor pede usuário e senha. */}
          <a href="/dashboard" className="hidden rounded-full px-3 py-2 text-sm font-medium text-slate-200 hover:text-white sm:inline-flex">
            Entrar
          </a>
          <a href="#demonstracao" className="inline-flex min-h-10 items-center rounded-full bg-ltb-blue px-4 text-sm font-semibold text-white hover:bg-blue-700">
            Agendar demonstração
          </a>
        </nav>
      </div>
    </header>
  );
}
