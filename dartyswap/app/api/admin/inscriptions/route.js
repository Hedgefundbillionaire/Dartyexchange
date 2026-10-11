import { NextResponse } from 'next/server';
import { query, getRun, isConfigured } from '../../../../lib/db';
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
    const latest = await getRun({ publishedOnly: false });
    const published = await getRun({ publishedOnly: true });

    // Une ligne par étudiant : son inscription, ses souhaits, et s'il y a un
    // calcul, l'échange qui lui est proposé et sa réponse.
    const { rows } = await query(
      `SELECT s.id, s.code, s.full_name, s.email, s.current_store, s.created_at,
              COALESCE(
                ARRAY_AGG(p.store ORDER BY p.rank) FILTER (WHERE p.store IS NOT NULL),
                '{}'
              ) AS preferences,
              e.idx              AS exchange_index,
              e.size             AS exchange_size,
              ep.to_store        AS assigned_store,
              ep.preference_rank AS assigned_rank,
              ep.response        AS response,
              ep.responded_at    AS responded_at
         FROM students s
         LEFT JOIN preferences p ON p.student_id = s.id
         LEFT JOIN exchange_participants ep
                ON ep.student_id = s.id
               AND ep.exchange_id IN (SELECT id FROM exchanges WHERE run_id = $1)
         LEFT JOIN exchanges e ON e.id = ep.exchange_id
        GROUP BY s.id, e.idx, e.size, ep.to_store, ep.preference_rank,
                 ep.response, ep.responded_at
        ORDER BY s.created_at`,
      [latest ? latest.id : -1]
    );

    return NextResponse.json({
      dbConfigured: true,
      run: latest
        ? { id: latest.id, createdAt: latest.created_at, published: Boolean(published && published.id === latest.id) }
        : null,
      students: rows.map((r) => ({
        id: r.id,
        code: r.code,
        fullName: r.full_name,
        email: r.email,
        currentStore: r.current_store,
        createdAt: r.created_at,
        preferences: r.preferences || [],
        exchangeIndex: r.exchange_index,
        exchangeSize: r.exchange_size,
        assignedStore: r.assigned_store,
        assignedRank: r.assigned_rank,
        response: r.response,
        respondedAt: r.responded_at,
      })),
    });
  } catch (e) {
    if (e.code === 'BASE_NON_CONFIGUREE') {
      return NextResponse.json({ dbConfigured: false });
    }
    return NextResponse.json({ error: 'Service indisponible.' }, { status: 503 });
  }
}
