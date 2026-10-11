import { NextResponse } from 'next/server';
import { createSession, safeEqual } from '../../../../lib/session';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  let body;
  try { body = await request.json(); } catch { body = {}; }

  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) {
    return NextResponse.json({ error: 'Administration non configurée.' }, { status: 503 });
  }

  await new Promise((r) => setTimeout(r, 400));

  if (!safeEqual(body.password, expected)) {
    return NextResponse.json({ error: 'Mot de passe incorrect.' }, { status: 401 });
  }

  createSession('admin', { ok: 1 }, 60 * 60 * 8);
  return NextResponse.json({ ok: true });
}
