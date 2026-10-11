import { NextResponse } from 'next/server';
import { loadAll, publishedRun, exchangesOf, statusLabel } from '../../../../lib/store';
import { readSession } from '../../../../lib/session';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = readSession('student');
  if (!session) return NextResponse.json({ error: 'Non connecté.' }, { status: 401 });

  try {
    const all = await loadAll();
    const me = all.students.find((s) => s.id === session.id);
    if (!me) return NextResponse.json({ error: 'Non connecté.' }, { status: 401 });

    const student = {
      code: me.code,
      fullName: me.fullName,
      currentStore: me.currentStore,
      preferences: me.preferences,
    };

    // Les propositions ne sont visibles qu'une fois les résultats publiés.
    const run = publishedRun(all);
    if (!run) return NextResponse.json({ student, published: false, proposals: [] });

    const proposals = exchangesOf(all, run.id)
      .filter((e) => e.participants.some((p) => p.studentId === me.id))
      .map((e) => {
        const mine = e.participants.find((p) => p.studentId === me.id);
        return {
          id: e.id,
          index: e.index,
          size: e.size,
          fromStore: mine.fromStore,
          toStore: mine.toStore,
          myResponse: mine.response,
          status: e.status,
          statusLabel: statusLabel(e.status),
          // Les autres participants restent anonymes entre étudiants.
          others: e.participants
            .filter((p) => p.studentId !== me.id)
            .map((p, i) => ({
              label: `Participant ${String.fromCharCode(66 + i)}`,
              fromStore: p.fromStore,
              toStore: p.toStore,
              response: p.response,
            })),
        };
      });

    return NextResponse.json({ student, published: true, proposals });
  } catch {
    return NextResponse.json({ error: 'Service indisponible.' }, { status: 503 });
  }
}
