// Bloco de depoimentos: a parede 3D de components/ui/3d-testimonials.jsx com os dados de content/depoimentos.js.
// Enquanto houver item marcado `exemplo`, o bloco avisa que é prévia: nada aqui se apresenta como depoimento real.
// Cores da marca pelas variáveis --t3d-* (style), sem mexer no componente.

import { Testimonials3D } from "../ui/3d-testimonials.jsx";
import { DEPOIMENTOS } from "../../content/depoimentos.js";

export default function DepoimentosParede() {
  const temExemplo = DEPOIMENTOS.some((d) => d.exemplo);
  const itens = DEPOIMENTOS.map(({ exemplo, ...d }) => d);
  return (
    <section aria-labelledby="depoimentos-titulo" className="bg-ltb-navy-deep px-5 py-20 text-white sm:px-10 sm:py-28">
      <div className="mx-auto max-w-7xl">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-ltb-blue-soft">Depoimentos</p>
        <h2 id="depoimentos-titulo" className="mt-3 max-w-3xl font-ltb-titulo text-[clamp(2rem,4.5vw,3.5rem)] font-extrabold leading-[1.05] tracking-[-0.03em]">
          A palavra de quem usa.
        </h2>
        {temExemplo && (
          <p className="mt-5 inline-flex max-w-2xl rounded-[12px] border border-amber-300/40 bg-amber-300/10 px-4 py-2 text-sm text-amber-100">
            Demonstração: depoimentos fictícios, de pessoas e empresas que não existem. Os depoimentos reais entram aqui
            depois de autorizados por escrito pelos gestores.
          </p>
        )}
        <Testimonials3D
          testimonials={itens}
          repeat={2}
          // 30 cartões por coluna: a volta é longa, então mais segundos para manter o passo lento e legível
          duration={190}
          label="Depoimentos de gestores comerciais"
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
      </div>
    </section>
  );
}
