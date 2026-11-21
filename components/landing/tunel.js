// Túnel de luz da Let's Touch Base. — cena original em WebGL (Three.js).
// Metáfora: no início, luzes velozes e desalinhadas (movimento sem direção); com a organização,
// elas se alinham em trilhos e a estrutura do corredor aparece (crescimento organizado).
//
// API: criarTunel(canvas, { movel, reduzido }) → null (sem WebGL) ou
//   { setPonteiro(x, y), setAlvo({ velocidade, ordem }), setProgresso(p), ativar(bool), dispose() }
//   x, y em [-1, 1]; ordem e p em [0, 1].

import {
  AdditiveBlending, BoxGeometry, BufferGeometry, CanvasTexture, Color, Float32BufferAttribute, FogExp2,
  InstancedMesh, LineBasicMaterial, LineSegments, MeshBasicMaterial, Object3D, PerspectiveCamera, Scene,
  SRGBColorSpace, Sprite, SpriteMaterial, WebGLRenderer,
} from "three";

// Paleta da marca (aditiva: as cores somam luz sobre o fundo escuro).
const NAVY_FUNDO = 0x050d1f;
const PALETA = [
  [0x2563eb, 0.42], // Electric Blue
  [0x60a5fa, 0.2], // azul claro
  [0xf8fafc, 0.14], // Cloud White
  [0x22c55e, 0.17], // Growth Green
  [0x7c3aed, 0.07], // AI Purple
];

const LARGURA = 3.4; // metade da largura do corredor
const ALTURA = 2.0; // metade da altura
const COMPRIMENTO = 96;
const PORTICOS = 18;

const lerp = (a, b, t) => a + (b - a) * t;
const limitar = (v, min, max) => Math.min(max, Math.max(min, v));

function sortearCor(aleatorio) {
  let r = aleatorio * PALETA.reduce((s, [, p]) => s + p, 0);
  for (const [cor, peso] of PALETA) {
    if ((r -= peso) <= 0) return cor;
  }
  return PALETA[0][0];
}

/** Brilho no ponto de fuga: textura radial gerada em canvas (sem imagem externa). */
function texturaBrilho() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d");
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, "rgba(220,235,255,0.95)");
  grad.addColorStop(0.18, "rgba(96,165,250,0.55)");
  grad.addColorStop(0.45, "rgba(37,99,235,0.18)");
  grad.addColorStop(1, "rgba(5,13,31,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

/** Contorno retangular de um pórtico do corredor. */
function geometriaPortico() {
  const w = LARGURA * 1.02;
  const h = ALTURA * 1.02;
  const v = [-w, -h, 0, w, -h, 0, w, -h, 0, w, h, 0, w, h, 0, -w, h, 0, -w, h, 0, -w, -h, 0];
  const geo = new BufferGeometry();
  geo.setAttribute("position", new Float32BufferAttribute(v, 3));
  return geo;
}

export function criarTunel(canvas, { movel = false, reduzido = false } = {}) {
  let renderer;
  try {
    renderer = new WebGLRenderer({ canvas, antialias: !movel, alpha: false, powerPreference: "high-performance" });
  } catch {
    return null; // sem WebGL: o componente mostra o fundo estático
  }
  renderer.setClearColor(NAVY_FUNDO, 1);
  let razaoPixel = Math.min(window.devicePixelRatio || 1, movel ? 1.5 : 1.75);
  renderer.setPixelRatio(razaoPixel);

  const cena = new Scene();
  cena.fog = new FogExp2(NAVY_FUNDO, 0.034);
  const camera = new PerspectiveCamera(72, 1, 0.1, 140);
  camera.position.set(0, 0, 4);

  // ---- feixes de luz (um InstancedMesh: uma chamada de desenho para todos) ----
  const total = movel ? 520 : 1100;
  const material = new MeshBasicMaterial({ transparent: true, opacity: 0.9, blending: AdditiveBlending, depthWrite: false });
  const feixes = new InstancedMesh(new BoxGeometry(1, 1, 1), material, total);
  feixes.frustumCulled = false;
  const caosX = new Float32Array(total);
  const caosY = new Float32Array(total);
  const ordemX = new Float32Array(total);
  const ordemY = new Float32Array(total);
  const z = new Float32Array(total);
  const comprimento = new Float32Array(total);
  const espessura = new Float32Array(total);
  const inclinacaoX = new Float32Array(total);
  const inclinacaoY = new Float32Array(total);
  const cor = new Color();
  const TRILHOS_X = 9; // trilhos no teto/chão
  const TRILHOS_Y = 5; // trilhos nas paredes

  for (let i = 0; i < total; i += 1) {
    const parede = i % 4; // 0 teto, 1 chão, 2 esquerda, 3 direita
    const t = Math.random() * 2 - 1;
    const recuo = Math.random() ** 2 * 0.9; // no caos, parte das luzes flutua para dentro do corredor
    if (parede < 2) {
      const sinal = parede === 0 ? 1 : -1;
      caosX[i] = t * LARGURA;
      caosY[i] = sinal * (ALTURA - recuo);
      const trilho = Math.round(((t + 1) / 2) * (TRILHOS_X - 1));
      ordemX[i] = (trilho / (TRILHOS_X - 1)) * 2 * LARGURA - LARGURA;
      ordemY[i] = sinal * ALTURA;
    } else {
      const sinal = parede === 3 ? 1 : -1;
      caosX[i] = sinal * (LARGURA - recuo);
      caosY[i] = t * ALTURA;
      const trilho = Math.round(((t + 1) / 2) * (TRILHOS_Y - 1));
      ordemX[i] = sinal * LARGURA;
      ordemY[i] = (trilho / (TRILHOS_Y - 1)) * 2 * ALTURA - ALTURA;
    }
    z[i] = -Math.random() * COMPRIMENTO + 4;
    comprimento[i] = 0.6 + Math.random() * 3.2;
    espessura[i] = 0.012 + Math.random() * 0.022;
    inclinacaoX[i] = (Math.random() - 0.5) * 0.5;
    inclinacaoY[i] = (Math.random() - 0.5) * 0.5;
    cor.setHex(sortearCor(Math.random())).multiplyScalar(0.55 + Math.random() * 0.6);
    feixes.setColorAt(i, cor);
  }
  feixes.instanceColor.needsUpdate = true;
  cena.add(feixes);

  // ---- pórticos: a estrutura do corredor, que aparece com a organização ----
  const materialPortico = new LineBasicMaterial({ color: 0x3b6fe0, transparent: true, opacity: 0.12, blending: AdditiveBlending, depthWrite: false });
  const geoPortico = geometriaPortico();
  const porticos = Array.from({ length: PORTICOS }, (_, k) => {
    const p = new LineSegments(geoPortico, materialPortico);
    p.position.z = 4 - (k / PORTICOS) * COMPRIMENTO;
    cena.add(p);
    return p;
  });

  // ---- brilho no ponto de fuga ----
  const brilho = new Sprite(new SpriteMaterial({ map: texturaBrilho(), blending: AdditiveBlending, depthWrite: false, transparent: true, fog: false }));
  brilho.position.set(0, 0, -70);
  brilho.scale.set(46, 46, 1);
  cena.add(brilho);

  // ---- estado ----
  const estado = {
    ponteiro: { x: 0, y: 0 },
    camera: { x: 0, y: 0, alvoX: 0, alvoY: 0 },
    velocidade: 24,
    velocidadeAlvo: 24,
    ordem: 0,
    ordemAlvo: 0,
    progresso: 0,
    ativo: false,
    tempo: 0,
    ultimoInput: 0,
    quadros: 0,
    somaQuadros: 0,
    reduzidoQualidade: false,
  };
  const boneco = new Object3D();

  function redimensionar() {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // Em telas estreitas, abre o campo de visão para o corredor não parecer um tubo.
    camera.fov = camera.aspect < 0.8 ? 88 : 72;
    camera.updateProjectionMatrix();
  }
  redimensionar();
  const observador = new ResizeObserver(redimensionar);
  observador.observe(canvas);

  function atualizar(dt) {
    estado.tempo += dt;
    const p = estado.progresso;
    // A rolagem desacelera e organiza; as fases do hero definem os alvos antes disso.
    const velocidadeFinal = estado.velocidadeAlvo * (1 - 0.86 * p);
    const ordemFinal = Math.max(estado.ordemAlvo, limitar(p * 1.25, 0, 1));
    estado.velocidade = lerp(estado.velocidade, velocidadeFinal, 1 - Math.exp(-dt * 2.2));
    estado.ordem = lerp(estado.ordem, ordemFinal, 1 - Math.exp(-dt * 2.6));

    // Sem interação recente, uma deriva lenta mantém a cena viva (no celular, principalmente).
    const ocioso = estado.tempo - estado.ultimoInput > 2.5;
    const deriva = ocioso ? { x: Math.sin(estado.tempo * 0.23) * 0.35, y: Math.sin(estado.tempo * 0.17) * 0.22 } : { x: 0, y: 0 };
    const px = limitar(estado.ponteiro.x + deriva.x, -1, 1);
    const py = limitar(estado.ponteiro.y + deriva.y, -1, 1);
    const suave = 1 - Math.exp(-dt * 3.2); // interpolação: nada de movimento brusco
    estado.camera.x = lerp(estado.camera.x, px * 1.15, suave);
    estado.camera.y = lerp(estado.camera.y, py * 0.62, suave);
    estado.camera.alvoX = lerp(estado.camera.alvoX, px * 2.6, suave);
    estado.camera.alvoY = lerp(estado.camera.alvoY, py * 1.4, suave);
    camera.position.set(estado.camera.x, estado.camera.y, 4);
    camera.lookAt(estado.camera.alvoX, estado.camera.alvoY, -22);
    camera.rotation.z += -estado.camera.x * 0.045 * (1 - estado.ordem); // leve inclinação nas curvas

    const v = estado.velocidade;
    const o = estado.ordem;
    const esticar = 0.32 + v * 0.05; // rastro maior com mais velocidade (motion blur)
    for (let i = 0; i < total; i += 1) {
      z[i] += v * dt;
      if (z[i] > 5) z[i] -= COMPRIMENTO;
      boneco.position.set(lerp(caosX[i], ordemX[i], o), lerp(caosY[i], ordemY[i], o), z[i]);
      boneco.rotation.set(inclinacaoX[i] * (1 - o), inclinacaoY[i] * (1 - o), 0);
      boneco.scale.set(espessura[i], espessura[i], comprimento[i] * esticar);
      boneco.updateMatrix();
      feixes.setMatrixAt(i, boneco.matrix);
    }
    feixes.instanceMatrix.needsUpdate = true;

    for (const portico of porticos) {
      portico.position.z += v * dt;
      if (portico.position.z > 5) portico.position.z -= COMPRIMENTO;
    }
    materialPortico.opacity = 0.1 + o * 0.5;
    material.opacity = 0.95 - o * 0.25;
    cena.fog.density = 0.034 - o * 0.012;
    brilho.material.opacity = 0.85 - p * 0.35;
  }

  let anterior = 0;
  function quadro(agora) {
    const dt = Math.min(0.05, (agora - (anterior || agora)) / 1000);
    anterior = agora;
    atualizar(dt);
    renderer.render(cena, camera);
    // Qualidade adaptativa: se os primeiros quadros forem lentos, reduz resolução e quantidade.
    if (!estado.reduzidoQualidade && estado.quadros < 90 && dt > 0) {
      estado.quadros += 1;
      estado.somaQuadros += dt;
      if (estado.quadros === 90 && estado.somaQuadros / 90 > 1 / 38) {
        estado.reduzidoQualidade = true;
        razaoPixel = 1;
        renderer.setPixelRatio(1);
        feixes.count = Math.floor(total * 0.55);
        redimensionar();
      }
    }
  }

  function ativar(sim) {
    if (reduzido) return;
    if (sim && !estado.ativo) {
      estado.ativo = true;
      anterior = 0;
      renderer.setAnimationLoop(quadro);
    } else if (!sim && estado.ativo) {
      estado.ativo = false;
      renderer.setAnimationLoop(null);
    }
  }

  // Movimento reduzido: um único quadro, já organizado e parado.
  if (reduzido) {
    estado.velocidade = estado.velocidadeAlvo = 0;
    estado.ordem = estado.ordemAlvo = 0.55;
    atualizar(0.016);
    renderer.render(cena, camera);
  }

  return {
    setPonteiro(x, y) {
      estado.ponteiro.x = limitar(x, -1, 1);
      estado.ponteiro.y = limitar(y, -1, 1);
      estado.ultimoInput = estado.tempo;
    },
    setAlvo({ velocidade, ordem }) {
      if (typeof velocidade === "number") estado.velocidadeAlvo = velocidade;
      if (typeof ordem === "number") estado.ordemAlvo = limitar(ordem, 0, 1);
    },
    setProgresso(p) {
      estado.progresso = limitar(p, 0, 1);
      if (reduzido) {
        atualizar(0.016);
        renderer.render(cena, camera);
      }
    },
    ativar,
    get qualidadeReduzida() {
      return estado.reduzidoQualidade;
    },
    dispose() {
      ativar(false);
      observador.disconnect();
      feixes.geometry.dispose();
      material.dispose();
      geoPortico.dispose();
      materialPortico.dispose();
      brilho.material.map.dispose();
      brilho.material.dispose();
      renderer.dispose();
    },
  };
}
