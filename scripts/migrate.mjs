// Uso: npm run db:migrate  (lê TURSO_DATABASE_URL e TURSO_AUTH_TOKEN do ambiente / .env.local)
import { migrar } from "../lib/db.js";

try {
  const novas = await migrar();
  console.log(novas.length ? `Migrações aplicadas: ${novas.join(", ")}` : "Banco já atualizado.");
  process.exit(0);
} catch (erro) {
  console.error("Falha na migração:", erro.message);
  process.exit(1);
}
