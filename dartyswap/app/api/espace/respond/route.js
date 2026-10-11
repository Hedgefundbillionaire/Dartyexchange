import { NextResponse } from 'next/server';
import { loadAll, publishedRun, respond } from '../../../../lib/store';
import { readSession } from '../../../../lib/session';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  const session = readSession('student');
  if (!session) return NextResponse.json({ error: 'Non connecté.' }, { status: 401 });

  let body;
  try { body = await request.json(); } catch { body = {}; }
  const action = String(body.action || '');
  const m = /^(\d+)-(\d+)$/.exec(String(body.exchangeId || ''));

  if (!m || !['accept', 'refuse'].includes(action)) {
    return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 });
  }
  const runId = Number(m[1]);
  const exchange = Number(m[2]);

  try {
    // Réponse acceptée uniquement sur le calcul publié, et seulement si
    // l'étudiant participe réellement à cet échange.
    const all = await loadAll();
    const run = publishedRun(all);
    if (!run) return NextResponse.json({ error: 'Résultats non publiés.' }, { status: 403 });
    if (run.id !== runId) {
      return NextResponse.json({ error: 'Échange introuvable.' }, { status: 404 });
    }
    const isParticipant = all.parts.some(
      (p) => p.runId === runId && p.exchange === exchange && p.studentId === session.id
    );
    if (!isParticipant) {
      return NextResponse.json({ error: 'Échange introuvable.' }, { status: 404 });
    }

    await respond({
      runId, exchange, studentId: session.id,
      response: action === 'accept' ? 'accepted' : 'refused',
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Service indisponible.' }, { status: 503 });
  }
}
