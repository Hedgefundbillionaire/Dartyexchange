import { NextResponse } from 'next/server';
import { query, getRun, getRunExchanges, statusLabel } from '../../../../lib/db';
import { readSession } from '../../../../lib/session';

export const dynamic = 'force-dynamic';

export async function GET() {
  // L'API est protégée au même titre que la page.
  if (!readSession('resultat')) {
    return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 });
  }

  try {
    const run = await getRun({ publishedOnly: true });
    if (!run) {
      return NextResponse.json({ published: false });
    }

    // includeIdentity: false — ni noms, ni contacts, ni codes ne sortent d'ici.
    const exchanges = await getRunExchanges(run.id, { includeIdentity: false });

    const { rows: counts } = await query(`
      SELECT
        (SELECT COUNT(*) FROM students) AS total,
        (SELECT COUNT(DISTINCT student_id) FROM preferences) AS requesting
    `);

    const movable = new Set();
    for (const e of exchanges) for (const p of e.participants) movable.add(p.studentId);

    return NextResponse.json({
      published: true,
      publishedAt: run.created_at,
      stats: {
        totalStudents: Number(counts[0].total),
        studentsRequesting: Number(counts[0].requesting),
        possibleExchanges: exchanges.length,
        studentsCanMove: movable.size,
      },
      // Identifiants anonymisés, recalculés par échange.
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
