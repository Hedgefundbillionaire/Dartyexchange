import { NextResponse } from 'next/server';
import { loadAll, latestRun, setPublished } from '../../../../lib/store';
import { readSession } from '../../../../lib/session';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  if (!readSession('admin')) return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 });

  let body;
  try { body = await request.json(); } catch { body = {}; }

  try {
    if (!body.published) {
      await setPublished(null);
      return NextResponse.json({ ok: true, published: false });
    }
    const latest = latestRun(await loadAll());
    if (!latest) {
      return NextResponse.json({ error: "Aucun calcul à publier. Lance d'abord l'algorithme." }, { status: 400 });
    }
    // Un seul calcul publié à la fois.
    await setPublished(latest.id);
    return NextResponse.json({ ok: true, published: true, runId: latest.id });
  } catch (e) {
    if (e.code === 'BASE_NON_CONFIGUREE') return NextResponse.json({ error: 'Base non configurée.' }, { status: 503 });
    return NextResponse.json({ error: 'Opération impossible.' }, { status: 500 });
  }
}
