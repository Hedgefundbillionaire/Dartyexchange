import { NextResponse } from 'next/server';
import { query, getRun } from '../../../../lib/db';
import { readSession } from '../../../../lib/session';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  const session = readSession('student');
  if (!session) return NextResponse.json({ error: 'Non connecté.' }, { status: 401 });

  let body;
  try { body = await request.json(); } catch { body = {}; }
  const exchangeId = Number(body.exchangeId);
  const action = String(body.action || '');

  if (!Number.isInteger(exchangeId) || !['accept', 'refuse'].includes(action)) {
    return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 });
  }

  try {
    // On n'autorise la réponse que sur un run publié, et seulement sur
    // un échange dont l'étudiant est réellement participant.
    const run = await getRun({ publishedOnly: true });
    if (!run) {
      return NextResponse.json({ error: 'Résultats non publiés.' }, { status: 403 });
    }

    const { rowCount } = await query(
      `UPDATE exchange_participants p
          SET response = $1
        WHERE p.student_id = $2
          AND p.exchange_id = $3
          AND EXISTS (
            SELECT 1 FROM exchanges e
             WHERE e.id = p.exchange_id AND e.run_id = $4
          )`,
      [action === 'accept' ? 'accepted' : 'refused', session.id, exchangeId, run.id]
    );

    if (!rowCount) {
      return NextResponse.json({ error: 'Échange introuvable.' }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Service indisponible.' }, { status: 503 });
  }
}
