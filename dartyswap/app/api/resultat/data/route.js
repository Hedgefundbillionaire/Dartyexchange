import { NextResponse } from 'next/server';
import { loadAll, publishedRun, exchangesOf, statusLabel } from '../../../../lib/store';
import { readSession } from '../../../../lib/session';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!readSession('resultat')) {
    return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 });
  }
  try {
    const all = await loadAll();
    const run = publishedRun(all);
    if (!run) return NextResponse.json({ published: false });

    const exchanges = exchangesOf(all, run.id);
    const movable = new Set(exchanges.flatMap((e) => e.participants.map((p) => p.studentId)));

    return NextResponse.json({
      published: true,
      publishedAt: run.createdAt,
      stats: {
        totalStudents: all.students.length,
        studentsRequesting: all.students.filter((s) => s.preferences.length > 0).length,
        possibleExchanges: exchanges.length,
        studentsCanMove: movable.size,
      },
      // Identifiants anonymisés : ni noms, ni mails, ni codes ne sortent d'ici.
      exchanges: exchanges.map((e) => ({
        index: e.index,
        size: e.size,
        type: e.size === 2 ? 'simple' : 'multiple',
        status: e.status,
        statusLabel: statusLabel(e.status),
        participants: e.participants.map((p, i) => ({
          label: `Étudiant ${String.fromCharCode(65 + i)}`,
          fromStore: p.fromStore,
          toStore: p.toStore,
          response: p.response,
        })),
      })),
    });
  } catch (e) {
    if (e.code === 'BASE_NON_CONFIGUREE') {
      return NextResponse.json({ error: 'Base non configurée.' }, { status: 503 });
    }
    return NextResponse.json({ error: 'Service indisponible.' }, { status: 503 });
  }
}
