"use client"

import * as React from "react"

/**
 * Slide Confirm Button — o botão de arrastar para confirmar: uma pílula escura com um puxador colorido à esquerda e o
 * rótulo à direita. O puxador estica como borracha até o fim, comendo o rótulo; lá, a pílula inteira fica colorida, o
 * ícone vira um visto e um balão sobe por cima do centro.
 *
 * - **Arrasto**: a cabeça do puxador acompanha o dedo 1:1 (mouse, toque e caneta), com resistência de borracha nas
 *   pontas. Soltar antes do limiar volta numa mola que continua com a velocidade da mão; passar do limiar, ou arremessar
 *   para a direita, completa. O rabo do puxador tem massa (desgruda no puxão rápido), a tira afina com a velocidade e
 *   amassa quando bate na parede, e a pílula inteira cede no agarrão.
 * - **Confirmação**: onConfirm pode devolver uma Promise. Enquanto ela corre, o ícone vira um arco girando; resolveu, o
 *   visto se desenha e o balão sobe; rejeitou, a pílula treme, o balão mostra o erro e o puxador volta. resetAfter (ms)
 *   volta sozinho; pela ref, reset() e confirm() controlam de fora.
 * - **Teclado e leitor de tela**: é um <button> de verdade. Enter ou Espaço completam com o deslize animado, as setas
 *   andam 20% por vez, Home volta, End completa e Esc cancela (também no meio de um arrasto). O estado é anunciado numa
 *   região viva; o leitor de tela confirma com o gesto de ativar dele.
 * - **Hover** (só com mouse): um empurrãozinho no puxador e o cursor de pegar. Toque sem arrasto: um empurrão maior,
 *   mostrando para onde ir. Vibração curta no toque, onde o aparelho tiver.
 *
 * Tamanho do próprio componente, não da tela: a largura é a do contêiner (ou a prop width), a altura vem da variável
 * --scb-h (de qualquer ancestral), e a letra e o puxador seguem a largura (container queries). Vai de 240 a 420 px. O
 * balão mora dentro do componente (position: absolute), por cima da pílula: deixe uns 56 px livres em cima.
 *
 * Os ícones são desenhados aqui. Autocontido: o React é o único import. Sem Tailwind, sem bibliotecas, sem arquivo CSS.
 */

// O React 19 sobe uma <style> com href e precedence para o <head>, uma vez só (fora da página e do textContent dela). O
// React 18 não conhece isso: lá ela vai dentro do componente, escondida e com o CSS cru, porque como filho de texto o SSR
// do 18 escaparia as aspas e quebraria os seletores.
const HOISTS_STYLES = Number(React.version.split(".")[0]) >= 19

function ScbStyles() {
  if (HOISTS_STYLES) {
    const hoist = { href: "slide-confirm-button", precedence: "default" }
    return <style {...hoist}>{SCB_CSS}</style>
  }
  return <style hidden dangerouslySetInnerHTML={{ __html: SCB_CSS }} />
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* ícones (traço redondo, a mesma espessura nos três)                                                                  */

function DragIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      <circle className="scb-dot scb-dot--1" cx="3.6" cy="12" r="1.15" fill="currentColor" />
      <circle className="scb-dot scb-dot--2" cx="8.3" cy="12" r="1.45" fill="currentColor" />
      <path d="M13.2 6.4 18.8 12l-5.6 5.6" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function SpinIcon() {
  return (
    <svg className="scb-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      <path d="M12 4.2a7.8 7.8 0 1 1-7.8 7.8" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      <path
        className="scb-check"
        d="M5.4 12.6 9.9 17 18.6 7.6"
        pathLength={1}
        stroke="currentColor"
        strokeWidth="2.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* a física: um laço de quadros que escreve direto no DOM (o React só troca os estados)                                */

// molas [frequência natural em rad/s, amortecimento]: abaixo de 1 passa do lugar e balança antes de assentar
const SPRING = {
  back: [15, 0.46], // soltou antes do limiar: volta com a velocidade da mão, amassa na parede e assenta
  commit: [16.5, 0.58], // soltou depois do limiar: corre até o fim e dá o tum
  glide: [11, 0.68], // Enter, leitor de tela ou confirm(): o deslize que mostra o caminho
  step: [22, 0.82], // setas do teclado
  reset: [10, 0.72], // depois de confirmado: recolhe, mais calma
  nudge: [11.5, 0.32], // o empurrãozinho do hover e do toque
  calm: [26, 1], // movimento reduzido: sem passar do lugar, uma troca curta
}

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))
// no servidor o useLayoutEffect não roda (e o React 18 avisa no console); lá vai o useEffect, que também não roda
const useIsoLayoutEffect = typeof window === "undefined" ? React.useEffect : React.useLayoutEffect
// o elástico do iOS: cede 55% no começo e nunca passa de dim
const rubber = (d, dim) => (1 - 1 / ((d * 0.55) / dim + 1)) * dim

class SlideEngine {
  els
  live
  hooks
  reduce = false
  dead = false
  phase = "idle"
  bubbleOn = false
  // medidas, em px de layout (sem a escala de fora)
  W = 0 // a canaleta por onde a tira corre
  K = 0 // o puxador em repouso
  D = 0 // o caminho da cabeça: W - K
  pad = 0
  labelLeft = 0
  // a cabeça (posição física, sem o elástico das pontas), a meta e a mola
  x = 0
  vx = 0
  goal = 0
  spring = SPRING.back
  // o rabo, a espessura da tira e a pílula inteira
  t = 0
  vt = 0
  sq = 1
  vsq = 0
  ts = 1
  vts = 0
  shakeAt = -1
  // o ponteiro
  pid = null
  startX = 0
  x0 = 0
  scale = 1
  moved = false
  armed = false
  touch = false
  lastUp = -1e9
  lastNudge = -1e9
  samples = []
  // a confirmação
  run = 0
  pending = false
  pendingAt = 0
  result = null
  timers = []
  raf = 0
  last = 0

  constructor(els, live, hooks) {
    this.els = els
    this.live = live
    this.hooks = hooks
  }

  measure() {
    const { root, groove, knob, label } = this.els
    this.W = groove.clientWidth
    this.K = knob.offsetWidth
    this.D = Math.max(1, this.W - this.K)
    this.pad = Math.max(0, (root.offsetHeight - groove.clientHeight) / 2)
    this.labelLeft = label.offsetLeft
    if (this.phase === "busy" || this.phase === "done") this.x = this.goal = this.D
    this.render(performance.now())
  }

  setPhase(p) {
    if (this.phase === p) return
    this.phase = p
    this.hooks.phase(p)
  }

  setBubble(show, kind = "done") {
    this.bubbleOn = show
    this.hooks.bubble({ show, kind })
  }

  later(fn, ms) {
    const id = window.setTimeout(() => {
      this.timers = this.timers.filter(t => t !== id)
      fn()
    }, ms)
    this.timers.push(id)
  }

  clearTimers() {
    this.timers.forEach(id => window.clearTimeout(id))
    this.timers = []
  }

  vibrate(pattern) {
    if (!this.touch) return
    try {
      navigator.vibrate?.(pattern)
    } catch {
      /* sem vibração neste aparelho */
    }
  }

  springTo(goal, name) {
    this.goal = goal
    this.spring = SPRING[this.reduce ? "calm" : name]
    this.kick()
  }

  /* -------------------------------------------------------------------------------------------- o laço de quadros */

  kick() {
    if (this.raf || this.dead) return
    this.last = performance.now()
    this.raf = requestAnimationFrame(this.frame)
  }

  frame = (now) => {
    this.raf = 0
    const dt = clamp((now - this.last) / 1000, 0, 1 / 30)
    this.last = now
    for (let i = 0; i < 4; i++) this.integrate(dt / 4)
    this.finishIfArrived(now)
    this.render(now)
    if (this.moving(now)) this.raf = requestAnimationFrame(this.frame)
  }

  integrate(h) {
    const dragging = this.pid !== null
    const rm = this.reduce
    if (!dragging) {
      const [w, z] = this.spring
      const before = this.x
      this.vx += (-w * w * (this.x - this.goal) - 2 * z * w * this.vx) * h
      this.x += this.vx * h
      // o tum da chegada: a cabeça cruzando o fim empurra a pílula inteira, na medida da velocidade
      if (!rm && before < this.D && this.x >= this.D && this.vx > 0) this.vts += Math.min(0.55, this.vx * 0.00026)
    }
    // o rabo: desgruda na direção do puxão rápido e volta numa mola própria
    const tg = rm ? 0 : clamp(this.vx * 0.0042, -this.pad * 0.7, this.K * 0.14)
    this.vt += (-484 * (this.t - tg) - 18.5 * this.vt) * h
    this.t += this.vt * h
    // a espessura: a tira esticada afina (a tensão cresce com o comprimento e some quando ela completa), afina mais
    // com a velocidade e incha quando amassa na parede da esquerda
    const tension = this.phase === "busy" || this.phase === "done" ? 0 : clamp(this.x / this.D, 0, 1)
    let sg = 1 - 0.06 * Math.pow(tension, 1.4) - Math.min(0.05, Math.abs(this.vx) * 0.000024)
    if (this.x < 0) sg += (rubber(-this.x, this.K * 0.2) / this.K) * 0.3
    if (rm) sg = 1
    this.vsq += (-676 * (this.sq - sg) - 26 * this.vsq) * h
    this.sq += this.vsq * h
    // a pílula inteira: cede no agarrão e volta com um pulinho
    const pg = dragging && !rm ? 0.976 : 1
    this.vts += (-576 * (this.ts - pg) - 24 * this.vts) * h
    this.ts += this.vts * h
  }

  moving(now) {
    if (this.pid !== null || this.shakeAt >= 0) return true
    // com a resposta na mão, falta terminar (o arco pode estar segurando); esperando a Promise, o laço dorme até ela
    if (this.phase === "busy" && this.result !== null) return true
    const still =
      Math.abs(this.x - this.goal) < 0.05 &&
      Math.abs(this.vx) < 1 &&
      Math.abs(this.t) < 0.02 &&
      Math.abs(this.vt) < 0.2 &&
      Math.abs(this.sq - 1) < 0.0005 &&
      Math.abs(this.vsq) < 0.005 &&
      Math.abs(this.ts - 1) < 0.0005 &&
      Math.abs(this.vts) < 0.005
    if (!still) return true
    this.x = this.goal
    this.vx = this.t = this.vt = this.vsq = this.vts = 0
    this.sq = this.ts = 1
    this.render(now)
    return false
  }

  render(now) {
    const { band, knob, label, track } = this.els
    const { W, K, D } = this
    if (!W || !K) return
    const rm = this.reduce
    const x = this.x
    // fora das pontas, a borracha: na esquerda o puxador amassa na parede; na direita a pílula é puxada junto
    const head = clamp(x, 0, D)
    const squash = x < 0 ? rubber(-x, K * 0.2) : 0
    const push = x > D && !rm ? rubber(x - D, Math.max(10, W * 0.04)) : 0
    const left = rm ? 0 : clamp(this.t, -this.pad * 0.7, K * 0.14)
    const right = K + head - squash + Math.min(push * 0.3, this.pad * 0.5)
    const bw = Math.max(K * 0.5, right - left)
    band.style.width = bw.toFixed(2) + "px"
    band.style.transform = `translate3d(${left.toFixed(2)}px,0,0) scaleY(${(rm ? 1 : this.sq).toFixed(4)})`
    // o ícone fica no meio da tira, como uma marca impressa na borracha: anda à metade da cabeça e, com a tira cheia,
    // está no centro da pílula
    knob.style.transform = `translate3d(${(left + bw / 2 - K / 2).toFixed(2)}px,0,0)`
    // o rótulo some onde a cor passa: a máscara anda com a borda da tira e esfuma um trecho à frente dela
    label.style.setProperty("--scb-e", (right - this.labelLeft).toFixed(1) + "px")
    label.style.setProperty("--scb-f", Math.min(32, head * 0.9).toFixed(1) + "px")
    label.style.opacity = clamp(1 - 0.32 * (head / D), 0, 1).toFixed(3)
    // a pílula inteira: cede, é puxada nas pontas e treme no erro
    let lean = 0
    if (!rm) {
      lean = push * 0.55 - squash * 0.25
      if (this.shakeAt >= 0) {
        const s = (now - this.shakeAt) / 1000
        if (s > 0.5) this.shakeAt = -1
        else lean += Math.sin(s * Math.PI * 2 * 8.5) * 6.5 * Math.exp(-s * 7.5)
      }
    }
    track.style.transform = `translate3d(${lean.toFixed(2)}px,0,0) scale(${(rm ? 1 : this.ts).toFixed(4)})`
  }

  /* ------------------------------------------------------------------------------------------------- o ponteiro */

  pointerDown(e) {
    if (this.live().disabled || this.pid !== null || e.button !== 0) return
    if (this.phase !== "idle" && this.phase !== "error") return
    if (this.phase === "error") this.toIdle()
    this.measure()
    const rect = this.els.root.getBoundingClientRect()
    this.scale = rect.width / (this.els.root.offsetWidth || rect.width || 1) || 1
    this.pid = e.pointerId
    this.touch = e.pointerType === "touch"
    this.startX = e.clientX
    this.x0 = this.x // pega o puxador onde ele estiver, até no meio de uma mola
    this.vx = 0
    this.moved = false
    this.samples = [{ t: performance.now(), x: this.x }]
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      /* evento de script (pointerId de mentira): segue pelos ouvintes da janela */
    }
    window.addEventListener("pointermove", this.pointerMove)
    window.addEventListener("pointerup", this.pointerUp)
    window.addEventListener("pointercancel", this.pointerUp)
    window.addEventListener("keydown", this.escapeDrag)
    window.addEventListener("blur", this.cancelDrag)
    this.kick()
  }

  pointerMove = (e) => {
    if (e.pointerId !== this.pid) return
    const now = performance.now()
    const dx = (e.clientX - this.startX) / (this.scale * this.ts)
    if (!this.moved && Math.abs(dx) > 3) {
      this.moved = true
      this.setPhase("drag")
    }
    this.x = this.x0 + dx
    this.samples.push({ t: now, x: this.x })
    while (this.samples.length > 2 && now - this.samples[0].t > 100) this.samples.shift()
    const s0 = this.samples[0]
    if (now - s0.t > 8) this.vx = (this.x - s0.x) / ((now - s0.t) / 1000)
    // o limiar com corpo: ao cruzar, o ícone pula, a luz cresce e o toque vibra; voltando (com folga), apaga
    const thr = this.live().threshold * this.D
    if (!this.armed && this.x >= thr) this.arm(true)
    else if (this.armed && this.x < thr - this.D * 0.05) this.arm(false)
  }

  pointerUp = (e) => {
    if (e.pointerId !== this.pid) return
    const cancelled = e.type === "pointercancel"
    const now = performance.now()
    const v = this.releaseVelocity(now)
    const moved = this.moved
    this.lastUp = now
    this.endDrag()
    if (!moved) {
      // toque ou clique sem arrasto: o empurrão que mostra para onde ir
      this.setPhase("idle")
      if (!cancelled && this.goal === 0) this.nudge(this.reduce ? 0 : 440)
      return
    }
    // além das pontas, a física recomeça perto do que está desenhado (o elástico já cedeu quase tudo)
    this.x = clamp(this.x, -this.K * 0.6, this.D + Math.max(10, this.W * 0.04) * 3)
    this.vx = clamp(v, -4000, 4000)
    // completa quem passou do limiar, quem arremessou (700 px/s para a direita) ou quem chegaria lá no embalo
    const thr = this.live().threshold * this.D
    if (!cancelled && (this.x >= thr || v >= 700 || (v > 250 && this.x + v * 0.28 >= thr))) {
      this.commit(true)
    } else {
      this.setPhase("idle")
      this.springTo(0, "back")
    }
  }

  releaseVelocity(now) {
    const s = this.samples
    const last = s[s.length - 1]
    if (!last || now - last.t > 70) return 0 // a mão parou antes de soltar
    let first = last
    for (let i = s.length - 1; i >= 0; i--) {
      if (now - s[i].t > 110) break
      first = s[i]
    }
    const dt = (last.t - first.t) / 1000
    return dt > 0.012 ? (last.x - first.x) / dt : this.vx
  }

  endDrag() {
    const { track } = this.els
    if (this.pid !== null) {
      try {
        if (track.hasPointerCapture(this.pid)) track.releasePointerCapture(this.pid)
      } catch {
        /* já solto */
      }
    }
    this.pid = null
    this.arm(false)
    window.removeEventListener("pointermove", this.pointerMove)
    window.removeEventListener("pointerup", this.pointerUp)
    window.removeEventListener("pointercancel", this.pointerUp)
    window.removeEventListener("keydown", this.escapeDrag)
    window.removeEventListener("blur", this.cancelDrag)
    this.kick()
  }

  cancelDrag = () => {
    if (this.pid === null) return
    this.endDrag()
    this.setPhase("idle")
    this.springTo(0, "back")
  }

  escapeDrag = (e) => {
    if (e.key !== "Escape" || this.pid === null) return
    e.preventDefault()
    this.cancelDrag()
  }

  arm(on) {
    if (this.armed === on) return
    this.armed = on
    if (on) {
      this.els.root.setAttribute("data-armed", "")
      this.vibrate(8)
    } else {
      this.els.root.removeAttribute("data-armed")
    }
  }

  nudge(v) {
    this.spring = SPRING[this.reduce ? "calm" : "nudge"]
    this.goal = 0
    this.vx += v
    this.kick()
  }

  hover(e) {
    if (e.pointerType !== "mouse" || this.live().disabled || this.pid !== null || this.reduce) return
    if (this.phase !== "idle" || this.goal !== 0 || Math.abs(this.x) > 2) return
    const now = performance.now()
    if (now - this.lastNudge < 700) return
    this.lastNudge = now
    this.measure()
    this.nudge(240)
  }

  /* ------------------------------------------------------------------------------------------------- o teclado */

  keyDown(e) {
    if (this.live().disabled) return
    const k = e.key
    const free = (this.phase === "idle" || this.phase === "error") && this.pid === null
    if (k === "Enter" || k === " " || k === "Spacebar") {
      e.preventDefault() // o clique nativo do botão não sai: o Enter completa com o deslize
      if (free && !e.repeat) this.commit()
      return
    }
    if (k === "Escape") {
      if (free && this.goal > 0) {
        e.preventDefault()
        this.springTo(0, "back")
      }
      return
    }
    if (!free) return
    this.measure()
    const step = this.D * 0.2
    if (k === "ArrowRight") {
      e.preventDefault()
      if (this.goal + step >= this.D - 1) this.commit()
      else this.springTo(this.goal + step, "step")
    } else if (k === "ArrowLeft") {
      e.preventDefault()
      this.springTo(Math.max(0, this.goal - step), "step")
    } else if (k === "Home") {
      e.preventDefault()
      this.springTo(0, "step")
    } else if (k === "End") {
      e.preventDefault()
      this.commit()
    }
  }

  keyUp(e) {
    if (e.key === " " || e.key === "Spacebar") e.preventDefault()
  }

  blur() {
    if (this.pid === null && this.phase === "idle" && this.goal > 0) this.springTo(0, "back")
  }

  // o clique que o navegador manda depois de um toque ou arrasto não confirma nada (o gesto é arrastar); um clique sem
  // ponteiro antes é o do leitor de tela (ou de um script): confirma com o deslize
  click() {
    if (this.live().disabled || this.pid !== null) return
    if (performance.now() - this.lastUp < 600) return
    if (this.phase === "idle" || this.phase === "error") {
      this.touch = false
      this.commit()
    }
  }

  /* --------------------------------------------------------------------------------------------- a confirmação */

  // byHand: a pessoa soltou o puxador depois do limiar (senão é o teclado, o leitor de tela ou a ref)
  commit(byHand = false) {
    if (this.dead || this.live().disabled) return
    if (this.phase === "busy" || this.phase === "done") return
    this.clearTimers()
    if (this.bubbleOn) this.setBubble(false, "error")
    this.measure()
    this.setPhase("busy")
    this.arm(false)
    this.springTo(this.D, byHand ? "commit" : "glide")
    // solta pela mão, a tira sempre chega com embalo: mesmo parada perto do fim, ela estala contra a ponta
    if (byHand && !this.reduce) this.vx = Math.max(this.vx, 700)
    this.result = null
    const run = ++this.run
    let out
    try {
      out = this.live().onConfirm?.()
    } catch (err) {
      console.error(err)
      this.result = false
      this.kick()
      return
    }
    if (out && typeof out.then === "function") {
      this.pending = true
      this.pendingAt = performance.now()
      this.els.root.setAttribute("data-pending", "")
      this.hooks.announce(this.live().loadingLabel)
      ;out.then(
        () => this.settle(run, true),
        () => this.settle(run, false),
      )
    } else {
      this.result = true
    }
    this.kick()
  }

  settle(run, ok) {
    if (this.dead || run !== this.run) return
    this.result = ok
    this.kick()
  }

  finishIfArrived(now) {
    if (this.phase !== "busy" || this.result === null) return
    if (Math.abs(this.x - this.D) > 6 || Math.abs(this.vx) > 240) return
    if (this.pending) {
      // o arco aparece 150 ms depois do começo; se apareceu, fica pelo menos ~0,45 s, para não piscar
      const shown = now - this.pendingAt
      if (shown > 150 && shown < 600) return
      this.pending = false
      this.els.root.removeAttribute("data-pending")
    }
    if (this.result) this.succeed()
    else this.fail(now)
  }

  succeed() {
    const live = this.live()
    this.setPhase("done")
    this.setBubble(true, "done")
    this.hooks.announce(live.confirmedLabel)
    this.vibrate(14)
    if (live.resetAfter && live.resetAfter > 0) this.later(() => this.reset(), live.resetAfter)
  }

  fail(now) {
    const live = this.live()
    this.setPhase("error")
    this.setBubble(true, "error")
    this.hooks.announce(live.errorLabel)
    this.vibrate([10, 40, 10])
    this.shakeAt = this.reduce ? -1 : now
    this.springTo(0, "back")
    this.later(() => this.toIdle(), 2400)
  }

  toIdle() {
    this.clearTimers()
    if (this.bubbleOn) this.setBubble(false, "error")
    this.setPhase("idle")
    this.hooks.announce("")
  }

  reset() {
    if (this.dead) return
    this.clearTimers()
    this.run++
    this.result = null
    this.pending = false
    this.els.root.removeAttribute("data-pending")
    if (this.pid !== null) this.endDrag()
    const hadBubble = this.bubbleOn
    if (hadBubble) this.setBubble(false, this.phase === "error" ? "error" : "done")
    this.setPhase("idle")
    this.hooks.announce("")
    // o balão sai primeiro; a tira recolhe logo depois
    if (hadBubble && !this.reduce) this.later(() => this.springTo(0, "reset"), 110)
    else this.springTo(0, "reset")
    this.kick()
  }

  destroy() {
    this.dead = true
    this.clearTimers()
    if (this.raf) cancelAnimationFrame(this.raf)
    this.raf = 0
    if (this.pid !== null) this.endDrag()
  }
}

/* ------------------------------------------------------------------------------------------------------------------ */

export const SlideConfirmButton = React.forwardRef(
  function SlideConfirmButton(
    {
      label = "Deslize para confirmar",
      confirmedLabel = "Confirmado",
      loadingLabel = "Confirmando…",
      errorLabel = "Não deu certo. Tente de novo.",
      hint = "Arraste até o fim ou aperte Enter para confirmar.",
      onConfirm,
      resetAfter,
      tone = "brasa",
      disabled = false,
      threshold = 0.8,
      width,
      icon,
      confirmedIcon,
      className,
      style,
    },
    ref,
  ) {
    const [phase, setPhase] = React.useState("idle")
    const [bubble, setBubble] = React.useState({ show: false, kind: "done" })
    const [announce, setAnnounce] = React.useState("")
    const id = React.useId()

    const rootRef = React.useRef(null)
    const trackRef = React.useRef(null)
    const grooveRef = React.useRef(null)
    const bandRef = React.useRef(null)
    const knobRef = React.useRef(null)
    const labelRef = React.useRef(null)
    const engine = React.useRef(null)

    // as props mais novas, lidas pelo motor na hora de usar (ele nasce uma vez só). A ref muda logo depois do render,
    // num efeito de layout, nunca durante ele
    const props = {
      threshold: clamp(threshold, 0.3, 0.98),
      loadingLabel,
      confirmedLabel,
      errorLabel,
      onConfirm,
      resetAfter,
      disabled,
    }
    const live = React.useRef(props)
    useIsoLayoutEffect(() => {
      live.current = props
    })

    React.useEffect(() => {
      const els = {
        root: rootRef.current,
        track: trackRef.current,
        groove: grooveRef.current,
        band: bandRef.current,
        knob: knobRef.current,
        label: labelRef.current,
      }
      const eng = new SlideEngine(els, () => live.current, { phase: setPhase, bubble: setBubble, announce: setAnnounce })
      engine.current = eng

      const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
      const onMq = () => {
        eng.reduce = mq.matches
      }
      onMq()
      mq.addEventListener?.("change", onMq)

      const ro = new ResizeObserver(() => eng.measure())
      ro.observe(els.groove)
      eng.measure()

      // as transições ficam presas até a montagem assentar: nada aparece e some no primeiro quadro
      let r2 = 0
      const r1 = requestAnimationFrame(() => {
        r2 = requestAnimationFrame(() => els.root.setAttribute("data-ready", ""))
      })

      return () => {
        cancelAnimationFrame(r1)
        cancelAnimationFrame(r2)
        ro.disconnect()
        mq.removeEventListener?.("change", onMq)
        eng.destroy()
        engine.current = null
      }
    }, [])

    React.useEffect(() => {
      if (disabled) engine.current?.cancelDrag()
    }, [disabled])

    React.useImperativeHandle(
      ref,
      () => ({
        reset: () => engine.current?.reset(),
        confirm: () => engine.current?.commit(),
      }),
      [],
    )

    const locked = phase === "busy" || phase === "done"
    const rootStyle = { ...style }
    if (width !== undefined) rootStyle.width = typeof width === "number" ? width + "px" : width

    return (
      <div
        ref={rootRef}
        className={"scb" + (className ? " " + className : "")}
        data-tone={tone}
        data-state={phase}
        data-disabled={disabled ? "" : undefined}
        style={rootStyle}
      >
        <ScbStyles />
        <button
          ref={trackRef}
          type="button"
          className="scb-track"
          disabled={disabled}
          aria-label={phase === "done" ? confirmedLabel : undefined}
          aria-describedby={locked ? undefined : id + "-hint"}
          aria-busy={phase === "busy" ? true : undefined}
          aria-disabled={locked ? true : undefined}
          onPointerDown={e => engine.current?.pointerDown(e)}
          onPointerEnter={e => engine.current?.hover(e)}
          onKeyDown={e => engine.current?.keyDown(e)}
          onKeyUp={e => engine.current?.keyUp(e)}
          onBlur={() => engine.current?.blur()}
          onClick={() => engine.current?.click()}
          onDragStart={e => e.preventDefault()}
        >
          <span ref={grooveRef} className="scb-groove">
            <span ref={labelRef} className="scb-label">
              <span className="scb-label__text">{label}</span>
              <span className="scb-shine" aria-hidden="true">
                <span className="scb-shine__copy">
                  <span className="scb-label__text">{label}</span>
                </span>
              </span>
            </span>
            <span ref={bandRef} className="scb-band" aria-hidden="true" />
            <span ref={knobRef} className="scb-knob" aria-hidden="true">
              <span className="scb-icon scb-icon--drag">{icon ?? <DragIcon />}</span>
              <span className="scb-icon scb-icon--load">
                <SpinIcon />
              </span>
              <span className="scb-icon scb-icon--done">{confirmedIcon ?? <CheckIcon />}</span>
            </span>
          </span>
        </button>
        <span className="scb-bubble" data-show={bubble.show ? "" : undefined} data-kind={bubble.kind} aria-hidden="true">
          <span className="scb-bubble__body">{bubble.kind === "error" ? errorLabel : confirmedLabel}</span>
          <svg className="scb-bubble__tail" viewBox="0 0 20 9" aria-hidden="true" focusable="false">
            <path d="M0 0h20c-4.6 0-6.4 7.6-10 7.6S4.6 0 0 0Z" />
          </svg>
        </span>
        <span id={id + "-hint"} className="scb-sr">
          {hint}
        </span>
        <span className="scb-sr" role="status" aria-live="polite">
          {announce}
        </span>
      </div>
    )
  },
)

const SCB_CSS = `
/* as cores: a pílula, o rótulo e os três tons do puxador (degradê do rabo para a cabeça, a cor do ícone, a luz que vaza
   na pílula e o balão). A altura vem de --scb-h, que pode ser posta em qualquer ancestral (padrão 64 px) */
.scb {
  --scb-track: #131418;
  --scb-track-hi: #26282e;
  --scb-track-lo: #0a0b0d;
  --scb-text: #9a9da6;
  --scb-text-hi: #ffffff;
  --scb-a: #ee2f0d;
  --scb-b: #ff6614;
  --scb-c: #ffae2c;
  --scb-ink: #2b0f03;
  --scb-glow: rgba(255, 90, 20, .55);
  --scb-ring: #ff7a1f;
  --scb-bubble: #ffe6d2;
  --scb-bubble-ink: #8a2a05;
  --scb-err: #18191c;
  --scb-err-ink: #f4f4f5;
  --scb-out: cubic-bezier(.23, 1, .32, 1);

  /* as medidas saem da altura e da largura do próprio componente */
  --scb-hh: var(--scb-h, 64px);
  --scb-pad: calc(var(--scb-hh) * .094);
  --scb-g: calc(var(--scb-hh) - 2 * var(--scb-pad));
  --scb-knob: clamp(calc(var(--scb-g) * 1.4), 27cqw, calc(var(--scb-g) * 2));
  --scb-fs: clamp(13px, 5.6cqw, calc(var(--scb-hh) * .3));
  --scb-bfs: clamp(12px, 3.9cqw, calc(var(--scb-hh) * .24));
}
.scb[data-tone="anil"] {
  --scb-a: #3a2bff;
  --scb-b: #3d63ff;
  --scb-c: #59afff;
  --scb-ink: #050a29;
  --scb-glow: rgba(66, 98, 255, .58);
  --scb-ring: #5a7bff;
  --scb-bubble: #e2e7ff;
  --scb-bubble-ink: #2431a3;
}
.scb[data-tone="menta"] {
  --scb-a: #07a374;
  --scb-b: #17d199;
  --scb-c: #8cf1cd;
  --scb-ink: #02271a;
  --scb-glow: rgba(23, 209, 153, .5);
  --scb-ring: #1fd49d;
  --scb-bubble: #d4f7e8;
  --scb-bubble-ink: #076d4c;
}
.scb[data-disabled] {
  --scb-a: #3f4146;
  --scb-b: #4c4f55;
  --scb-c: #5f6269;
  --scb-ink: #191a1d;
  --scb-glow: transparent;
  --scb-text: #6a6d75;
  --scb-text-hi: #6a6d75;
}

.scb {
  position: relative;
  display: block;
  box-sizing: border-box;
  width: 100%;
  max-width: 100%;
  container-type: inline-size;
  font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  font-size: 16px;
  font-weight: 400;
  line-height: 1;
  letter-spacing: normal;
  text-align: left;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
.scb *, .scb *::before, .scb *::after { box-sizing: border-box; }

/* a pílula: tinta quase preta, com um bisel macio em cima e sombra de objeto pesado */
.scb-track {
  position: relative;
  display: block;
  width: 100%;
  height: var(--scb-hh);
  margin: 0;
  padding: var(--scb-pad);
  border: 0;
  border-radius: 999px;
  background: linear-gradient(180deg, var(--scb-track-hi), var(--scb-track) 46%, var(--scb-track-lo));
  box-shadow:
    0 0 0 1px rgba(0, 0, 0, .62),
    0 1.5px 1px -.5px rgba(0, 0, 0, .3),
    0 10px 22px -10px rgba(0, 0, 0, .55),
    0 26px 44px -26px rgba(0, 0, 0, .5);
  color: inherit;
  font: inherit;
  text-align: inherit;
  cursor: grab;
  touch-action: pan-y;
  user-select: none;
  -webkit-user-select: none;
  -webkit-touch-callout: none;
  -webkit-tap-highlight-color: transparent;
  -webkit-appearance: none;
  appearance: none;
  transform-origin: 50% 50%;
  will-change: transform;
}
.scb-track::before {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: linear-gradient(180deg, rgba(255, 255, 255, .075), rgba(255, 255, 255, 0) 48%);
  box-shadow: inset 0 1.5px 0 rgba(255, 255, 255, .16), inset 0 0 0 1px rgba(255, 255, 255, .035);
  pointer-events: none;
}
.scb-track:focus { outline: none; }
.scb-track:focus-visible { outline: 2px solid var(--scb-ring); outline-offset: 3px; }
.scb[data-state="drag"] .scb-track { cursor: grabbing; }
.scb[data-state="busy"] .scb-track,
.scb[data-state="done"] .scb-track { cursor: default; }
.scb-track:disabled { cursor: not-allowed; }

/* a canaleta por onde a tira corre */
.scb-groove {
  position: relative;
  display: block;
  width: 100%;
  height: 100%;
  border-radius: 999px;
  box-shadow: inset 0 1.5px 4px rgba(0, 0, 0, .55);
  contain: layout style;
}

/* o rótulo: centrado no espaço à direita do puxador; some onde a cor passa (--scb-e é a borda da tira, --scb-f o trecho
   esfumado à frente dela) */
.scb-label {
  --scb-e: -999px;
  --scb-f: 0px;
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  left: var(--scb-knob);
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 calc(var(--scb-g) * .34) 0 calc(var(--scb-g) * .16);
  overflow: hidden;
  pointer-events: none;
  -webkit-mask-image: linear-gradient(90deg, transparent var(--scb-e), #000 calc(var(--scb-e) + var(--scb-f)));
  mask-image: linear-gradient(90deg, transparent var(--scb-e), #000 calc(var(--scb-e) + var(--scb-f)));
}
.scb-label__text {
  display: block;
  min-width: 0;
  overflow: hidden;
  font-size: var(--scb-fs);
  font-weight: 500;
  line-height: 1.3;
  letter-spacing: -.006em;
  white-space: nowrap;
  text-overflow: ellipsis;
  color: var(--scb-text);
}
/* o brilho que corre convidando a arrastar, de tempos em tempos, só parado: uma janela de bordas macias anda sobre uma
   cópia branca do rótulo, que anda ao contrário e por isso fica parada. Só transform: roda fora da thread principal */
.scb-shine {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  width: 40%;
  overflow: hidden;
  pointer-events: none;
  transform: translateX(-100%);
  -webkit-mask-image: linear-gradient(90deg, transparent, #000 44%, #000 56%, transparent);
  mask-image: linear-gradient(90deg, transparent, #000 44%, #000 56%, transparent);
}
.scb-shine__copy {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 250%;
  padding: 0 calc(var(--scb-g) * .34) 0 calc(var(--scb-g) * .16);
  transform: translateX(40%);
}
.scb-shine .scb-label__text { color: var(--scb-text-hi); }
.scb[data-ready][data-state="idle"]:not([data-disabled]) .scb-shine {
  animation: scb-shine-window 4.4s cubic-bezier(.45, .05, .3, 1) 1.2s infinite both;
}
.scb[data-ready][data-state="idle"]:not([data-disabled]) .scb-shine__copy {
  animation: scb-shine-copy 4.4s cubic-bezier(.45, .05, .3, 1) 1.2s infinite both;
}
@keyframes scb-shine-window {
  0% { transform: translateX(-100%); }
  36%, 100% { transform: translateX(250%); }
}
@keyframes scb-shine-copy {
  0% { transform: translateX(40%); }
  36%, 100% { transform: translateX(-100%); }
}

/* a tira: o degradê do rabo (fundo) para a cabeça (claro), o brilho de cima e a luz que vaza na pílula. A largura, a
   posição e a espessura vêm do motor, a cada quadro (width, e não scaleX, para as pontas continuarem redondas) */
.scb-band {
  position: absolute;
  top: 0;
  left: 0;
  z-index: 2;
  display: block;
  width: var(--scb-knob);
  height: 100%;
  border-radius: 999px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, .2), rgba(255, 255, 255, 0) 50%),
    linear-gradient(90deg, var(--scb-a), var(--scb-b) 62%, var(--scb-c));
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, .5),
    inset 0 -1.5px 2px rgba(0, 0, 0, .14),
    0 0 0 .5px rgba(0, 0, 0, .35),
    0 1px 8px -2px var(--scb-glow),
    0 0 18px -7px var(--scb-glow);
  transform-origin: 50% 50%;
  will-change: transform;
  transition: box-shadow .28s var(--scb-out), filter .2s var(--scb-out);
}
/* passou do limiar: a luz cresce; com a tira cheia ela recolhe, e a pílula volta a ter a borda escura limpa */
.scb[data-armed] .scb-band {
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, .55),
    inset 0 -1.5px 2px rgba(0, 0, 0, .14),
    0 0 0 .5px rgba(0, 0, 0, .35),
    0 1px 10px -2px var(--scb-glow),
    0 0 22px -6px var(--scb-glow);
}
.scb[data-state="busy"] .scb-band,
.scb[data-state="done"] .scb-band {
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, .55),
    inset 0 -1.5px 2px rgba(0, 0, 0, .14),
    0 0 0 .5px rgba(0, 0, 0, .4),
    0 0 6px -3px var(--scb-glow);
}
/* carregando: uma luz quente, da cor da cabeça, atravessa a tira (branca, ela desbotaria a cor) */
.scb-band::after {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: linear-gradient(100deg, transparent 40%, color-mix(in srgb, var(--scb-c) 62%, #fff) 50%, transparent 60%) 0 0 / 250% 100% no-repeat;
  opacity: 0;
  transition: opacity .25s var(--scb-out);
}
.scb[data-state="busy"][data-pending] .scb-band::after {
  opacity: .42;
  transition-delay: .15s;
  animation: scb-sheen 1.15s cubic-bezier(.45, .05, .55, .95) infinite;
}
@keyframes scb-sheen {
  from { background-position: 100% 0; }
  to { background-position: 0% 0; }
}

/* o ícone: no meio da tira (o motor o põe lá a cada quadro) */
.scb-knob {
  position: absolute;
  top: 0;
  left: 0;
  z-index: 3;
  display: grid;
  place-items: center;
  width: var(--scb-knob);
  height: 100%;
  color: var(--scb-ink);
  pointer-events: none;
  will-change: transform;
}
.scb-icon {
  grid-area: 1 / 1;
  display: grid;
  place-items: center;
  width: calc(var(--scb-g) * .46);
  height: calc(var(--scb-g) * .46);
  transition: opacity .16s var(--scb-out), transform .2s var(--scb-out), filter .16s var(--scb-out);
}
.scb-icon > * { display: block; width: 100%; height: 100%; }
.scb-icon--load,
.scb-icon--done { opacity: 0; transform: scale(.82); filter: blur(3px); }
/* a seta sai quando entra o arco (com a Promise correndo) ou o visto; sem Promise, ela fica até o visto */
.scb[data-state="busy"][data-pending] .scb-icon--drag,
.scb[data-state="done"] .scb-icon--drag { opacity: 0; transform: scale(.82); filter: blur(3px); }
.scb[data-state="busy"][data-pending] .scb-icon--drag { transition-delay: .15s; }
.scb[data-state="busy"][data-pending] .scb-icon--load {
  opacity: 1;
  transform: none;
  filter: none;
  transition-duration: .22s, .34s, .22s;
  transition-delay: .15s;
}
.scb[data-state="done"] .scb-icon--done {
  opacity: 1;
  transform: none;
  filter: none;
  transition-duration: .22s, .38s, .22s;
}
.scb-spin { animation: scb-spin .8s linear infinite; }
@keyframes scb-spin { to { transform: rotate(360deg); } }
.scb-check { stroke-dasharray: 1 2; stroke-dashoffset: 1.02; }
.scb[data-state="done"] .scb-check { stroke-dashoffset: 0; transition: stroke-dashoffset .42s var(--scb-out) .06s; }
/* o pulo do ícone ao cruzar o limiar */
.scb[data-armed] .scb-icon--drag > svg { animation: scb-pop .34s var(--scb-out); }
@keyframes scb-pop {
  0% { transform: scale(1); }
  35% { transform: scale(1.22); }
  100% { transform: scale(1); }
}
/* os dois pontos do ícone correm para a divisa enquanto o mouse está em cima */
.scb-dot { transform-box: fill-box; transform-origin: center; }

/* o balão: mora no componente, por cima do centro da pílula; sobe saindo de um desfoque e sai mais rápido */
.scb-bubble {
  position: absolute;
  left: 50%;
  bottom: calc(100% + var(--scb-hh) * .17);
  z-index: 4;
  display: block;
  opacity: 0;
  filter: blur(4px);
  transform: translate(-50%, 9px) scale(.95);
  transform-origin: 50% 100%;
  pointer-events: none;
  transition: opacity .15s var(--scb-out), transform .18s var(--scb-out), filter .15s var(--scb-out);
}
.scb-bubble[data-show] {
  opacity: 1;
  filter: blur(0);
  transform: translate(-50%, 0) scale(1);
  transition-duration: .3s, .46s, .3s;
}
.scb-bubble__body {
  display: block;
  padding: .66em 1.1em .7em;
  border-radius: 999px;
  background: var(--scb-bubble);
  color: var(--scb-bubble-ink);
  font-size: var(--scb-bfs);
  font-weight: 600;
  line-height: 1;
  letter-spacing: -.004em;
  white-space: nowrap;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, .7),
    0 1px 2px rgba(0, 0, 0, .06),
    0 10px 22px -12px rgba(0, 0, 0, .3);
}
.scb-bubble__tail {
  position: absolute;
  top: calc(100% - 1px);
  left: 50%;
  display: block;
  width: calc(var(--scb-bfs) * 1.15);
  height: calc(var(--scb-bfs) * .52);
  transform: translateX(-50%);
  fill: var(--scb-bubble);
  overflow: visible;
}
.scb-bubble[data-kind="error"] .scb-bubble__body { background: var(--scb-err); color: var(--scb-err-ink); box-shadow: 0 10px 22px -12px rgba(0, 0, 0, .45); }
.scb-bubble[data-kind="error"] .scb-bubble__tail { fill: var(--scb-err); }

/* só para o leitor de tela */
.scb-sr {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  border: 0;
  overflow: hidden;
  clip: rect(0 0 0 0);
  clip-path: inset(50%);
  white-space: nowrap;
}

/* hover só com mouse: a tira acende um pouco e os pontos do ícone correm para a divisa */
@media (hover: hover) and (pointer: fine) {
  .scb[data-state="idle"]:not([data-disabled]) .scb-track:hover .scb-band { filter: brightness(1.06) saturate(1.06); }
  .scb[data-state="idle"]:not([data-disabled]) .scb-track:hover .scb-dot { animation: scb-dots 1.1s var(--scb-out) infinite; }
  .scb[data-state="idle"]:not([data-disabled]) .scb-track:hover .scb-dot--1 { animation-delay: .08s; }
}
@keyframes scb-dots {
  0% { transform: translateX(0); opacity: 1; }
  45% { transform: translateX(3px); opacity: .35; }
  46% { transform: translateX(-2px); opacity: 0; }
  100% { transform: translateX(0); opacity: 1; }
}

/* nada anima antes da montagem assentar (uma peça escondida com transição apareceria e sumiria) */
.scb:not([data-ready]) *,
.scb:not([data-ready]) *::before,
.scb:not([data-ready]) *::after { transition: none !important; }

/* alto contraste do sistema: sem o brilho, e a tira mantém a cor */
@media (forced-colors: active) {
  .scb-shine { display: none; }
  .scb-band { forced-color-adjust: none; }
}

/* movimento reduzido: o motor troca as molas por uma troca curta; aqui saem o brilho, os pulos e o desfoque */
@media (prefers-reduced-motion: reduce) {
  .scb .scb-shine, .scb .scb-shine__copy { animation: none !important; }
  .scb-bubble { transform: translate(-50%, 0) !important; filter: none !important; }
  .scb-icon { transform: none !important; filter: none !important; }
  .scb .scb-dot, .scb[data-armed] .scb-icon--drag > svg { animation: none !important; }
  .scb-band::after { animation: none !important; }
}
`
