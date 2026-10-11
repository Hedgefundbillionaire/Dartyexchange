'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import '../globals.css';

function Login({ onDone }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Mot de passe incorrect.');
      onDone();
    } catch (err) {
      setError(err.message);
      setPassword('');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="wrap">
      <div className="gate">
        <div style={{ textAlign: 'center' }}>
          <div className="lock">🔑</div>
          <h1 style={{ fontSize: 26, margin: '0 0 8px' }}>Administration</h1>
          <p className="sub" style={{ marginBottom: 24 }}>Accès réservé.</p>
        </div>
        {error && <div className="msg err">{error}</div>}
        <form className="card" onSubmit={submit}>
          <div className="field" style={{ marginBottom: 14 }}>
            <label htmlFor="pw">Mot de passe administrateur</label>
            <input id="pw" type="password" autoFocus autoComplete="current-password"
                   value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <button type="submit" disabled={busy} style={{ width: '100%' }}>
            {busy ? 'Vérification…' : 'Entrer'}
          </button>
        </form>
      </div>
    </main>
  );
}

export default function Admin() {
  const [state, setState] = useState({ phase: 'loading' });
  const [busy, setBusy] = useState('');
  const [note, setNote] = useState(null);
  const [maxCycleLength, setMaxCycleLength] = useState(4);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/data', { cache: 'no-store' });
      if (res.status === 401) return setState({ phase: 'login' });
      const data = await res.json();
      if (!res.ok) return setState({ phase: 'error', error: data.error || 'Erreur.' });
      setState({ phase: 'ready', data });
    } catch {
      setState({ phase: 'error', error: 'Service indisponible.' });
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function post(url, body, label) {
    setBusy(label);
    setNote(null);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body || {}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Échec.');
      setNote({ kind: 'ok', text: label });
      await load();
    } catch (err) {
      setNote({ kind: 'err', text: err.message });
    } finally {
      setBusy('');
    }
  }

  if (state.phase === 'loading') {
    return <main className="wrap"><p className="sub">Chargement…</p></main>;
  }
  if (state.phase === 'login') return <Login onDone={load} />;
  if (state.phase === 'error') {
    return <main className="wrap"><div className="msg err">{state.error}</div></main>;
  }

  const { data } = state;

  if (!data.dbConfigured) {
    return (
      <main className="wrap">
        <h1>Administration</h1>
        <div className="msg err">
          La base de données n’est pas connectée. Ajoute une base Postgres au
          projet Vercel : la variable <code>POSTGRES_URL</code> sera injectée
          automatiquement, et les tables seront créées à la première requête.
        </div>
      </main>
    );
  }

  const { stats, run, publishedRunId, exchanges } = data;
  const isPublished = run && publishedRunId === run.id;

  return (
    <main className="wrap-wide">
      <div className="row">
        <h1 style={{ margin: 0 }}>Administration</h1>
        <span className="actions">
          <Link href="/admin/inscriptions">
            <button type="button" className="ghost small">Voir les inscriptions</button>
          </Link>
          <button className="ghost small" onClick={async () => {
            await fetch('/api/admin/logout', { method: 'POST' });
            setState({ phase: 'login' });
          }}>Se déconnecter</button>
        </span>
      </div>

      {note && <div className={`msg ${note.kind}`} style={{ marginTop: 18 }}>{note.text}</div>}

      <div className="grid" style={{ marginTop: 20 }}>
        <div className="stat"><div className="n">{stats.totalStudents}</div><div className="l">Étudiants inscrits</div></div>
        <div className="stat"><div className="n">{stats.studentsRequesting}</div><div className="l">Ont demandé un échange</div></div>
        <div className="stat"><div className="n">{stats.possibleExchanges}</div><div className="l">Échanges du dernier calcul</div></div>
        <div className="stat"><div className="n">{stats.studentsCanMove}</div><div className="l">Peuvent changer de Darty</div></div>
      </div>

      <h2>Calcul</h2>
      <div className="card">
        <div className="field">
          <label htmlFor="mc">Longueur maximale d’un échange</label>
          <select id="mc" value={maxCycleLength}
                  onChange={(e) => setMaxCycleLength(Number(e.target.value))}>
            <option value={2}>2 — échanges simples uniquement</option>
            <option value={3}>3 — jusqu’à trois personnes</option>
            <option value={4}>4 — jusqu’à quatre personnes</option>
            <option value={5}>5 — jusqu’à cinq personnes</option>
          </select>
        </div>

        <div className="actions">
          <button disabled={busy !== ''}
                  onClick={() => post('/api/admin/run',
                    { maxCycleLength, restarts: 240 },
                    'Algorithme exécuté. Les résultats ne sont pas encore publiés.')}>
            {busy.startsWith('Algorithme') ? 'Calcul…' : 'Lancer l’algorithme'}
          </button>
          <button className="ghost" disabled={busy !== '' || !run}
                  onClick={() => post('/api/admin/run',
                    { maxCycleLength, restarts: 1600 },
                    'Optimisation relancée avec plus d’itérations.')}>
            Relancer l’optimisation
          </button>
        </div>
        <p className="hint" style={{ marginTop: 10 }}>
          Un nouveau calcul crée une nouvelle proposition et remet à zéro les
          réponses des étudiants.
        </p>
      </div>

      <h2>Publication</h2>
      <div className="card">
        <div className="row">
          <div>
            <h3>
              {isPublished ? 'Résultats visibles sur /resultat' : 'Résultats masqués'}
            </h3>
            <p className="sub" style={{ margin: 0 }}>
              {run
                ? `Dernier calcul : ${new Date(run.createdAt).toLocaleString('fr-FR')}`
                : 'Aucun calcul effectué.'}
            </p>
          </div>
          <span className={`tag ${isPublished ? 'ok' : 'warn'}`}>
            {isPublished ? 'Publié' : 'Non publié'}
          </span>
        </div>
        <div className="actions" style={{ marginTop: 16 }}>
          <button disabled={busy !== '' || !run || isPublished}
                  onClick={() => post('/api/admin/publish', { published: true },
                    'Résultats publiés. Ils sont visibles sur /resultat.')}>
            Publier les résultats
          </button>
          <button className="ghost" disabled={busy !== '' || !publishedRunId}
                  onClick={() => post('/api/admin/publish', { published: false },
                    'Résultats masqués.')}>
            Masquer temporairement
          </button>
          <a href="/api/admin/export">
            <button className="ghost" type="button" disabled={!run}>Exporter en CSV</button>
          </a>
        </div>
      </div>

      <h2>Détail du dernier calcul</h2>
      {!run ? (
        <div className="card empty"><h3>Aucun calcul</h3>
          <p className="sub">Lance l’algorithme pour générer des propositions.</p></div>
      ) : exchanges.length === 0 ? (
        <div className="card empty"><h3>Aucun échange trouvé</h3>
          <p className="sub">Les préférences actuelles ne permettent aucune rotation.</p></div>
      ) : (
        exchanges.map((e) => (
          <div className="exchange" key={e.id}>
            <header>
              <span className="t">ÉCHANGE #{e.index}</span>
              <span className="actions">
                <span className="tag">{e.size} participants</span>
                <span className={`tag ${e.status === 'confirme' ? 'ok' : e.status === 'refuse' ? 'bad' : 'warn'}`}>
                  {e.status === 'confirme' ? 'Confirmé' : e.status === 'refuse' ? 'Refusé' : 'Proposé'}
                </span>
              </span>
            </header>
            <div className="body">
              {e.participants.map((p) => (
                <div className="leg" key={p.studentId}>
                  <div className="who">
                    {p.fullName}{' '}
                    <span className="tag">{p.code}</span>{' '}
                    {p.response === 'accepted' && <span className="tag ok">accepté</span>}
                    {p.response === 'refused' && <span className="tag bad">refusé</span>}
                    {p.response === 'pending' && <span className="tag">en attente</span>}
                  </div>
                  <div className="move">
                    <span>{p.fromStore}</span>
                    <span className="arrow">→</span>
                    <span className="to">{p.toStore}</span>
                    <span className="sub">(choix n°{p.preferenceRank})</span>
                  </div>
                  {p.email && <p className="hint" style={{ margin: '2px 0 0' }}>{p.email}</p>}
                </div>
              ))}
              <p className="sub" style={{ marginTop: 10, marginBottom: 0 }}>
                Statut : {e.statusLabel}
              </p>
            </div>
          </div>
        ))
      )}
    </main>
  );
}
