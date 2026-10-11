/**
 * Stockage DartySwap dans un Google Sheet, via le script Apps Script
 * déployé en application Web (voir apps-script/Code.gs).
 *
 * Toute la logique reste ici, côté serveur ; le Sheet ne fait que stocker.
 * L'URL du script (SHEETS_URL) est la clé d'accès : elle ne quitte jamais
 * le serveur.
 */

const RESPONSE_TO_SHEET = { pending: 'en attente', accepted: 'accepté', refused: 'refusé' };
const RESPONSE_FROM_SHEET = { 'en attente': 'pending', 'accepté': 'accepted', 'refusé': 'refused' };

export function isConfigured() {
  return Boolean(process.env.SHEETS_URL);
}

function notConfigured() {
  const e = new Error('BASE_NON_CONFIGUREE');
  e.code = 'BASE_NON_CONFIGUREE';
  return e;
}

async function call(action, payload = {}) {
  const url = process.env.SHEETS_URL;
  if (!url) throw notConfigured();

  const res = await fetch(url, {
    method: 'POST',
    // text/plain : Apps Script lit le corps tel quel.
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action, ...payload }),
    redirect: 'follow',
    cache: 'no-store',
  });

  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    // Apps Script renvoie une page HTML quand l'URL ou le déploiement est faux.
    throw new Error('SHEETS_REPONSE_INVALIDE');
  }
  if (!data.ok) {
    const e = new Error(data.error || 'SHEETS_ERREUR');
    e.code = data.error;
    throw e;
  }
  return data;
}

const toInt = (v) => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
};

/** Charge tout le Sheet et le remet sous forme d'objets. */
export async function loadAll() {
  const d = await call('getAll');

  const students = (d.students || [])
    .filter((r) => r[0])
    .map((r) => ({
      id: toInt(r[0]),
      code: r[1],
      fullName: r[2],
      email: r[3],
      currentStore: r[4],
      preferences: [r[5], r[6], r[7], r[8], r[9]].filter(Boolean),
      createdAt: r[10] || null,
    }));

  const runs = (d.runs || [])
    .filter((r) => r[0])
    .map((r) => ({
      id: toInt(r[0]),
      createdAt: r[1] || null,
      published: r[2] === 'oui',
      maxLen: toInt(r[3]),
      stats: {
        totalStudents: toInt(r[4]) || 0,
        studentsRequesting: toInt(r[5]) || 0,
        possibleExchanges: toInt(r[6]) || 0,
        studentsCanMove: toInt(r[7]) || 0,
      },
    }));

  const runIds = new Set(runs.map((r) => r.id));
  const parts = (d.parts || [])
    .filter((r) => r[0] && runIds.has(toInt(r[0])))
    .map((r) => ({
      runId: toInt(r[0]),
      exchange: toInt(r[1]),
      size: toInt(r[2]),
      position: toInt(r[3]),
      studentId: toInt(r[4]),
      fullName: r[5],
      fromStore: r[6],
      toStore: r[7],
      rank: toInt(r[8]),
      response: RESPONSE_FROM_SHEET[r[9]] || 'pending',
      respondedAt: r[10] || null,
    }));

  return { students, runs, parts };
}

export function latestRun(all) {
  return all.runs.reduce((best, r) => (!best || r.id > best.id ? r : best), null);
}

export function publishedRun(all) {
  return all.runs.filter((r) => r.published).reduce((b, r) => (!b || r.id > b.id ? r : b), null);
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

/** Identifiant public d'un échange : "calcul-numéro". */
export const exchangeKey = (runId, index) => `${runId}-${index}`;

/** Échanges d'un calcul, regroupés et triés. */
export function exchangesOf(all, runId) {
  const byIdx = new Map();
  for (const p of all.parts) {
    if (p.runId !== runId) continue;
    if (!byIdx.has(p.exchange)) byIdx.set(p.exchange, []);
    byIdx.get(p.exchange).push(p);
  }
  return [...byIdx.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([index, ps]) => {
      const participants = ps.sort((a, b) => a.position - b.position);
      return {
        id: exchangeKey(runId, index),
        index,
        size: participants.length,
        participants,
        status: exchangeStatus(participants),
      };
    });
}

export async function addStudent({ code, fullName, email, currentStore, preferences }) {
  const d = await call('addStudent', {
    code, fullName, email, currentStore, preferences,
    at: new Date().toISOString(),
  });
  return { id: d.id };
}

export async function saveRun(result, studentsById) {
  const parts = [];
  for (const ex of result.exchanges) {
    ex.participants.forEach((p, i) => {
      parts.push({
        exchange: ex.index,
        size: ex.size,
        position: i,
        studentId: p.studentId,
        fullName: studentsById.get(p.studentId)?.fullName || '',
        fromStore: p.fromStore,
        toStore: p.toStore,
        rank: p.preferenceRank,
      });
    });
  }
  const d = await call('addRun', {
    at: new Date().toISOString(),
    maxLen: result.options.maxCycleLength,
    stats: result.stats,
    parts,
  });
  return d.runId;
}

export async function setPublished(runId) {
  await call('setPublished', { runId: runId ?? null });
}

export async function respond({ runId, exchange, studentId, response }) {
  const d = await call('respond', {
    runId, exchange, studentId,
    response: RESPONSE_TO_SHEET[response],
    at: new Date().toISOString(),
  });
  return d.updated;
}
