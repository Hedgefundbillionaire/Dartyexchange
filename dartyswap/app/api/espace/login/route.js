import { NextResponse } from 'next/server';
import { loadAll } from '../../../../lib/store';
import { createSession, safeEqual } from '../../../../lib/session';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  let body;
  try { body = await request.json(); } catch { body = {}; }
  const raw = String(body.code || '').trim();

  // Code universel : vue partagée et anonymisée (/resultat). N'identifie personne.
  const shared = process.env.RESULTS_PASSWORD;
  if (shared && safeEqual(raw, shared)) {
    await new Promise((r) => setTimeout(r, 300));
    createSession('resultat', { ok: 1 }, 60 * 60 * 12);
    return NextResponse.json({ ok: true, shared: true });
  }

  const code = raw.toUpperCase();
  if (!/^[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(code)) {
    return NextResponse.json({ error: 'Code incorrect. Réessaie.' }, { status: 401 });
  }

  try {
    const all = await loadAll();
    const student = all.students.find((s) => s.code === code);
    if (!student) {
      return NextResponse.json({ error: 'Code incorrect. Réessaie.' }, { status: 401 });
    }
    createSession('student', { id: student.id }, 60 * 60 * 24 * 30);
    return NextResponse.json({ ok: true, shared: false });
  } catch {
    return NextResponse.json({ error: 'Service indisponible.' }, { status: 503 });
  }
}
