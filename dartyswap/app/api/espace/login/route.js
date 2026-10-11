import { NextResponse } from 'next/server';
import { query } from '../../../../lib/db';
import { createSession } from '../../../../lib/session';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  let body;
  try { body = await request.json(); } catch { body = {}; }
  const code = String(body.code || '').trim().toUpperCase();
  if (!/^[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(code)) {
    return NextResponse.json({ error: 'Code incorrect. Réessaie.' }, { status: 401 });
  }
  try {
    const { rows } = await query(`SELECT id FROM students WHERE code = $1`, [code]);
    if (!rows[0]) {
      return NextResponse.json({ error: 'Code incorrect. Réessaie.' }, { status: 401 });
    }
    createSession('student', { id: rows[0].id }, 60 * 60 * 24 * 30);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Service indisponible.' }, { status: 503 });
  }
}
