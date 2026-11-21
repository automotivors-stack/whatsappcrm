// Bloco "O que muda na sua operação.": a parede 3D de components/ui/3d-testimonials.jsx com frases da própria
// Let's Touch Base. (content/operacao.js). Não são depoimentos: sem pessoas, empresas ou resultados.
// Cores da marca pelas variáveis --t3d-* (style), sem mexer no componente.

import { Testimonials3D } from "../ui/3d-testimonials.jsx";
import DeslizeCTA from "./DeslizeCTA.jsx";
import { FRASES_OPERACAO } from "../../content/operacao.js";

export default function OperacaoParede() {
  return (
    <section aria-labelledby="operacao-titulo" className="bg-ltb-navy-deep px-5 py-20 text-white sm:px-10 sm:py-28">
      <div className="mx-auto max-w-7xl">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-ltb-blue-soft">Na prática</p>
        <h2 id="operacao-titulo" className="mt-3 max-w-3xl font-ltb-titulo text-[clamp(2rem,4.5vw,3.5rem)] font-extrabold leading-[1.05] tracking-[-0.03em]">
          O que muda na sua operação.
        </h2>
        <Testimonials3D
          testimonials={FRASES_OPERACAO}
          repeat={2}
          // 30 cartões por coluna: a volta é longa, então mais segundos para manter o passo lento e legível
          duration={190}
          label="O que muda na sua operação"
          className="mx-auto mt-12 h-[560px] max-w-[880px] max-sm:h-[480px]"
          style={{
            "--t3d-bg": "#050d1f",
            "--t3d-card": "#0b1f44",
            "--t3d-card-hover": "#132b5c",
            "--t3d-fg": "#f8fafc",
            "--t3d-muted": "#94a3b8",
            "--t3d-border": "rgba(148, 163, 184, 0.22)",
            "--t3d-border-hover": "rgba(96, 165, 250, 0.7)",
            "--t3d-avatar": "#1d3a7a",
            "--t3d-ring": "rgba(96, 165, 250, 0.7)",
          }}
        />
        <div className="mt-24">
          <DeslizeCTA rotulo="Quero ver na prática" />
        </div>
      </div>
    </section>
  );
}
