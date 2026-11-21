"use client";

// Seção 2 — O problema. As peças da rotina comercial chegam espalhadas e, com a rolagem,
// se alinham: a mesma passagem de "movimento sem direção" para "crescimento organizado" do hero.
// Conteúdo ilustrativo (situações comuns), sem números de resultado.

import { useEffect, useRef } from "react";
import DeslizeCTA from "./DeslizeCTA.jsx";

const PECAS = [
  { tipo: "conversa", texto: "Oi! Ainda vale aquela proposta?", dor: "Conversas dispersas" },
  { tipo: "cartao", texto: "Lead que chegou pelo Instagram", dor: "Sem acompanhamento" },
  { tipo: "cartao", texto: "planilha_leads_final_v3.xlsx", dor: "Informação incompleta" },
  { tipo: "conversa", texto: "Pode me mandar as taxas de novo?", dor: "Retrabalho" },
  { tipo: "cartao", texto: "Proposta enviada por e-mail", dor: "Sem rastreabilidade" },
  { tipo: "cartao", texto: "Copiar dados do chat para o sistema", dor: "Tempo em tarefa repetitiva" },
  { tipo: "conversa", texto: "Qual o volume mensal de vocês?", dor: "Pergunta repetida" },
  { tipo: "cartao", texto: "Retorno combinado para quinta", dor: "Prioridade perdida" },
];

// Deslocamentos do "caos" (fixos, para o layout ser o mesmo a cada visita).
const CAOS = [
  [-140, -70, -9], [90, 40, 7], [-60, 110, 5], [160, -40, -12],
  [-180, 30, 11], [40, -120, -6], [120, 90, 9], [-90, -30, -14],
];

export default function ProblemaNarrativa() {
  const secao = useRef(null);
  const palco = useRef(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return undefined;
    let ctx;
    let encerrado = false;
    Promise.all([import("gsap"), import("gsap/ScrollTrigger")]).then(([{ gsap }, { ScrollTrigger }]) => {
      if (encerrado || !palco.current) return;
      gsap.registerPlugin(ScrollTrigger);
      ctx = gsap.context(() => {
        const pecas = gsap.utils.toArray(".ltb-peca", palco.current);
        const escala = window.innerWidth < 640 ? 0.45 : 1;
        const tl = gsap.timeline({
          // Começa quando o palco entra na tela: o visitante vê as peças espalhadas antes de alinharem.
          scrollTrigger: { trigger: palco.current, start: "top 92%", end: "top 22%", scrub: 0.8 },
        });
        pecas.forEach((peca, i) => {
          const [x, y, r] = CAOS[i % CAOS.length];
          tl.fromTo(peca, { x: x * escala, y: y * escala, rotate: r, opacity: 0.55 }, { x: 0, y: 0, rotate: 0, opacity: 1, ease: "none", duration: 1 }, 0);
        });
        // As peças ocupam a linha do tempo inteira (0 → 1); a linha de conexão nasce no fim (0,6 → 1).
        tl.fromTo(".ltb-trilho", { scaleX: 0 }, { scaleX: 1, ease: "none", duration: 0.4 }, 0.6);
        gsap.from(".ltb-problema-titulo > *", {
          y: 40, opacity: 0, stagger: 0.12, duration: 1, ease: "power3.out",
          scrollTrigger: { trigger: secao.current, start: "top 80%" },
        });
        gsap.from(".ltb-fecho", {
          y: 30, opacity: 0, duration: 1, ease: "power3.out",
          scrollTrigger: { trigger: ".ltb-fecho", start: "top 88%" },
        });
      }, secao);
    });
    return () => {
      encerrado = true;
      ctx?.revert();
    };
  }, []);

  return (
    <section ref={secao} id="conteudo" aria-labelledby="problema-titulo" className="relative overflow-hidden bg-ltb-cloud px-5 pb-24 pt-20 text-ltb-navy sm:px-10 sm:pb-32 sm:pt-28">
      <div className="mx-auto max-w-7xl">
        <div className="ltb-problema-titulo max-w-4xl">
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.28em] text-ltb-blue">O problema</p>
          <h2 id="problema-titulo" className="font-ltb-titulo text-[clamp(2.1rem,5.5vw,4.5rem)] font-extrabold leading-[1.02] tracking-[-0.035em]">
            Sua operação comercial está crescendo. <span className="text-ltb-blue">Mas está evoluindo?</span>
          </h2>
        </div>

        <div ref={palco} className="relative mt-14 sm:mt-20">
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:gap-4">
            {PECAS.map((p) => (
              <li
                key={p.texto}
                className={`ltb-peca flex flex-col justify-between gap-4 border p-4 shadow-[0_12px_30px_-18px_rgba(11,31,68,0.35)] ${
                  p.tipo === "conversa"
                    ? "rounded-[18px] rounded-bl-[6px] border-slate-200 bg-white"
                    : "rounded-[12px] border-slate-200 bg-white"
                }`}
              >
                <p className="flex items-start gap-2 text-[15px] font-medium leading-snug text-ltb-navy">
                  <span aria-hidden="true" className={`mt-1 inline-block h-2 w-2 shrink-0 rounded-full ${p.tipo === "conversa" ? "bg-ltb-blue" : "bg-ltb-slate"}`} />
                  {p.texto}
                </p>
                <p className="inline-flex w-fit items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-900">
                  <span aria-hidden="true">!</span> {p.dor}
                </p>
              </li>
            ))}
          </ul>
          <div aria-hidden="true" className="ltb-trilho mt-8 h-[3px] origin-left rounded-full bg-gradient-to-r from-ltb-blue via-sky-400 to-ltb-green" />
        </div>

        <p className="ltb-fecho mt-14 max-w-4xl font-ltb-titulo text-[clamp(1.35rem,3vw,2.25rem)] font-bold leading-snug tracking-[-0.02em]">
          Mais contatos não significam necessariamente mais negócios.{" "}
          <span className="text-ltb-blue">
            O que define uma estratégia de sucesso é a organização, a comunicação e a inteligência em cada interação.
          </span>
        </p>

        <div className="mt-24">
          <DeslizeCTA rotulo="Quero organizar" alinhamento="esquerda" fundo="claro" />
        </div>
      </div>
    </section>
  );
}
