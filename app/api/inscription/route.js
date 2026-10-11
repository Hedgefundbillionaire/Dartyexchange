import { NextResponse } from 'next/server';
import { query, withTransaction, isConfigured } from '../../../lib/db';
import { generateStudentCode, createSession } from '../../../lib/session';
import { OTHER_STORE, DIF_GROUPS, MAX_PREFS } from '../../../lib/stores';

export const dynamic = 'force-dynamic';

function cleanStore(raw) {
  const v = String(raw || '').trim().replace(/\s+/g, ' ');
  if (!v) return null;
  if (v.length > 120) return null;
  return v;
}

export async function POST(request) {
  if (!isConfigured()) {
    return NextResponse.json(
      { error: "La base de données n'est pas encore configurée." },
      { status: 503 }
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 });
  }

  const fullName = String(body.fullName || '').trim().replace(/\s+/g, ' ');
  const contact = String(body.contact || '').trim();
  const difGroup = String(body.difGroup || '').trim();
  const currentStore = cleanStore(body.currentStore);
  const rawPrefs = Array.isArray(body.preferences) ? body.preferences : [];

  if (fullName.length < 2 || fullName.length > 100) {
    return NextResponse.json({ error: 'Indique ton nom complet.' }, { status: 400 });
  }
  if (!DIF_GROUPS.includes(difGroup)) {
    return NextResponse.json({ error: 'Choisis ton groupe DIF.' }, { status: 400 });
  }
  if (!currentStore) {
    return NextResponse.json({ error: 'Indique ton Darty actuel.' }, { status: 400 });
  }
  if (contact.length > 120) {
    return NextResponse.json({ error: 'Contact trop long.' }, { status: 400 });
  }

  // "Autre Darty" est un libellé d'interface : il faut le nom réel du magasin.
  if (currentStore === OTHER_STORE) {
    return NextResponse.json({ error: 'Précise le nom de ton Darty.' }, { status: 400 });
  }

  const seen = new Set([currentStore.toLowerCase()]);
  const preferences = [];
  for (const raw of rawPrefs) {
    const v = cleanStore(raw);
    if (!v || v === OTHER_STORE) continue;
    const key = v.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    preferences.push(v);
    if (preferences.length >= MAX_PREFS) break;
  }

  if (preferences.length === 0) {
    return NextResponse.json(
      { error: 'Indique au moins un Darty souhaité, différent du tien.' },
      { status: 400 }
    );
  }

  try {
    const student = await withTransaction(async (client) => {
      let code;
      let row;
      // Collision de code quasi impossible, mais on réessaie proprement.
      for (let attempt = 0; attempt < 5; attempt++) {
        code = generateStudentCode();
        const res = await client.query(
          `INSERT INTO students (code, full_name, contact, dif_group, current_store)
           VALUES ($1,$2,$3,$4,$5)
           ON CONFLICT (code) DO NOTHING
           RETURNING id, code`,
          [code, fullName, contact || null, difGroup, currentStore]
        );
        if (res.rows[0]) { row = res.rows[0]; break; }
      }
      if (!row) throw new Error('Impossible de générer un code.');

      for (let i = 0; i < preferences.length; i++) {
        await client.query(
          `INSERT INTO preferences (student_id, rank, store) VALUES ($1,$2,$3)`,
          [row.id, i, preferences[i]]
        );
      }
      return row;
    });

    // Connexion immédiate : pas d'email, donc le code est montré une fois à l'écran.
    createSession('student', { id: student.id }, 60 * 60 * 24 * 30);

    return NextResponse.json({ ok: true, code: student.code });
  } catch (e) {
    if (e.code === 'BASE_NON_CONFIGUREE') {
      return NextResponse.json({ error: "Base non configurée." }, { status: 503 });
    }
    return NextResponse.json({ error: "Erreur à l'enregistrement." }, { status: 500 });
  }
}
