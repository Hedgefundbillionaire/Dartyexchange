import { NextResponse } from 'next/server';
import { createSession, safeEqual } from '../../../../lib/session';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  let body;
  try { body = await request.json(); } catch { body = {}; }

  const expected = process.env.RESULTS_PASSWORD;
  if (!expected) {
    return NextResponse.json({ error: 'Page non configurée.' }, { status: 503 });
  }

  // Petit délai constant : ralentit le bruteforce sans gêner un humain.
  await new Promise((r) => setTimeout(r, 400));

  if (!safeEqual(body.password, expected)) {
    return NextResponse.json(
      { error: 'Mot de passe incorrect. Réessaie.' },
      { status: 401 }
    );
  }

  createSession('resultat', { ok: 1 }, 60 * 60 * 12);
  return NextResponse.json({ ok: true });
}
