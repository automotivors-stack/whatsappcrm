// Conexão com o Turso (SQLite Edge) e migrações do banco.
// Credenciais só por variável de ambiente: TURSO_DATABASE_URL e TURSO_AUTH_TOKEN.
// Nenhuma migração aqui apaga ou altera dados: só CREATE ... IF NOT EXISTS.

import { createClient } from "@libsql/client";

let clienteGlobal = globalThis.__tursoClient ?? null;

/** Token do Turso: TURSO_AUTH_TOKEN ou, vindo da integração da Vercel, TURSO_DATABASE_AUTH_TOKEN. */
export function tokenDoBanco(env = process.env) {
  return env.TURSO_AUTH_TOKEN || env.TURSO_DATABASE_AUTH_TOKEN || undefined;
}

/**
 * Devolve um cliente único por processo (evita várias conexões no hot reload do Next.js).
 * Lança erro claro se a URL não estiver configurada.
 */
export function getDb() {
  if (clienteGlobal) return clienteGlobal;

  const url = process.env.TURSO_DATABASE_URL;
  // TURSO_DATABASE_AUTH_TOKEN é o nome criado pela integração Turso da Vercel (prefixo TURSO_DATABASE).
  const authToken = tokenDoBanco();

  if (!url) {
    throw new Error("TURSO_DATABASE_URL não configurada. Veja o .env.example.");
  }
  // Banco remoto (libsql://, https://, wss://) exige token; arquivo local (file:) não.
  if (!url.startsWith("file:") && !authToken) {
    throw new Error("TURSO_AUTH_TOKEN não configurado para banco remoto. Veja o .env.example.");
  }

  clienteGlobal = createClient({ url, authToken: authToken || undefined });
  if (process.env.NODE_ENV !== "production") globalThis.__tursoClient = clienteGlobal;
  return clienteGlobal;
}

/**
 * Migrações em ordem. Cada uma roda uma única vez (controle na tabela _migracoes).
 * Regra: migração publicada nunca é reescrita; correção vira migração nova no fim da lista.
 */
export const MIGRACOES = [
  {
    versao: 1,
    nome: "fase0_schema_inicial",
    sql: [
      `CREATE TABLE IF NOT EXISTS contatos (
        phone_number          TEXT PRIMARY KEY,
        nome                  TEXT,
        tipo_pessoa           TEXT,
        documento             TEXT,
        descricao_negocio     TEXT,
        volume_mensal         TEXT,
        status_relacionamento TEXT DEFAULT 'novo_lead',
        created_at            DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at            DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,

      `CREATE TABLE IF NOT EXISTS mensagens_historico (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        phone_number TEXT,
        role         TEXT,
        content      TEXT,
        created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (phone_number) REFERENCES contatos(phone_number)
      )`,

      `CREATE TABLE IF NOT EXISTS oportunidades (
        id                   INTEGER PRIMARY KEY AUTOINCREMENT,
        phone_number         TEXT,
        tipo_pessoa          TEXT,
        nome_ou_razao_social TEXT,
        documento            TEXT,
        descricao_negocio    TEXT,
        onde_opera_hoje      TEXT,
        volume_mensal        TEXT,
        numero_transacoes    INTEGER,
        taxas_atuais         TEXT,
        taxa_med_operacao    TEXT,
        limite_por_venda     TEXT,
        limite_saque_diario  TEXT,
        saque_terceiros      BOOLEAN,
        metodos_pagamento    TEXT,
        tipo_integracao      TEXT,
        whatsapp_contato     TEXT,
        email_contato        TEXT,
        resumo_executivo     TEXT,
        status_kanban        TEXT DEFAULT 'Contato Recebido',
        fornecedor_operacao  TEXT DEFAULT NULL,
        dados_precificacao   TEXT DEFAULT NULL,
        volume_real_mes      REAL DEFAULT 0.0,
        med_real_mes         REAL DEFAULT 0.0,
        created_at           DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,

      `CREATE TABLE IF NOT EXISTS interacoes_cliente (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        oportunidade_id INTEGER,
        tipo            TEXT,
        destinatario    TEXT,
        assunto         TEXT,
        mensagem        TEXT,
        status_envio    TEXT DEFAULT 'sucesso',
        created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (oportunidade_id) REFERENCES oportunidades(id)
      )`,

      // Deduplicação idempotente de webhooks: o mesmo message_id só entra uma vez.
      `CREATE TABLE IF NOT EXISTS eventos_processados (
        message_id TEXT PRIMARY KEY,
        provider   TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,

      // Índices para as consultas previstas (histórico por contato, kanban, interações).
      `CREATE INDEX IF NOT EXISTS idx_mensagens_phone_data ON mensagens_historico (phone_number, created_at)`,
      `CREATE INDEX IF NOT EXISTS idx_oportunidades_phone ON oportunidades (phone_number)`,
      `CREATE INDEX IF NOT EXISTS idx_oportunidades_status ON oportunidades (status_kanban)`,
      `CREATE INDEX IF NOT EXISTS idx_interacoes_oportunidade ON interacoes_cliente (oportunidade_id)`,
    ],
  },
  {
    versao: 2,
    nome: "fase1_aprovacoes_pendentes",
    sql: [
      // Diagnóstico finalizado aguardando o SIM/NÃO do consultor no WhatsApp administrativo.
      // Nada entra em `oportunidades` sem passar por aqui (aprovação humana pré-CRM).
      `CREATE TABLE IF NOT EXISTS aprovacoes_pendentes (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        phone_number    TEXT NOT NULL,
        dados           TEXT NOT NULL,
        status          TEXT NOT NULL DEFAULT 'aguardando'
                        CHECK (status IN ('aguardando', 'aprovado', 'descartado')),
        aviso_enviado   INTEGER NOT NULL DEFAULT 0,
        oportunidade_id INTEGER,
        created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
        decidido_em     DATETIME,
        FOREIGN KEY (phone_number) REFERENCES contatos(phone_number),
        FOREIGN KEY (oportunidade_id) REFERENCES oportunidades(id)
      )`,
      // No máximo uma pendência aberta por contato.
      `CREATE UNIQUE INDEX IF NOT EXISTS uq_aprovacao_aberta_por_contato
         ON aprovacoes_pendentes (phone_number) WHERE status = 'aguardando'`,
      `CREATE INDEX IF NOT EXISTS idx_aprovacoes_status ON aprovacoes_pendentes (status)`,
    ],
  },
  {
    versao: 3,
    nome: "motor_diagnostico",
    sql: [
      // Dados que a IA já coletou na conversa (JSON), para não perder o progresso entre mensagens.
      // Só acrescenta coluna: nada existente muda.
      "ALTER TABLE contatos ADD COLUMN dados_diagnostico TEXT",
    ],
  },
  {
    versao: 4,
    nome: "lucro_realizado",
    sql: [
      // Lucro líquido do mês que a consultoria recebeu do cliente (lançado pelo consultor a partir do
      // relatório do parceiro). Base da meta mensal no dashboard. Só acrescenta coluna.
      "ALTER TABLE oportunidades ADD COLUMN lucro_real_mes REAL DEFAULT 0.0",
    ],
  },
  {
    versao: 5,
    nome: "origem_do_contato",
    sql: [
      // De onde o contato veio ('site' = formulário ou botão do WhatsApp da landing) e o que ele
      // preencheu no formulário (JSON: nome, empresa, prioridade, gargalo). Só acrescenta colunas.
      "ALTER TABLE contatos ADD COLUMN origem TEXT",
      "ALTER TABLE contatos ADD COLUMN dados_site TEXT",
    ],
  },
  {
    versao: 6,
    nome: "area_do_cliente_login",
    sql: [
      // Login da área do cliente (Better Auth, lib/auth.js). Esquema gerado pelo próprio Better Auth
      // (getMigrations) com IF NOT EXISTS; nomes de coluna em camelCase são os da biblioteca.
      // status_acesso: toda conta nasce 'pendente' e só o consultor libera. oportunidade_id: o card
      // que o consultor vinculou à conta (nunca escolhido pelo cliente).
      `CREATE TABLE IF NOT EXISTS cliente_usuarios (
        "id" TEXT NOT NULL PRIMARY KEY, "name" TEXT NOT NULL, "email" TEXT NOT NULL UNIQUE,
        "emailVerified" INTEGER NOT NULL, "image" TEXT, "createdAt" DATE NOT NULL, "updatedAt" DATE NOT NULL,
        "telefone" TEXT, "empresa" TEXT,
        "status_acesso" TEXT NOT NULL DEFAULT 'pendente' CHECK ("status_acesso" IN ('pendente', 'liberado', 'recusado')),
        "oportunidade_id" INTEGER REFERENCES oportunidades(id),
        "decidido_em" DATETIME
      )`,
      `CREATE TABLE IF NOT EXISTS cliente_sessoes (
        "id" TEXT NOT NULL PRIMARY KEY, "expiresAt" DATE NOT NULL, "token" TEXT NOT NULL UNIQUE,
        "createdAt" DATE NOT NULL, "updatedAt" DATE NOT NULL, "ipAddress" TEXT, "userAgent" TEXT,
        "userId" TEXT NOT NULL REFERENCES cliente_usuarios ("id") ON DELETE CASCADE
      )`,
      `CREATE TABLE IF NOT EXISTS cliente_contas (
        "id" TEXT NOT NULL PRIMARY KEY, "accountId" TEXT NOT NULL, "providerId" TEXT NOT NULL,
        "userId" TEXT NOT NULL REFERENCES cliente_usuarios ("id") ON DELETE CASCADE,
        "accessToken" TEXT, "refreshToken" TEXT, "idToken" TEXT, "accessTokenExpiresAt" DATE,
        "refreshTokenExpiresAt" DATE, "scope" TEXT, "password" TEXT, "createdAt" DATE NOT NULL, "updatedAt" DATE NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS cliente_verificacoes (
        "id" TEXT NOT NULL PRIMARY KEY, "identifier" TEXT NOT NULL, "value" TEXT NOT NULL,
        "expiresAt" DATE NOT NULL, "createdAt" DATE NOT NULL, "updatedAt" DATE NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS cliente_limites (
        "id" TEXT NOT NULL PRIMARY KEY, "key" TEXT NOT NULL UNIQUE, "count" INTEGER NOT NULL, "lastRequest" BIGINT NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS cliente_sessoes_userId_idx ON cliente_sessoes ("userId")`,
      `CREATE INDEX IF NOT EXISTS cliente_contas_userId_idx ON cliente_contas ("userId")`,
      `CREATE INDEX IF NOT EXISTS cliente_verificacoes_identifier_idx ON cliente_verificacoes ("identifier")`,
      `CREATE INDEX IF NOT EXISTS idx_cliente_usuarios_status ON cliente_usuarios ("status_acesso")`,
    ],
  },
];

/**
 * Aplica as migrações pendentes. Idempotente: rodar de novo não muda nada.
 * Cada migração roda numa transação (batch "write"): ou entra inteira, ou nada entra.
 */
export async function migrar(db = getDb()) {
  await db.execute(`CREATE TABLE IF NOT EXISTS _migracoes (
    versao      INTEGER PRIMARY KEY,
    nome        TEXT NOT NULL,
    aplicada_em DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  const { rows } = await db.execute("SELECT versao FROM _migracoes");
  const aplicadas = new Set(rows.map((r) => Number(r.versao)));
  const novas = [];

  for (const m of MIGRACOES) {
    if (aplicadas.has(m.versao)) continue;
    await db.batch(
      [
        ...m.sql,
        { sql: "INSERT INTO _migracoes (versao, nome) VALUES (?, ?)", args: [m.versao, m.nome] },
      ],
      "write",
    );
    novas.push(`${m.versao}_${m.nome}`);
  }
  return novas;
}

/**
 * Registra um evento de webhook. Devolve true se é novo, false se já tinha sido processado.
 * Usa INSERT OR IGNORE para ser seguro mesmo com duas entregas simultâneas do mesmo evento.
 */
export async function registrarEventoSeNovo(messageId, provider, db = getDb()) {
  const r = await db.execute({
    sql: "INSERT OR IGNORE INTO eventos_processados (message_id, provider) VALUES (?, ?)",
    args: [messageId, provider],
  });
  return r.rowsAffected === 1;
}
