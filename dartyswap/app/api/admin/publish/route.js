import { NextResponse } from 'next/server';
import { query, withTransaction, getRun } from '../../../../lib/db';
import { readSession } from '../../../../lib/session';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  if (!readSession('admin')) {
    return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 });
  }

  let body;
  try { body = await request.json(); } catch { body = {}; }
  const publish = Boolean(body.published);

  try {
    if (!publish) {
      // Masquer : /resultat et les espaces étudiants redeviennent vides.
      await query(`UPDATE runs SET published = FALSE WHERE published = TRUE`);
      return NextResponse.json({ ok: true, published: false });
    }

    const latest = await getRun({ publishedOnly: false });
    if (!latest) {
      return NextResponse.json(
        { error: "Aucun calcul à publier. Lance d'abord l'algorithme." },
        { status: 400 }
      );
    }

    // Un seul run publié à la fois.
    await withTransaction(async (client) => {
      await client.query(`UPDATE runs SET published = FALSE WHERE published = TRUE`);
      await client.query(`UPDATE runs SET published = TRUE WHERE id = $1`, [latest.id]);
    });

    return NextResponse.json({ ok: true, published: true, runId: latest.id });
  } catch (e) {
    if (e.code === 'BASE_NON_CONFIGUREE') {
      return NextResponse.json({ error: 'Base non configurée.' }, { status: 503 });
    }
    return NextResponse.json({ error: 'Opération impossible.' }, { status: 500 });
  }
}
