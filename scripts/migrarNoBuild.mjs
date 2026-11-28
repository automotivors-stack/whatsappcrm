// Roda antes do `next build` (package.json). Só no build de PRODUÇÃO da Vercel, que é o único com as
// variáveis do Turso de produção: aplica as migrações pendentes de lib/db.js (só acrescentam; idempotentes).
// Se a migração falhar, o build falha e a Vercel mantém no ar a versão anterior (nada fica pela metade).
// Prévias e builds locais pulam esta etapa.
import { migrar } from "../lib/db.js";

export function deveMigrar(env = process.env) {
  return env.VERCEL_ENV === "production" && Boolean(env.TURSO_DATABASE_URL);
}

if (!deveMigrar()) {
  console.log("[migrações] fora do build de produção da Vercel: etapa pulada.");
} else {
  try {
    const novas = await migrar();
    console.log(novas.length ? `[migrações] aplicadas: ${novas.join(", ")}` : "[migrações] banco já atualizado.");
  } catch (erro) {
    console.error(`[migrações] falha: ${erro?.message ?? erro}`);
    process.exit(1);
  }
}
