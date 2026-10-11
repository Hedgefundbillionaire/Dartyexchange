import { getRun, getRunExchanges } from '../../../../lib/db';
import { readSession } from '../../../../lib/session';

export const dynamic = 'force-dynamic';

function csvCell(value) {
  const s = value === null || value === undefined ? '' : String(value);
  // Neutralise l'injection de formules dans Excel / Sheets.
  const guarded = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return `"${guarded.replace(/"/g, '""')}"`;
}

export async function GET() {
  if (!readSession('admin')) {
    return new Response('Non autorisé.', { status: 401 });
  }

  try {
    const run = await getRun({ publishedOnly: false });
    if (!run) return new Response('Aucun calcul disponible.', { status: 404 });

    const exchanges = await getRunExchanges(run.id, { includeIdentity: true });

    const header = [
      'echange', 'taille', 'type', 'statut', 'position',
      'nom', 'code', 'email',
      'darty_actuel', 'darty_attribue', 'rang_preference', 'reponse',
    ];

    const lines = [header.map(csvCell).join(',')];
    for (const e of exchanges) {
      for (const p of e.participants) {
        lines.push([
          e.index, e.size, e.size === 2 ? 'simple' : 'multiple', e.status, p.position + 1,
          p.fullName, p.code, p.email,
          p.fromStore, p.toStore, p.preferenceRank, p.response,
        ].map(csvCell).join(','));
      }
    }

    const stamp = new Date().toISOString().slice(0, 10);
    // BOM pour qu'Excel ouvre l'UTF-8 correctement.
    return new Response('﻿' + lines.join('\r\n'), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="dartyswap-run${run.id}-${stamp}.csv"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch {
    return new Response('Service indisponible.', { status: 503 });
  }
}
