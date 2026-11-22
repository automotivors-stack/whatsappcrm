// Linha antes do rodapé: "De onde vem e o que significa a expressão Let's touch base?", que abre e fecha com uma seta.
// <details>/<summary> nativos: funcionam sem JavaScript, pelo teclado (Enter/Espaço) e com leitor de tela.

import { EXPRESSAO } from "../../content/expressao.js";

function Seta() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false" className="ltb-expressao-seta h-5 w-5 shrink-0">
      <path d="M5 7.5 10 12.5 15 7.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function SobreExpressao() {
  return (
    <section aria-label="Sobre a expressão Let’s touch base" className="bg-ltb-navy-deep px-5 pt-10 sm:px-10">
      <details className="ltb-expressao mx-auto max-w-7xl rounded-[12px] border border-white/10 bg-white/[0.03]">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-[12px] px-5 py-5 text-left font-ltb-titulo text-base font-bold text-white hover:bg-white/[0.04] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ltb-blue-soft sm:px-6 sm:text-lg">
          <span>{EXPRESSAO.pergunta}</span>
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/15 text-ltb-blue-soft">
            <Seta />
          </span>
        </summary>
        <div className="max-w-4xl px-5 pb-7 text-[15px] leading-relaxed text-slate-300 sm:px-6">
          {EXPRESSAO.abertura.map((p) => (
            <p key={p.slice(0, 24)} className="mt-1">
              {p}
            </p>
          ))}
          {EXPRESSAO.secoes.map((s) => (
            <div key={s.titulo} className="mt-6">
              <h3 className="font-ltb-titulo text-base font-bold text-white">{s.titulo}</h3>
              {s.paragrafos.map((p) => (
                <p key={p.slice(0, 24)} className="mt-2">
                  {p}
                </p>
              ))}
            </div>
          ))}
        </div>
      </details>
    </section>
  );
}
