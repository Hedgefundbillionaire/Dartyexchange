'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import '../../globals.css';

const MAX_PREFS = 5;

function fmt(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  return d.toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

function responseTag(r) {
  if (r === 'accepted') return <span className="tag ok">accepté</span>;
  if (r === 'refused') return <span className="tag bad">refusé</span>;
  if (r === 'pending') return <span className="tag warn">en attente</span>;
  return <span className="tag">—</span>;
}

const COLUMNS = [
  { key: 'createdAt', label: 'Inscrit le', get: (s) => s.createdAt || '' },
  { key: 'fullName', label: 'Nom', get: (s) => s.fullName },
  { key: 'email', label: 'Adresse mail', get: (s) => s.email },
  { key: 'code', label: 'Code', get: (s) => s.code },
  { key: 'currentStore', label: 'Darty actuel', get: (s) => s.currentStore },
  ...Array.from({ length: MAX_PREFS }, (_, i) => ({
    key: `pref${i}`,
    label: `Choix ${i + 1}`,
    get: (s) => s.preferences[i] || '',
  })),
  { key: 'exchangeIndex', label: 'Échange', get: (s) => s.exchangeIndex ?? '' },
  { key: 'assignedStore', label: 'Darty attribué', get: (s) => s.assignedStore || '' },
  { key: 'assignedRank', label: 'Rang obtenu', get: (s) => s.assignedRank ?? '' },
  { key: 'response', label: 'Réponse', get: (s) => s.response || '' },
  { key: 'respondedAt', label: 'Répondu le', get: (s) => s.respondedAt || '' },
];

export default function Inscriptions() {
  const [state, setState] = useState({ phase: 'loading' });
  const [q, setQ] = useState('');
  const [sort, setSort] = useState({ key: 'createdAt', dir: 'asc' });

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/inscriptions', { cache: 'no-store' });
      if (res.status === 401) return setState({ phase: 'denied' });
      const data = await res.json();
      if (!res.ok) return setState({ phase: 'error', error: data.error || 'Erreur.' });
      setState({ phase: 'ready', data });
    } catch {
      setState({ phase: 'error', error: 'Service indisponible.' });
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const rows = useMemo(() => {
    if (state.phase !== 'ready' || !state.data.students) return [];
    const needle = q.trim().toLowerCase();
    let list = state.data.students;
    if (needle) {
      list = list.filter((s) =>
        [s.fullName, s.email, s.code, s.currentStore, s.assignedStore, ...s.preferences]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(needle))
      );
    }
    const col = COLUMNS.find((c) => c.key === sort.key);
    if (col) {
      list = [...list].sort((a, b) => {
        const va = col.get(a) ?? '';
        const vb = col.get(b) ?? '';
        const cmp = typeof va === 'number' && typeof vb === 'number'
          ? va - vb
          : String(va).localeCompare(String(vb), 'fr', { numeric: true });
        return sort.dir === 'asc' ? cmp : -cmp;
      });
    }
    return list;
  }, [state, q, sort]);

  function toggleSort(key) {
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }));
  }

  function downloadCsv() {
    const cell = (v) => {
      const s = v === null || v === undefined ? '' : String(v);
      const guarded = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
      return `"${guarded.replace(/"/g, '""')}"`;
    };
    const lines = [COLUMNS.map((c) => cell(c.label)).join(',')];
    for (const s of rows) {
      lines.push(COLUMNS.map((c) => {
        const v = c.get(s);
        if (c.key === 'createdAt' || c.key === 'respondedAt') return cell(fmt(v));
        return cell(v);
      }).join(','));
    }
    const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dartyswap-inscriptions-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (state.phase === 'loading') {
    return <main className="wrap"><p className="sub">Chargement…</p></main>;
  }
  if (state.phase === 'denied') {
    return (
      <main className="wrap">
        <h1>Administration</h1>
        <div className="msg err">Session expirée.</div>
        <Link href="/admin"><button>Se reconnecter</button></Link>
      </main>
    );
  }
  if (state.phase === 'error') {
    return <main className="wrap"><div className="msg err">{state.error}</div></main>;
  }
  if (!state.data.dbConfigured) {
    return (
      <main className="wrap">
        <h1>Inscriptions</h1>
        <div className="msg err">La base de données n’est pas connectée.</div>
      </main>
    );
  }

  const { students, run } = state.data;
  const responded = students.filter((s) => s.response && s.response !== 'pending').length;
  const awaiting = students.filter((s) => s.response === 'pending').length;

  return (
    <main className="wrap-full">
      <div className="row">
        <div>
          <Link href="/admin" className="sub">← Administration</Link>
          <h1 style={{ margin: '6px 0 0' }}>Inscriptions</h1>
        </div>
        <div className="actions">
          <button className="ghost small" onClick={load}>Rafraîchir</button>
          <button className="small" onClick={downloadCsv}>Exporter en CSV</button>
        </div>
      </div>

      <p className="sub" style={{ marginTop: 8 }}>
        {students.length} inscrit{students.length > 1 ? 's' : ''}
        {run
          ? ` · calcul du ${fmt(run.createdAt)}${run.published ? ' (publié)' : ' (non publié)'} · ${responded} réponse${responded > 1 ? 's' : ''}, ${awaiting} en attente`
          : ' · aucun calcul lancé'}
      </p>

      <div className="field" style={{ maxWidth: 360, marginTop: 14 }}>
        <input type="text" value={q} placeholder="Filtrer : nom, mail, code, magasin…"
               onChange={(e) => setQ(e.target.value)} />
      </div>

      {students.length === 0 ? (
        <div className="card empty">
          <h3>Aucune inscription pour l’instant</h3>
          <p className="sub">Le tableau se remplira au fur et à mesure.</p>
        </div>
      ) : (
        <>
          <div className="tablewrap">
            <table className="sheet">
              <thead>
                <tr>
                  <th className="num">#</th>
                  {COLUMNS.map((c) => (
                    <th key={c.key} onClick={() => toggleSort(c.key)} title="Trier">
                      {c.label}
                      {sort.key === c.key && <span className="arrow">{sort.dir === 'asc' ? ' ▲' : ' ▼'}</span>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((s, i) => (
                  <tr key={s.id}>
                    <td className="num">{i + 1}</td>
                    <td className="nowrap">{fmt(s.createdAt)}</td>
                    <td className="nowrap"><strong>{s.fullName}</strong></td>
                    <td className="nowrap">{s.email}</td>
                    <td className="mono">{s.code}</td>
                    <td className="nowrap">{s.currentStore}</td>
                    {Array.from({ length: MAX_PREFS }, (_, k) => (
                      <td key={k} className={s.preferences[k] ? 'nowrap' : 'faint'}>
                        {s.preferences[k] || '—'}
                      </td>
                    ))}
                    <td className="num">{s.exchangeIndex ?? '—'}</td>
                    <td className={s.assignedStore ? 'nowrap' : 'faint'}>{s.assignedStore || '—'}</td>
                    <td className="num">{s.assignedRank ?? '—'}</td>
                    <td>{responseTag(s.response)}</td>
                    <td className="nowrap faint">{fmt(s.respondedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rows.length !== students.length && (
            <p className="sub" style={{ marginTop: 10 }}>
              {rows.length} ligne{rows.length > 1 ? 's' : ''} sur {students.length}.
            </p>
          )}
        </>
      )}
    </main>
  );
}
