"use client";

// Hero cinematográfico da landing: túnel WebGL (tunel.js) + sequência editorial + transição por scroll.
// Carregamento progressivo: o texto aparece direto do HTML; Three.js e GSAP chegam depois (import dinâmico).
// Sem WebGL → fundo estático. Movimento reduzido → as frases em sequência, só esmaecendo (sem deslizar, sem
// aceleração nem explosão). Sem JS ou com as animações muito atrasadas → versão parada, com tudo legível.

import { useEffect, useRef, useState } from "react";
import { AGENDA_URL } from "../../content/contato.js";

// Cada frase em linhas (a última em gradiente) e quanto tempo fica na tela para ser lida.
const FRASES = [
  { linhas: ["Tudo se inicia", "com uma conversa."], leitura: 2.6, cena: { velocidade: 22, ordem: 0 } },
  {
    linhas: ["A inteligência, organização", "e o talento de sua equipe", "levam a seus objetivos."],
    leitura: 3.6,
    cena: { velocidade: 28, ordem: 0.2 },
  },
  {
    linhas: ["A escala dos seus", "resultados comerciais", "passa pela Let\u2019s Touch Base."],
    leitura: 3.3,
    cena: { velocidade: 20, ordem: 0.45 },
  },
];
const TEXTO_FRASES = FRASES.map((f) => f.linhas.join(" ")).join(" ");
// Quarta etapa: o túnel acelera de 1x (VELOCIDADE_BASE) a 5x e explode; a assinatura nasce do clarão.
const VELOCIDADE_BASE = 24;
const ACELERACAO = 1.9; // segundos de 100% a 500%
const CENA_CRUZEIRO = { velocidade: VELOCIDADE_BASE, ordem: 0.08 };

// Versão parada para quem está sem JavaScript (as mesmas regras do data-estado="estatico" em app/globals.css).
const SEM_JS_CSS = `
.ltb-hero { height: auto !important; min-height: 100svh; }
.ltb-hero .ltb-hero-conteudo { padding-top: 6.5rem; padding-bottom: 4rem; min-height: 100svh; }
.ltb-hero .ltb-sequencia, .ltb-hero .ltb-hero-aviso { display: none !important; }
.ltb-hero .ltb-marca { visibility: visible !important; }
.ltb-hero .ltb-frases-estaticas {
  position: static !important; width: auto !important; height: auto !important; overflow: visible !important;
  clip: auto !important; white-space: normal !important; display: block !important; margin-bottom: 1.5rem; max-width: 40rem;
  font-weight: 800; text-transform: uppercase; letter-spacing: .02em; font-size: clamp(.85rem, 1.6vw, 1rem);
  line-height: 1.6; color: #93c5fd;
}
`;

export default function CinematicHero() {
  const secao = useRef(null);
  const canvas = useRef(null);
  const sequencia = useRef(null);
  const marca = useRef(null);
  const aviso = useRef(null);
  const clarao = useRef(null);
  const sensor = useRef(null); // ouvinte do giroscópio (opcional, só quando o visitante ativa)
  const [estado, setEstado] = useState("inicial"); // inicial | animado | estatico
  const [semWebgl, setSemWebgl] = useState(false);
  const [giroscopio, setGiroscopio] = useState({ disponivel: false, ativo: false });

  useEffect(() => {
    const reduzido = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const movel = window.matchMedia("(pointer: coarse)").matches;
    let tunel = null;
    let ctx = null;
    let encerrado = false;
    const limpar = [];

    // Se as animações demorarem demais (rede muito lenta, script bloqueado), o conteúdo aparece parado e fica assim:
    // chegar depois não recomeça a sequência (antes a página piscava e começava de novo).
    let atrasou = false;
    const seguranca = window.setTimeout(() => {
      if (encerrado) return;
      atrasou = true;
      setEstado((e) => (e === "inicial" ? "estatico" : e));
    }, 7000);

    // A primeira frase entra pelo CSS (ltb-sobe, ~1,65 s a partir do carregamento). Assim que ela termina, a janela das
    // linhas abre sem esperar o GSAP chegar (numa rede lenta ele demora): parada, nenhuma letra é cortada. O GSAP
    // fecha de novo só para a saída.
    const primeira = sequencia.current?.querySelector(".ltb-frase-primeira");
    const abrirPrimeira = window.setTimeout(() => {
      primeira?.querySelectorAll(".ltb-linha").forEach((l) => {
        if (!l.style.overflow) l.style.overflow = "visible";
      });
    }, Math.max(0, 1900 - performance.now()));
    limpar.push(() => window.clearTimeout(abrirPrimeira));

    setGiroscopio((g) => ({
      ...g,
      disponivel: movel && typeof window.DeviceOrientationEvent !== "undefined" && !reduzido,
    }));

    // ---- cena 3D (carregada depois do primeiro desenho) ----
    import("./tunel.js")
      .then(({ criarTunel }) => {
        if (encerrado || !canvas.current) return;
        tunel = criarTunel(canvas.current, { movel, reduzido });
        if (!tunel) {
          setSemWebgl(true);
          return;
        }
        canvas.current.dataset.pronto = "1";
        // Só renderiza quando o hero está visível e a aba está aberta.
        const visivel = { tela: true, aba: !document.hidden };
        const aplicar = () => tunel.ativar(visivel.tela && visivel.aba);
        const io = new IntersectionObserver(([e]) => { visivel.tela = e.isIntersecting; aplicar(); });
        io.observe(secao.current);
        const aba = () => { visivel.aba = !document.hidden; aplicar(); };
        document.addEventListener("visibilitychange", aba);
        aplicar();
        limpar.push(() => { io.disconnect(); document.removeEventListener("visibilitychange", aba); });
      })
      .catch(() => setSemWebgl(true));

    // ---- interação: mouse (desktop) e toque (celular) ----
    const porMouse = (ev) => tunel?.setPonteiro((ev.clientX / window.innerWidth) * 2 - 1, -((ev.clientY / window.innerHeight) * 2 - 1));
    const porToque = (ev) => {
      const t = ev.touches[0];
      if (t) tunel?.setPonteiro((t.clientX / window.innerWidth) * 2 - 1, -((t.clientY / window.innerHeight) * 2 - 1) * 0.6);
    };
    const porGiroscopio = (ev) => tunel?.setPonteiro(ev.detail.x, ev.detail.y);
    window.addEventListener("ltb-giroscopio", porGiroscopio);
    limpar.push(() => {
      window.removeEventListener("ltb-giroscopio", porGiroscopio);
      if (sensor.current) window.removeEventListener("deviceorientation", sensor.current);
    });
    if (!reduzido) {
      window.addEventListener("pointermove", porMouse, { passive: true });
      secao.current?.addEventListener("touchmove", porToque, { passive: true });
      secao.current?.addEventListener("touchstart", porToque, { passive: true });
      limpar.push(() => {
        window.removeEventListener("pointermove", porMouse);
        secao.current?.removeEventListener("touchmove", porToque);
        secao.current?.removeEventListener("touchstart", porToque);
      });
    }

    // ---- sequência editorial e transição (GSAP) ----
    // Também com "reduzir movimento" (o "Remover animações" de muitos celulares): as frases aparecem uma a uma, só
    // esmaecendo, sem deslizar; sem aceleração, explosão nem clarão.
    {
      const rm = reduzido;
      Promise.all([import("gsap"), import("gsap/ScrollTrigger")])
        .then(([{ gsap }, { ScrollTrigger }]) => {
          if (encerrado || !secao.current || atrasou) return;
          window.clearTimeout(seguranca);
          gsap.registerPlugin(ScrollTrigger);
          setEstado("animado");
          ctx = gsap.context(() => {
            const frases = gsap.utils.toArray(".ltb-frase", sequencia.current);
            const linhas = (el) => el.querySelectorAll(".ltb-linha > span");
            // A "janela" de cada linha (overflow: hidden) só existe para a máscara da entrada e da saída. Com a frase
            // parada ela fica aberta: nenhuma letra com perna (g, j, p, q) pode ser cortada, seja qual for a fonte ou o
            // aparelho. Com movimento reduzido não há máscara: aberta o tempo todo.
            const janelas = (el) => el.querySelectorAll(".ltb-linha");
            const abrir = (el) => gsap.set(janelas(el), { overflow: "visible" });
            const fechar = (el) => gsap.set(janelas(el), { overflow: "hidden" });
            gsap.set(frases.slice(1), { autoAlpha: 0 });
            if (rm) frases.forEach(abrir);
            gsap.set(marca.current, { autoAlpha: 0, y: rm ? 0 : 24 });

            // Sequência: cada frase entra por máscara e muda o ritmo da cena.
            const intro = gsap.timeline({ defaults: { ease: "power3.out" } });
            // Ritmo em tempos absolutos: cada frase fica o tempo de ser lida (FRASES[i].leitura), sai por
            // inteiro e só então a seguinte entra. A primeira já entrou pelo CSS. Igual no celular e no computador.
            const ENTRADA = 1.0;
            const SAIDA = 0.7;
            let inicio = 0;
            let pulou = false;
            frases.forEach((frase, i) => {
              if (i > 0) {
                if (rm) intro.fromTo(frase, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.6, ease: "none" }, inicio);
                else {
                  intro.set(frase, { autoAlpha: 1 }, inicio);
                  intro.call(() => fechar(frase), null, inicio);
                  intro.fromTo(linhas(frase), { yPercent: 110 }, { yPercent: 0, duration: ENTRADA, stagger: 0.1 }, inicio);
                }
              }
              intro.call(() => tunel?.setAlvo(FRASES[i].cena), null, inicio);
              const saida = (i === 0 ? 1.2 : inicio + ENTRADA) + FRASES[i].leitura;
              if (!rm) {
                // entrou por inteiro (a última linha tem o atraso do stagger): abre a janela; fecha só para a saída
                const entrou = i === 0 ? 1.7 : inicio + ENTRADA + 0.1 * (janelas(frase).length - 1) + 0.05;
                intro.call(() => abrir(frase), null, entrou);
                intro.call(() => fechar(frase), null, saida);
              }
              if (rm) intro.to(frase, { autoAlpha: 0, duration: SAIDA, ease: "none" }, saida);
              else {
                intro.to(linhas(frase), { yPercent: -110, duration: SAIDA, stagger: 0.06, ease: "power2.in" }, saida);
                intro.set(frase, { autoAlpha: 0 }, saida + SAIDA + 0.05);
              }
              inicio = saida + SAIDA + 0.35; // a próxima só entra depois de a anterior sair por inteiro
            });

            // Quarta etapa: aceleração de 100% a 500%, explosão e a assinatura saindo do clarão.
            // Com movimento reduzido, só a assinatura, esmaecendo, depois da última frase.
            if (rm) {
              intro.to(marca.current, { autoAlpha: 1, duration: 0.6, ease: "none" }, inicio);
            } else {
            const giro = { v: VELOCIDADE_BASE };
            intro.call(() => tunel?.setAlvo({ ordem: 0.55 }), null, inicio);
            intro.fromTo(
              giro,
              { v: VELOCIDADE_BASE },
              { v: VELOCIDADE_BASE * 5, duration: ACELERACAO, ease: "power2.in", onUpdate: () => !pulou && tunel?.setVelocidade(giro.v) },
              inicio,
            );
            const explosao = inicio + ACELERACAO;
            intro.call(() => {
              if (pulou) return;
              tunel?.explodir();
              tunel?.setAlvo(CENA_CRUZEIRO); // depois do clarão, desacelera sozinho até o cruzeiro
            }, null, explosao);
            intro.fromTo(clarao.current, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.12, ease: "power2.out" }, explosao);
            intro.to(clarao.current, { autoAlpha: 0, duration: 1.1, ease: "power2.out" }, explosao + 0.12);
            intro.to(marca.current, { autoAlpha: 1, y: 0, duration: 0.9 }, explosao + 0.1);
            intro.from(marca.current.querySelectorAll("[data-entrar]"), { autoAlpha: 0, y: 18, stagger: 0.1, duration: 0.7 }, "<0.1");
            }

            // Quem rola antes do fim pula direto para a assinatura (não perde os CTAs), sem clarão.
            const pular = () => {
              if (intro.progress() >= 1) return;
              pulou = true;
              intro.progress(1);
              tunel?.setVelocidade(VELOCIDADE_BASE);
              tunel?.setAlvo(CENA_CRUZEIRO);
            };

            // Rolagem: sem pin. A assinatura é a última mensagem do hero e sobe junto com ele; o túnel
            // desacelera e se organiza enquanto o hero sai da tela. Igual no celular e no computador.
            gsap.timeline({
              scrollTrigger: {
                trigger: secao.current,
                start: "top top",
                end: "bottom top",
                scrub: 0.7,
                // Só pula a introdução quando o visitante de fato rola (progresso > 2%), nunca ao carregar.
                onUpdate: (st) => {
                  tunel?.setProgresso(st.progress);
                  if (st.progress > 0.02) pular();
                },
              },
            }).to(aviso.current, { autoAlpha: 0, duration: 0.15 }, 0).to({}, { duration: 0.85 }, 0.15);
          }, secao);
        })
        .catch(() => setEstado("estatico"));
    }

    return () => {
      encerrado = true;
      window.clearTimeout(seguranca);
      limpar.forEach((f) => f());
      ctx?.revert();
      tunel?.dispose();
    };
  }, []);

  async function ativarGiroscopio() {
    try {
      const Evento = window.DeviceOrientationEvent;
      if (typeof Evento.requestPermission === "function") {
        const r = await Evento.requestPermission(); // iOS pede permissão ao toque
        if (r !== "granted") return;
      }
      const mover = (e) => {
        if (e.gamma == null || e.beta == null) return;
        const x = Math.max(-1, Math.min(1, e.gamma / 35));
        const y = Math.max(-1, Math.min(1, (e.beta - 45) / 35));
        window.dispatchEvent(new CustomEvent("ltb-giroscopio", { detail: { x, y } }));
      };
      sensor.current = mover;
      window.addEventListener("deviceorientation", mover, { passive: true });
      setGiroscopio({ disponivel: true, ativo: true });
    } catch {
      setGiroscopio({ disponivel: false, ativo: false });
    }
  }

  return (
    <section
      ref={secao}
      id="inicio"
      data-estado={estado}
      aria-label="Apresentação"
      className="ltb-hero relative isolate h-[100svh] min-h-[560px] overflow-hidden bg-ltb-navy-deep text-white"
    >
      {/* Sem JavaScript, o estado nunca sai de "inicial": este estilo mostra a versão parada completa (as frases em
          texto, a assinatura e os botões), igual ao data-estado="estatico". */}
      <noscript dangerouslySetInnerHTML={{ __html: `<style>${SEM_JS_CSS}</style>` }} />
      {/* Fundo estático: aparece antes do WebGL e no lugar dele quando não há suporte. */}
      <div aria-hidden="true" className="ltb-hero-fundo absolute inset-0 -z-20" />
      <canvas
        ref={canvas}
        aria-hidden="true"
        className={`absolute inset-0 -z-10 h-full w-full transition-opacity duration-1000 ${semWebgl ? "hidden" : ""}`}
      />
      <div aria-hidden="true" className="ltb-hero-vinheta pointer-events-none absolute inset-0 -z-10" />
      {/* Clarão da explosão (um único flash suave, sem piscar repetido). */}
      <div ref={clarao} aria-hidden="true" className="ltb-clarao pointer-events-none absolute inset-0 z-[5]" />

      <div className="ltb-hero-conteudo relative z-10 mx-auto flex h-full max-w-7xl flex-col justify-center px-5 sm:px-10">
        {/* Sequência editorial (decorativa para leitores de tela; o texto completo vem abaixo, oculto). */}
        <div ref={sequencia} aria-hidden="true" className="ltb-sequencia absolute inset-x-5 top-1/2 -translate-y-1/2 sm:inset-x-10">
          {FRASES.map((f, i) => (
            <p key={f.linhas[0]} className={`ltb-frase absolute inset-x-0 -translate-y-1/2 ${i === 0 ? "ltb-frase-primeira" : ""}`}>
              {f.linhas.map((linha, j) => (
                <span key={linha} className="ltb-linha -mb-[0.12em] block overflow-hidden pb-[0.22em]">
                  <span
                    className={`block font-ltb-titulo text-[clamp(2rem,5.4vw,5rem)] font-extrabold leading-[1.02] tracking-[-0.035em] ${
                      j === f.linhas.length - 1 ? "ltb-gradiente-texto" : ""
                    }`}
                  >
                    {linha}
                  </span>
                </span>
              ))}
            </p>
          ))}
        </div>
        <p className="ltb-frases-estaticas">{TEXTO_FRASES}</p>

        {/* Assinatura e CTAs */}
        <div ref={marca} className="ltb-marca max-w-3xl">
          <p data-entrar className="mb-5 text-xs font-semibold uppercase tracking-[0.32em] text-ltb-blue-soft">Intelligent Sales Workspace</p>
          <h1 data-entrar className="font-ltb-titulo text-[clamp(2.75rem,8vw,6.75rem)] font-extrabold leading-[0.95] tracking-[-0.04em]">
            Let&rsquo;s Touch Base<span className="text-ltb-green">.</span>
          </h1>
          <p data-entrar lang="en" className="ltb-gradiente-texto mt-4 font-ltb-titulo text-[clamp(1.25rem,3vw,2.1rem)] font-bold leading-tight">
            Every conversation moves business forward.
          </p>
          <p data-entrar className="mt-5 max-w-xl text-base leading-relaxed text-slate-200 sm:text-lg">
            Uma plataforma inteligente para transformar conversas em oportunidades, organizar sua operação comercial e acelerar resultados.
          </p>
          <div data-entrar className="mt-8 flex flex-wrap gap-3">
            <a href="#plataforma" className="ltb-botao-primario">Conhecer a plataforma</a>
            <a href={AGENDA_URL} target="_blank" rel="noopener noreferrer" className="ltb-botao-secundario">
              Agendar uma demonstração<span className="sr-only"> (abre a agenda em nova aba)</span>
            </a>
          </div>
        </div>
      </div>

      {/* Rodapé do hero: dica de rolagem e giroscópio opcional (celular) */}
      <div ref={aviso} className="ltb-hero-aviso absolute inset-x-0 bottom-6 z-10 flex flex-wrap items-center justify-center gap-3 px-5 text-xs text-slate-300">
        <span className="flex items-center gap-2" aria-hidden="true">
          <span className="ltb-indicador-rolagem" /> Role para continuar
        </span>
        {giroscopio.disponivel && !giroscopio.ativo && (
          <button type="button" onClick={ativarGiroscopio} className="rounded-full border border-white/25 px-3 py-1.5 text-xs text-white hover:bg-white/10">
            Mover a cena com o celular
          </button>
        )}
      </div>
    </section>
  );
}
