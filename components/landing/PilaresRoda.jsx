"use client";

// Bloco "pilares": as quatro frases da marca numa roda que se gira (components/ui/works-wheel.jsx).
// Cada frase é um cartão desenhado aqui mesmo (SVG em data URI, nas cores da marca): nada de imagem externa nem de
// arquivo em /public, que ficaria atrás da senha do proxy.js. O componente da roda não foi alterado; as cores e a
// fonte da marca entram pelas props (style), e a roda segue igual em qualquer outro uso.

import { useCallback, useEffect, useRef, useState } from "react";
import { WorksWheel } from "../ui/works-wheel.jsx";

const PILARES = [
  { titulo: "Talento", resto: "abre caminhos.", cor: ["#60a5fa", "#2563eb"] },
  { titulo: "Persistência", resto: "move.", cor: ["#4ade80", "#22c55e"] },
  { titulo: "Organização", resto: "dá direção.", cor: ["#93c5fd", "#22c55e"] },
  { titulo: "Inteligência", resto: "acelera.", cor: ["#a78bfa", "#7c3aed"] },
];

/** Linhas de luz partindo do ponto de fuga, como no túnel do hero. Sorteio com semente fixa: o cartão sai igual no
    servidor e no navegador (sem diferença de hidratação). */
function feixes(semente, cores) {
  let s = semente;
  const sorteio = () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
  const cx = 760;
  const cy = 300;
  let linhas = "";
  for (let i = 0; i < 46; i += 1) {
    const ang = sorteio() * Math.PI * 2;
    const r1 = 60 + sorteio() * 260;
    const r2 = r1 + 60 + sorteio() * 320;
    const cor = sorteio() < 0.55 ? cores[1] : sorteio() < 0.5 ? cores[0] : "#f8fafc";
    const op = (0.18 + sorteio() * 0.5).toFixed(2);
    const w = (1 + sorteio() * 2.4).toFixed(1);
    linhas += `<line x1="${(cx + Math.cos(ang) * r1).toFixed(0)}" y1="${(cy + Math.sin(ang) * r1).toFixed(0)}" x2="${(cx + Math.cos(ang) * r2).toFixed(0)}" y2="${(cy + Math.sin(ang) * r2).toFixed(0)}" stroke="${cor}" stroke-opacity="${op}" stroke-width="${w}" stroke-linecap="round"/>`;
  }
  return linhas;
}

function capa({ titulo, resto, cor }, i) {
  // 1000 × 690: a proporção do cartão da roda (1,45 por 1). Fonte do sistema: um SVG em <img> não carrega webfont.
  const fonte = "Manrope, Inter, 'Segoe UI', Roboto, Arial, sans-serif";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 690">
<defs>
<radialGradient id="b" cx="76%" cy="43%" r="70%"><stop offset="0" stop-color="#1d3a7a"/><stop offset=".45" stop-color="#0b1f44"/><stop offset="1" stop-color="#050d1f"/></radialGradient>
<linearGradient id="t" x1="0" x2="1"><stop offset="0" stop-color="${cor[0]}"/><stop offset="1" stop-color="${cor[1]}"/></linearGradient>
<linearGradient id="v" x1="0" x2="1"><stop offset="0" stop-color="#050d1f" stop-opacity=".92"/><stop offset=".6" stop-color="#050d1f" stop-opacity=".25"/><stop offset="1" stop-color="#050d1f" stop-opacity="0"/></linearGradient>
</defs>
<rect width="1000" height="690" fill="url(#b)"/>
${feixes(9301 + i * 7919, cor)}
<rect width="1000" height="690" fill="url(#v)"/>
<text x="72" y="400" font-family="${fonte}" font-weight="800" font-size="112" letter-spacing="-3" fill="#f8fafc">${titulo.toUpperCase()}</text>
<text x="72" y="500" font-family="${fonte}" font-weight="800" font-size="84" letter-spacing="-2" fill="url(#t)">${resto.toUpperCase()}</text>
<rect x="72" y="560" width="96" height="6" rx="3" fill="${cor[1]}"/>
</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

const ITENS = PILARES.map((p, i) => ({
  title: p.titulo,
  image: capa(p, i),
  alt: `${p.titulo} ${p.resto}`,
}));

// Quanto de rolagem (em alturas de tela) cada passo da roda ocupa: anel → Talento → … → Inteligência.
const ROLAGEM_POR_PASSO = 0.7;

/** Segura a roda em cada peça e só gira no meio do trecho: a peça fica parada para leitura antes de a próxima vir. */
function comPausas(bruto) {
  const base = Math.floor(bruto);
  const f = bruto - base;
  const s = Math.min(1, Math.max(0, (f - 0.25) / 0.5));
  return base + s * s * (3 - 2 * s);
}

export default function PilaresRoda() {
  // A roda acompanha a rolagem da página nos dois sentidos: descendo, o anel abre e os pilares avançam; subindo, voltam.
  // A seção é alta e a roda fica fixa (sticky) enquanto a página passa por ela; nada prende a rolagem, no celular também.
  const secao = useRef(null);
  const [progresso, setProgresso] = useState(0);
  const passos = ITENS.length; // 0 = anel, 1..4 = cada pilar na frente

  useEffect(() => {
    let quadro = 0;
    const medir = () => {
      quadro = 0;
      const el = secao.current;
      if (!el) return;
      const total = el.offsetHeight - window.innerHeight;
      const p = total > 0 ? Math.min(1, Math.max(0, -el.getBoundingClientRect().top / total)) : 0;
      setProgresso(comPausas(p * passos));
    };
    const pedir = () => {
      if (!quadro) quadro = requestAnimationFrame(medir);
    };
    medir();
    window.addEventListener("scroll", pedir, { passive: true });
    window.addEventListener("resize", pedir);
    return () => {
      cancelAnimationFrame(quadro);
      window.removeEventListener("scroll", pedir);
      window.removeEventListener("resize", pedir);
    };
  }, [passos]);

  // Lista, setas e clique num cartão: a página rola até o ponto em que aquela peça fica na frente.
  const irPara = useCallback(
    (passo) => {
      const el = secao.current;
      if (!el) return;
      const total = el.offsetHeight - window.innerHeight;
      const topo = el.getBoundingClientRect().top + window.scrollY;
      const reduzido = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      window.scrollTo({ top: topo + (passo / passos) * total, behavior: reduzido ? "auto" : "smooth" });
    },
    [passos],
  );

  return (
    <section
      ref={secao}
      aria-labelledby="pilares-titulo"
      className="relative bg-ltb-navy-deep"
      style={{ height: `${100 + passos * ROLAGEM_POR_PASSO * 100}svh` }}
    >
      <h2 id="pilares-titulo" className="sr-only">
        Talento abre caminhos. Persistência move. Organização dá direção. Inteligência acelera.
      </h2>
      <div className="sticky top-0 h-[100svh] pt-16">
        <WorksWheel
          items={ITENS}
          label="Let’s Touch Base."
          action=""
          progress={progresso}
          onRequest={irPara}
          className="h-full"
          style={{
            "--ww-bg": "#050d1f",
            "--ww-fg": "#f8fafc",
            "--ww-muted": "#94a3b8",
            "--ww-card": "#0b1f44",
            "--ww-shadow": "rgba(37, 99, 235, .35)",
            fontFamily: '"Manrope Variable", "Inter Variable", system-ui, Arial, sans-serif',
          }}
        />
      </div>
    </section>
  );
}
