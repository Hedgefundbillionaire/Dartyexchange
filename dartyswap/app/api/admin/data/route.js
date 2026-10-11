import { NextResponse } from 'next/server';
import { query, getRun, getRunExchanges, isConfigured, statusLabel } from '../../../../lib/db';
import { readSession } from '../../../../lib/session';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!readSession('admin')) {
    return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 });
  }
  if (!isConfigured()) {
    return NextResponse.json({ dbConfigured: false });
  }

  try {
    const { rows: counts } = await query(`
      SELECT
        (SELECT COUNT(*) FROM students) AS total,
        (SELECT COUNT(DISTINCT student_id) FROM preferences) AS requesting
    `);

    const latest = await getRun({ publishedOnly: false });
    const published = await getRun({ publishedOnly: true });

    let exchanges = [];
    if (latest) {
      // L'admin voit les identités : c'est le seul endroit où elles sortent.
      exchanges = await getRunExchanges(latest.id, { includeIdentity: true });
    }

    return NextResponse.json({
      dbConfigured: true,
      stats: {
        totalStudents: Number(counts[0].total),
        studentsRequesting: Number(counts[0].requesting),
        possibleExchanges: exchanges.length,
        studentsCanMove: new Set(
          exchanges.flatMap((e) => e.participants.map((p) => p.studentId))
        ).size,
      },
      run: latest
        ? {
            id: latest.id,
            createdAt: latest.created_at,
            published: latest.published,
            options: latest.options,
          }
        : null,
      publishedRunId: published ? published.id : null,
      exchanges: exchanges.map((e) => ({
        ...e,
        statusLabel: statusLabel(e.status),
      })),
    });
  } catch (e) {
    if (e.code === 'BASE_NON_CONFIGUREE') {
      return NextResponse.json({ dbConfigured: false });
    }
    return NextResponse.json({ error: 'Service indisponible.' }, { status: 503 });
  }
}
