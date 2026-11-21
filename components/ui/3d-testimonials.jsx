"use client"

import * as React from "react"

/**
 * 3D Testimonials — uma parede de depoimentos inclinada em 3D: colunas de cartões que correm sem parar, uma para cima e
 * a outra para baixo, sumindo nas bordas. A coluna sob o mouse para, e o cartão sob ele acende.
 *
 * - Marquee: o letreiro sem emenda, na horizontal ou na vertical, que repete o conteúdo e o faz correr em loop. Serve
 *   sozinho para logos, depoimentos ou qualquer fileira.
 * - Testimonials3D: a parede inteira, com as colunas, os cartões (TestimonialCard) e o esmaecido das bordas.
 * - Com o mouse ou o foco do teclado, o letreiro para; com "reduzir movimento" ligado no sistema, ele nem anda. O leitor de
 *   tela lê cada depoimento uma vez só (as cópias do loop ficam escondidas dele).
 * - As cores vêm de variáveis CSS (--t3d-bg, --t3d-card…), com um tema escuro e um claro (theme).
 *
 * Tamanho, posição e margem aceitam as classes do projeto (Tailwind, CSS Modules, CSS comum).
 *
 * O React é o único import. Sem Tailwind, sem arquivo CSS.
 */

// A inclinação da parede: ela recua, deita para trás e gira, como uma vitrine vista de lado.
const PERSPECTIVE = 300
const TILT = "translateX(-100px) translateY(0px) translateZ(-100px) rotateX(20deg) rotateY(-10deg) rotateZ(20deg)"

// O React 19 sobe uma <style> com href e precedence para o <head>, uma vez só para todas as paredes. O React 18 não
// conhece isso: lá ela vai dentro do componente, escondida e com o CSS cru, porque como filho de texto o SSR do 18
// escaparia as aspas e quebraria os seletores.
const HOISTS_STYLES = Number(React.version.split(".")[0]) >= 19

function Testimonials3DStyles() {
  if (HOISTS_STYLES) {
    const hoist = { href: "3d-testimonials", precedence: "default" }
    return <style {...hoist}>{T3D_CSS}</style>
  }
  return <style hidden dangerouslySetInnerHTML={{ __html: T3D_CSS }} />
}

export function Marquee({
  className,
  style,
  reverse = false,
  pauseOnHover = false,
  children,
  vertical = false,
  repeat = 4,
  duration = 40,
  gap = 16,
  ariaLabel,
  ariaLive = "off",
  ariaRole = "marquee",
  ...props
}) {
  const vars = { "--t3d-duration": `${duration}s`, "--t3d-gap": `${gap}px` }

  return (
    <div
      tabIndex={0}
      {...props}
      data-slot="marquee"
      data-vertical={vertical || undefined}
      data-reverse={reverse || undefined}
      data-pause-on-hover={pauseOnHover || undefined}
      className={className ? `t3d-marquee ${className}` : "t3d-marquee"}
      style={{ ...vars, ...style }}
      aria-label={ariaLabel}
      aria-live={ariaLive}
      role={ariaRole}
    >
      <Testimonials3DStyles />
      {React.useMemo(
        () =>
          Array.from({ length: repeat }, (_, i) => (
            // só a primeira volta é lida: as outras são cópias para o loop não ter emenda
            <div key={i} className="t3d-group" aria-hidden={i > 0 || undefined}>
              {children}
            </div>
          )),
        [repeat, children],
      )}
    </div>
  )
}

export function TestimonialCard({ img, name, username, body, country }) {
  const [failed, setFailed] = React.useState(false)

  return (
    <figure className="t3d-card">
      <div className="t3d-card__head">
        <span className="t3d-avatar">
          {img && !failed ? (
            <img src={img} alt="" loading="lazy" decoding="async" draggable={false} onError={() => setFailed(true)} />
          ) : (
            <span aria-hidden="true">{name.trim()[0]}</span>
          )}
        </span>
        <div className="t3d-card__who">
          <figcaption className="t3d-card__name">
            {name} {country && <span className="t3d-card__country">{country}</span>}
          </figcaption>
          <p className="t3d-card__user">{username}</p>
        </div>
      </div>
      <blockquote className="t3d-card__body">{body}</blockquote>
    </figure>
  )
}

export function Testimonials3D({
  testimonials,
  columns = 4,
  duration = 40,
  repeat = 3,
  pauseOnHover = true,
  theme = "dark",
  label = "Depoimentos",
  className,
  style,
  ...props
}) {
  // cada coluna começa num ponto da lista, para duas colunas que correm no mesmo sentido não andarem lado a lado com os
  // mesmos cartões
  const lists = React.useMemo(() => {
    const n = testimonials.length
    return Array.from({ length: columns }, (_, c) => {
      const start = n ? Math.floor((c * n) / columns) : 0
      return [...testimonials.slice(start), ...testimonials.slice(0, start)]
    })
  }, [testimonials, columns])

  return (
    <section
      tabIndex={0}
      {...props}
      data-theme={theme}
      className={className ? `t3d-root ${className}` : "t3d-root"}
      style={style}
      aria-label={label}
    >
      <Testimonials3DStyles />
      {/* a perspectiva mora num elemento só dela: com o plano 3D e o esmaecido no mesmo pai com perspective, o Chrome
          pinta o plano por cima do esmaecido */}
      <div className="t3d-scene" style={{ perspective: `${PERSPECTIVE}px` }}>
        <div className="t3d-plane" style={{ transform: TILT }}>
          {lists.map((list, c) => (
            <Marquee
              key={c}
              vertical
              reverse={c % 2 === 1}
              pauseOnHover={pauseOnHover}
              repeat={repeat}
              duration={duration}
              tabIndex={-1}
              // as colunas mostram os mesmos depoimentos: o leitor de tela lê só a primeira
              aria-hidden={c > 0 || undefined}
            >
              {list.map(t => (
                <TestimonialCard key={t.username} {...t} />
              ))}
            </Marquee>
          ))}
        </div>
      </div>
      <div className="t3d-fade t3d-fade--top" />
      <div className="t3d-fade t3d-fade--bottom" />
      <div className="t3d-fade t3d-fade--left" />
      <div className="t3d-fade t3d-fade--right" />
    </section>
  )
}

export default Testimonials3D

const T3D_CSS = `
.t3d-root {
  --t3d-bg: #0a0a0a;
  --t3d-card: #171717;
  --t3d-card-hover: #232323;
  --t3d-fg: #fafafa;
  --t3d-muted: #a1a1a1;
  --t3d-border: rgba(255, 255, 255, 0.1);
  --t3d-border-hover: rgba(255, 255, 255, 0.3);
  --t3d-avatar: #262626;
  --t3d-ring: rgba(255, 255, 255, 0.4);
  --t3d-shadow: 0 1px 2px rgba(0, 0, 0, 0.4);
}
.t3d-root[data-theme="light"] {
  --t3d-bg: #ffffff;
  --t3d-card: #ffffff;
  --t3d-card-hover: #f5f5f5;
  --t3d-fg: #0a0a0a;
  --t3d-muted: #737373;
  --t3d-border: #e5e5e5;
  --t3d-border-hover: #a3a3a3;
  --t3d-avatar: #f5f5f5;
  --t3d-ring: rgba(10, 10, 10, 0.35);
  --t3d-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}

/* tamanho, posição, margem, borda e fundo ficam numa camada, para as classes do projeto vencerem */
@layer base {
  .t3d-root {
    position: relative;
    width: 100%;
    height: 384px;
    margin: 0;
    border: 1px solid var(--t3d-border);
    border-radius: 8px;
    background: var(--t3d-bg);
  }
}
.t3d-root {
  overflow: hidden;
  isolation: isolate;
  box-sizing: border-box;
  color: var(--t3d-fg);
  font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji";
  font-size: 16px;
  line-height: 1.5;
  letter-spacing: normal;
  text-align: left;
  -webkit-font-smoothing: antialiased;
  outline: none;
}
.t3d-root *, .t3d-root *::before, .t3d-root *::after { box-sizing: border-box; }
.t3d-root:focus-visible { box-shadow: 0 0 0 2px var(--t3d-bg), 0 0 0 4px var(--t3d-ring); }

.t3d-scene { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; }
.t3d-plane { display: flex; flex-direction: row; align-items: center; gap: 16px; }

.t3d-fade { position: absolute; z-index: 1; pointer-events: none; }
.t3d-fade--top { inset: 0 0 auto; height: 25%; background: linear-gradient(to bottom, var(--t3d-bg), transparent); }
.t3d-fade--bottom { inset: auto 0 0; height: 25%; background: linear-gradient(to top, var(--t3d-bg), transparent); }
.t3d-fade--left { inset: 0 auto 0 0; width: 25%; background: linear-gradient(to right, var(--t3d-bg), transparent); }
.t3d-fade--right { inset: 0 0 0 auto; width: 25%; background: linear-gradient(to left, var(--t3d-bg), transparent); }

.t3d-marquee {
  display: flex;
  flex-direction: row;
  gap: var(--t3d-gap, 16px);
  overflow: hidden;
  padding: 8px;
  outline: none;
}
.t3d-marquee[data-vertical] { flex-direction: column; }
.t3d-group {
  display: flex;
  flex-direction: row;
  flex-shrink: 0;
  justify-content: space-around;
  gap: var(--t3d-gap, 16px);
  animation: t3d-marquee var(--t3d-duration, 40s) linear infinite;
}
.t3d-marquee[data-vertical] > .t3d-group { flex-direction: column; animation-name: t3d-marquee-vertical; }
.t3d-marquee[data-reverse] > .t3d-group { animation-direction: reverse; }
.t3d-marquee[data-pause-on-hover]:hover > .t3d-group,
.t3d-marquee:focus-visible > .t3d-group,
.t3d-marquee:has(:focus-visible) > .t3d-group,
.t3d-root:focus-visible .t3d-group { animation-play-state: paused; }

@keyframes t3d-marquee {
  from { transform: translateX(0); }
  to { transform: translateX(calc(-100% - var(--t3d-gap, 16px))); }
}
@keyframes t3d-marquee-vertical {
  from { transform: translateY(0); }
  to { transform: translateY(calc(-100% - var(--t3d-gap, 16px))); }
}

.t3d-card {
  width: 200px;
  margin: 0;
  padding: 20px;
  border: 1px solid var(--t3d-border);
  border-radius: 12px;
  background: var(--t3d-card);
  color: var(--t3d-fg);
  box-shadow: var(--t3d-shadow);
  transition: border-color 0.2s ease, background-color 0.2s ease;
}
.t3d-card:hover { border-color: var(--t3d-border-hover); background: var(--t3d-card-hover); }
.t3d-card__head { display: flex; align-items: center; gap: 10px; }
.t3d-avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 36px;
  height: 36px;
  overflow: hidden;
  border-radius: 9999px;
  background: var(--t3d-avatar);
  font-size: 14px;
  font-weight: 500;
}
.t3d-avatar img { display: block; width: 100%; height: 100%; object-fit: cover; }
.t3d-card__who { display: flex; flex-direction: column; min-width: 0; }
.t3d-card__name {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  column-gap: 4px;
  margin: 0;
  font-size: 14px;
  line-height: 20px;
  font-weight: 500;
}
.t3d-card__country { font-size: 12px; line-height: 16px; font-weight: 400; color: var(--t3d-muted); white-space: nowrap; }
.t3d-card__user { margin: 0; font-size: 12px; line-height: 16px; font-weight: 500; color: var(--t3d-muted); }
.t3d-card__body { margin: 12px 0 0; padding: 0; border: 0; font-size: 14px; line-height: 20px; quotes: none; }

@media (prefers-reduced-motion: reduce) {
  .t3d-group { animation: none; }
}
`
