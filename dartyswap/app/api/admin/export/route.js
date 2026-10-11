import { loadAll, latestRun, exchangesOf } from '../../../../lib/store';
import { readSession } from '../../../../lib/session';

export const dynamic = 'force-dynamic';

function csvCell(value) {
  const s = value === null || value === undefined ? '' : String(value);
  const guarded = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return `"${guarded.replace(/"/g, '""')}"`;
}

export async function GET() {
  if (!readSession('admin')) return new Response('Non autorisé.', { status: 401 });

  try {
    const all = await loadAll();
    const run = latestRun(all);
    if (!run) return new Response('Aucun calcul disponible.', { status: 404 });

    const byId = new Map(all.students.map((s) => [s.id, s]));
    const header = ['echange', 'taille', 'type', 'statut', 'position', 'nom', 'code', 'email',
                    'darty_actuel', 'darty_attribue', 'rang_preference', 'reponse'];
    const lines = [header.map(csvCell).join(',')];

    for (const e of exchangesOf(all, run.id)) {
      for (const p of e.participants) {
        const s = byId.get(p.studentId) || {};
        lines.push([
          e.index, e.size, e.size === 2 ? 'simple' : 'multiple', e.status, p.position + 1,
          s.fullName || p.fullName, s.code, s.email,
          p.fromStore, p.toStore, p.rank, p.response,
        ].map(csvCell).join(','));
      }
    }

    const stamp = new Date().toISOString().slice(0, 10);
    return new Response('﻿' + lines.join('\r\n'), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="dartyswap-calcul${run.id}-${stamp}.csv"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch {
    return new Response('Service indisponible.', { status: 503 });
  }
}
