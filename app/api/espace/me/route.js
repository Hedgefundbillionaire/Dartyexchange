import { NextResponse } from 'next/server';
import { query, getRun, exchangeStatus, statusLabel } from '../../../../lib/db';
import { readSession } from '../../../../lib/session';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = readSession('student');
  if (!session) return NextResponse.json({ error: 'Non connecté.' }, { status: 401 });

  try {
    const { rows: me } = await query(
      `SELECT s.id, s.code, s.full_name, s.dif_group, s.current_store,
              COALESCE(ARRAY_AGG(p.store ORDER BY p.rank)
                       FILTER (WHERE p.store IS NOT NULL), '{}') AS preferences
         FROM students s
         LEFT JOIN preferences p ON p.student_id = s.id
        WHERE s.id = $1
        GROUP BY s.id`,
      [session.id]
    );
    if (!me[0]) return NextResponse.json({ error: 'Non connecté.' }, { status: 401 });

    const student = {
      code: me[0].code,
      fullName: me[0].full_name,
      difGroup: me[0].dif_group,
      currentStore: me[0].current_store,
      preferences: me[0].preferences || [],
    };

    // Les propositions ne sont visibles qu'une fois les résultats publiés.
    const run = await getRun({ publishedOnly: true });
    if (!run) return NextResponse.json({ student, published: false, proposals: [] });

    const { rows } = await query(
      `SELECT e.id AS exchange_id, e.idx, e.size,
              p.student_id, p.position, p.from_store, p.to_store, p.response
         FROM exchanges e
         JOIN exchange_participants p ON p.exchange_id = e.id
        WHERE e.run_id = $1
          AND e.id IN (SELECT exchange_id FROM exchange_participants WHERE student_id = $2)
        ORDER BY e.idx, p.position`,
      [run.id, session.id]
    );

    const grouped = new Map();
    for (const r of rows) {
      if (!grouped.has(r.exchange_id)) {
        grouped.set(r.exchange_id, { id: r.exchange_id, index: r.idx, size: r.size, participants: [] });
      }
      grouped.get(r.exchange_id).participants.push(r);
    }

    const proposals = [...grouped.values()].map((e) => {
      const mine = e.participants.find((p) => p.student_id === session.id);
      const status = exchangeStatus(e.participants.map((p) => ({ response: p.response })));
      return {
        id: e.id,
        index: e.index,
        size: e.size,
        fromStore: mine.from_store,
        toStore: mine.to_store,
        myResponse: mine.response,
        status,
        statusLabel: statusLabel(status),
        // Les autres participants restent anonymes entre étudiants.
        others: e.participants
          .filter((p) => p.student_id !== session.id)
          .map((p, i) => ({
            label: `Participant ${String.fromCharCode(66 + i)}`,
            fromStore: p.from_store,
            toStore: p.to_store,
            response: p.response,
          })),
      };
    });

    return NextResponse.json({ student, published: true, proposals });
  } catch {
    return NextResponse.json({ error: 'Service indisponible.' }, { status: 503 });
  }
}
