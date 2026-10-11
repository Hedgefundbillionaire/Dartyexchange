import { NextResponse } from 'next/server';
import { loadAll, latestRun, isConfigured } from '../../../../lib/store';
import { readSession } from '../../../../lib/session';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!readSession('admin')) return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 });
  if (!isConfigured()) return NextResponse.json({ dbConfigured: false });

  try {
    const all = await loadAll();
    const latest = latestRun(all);
    const mine = new Map();
    if (latest) {
      for (const p of all.parts) if (p.runId === latest.id) mine.set(p.studentId, p);
    }

    return NextResponse.json({
      dbConfigured: true,
      run: latest ? { id: latest.id, createdAt: latest.createdAt, published: latest.published } : null,
      students: all.students.map((s) => {
        const p = mine.get(s.id);
        return {
          id: s.id,
          code: s.code,
          fullName: s.fullName,
          email: s.email,
          currentStore: s.currentStore,
          createdAt: s.createdAt,
          preferences: s.preferences,
          exchangeIndex: p ? p.exchange : null,
          exchangeSize: p ? p.size : null,
          assignedStore: p ? p.toStore : null,
          assignedRank: p ? p.rank : null,
          response: p ? p.response : null,
          respondedAt: p ? p.respondedAt : null,
        };
      }),
    });
  } catch (e) {
    if (e.code === 'BASE_NON_CONFIGUREE') return NextResponse.json({ dbConfigured: false });
    return NextResponse.json({ error: 'Service indisponible.' }, { status: 503 });
  }
}
