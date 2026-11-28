// Dialeto Kysely mínimo sobre o mesmo @libsql/client do CRM (lib/db.js), usado só pelo login
// (Better Auth). Evita um segundo cliente do Turso. Sem transações: o Better Auth roda com
// `transaction: false` (padrão) e executa as operações em sequência.

import { CompiledQuery, SqliteAdapter, SqliteIntrospector, SqliteQueryCompiler } from "kysely";

class ConexaoLibsql {
  constructor(cliente) {
    this.cliente = cliente;
  }

  async executeQuery(consulta) {
    const r = await this.cliente.execute({ sql: consulta.sql, args: consulta.parameters });
    return {
      rows: r.rows.map((linha) => ({ ...linha })),
      numAffectedRows: BigInt(r.rowsAffected ?? 0),
      insertId: r.lastInsertRowid === undefined ? undefined : BigInt(r.lastInsertRowid),
    };
  }

  // eslint-disable-next-line require-yield
  async *streamQuery() {
    throw new Error("Consulta em fluxo não suportada no login.");
  }
}

class DriverLibsql {
  constructor(obterCliente) {
    this.obterCliente = obterCliente;
  }
  async init() {}
  async acquireConnection() {
    return new ConexaoLibsql(this.obterCliente());
  }
  async beginTransaction() {
    throw new Error("Transações não são usadas pelo login.");
  }
  async commitTransaction() {}
  async rollbackTransaction() {}
  async releaseConnection() {}
  async destroy() {}
}

/** @param {() => import("@libsql/client").Client} obterCliente  chamado a cada consulta (getDb) */
export function dialetoLibsql(obterCliente) {
  return {
    createAdapter: () => new SqliteAdapter(),
    createDriver: () => new DriverLibsql(obterCliente),
    createIntrospector: (db) => new SqliteIntrospector(db),
    createQueryCompiler: () => new SqliteQueryCompiler(),
  };
}

export { CompiledQuery };
