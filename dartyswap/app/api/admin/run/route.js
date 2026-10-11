import { NextResponse } from 'next/server';
import { loadRoster, withTransaction } from '../../../../lib/db';
import { readSession } from '../../../../lib/session';
import { computeExchanges, DEFAULT_OPTIONS } from '../../../../lib/matching';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(request) {
  if (!readSession('admin')) {
    return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 });
  }

  let body;
  try { body = await request.json(); } catch { body = {}; }

  const options = {
    ...DEFAULT_OPTIONS,
    sameDifGroup: Boolean(body.sameDifGroup),
    maxCycleLength: Number(body.maxCycleLength) || DEFAULT_OPTIONS.maxCycleLength,
    // "Relancer l'optimisation" : plus de restarts = meilleur packing.
    restarts: Math.min(2000, Math.max(1, Number(body.restarts) || DEFAULT_OPTIONS.restarts)),
  };

  try {
    const roster = await loadRoster();
    const result = computeExchanges(roster, options);

    // Un nouveau calcul crée un nouveau run, non publié, et remet donc les
    // réponses à zéro : les propositions ont changé.
    const runId = await withTransaction(async (client) => {
      const { rows } = await client.query(
        `INSERT INTO runs (published, options, stats) VALUES (FALSE, $1, $2) RETURNING id`,
        [JSON.stringify(result.options), JSON.stringify(result.stats)]
      );
      const id = rows[0].id;

      for (const ex of result.exchanges) {
        const { rows: er } = await client.query(
          `INSERT INTO exchanges (run_id, idx, size, dif_group) VALUES ($1,$2,$3,$4) RETURNING id`,
          [id, ex.index, ex.size, ex.difGroup || null]
        );
        const exchangeId = er[0].id;
        for (let i = 0; i < ex.participants.length; i++) {
          const p = ex.participants[i];
          await client.query(
            `INSERT INTO exchange_participants
               (exchange_id, student_id, position, from_store, to_store, preference_rank)
             VALUES ($1,$2,$3,$4,$5,$6)`,
            [exchangeId, p.studentId, i, p.fromStore, p.toStore, p.preferenceRank]
          );
        }
      }
      return id;
    });

    return NextResponse.json({ ok: true, runId, stats: result.stats, options: result.options });
  } catch (e) {
    if (e.code === 'BASE_NON_CONFIGUREE') {
      return NextResponse.json({ error: 'Base non configurée.' }, { status: 503 });
    }
    return NextResponse.json({ error: 'Le calcul a échoué.' }, { status: 500 });
  }
}
