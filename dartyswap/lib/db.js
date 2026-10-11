import { Pool } from 'pg';

/**
 * Connexion Postgres paresseuse : rien n'est ouvert au build, tout est ouvert
 * à la première requête. Permet de déployer avant d'avoir branché la base.
 */

let pool;
let schemaReady;

function connectionString() {
  return (
    process.env.POSTGRES_URL ||
    process.env.DATABASE_URL ||
    process.env.POSTGRES_PRISMA_URL ||
    null
  );
}

export function isConfigured() {
  return Boolean(connectionString());
}

function getPool() {
  const cs = connectionString();
  if (!cs) {
    const err = new Error('BASE_NON_CONFIGUREE');
    err.code = 'BASE_NON_CONFIGUREE';
    throw err;
  }
  if (!pool) {
    pool = new Pool({
      connectionString: cs,
      ssl: cs.includes('localhost') || cs.includes('127.0.0.1')
        ? false
        : { rejectUnauthorized: false },
      max: 3,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 10_000,
    });
  }
  return pool;
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS students (
  id            SERIAL PRIMARY KEY,
  code          TEXT UNIQUE NOT NULL,
  full_name     TEXT NOT NULL,
  email         TEXT NOT NULL,
  current_store TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS preferences (
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  rank       INTEGER NOT NULL,
  store      TEXT NOT NULL,
  PRIMARY KEY (student_id, rank)
);

CREATE TABLE IF NOT EXISTS runs (
  id         SERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  published  BOOLEAN NOT NULL DEFAULT FALSE,
  options    JSONB,
  stats      JSONB
);

CREATE TABLE IF NOT EXISTS exchanges (
  id        SERIAL PRIMARY KEY,
  run_id    INTEGER NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  idx       INTEGER NOT NULL,
  size      INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS exchange_participants (
  id              SERIAL PRIMARY KEY,
  exchange_id     INTEGER NOT NULL REFERENCES exchanges(id) ON DELETE CASCADE,
  student_id      INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  position        INTEGER NOT NULL,
  from_store      TEXT NOT NULL,
  to_store        TEXT NOT NULL,
  preference_rank INTEGER,
  response        TEXT NOT NULL DEFAULT 'pending',
  responded_at    TIMESTAMPTZ
);

-- Colonnes retirées après coup : on les supprime si une base plus ancienne
-- les contient encore, pour que le schéma converge sans migration manuelle.
ALTER TABLE students  DROP COLUMN IF EXISTS dif_group;
ALTER TABLE exchanges DROP COLUMN IF EXISTS dif_group;
ALTER TABLE students  DROP COLUMN IF EXISTS contact;
ALTER TABLE exchange_participants ADD COLUMN IF NOT EXISTS responded_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_part_exchange ON exchange_participants(exchange_id);
CREATE INDEX IF NOT EXISTS idx_part_student  ON exchange_participants(student_id);
CREATE INDEX IF NOT EXISTS idx_exch_run      ON exchanges(run_id);
CREATE INDEX IF NOT EXISTS idx_pref_student  ON preferences(student_id);
`;

async function ensureSchema() {
  if (!schemaReady) {
    schemaReady = getPool()
      .query(SCHEMA)
      .catch((e) => {
        schemaReady = undefined; // autorise une nouvelle tentative
        throw e;
      });
  }
  return schemaReady;
}

export async function query(text, params = []) {
  await ensureSchema();
  return getPool().query(text, params);
}

export async function withTransaction(fn) {
  await ensureSchema();
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch {}
    throw e;
  } finally {
    client.release();
  }
}

/** Roster complet, prêt pour l'algorithme. */
export async function loadRoster() {
  const { rows } = await query(`
    SELECT s.id, s.code, s.current_store,
           COALESCE(
             ARRAY_AGG(p.store ORDER BY p.rank) FILTER (WHERE p.store IS NOT NULL),
             '{}'
           ) AS preferences
    FROM students s
    LEFT JOIN preferences p ON p.student_id = s.id
    GROUP BY s.id
    ORDER BY s.id
  `);
  return rows.map((r) => ({
    id: r.id,
    code: r.code,
    currentStore: r.current_store,
    preferences: r.preferences || [],
  }));
}

/** Dernier run publié (pour /resultat) ou tout dernier run (pour /admin). */
export async function getRun({ publishedOnly }) {
  const { rows } = await query(
    publishedOnly
      ? `SELECT * FROM runs WHERE published = TRUE ORDER BY id DESC LIMIT 1`
      : `SELECT * FROM runs ORDER BY id DESC LIMIT 1`
  );
  return rows[0] || null;
}

/**
 * Échanges d'un run, avec les réponses. `includeIdentity` n'est vrai que pour
 * l'admin : /resultat ne reçoit jamais les noms.
 */
export async function getRunExchanges(runId, { includeIdentity = false } = {}) {
  const { rows } = await query(
    `SELECT e.id   AS exchange_id,
            e.idx, e.size,
            p.position, p.from_store, p.to_store, p.preference_rank, p.response,
            p.student_id,
            ${includeIdentity ? 's.full_name, s.email, s.code' : 'NULL AS full_name, NULL AS email, NULL AS code'}
       FROM exchanges e
       JOIN exchange_participants p ON p.exchange_id = e.id
       JOIN students s ON s.id = p.student_id
      WHERE e.run_id = $1
      ORDER BY e.idx, p.position`,
    [runId]
  );

  const byExchange = new Map();
  for (const r of rows) {
    if (!byExchange.has(r.exchange_id)) {
      byExchange.set(r.exchange_id, {
        id: r.exchange_id,
        index: r.idx,
        size: r.size,
        participants: [],
      });
    }
    byExchange.get(r.exchange_id).participants.push({
      studentId: r.student_id,
      position: r.position,
      fromStore: r.from_store,
      toStore: r.to_store,
      preferenceRank: r.preference_rank,
      response: r.response,
      ...(includeIdentity
        ? { fullName: r.full_name, email: r.email, code: r.code }
        : {}),
    });
  }

  return [...byExchange.values()].map((e) => ({
    ...e,
    status: exchangeStatus(e.participants),
  }));
}

export function exchangeStatus(participants) {
  if (participants.some((p) => p.response === 'refused')) return 'refuse';
  if (participants.every((p) => p.response === 'accepted')) return 'confirme';
  return 'propose';
}

export function statusLabel(status) {
  if (status === 'confirme') return 'Échange confirmé entre étudiants — sous réserve de validation HEC';
  if (status === 'refuse') return 'Échange refusé';
  return 'Échange proposé';
}
