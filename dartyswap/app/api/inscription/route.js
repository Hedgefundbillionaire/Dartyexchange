import { NextResponse } from 'next/server';
import { addStudent, isConfigured } from '../../../lib/store';
import { generateStudentCode, createSession } from '../../../lib/session';
import { isKnownStore, MAX_PREFS } from '../../../lib/stores';

export const dynamic = 'force-dynamic';

// Liste fermée : seuls les 36 Darty de la promotion sont acceptés.
function cleanStore(raw) {
  const v = String(raw || '').trim().replace(/\s+/g, ' ');
  return isKnownStore(v) ? v : null;
}

export async function POST(request) {
  if (!isConfigured()) {
    return NextResponse.json({ error: "La base de données n'est pas encore configurée." }, { status: 503 });
  }

  let body;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 });
  }

  const fullName = String(body.fullName || '').trim().replace(/\s+/g, ' ');
  const email = String(body.email || '').trim().toLowerCase();
  const currentStore = cleanStore(body.currentStore);
  const rawPrefs = Array.isArray(body.preferences) ? body.preferences : [];

  if (fullName.length < 2 || fullName.length > 100) {
    return NextResponse.json({ error: 'Indique ton nom complet.' }, { status: 400 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 120) {
    return NextResponse.json({ error: 'Indique une adresse mail valide.' }, { status: 400 });
  }
  if (!currentStore) {
    return NextResponse.json({ error: 'Choisis ton Darty actuel dans la liste.' }, { status: 400 });
  }

  const seen = new Set([currentStore.toLowerCase()]);
  const preferences = [];
  for (const raw of rawPrefs) {
    const v = cleanStore(raw);
    if (!v) continue;
    const key = v.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    preferences.push(v);
    if (preferences.length >= MAX_PREFS) break;
  }
  if (preferences.length === 0) {
    return NextResponse.json(
      { error: 'Choisis au moins un Darty souhaité dans la liste, différent du tien.' },
      { status: 400 }
    );
  }

  try {
    let code, id;
    for (let attempt = 0; attempt < 4; attempt++) {
      code = generateStudentCode();
      try {
        ({ id } = await addStudent({ code, fullName, email, currentStore, preferences }));
        break;
      } catch (e) {
        if (e.code !== 'CODE_DUPLIQUE') throw e;
      }
    }
    if (!id) throw new Error('Impossible de générer un code.');

    createSession('student', { id }, 60 * 60 * 24 * 30);
    return NextResponse.json({ ok: true, code });
  } catch (e) {
    if (e.code === 'BASE_NON_CONFIGUREE') {
      return NextResponse.json({ error: 'Base non configurée.' }, { status: 503 });
    }
    return NextResponse.json({ error: "Erreur à l'enregistrement. Réessaie." }, { status: 500 });
  }
}
