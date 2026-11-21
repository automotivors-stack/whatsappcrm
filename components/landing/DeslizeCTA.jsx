"use client";

// O botão de arrastar (components/ui/slide-confirm-button.jsx) com a identidade da Let's Touch Base.: pílula navy,
// puxador em Electric Blue, ícone claro e a fonte da marca (classe ltb-deslize em app/globals.css).
// Honesto: o agendamento ainda não existe (é a etapa 2, a pré-triagem). Completar o arrasto não "marca" nada: confirma
// e leva a pessoa até a seção de demonstração.

import { SlideConfirmButton } from "../ui/slide-confirm-button.jsx";

export default function DeslizeCTA({
  rotulo = "Agendar conversa",
  legenda = "Arraste até o fim para ir à demonstração",
  destino = "#demonstracao",
  alinhamento = "centro", // "centro" | "esquerda"
  fundo = "escuro", // "escuro" | "claro": só muda a cor da legenda
}) {
  const ir = () => {
    // deixa o visto e o balão aparecerem antes de rolar
    window.setTimeout(() => {
      const alvo = document.querySelector(destino);
      if (!alvo) return;
      const reduzido = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      alvo.scrollIntoView({ behavior: reduzido ? "auto" : "smooth", block: "start" });
    }, 650);
  };

  return (
    <div className={`flex w-full max-w-[420px] flex-col ${alinhamento === "centro" ? "mx-auto items-center" : "items-start"}`}>
      <SlideConfirmButton
        className="ltb-deslize"
        label={rotulo}
        confirmedLabel="Levando você à demonstração"
        hint="Arraste até o fim ou aperte Enter para ir até a seção de demonstração."
        onConfirm={ir}
        resetAfter={2400}
      />
      {legenda && (
        <p className={`mt-4 text-sm ${fundo === "claro" ? "text-slate-600" : "text-slate-400"}`}>{legenda}</p>
      )}
    </div>
  );
}
