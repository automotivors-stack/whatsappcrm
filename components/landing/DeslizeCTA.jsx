"use client";

// O botão de arrastar (components/ui/slide-confirm-button.jsx) com a identidade da Let's Touch Base.: pílula navy,
// puxador em Electric Blue, ícone claro e a fonte da marca (classe ltb-deslize em app/globals.css).
// Completar o arrasto abre a agenda do Google (content/contato.js) numa nova aba, para a pessoa escolher o horário.
// O botão não diz que agendou: quem agenda é a própria agenda; o balão só avisa que ela está abrindo.

import { SlideConfirmButton } from "../ui/slide-confirm-button.jsx";
import { AGENDA_URL } from "../../content/contato.js";

export default function DeslizeCTA({
  rotulo = "Agendar conversa",
  legenda = "Arraste até o fim para abrir a agenda",
  alinhamento = "centro", // "centro" | "esquerda"
  fundo = "escuro", // "escuro" | "claro": só muda a cor da legenda
}) {
  // Abre na hora, ainda dentro do gesto (soltar o puxador ou apertar Enter): fora dele o navegador bloquearia a aba nova.
  // Se mesmo assim ela for bloqueada, a agenda abre nesta aba, depois de o visto aparecer.
  const abrirAgenda = () => {
    // Sem "noopener" nas opções: com ele o navegador sempre devolve null e não daria para saber se a aba abriu.
    // O vínculo com esta página é cortado logo em seguida (mesmo efeito do noopener).
    const aba = window.open(AGENDA_URL, "_blank");
    if (aba) aba.opener = null;
    else window.setTimeout(() => window.location.assign(AGENDA_URL), 700);
  };

  return (
    <div className={`flex w-full max-w-[420px] flex-col ${alinhamento === "centro" ? "mx-auto items-center" : "items-start"}`}>
      <SlideConfirmButton
        className="ltb-deslize"
        label={rotulo}
        confirmedLabel="Abrindo a agenda"
        hint="Arraste até o fim ou aperte Enter para abrir a agenda e escolher um horário. Abre em nova aba."
        onConfirm={abrirAgenda}
        resetAfter={2400}
      />
      {legenda && (
        <p className={`mt-4 text-sm ${fundo === "claro" ? "text-slate-600" : "text-slate-400"}`}>{legenda}</p>
      )}
    </div>
  );
}
