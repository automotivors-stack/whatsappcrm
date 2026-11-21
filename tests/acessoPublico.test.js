// Segurança da landing pública: percorre TODAS as páginas e rotas de API do app e garante que só as
// exceções explícitas (ROTAS_PUBLICAS) abrem sem usuário e senha. Rota nova sem proteção quebra este teste.
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { proxy, ROTAS_PUBLICAS, config } from "../proxy.js";

const APP = new URL("../app/", import.meta.url).pathname;

/** app/(crm)/kanban/page.jsx → { caminho: "/kanban", metodos: ["GET"] }; [id] vira 1; grupos (x) somem. */
function mapearRotas(dir = APP) {
  const rotas = [];
  for (const nome of readdirSync(dir)) {
    const cheio = join(dir, nome);
    if (statSync(cheio).isDirectory()) { rotas.push(...mapearRotas(cheio)); continue; }
    if (!/^(page\.jsx|route\.js)$/.test(nome)) continue;
    const partes = relative(APP, dir).split(sep).filter((p) => p && !/^\(.*\)$/.test(p)).map((p) => (/^\[.*\]$/.test(p) ? "1" : p));
    const caminho = `/${partes.join("/")}`;
    const metodos = nome === "page.jsx"
      ? ["GET", "HEAD", "POST"]
      : [...readFileSync(cheio, "utf8").matchAll(/export (?:async )?function (GET|POST|PATCH|PUT|DELETE)/g)].map((m) => m[1]);
    rotas.push({ caminho, metodos, arquivo: relative(APP, cheio) });
  }
  return rotas;
}

const req = (metodo, caminho, auth) => new Request(`http://crm.exemplo${caminho}`, {
  method: metodo, headers: auth ? { authorization: auth } : {},
});
const basic = (u, s) => `Basic ${btoa(`${u}:${s}`)}`;
const publica = (m, c) => ROTAS_PUBLICAS.some((r) => r.caminho === c && r.metodos.includes(m));

before(() => Object.assign(process.env, { CRM_USUARIO: "consultor", CRM_SENHA: "senha-forte" }));

test("o mapa de rotas acha as páginas e APIs do CRM", () => {
  const caminhos = mapearRotas().map((r) => r.caminho);
  for (const c of ["/", "/kanban", "/dashboard", "/api/leads", "/api/leads/1", "/api/aprovacoes/1", "/api/webhooks/whatsapp", "/api/dashboard/metrics"]) {
    assert.ok(caminhos.includes(c), `faltou ${c}`);
  }
});

test("sem senha, só as exceções explícitas abrem; todo o resto responde 401", () => {
  const abertas = [];
  for (const { caminho, metodos, arquivo } of mapearRotas()) {
    for (const metodo of metodos) {
      const r = proxy(req(metodo, caminho));
      if (publica(metodo, caminho)) {
        assert.equal(r, undefined, `${metodo} ${caminho} deveria ser público`);
        abertas.push(`${metodo} ${caminho}`);
      } else {
        assert.equal(r?.status, 401, `${metodo} ${caminho} (${arquivo}) abriu sem senha`);
      }
    }
  }
  assert.deepEqual(abertas.sort(), ["GET /", "HEAD /", "POST /api/webhooks/whatsapp"]);
});

test("com a senha certa, as rotas do CRM abrem; com a errada, não", () => {
  assert.equal(proxy(req("GET", "/kanban", basic("consultor", "senha-forte"))), undefined);
  assert.equal(proxy(req("GET", "/api/leads", basic("consultor", "errada"))).status, 401);
});

test("variações do caminho público não furam a regra", () => {
  for (const [m, c] of [
    ["POST", "/"], ["PATCH", "/"], ["GET", "/api/webhooks/whatsapp"], ["POST", "/api/webhooks/whatsappX"],
    ["POST", "/api/webhooks/outro"], ["GET", "/index"], ["GET", "/api"], ["GET", "/api/"],
  ]) {
    assert.equal(proxy(req(m, c))?.status, 401, `${m} ${c}`);
  }
});

test("sem CRM_USUARIO/CRM_SENHA: CRM bloqueado (503), landing e webhook continuam abrindo", () => {
  const antes = { ...process.env };
  delete process.env.CRM_USUARIO;
  delete process.env.CRM_SENHA;
  try {
    assert.equal(proxy(req("GET", "/")), undefined);
    assert.equal(proxy(req("POST", "/api/webhooks/whatsapp")), undefined);
    assert.equal(proxy(req("GET", "/dashboard")).status, 503);
  } finally {
    Object.assign(process.env, antes);
  }
});

test("o matcher só deixa de fora os estáticos do build", () => {
  const re = new RegExp(`^${config.matcher[0]}$`);
  for (const c of ["/", "/kanban", "/api/leads", "/api/webhooks/whatsapp", "/qualquer"]) assert.ok(re.test(c), `${c} precisa passar pelo proxy`);
  for (const c of ["/_next/static/chunks/a.js", "/_next/image", "/favicon.ico"]) assert.ok(!re.test(c), c);
});
