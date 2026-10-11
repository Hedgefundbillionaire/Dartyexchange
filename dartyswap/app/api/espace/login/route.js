import { NextResponse } from 'next/server';
import { query } from '../../../../lib/db';
import { createSession, safeEqual } from '../../../../lib/session';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  let body;
  try { body = await request.json(); } catch { body = {}; }

  const raw = String(body.code || '').trim();

  // Code universel : donne accès à la vue partagée et anonymisée (/resultat).
  // Il ne connecte personne en particulier — il n'identifie aucun étudiant.
  const shared = process.env.RESULTS_PASSWORD;
  if (shared && safeEqual(raw, shared)) {
    await new Promise((r) => setTimeout(r, 300));
    createSession('resultat', { ok: 1 }, 60 * 60 * 12);
    return NextResponse.json({ ok: true, shared: true });
  }

  // Sinon : code personnel, au format XXXX-XXXX.
  const code = raw.toUpperCase();
  if (!/^[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(code)) {
    return NextResponse.json({ error: 'Code incorrect. Réessaie.' }, { status: 401 });
  }

  try {
    const { rows } = await query(`SELECT id FROM students WHERE code = $1`, [code]);
    if (!rows[0]) {
      return NextResponse.json({ error: 'Code incorrect. Réessaie.' }, { status: 401 });
    }
    createSession('student', { id: rows[0].id }, 60 * 60 * 24 * 30);
    return NextResponse.json({ ok: true, shared: false });
  } catch {
    return NextResponse.json({ error: 'Service indisponible.' }, { status: 503 });
  }
}
