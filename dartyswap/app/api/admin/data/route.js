import { NextResponse } from 'next/server';
import { loadAll, latestRun, publishedRun, exchangesOf, statusLabel, isConfigured } from '../../../../lib/store';
import { readSession } from '../../../../lib/session';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!readSession('admin')) return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 });
  if (!isConfigured()) return NextResponse.json({ dbConfigured: false });

  try {
    const all = await loadAll();
    const latest = latestRun(all);
    const published = publishedRun(all);
    const byId = new Map(all.students.map((s) => [s.id, s]));

    const exchanges = latest ? exchangesOf(all, latest.id) : [];

    return NextResponse.json({
      dbConfigured: true,
      stats: {
        totalStudents: all.students.length,
        studentsRequesting: all.students.filter((s) => s.preferences.length > 0).length,
        possibleExchanges: exchanges.length,
        studentsCanMove: new Set(exchanges.flatMap((e) => e.participants.map((p) => p.studentId))).size,
      },
      run: latest
        ? { id: latest.id, createdAt: latest.createdAt, published: latest.published, options: { maxCycleLength: latest.maxLen } }
        : null,
      publishedRunId: published ? published.id : null,
      // Seul endroit, avec /admin/inscriptions, où les identités apparaissent.
      exchanges: exchanges.map((e) => ({
        ...e,
        statusLabel: statusLabel(e.status),
        participants: e.participants.map((p) => {
          const s = byId.get(p.studentId);
          return {
            studentId: p.studentId,
            position: p.position,
            fromStore: p.fromStore,
            toStore: p.toStore,
            preferenceRank: p.rank,
            response: p.response,
            fullName: s?.fullName || p.fullName,
            email: s?.email || '',
            code: s?.code || '',
          };
        }),
      })),
    });
  } catch (e) {
    if (e.code === 'BASE_NON_CONFIGUREE') return NextResponse.json({ dbConfigured: false });
    return NextResponse.json({ error: 'Service indisponible.' }, { status: 503 });
  }
}
