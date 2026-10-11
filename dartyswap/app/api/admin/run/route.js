import { NextResponse } from 'next/server';
import { loadAll, saveRun } from '../../../../lib/store';
import { readSession } from '../../../../lib/session';
import { computeExchanges, DEFAULT_OPTIONS } from '../../../../lib/matching';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(request) {
  if (!readSession('admin')) return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 });

  let body;
  try { body = await request.json(); } catch { body = {}; }

  const options = {
    ...DEFAULT_OPTIONS,
    maxCycleLength: Number(body.maxCycleLength) || DEFAULT_OPTIONS.maxCycleLength,
    // « Relancer l'optimisation » : plus de restarts = meilleur packing.
    restarts: Math.min(2000, Math.max(1, Number(body.restarts) || DEFAULT_OPTIONS.restarts)),
  };

  try {
    const all = await loadAll();
    const roster = all.students.map((s) => ({
      id: s.id, code: s.code, currentStore: s.currentStore, preferences: s.preferences,
    }));
    const result = computeExchanges(roster, options);

    // Un nouveau calcul crée une nouvelle proposition, non publiée :
    // les réponses repartent de zéro.
    const runId = await saveRun(result, new Map(all.students.map((s) => [s.id, s])));
    return NextResponse.json({ ok: true, runId, stats: result.stats, options: result.options });
  } catch (e) {
    if (e.code === 'BASE_NON_CONFIGUREE') return NextResponse.json({ error: 'Base non configurée.' }, { status: 503 });
    return NextResponse.json({ error: 'Le calcul a échoué.' }, { status: 500 });
  }
}
