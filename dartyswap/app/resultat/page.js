'use client';

import { useEffect, useState, useCallback } from 'react';
import '../globals.css';


function Gate({ onUnlocked }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/resultat/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Mot de passe incorrect. Réessaie.');
      onUnlocked();
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
          <div className="lock">🔒</div>
          <h1 style={{ fontSize: 26, margin: '0 0 8px' }}>Résultats DartySwap</h1>
          <p className="sub" style={{ marginBottom: 24 }}>
            Entre le mot de passe pour découvrir les échanges.
          </p>
        </div>
        {error && <div className="msg err">{error}</div>}
        <form className="card" onSubmit={submit}>
          <div className="field" style={{ marginBottom: 14 }}>
            <label htmlFor="pw">Mot de passe</label>
            <input id="pw" type="password" autoFocus autoComplete="current-password"
                   value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <button type="submit" disabled={busy} style={{ width: '100%' }}>
            {busy ? 'Vérification…' : 'Voir les résultats'}
          </button>
        </form>
      </div>
    </main>
  );
}

function statusTag(status) {
  if (status === 'confirme') return <span className="tag ok">Confirmé</span>;
  if (status === 'refuse') return <span className="tag bad">Refusé</span>;
  return <span className="tag warn">Proposé</span>;
}

export default function Resultat() {
  const [state, setState] = useState({ phase: 'loading' });

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/resultat/data', { cache: 'no-store' });
      if (res.status === 401) return setState({ phase: 'locked' });
      const data = await res.json();
      if (!res.ok) return setState({ phase: 'error', error: data.error || 'Erreur.' });
      setState({ phase: 'ready', data });
    } catch {
      setState({ phase: 'error', error: 'Service indisponible.' });
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (state.phase === 'loading') {
    return <main className="wrap"><p className="sub">Chargement…</p></main>;
  }
  if (state.phase === 'locked') return <Gate onUnlocked={load} />;
  if (state.phase === 'error') {
    return <main className="wrap"><div className="msg err">{state.error}</div></main>;
  }

  const { data } = state;

  if (!data.published) {
    return (
      <main className="wrap">
        <h1>Résultats DartySwap</h1>
        <div className="card empty">
          <div className="lock">⏳</div>
          <h3>Les résultats ne sont pas encore publiés</h3>
          <p className="sub">Reviens une fois que l’administrateur les aura publiés.</p>
        </div>
      </main>
    );
  }

  const { stats, exchanges } = data;

  return (
    <main className="wrap-wide">
      <div className="row">
        <h1 style={{ margin: 0 }}>Résultats DartySwap</h1>
        <button className="ghost small" onClick={async () => {
          await fetch('/api/resultat/logout', { method: 'POST' });
          setState({ phase: 'locked' });
        }}>Quitter</button>
      </div>
      <p className="lead" style={{ marginTop: 10 }}>
        Résultats réels de l’algorithme. Les étudiants sont anonymisés.
      </p>

      <div className="grid">
        <div className="stat"><div className="n">{stats.totalStudents}</div><div className="l">Étudiants inscrits</div></div>
        <div className="stat"><div className="n">{stats.studentsRequesting}</div><div className="l">Ont demandé un échange</div></div>
        <div className="stat"><div className="n">{stats.possibleExchanges}</div><div className="l">Échanges possibles</div></div>
        <div className="stat"><div className="n">{stats.studentsCanMove}</div><div className="l">Peuvent changer de Darty</div></div>
      </div>

      <h2>Échanges trouvés 🔄</h2>

      {exchanges.length === 0 ? (
        <div className="card empty">
          <h3>Aucun échange trouvé</h3>
          <p className="sub">
            Les préférences actuelles ne permettent aucune rotation. Plus
            d’inscriptions augmentent les chances.
          </p>
        </div>
      ) : (
        exchanges.map((e) => (
          <div className="exchange" key={e.index}>
            <header>
              <span className="t">ÉCHANGE #{e.index}</span>
              <span className="actions">
                <span className="tag">{e.size} participants</span>
                {statusTag(e.status)}
              </span>
            </header>
            <div className="body">
              {e.participants.map((p) => (
                <div className="leg" key={p.label}>
                  <div className="who">{p.label}</div>
                  <div className="move">
                    <span>{p.fromStore}</span>
                    <span className="arrow">→</span>
                    <span className="to">{p.toStore}</span>
                  </div>
                </div>
              ))}
              <p className="sub" style={{ marginTop: 10, marginBottom: 0 }}>
                Statut : {e.statusLabel}
              </p>
            </div>
          </div>
        ))
      )}

      <p className="foot">
        Un échange n’est confirmé que lorsque tous ses participants l’ont
        accepté dans leur espace. Il reste soumis à la validation de HEC si
        celle-ci est nécessaire. Aucun nom ni contact n’est exposé sur cette
        page.
      </p>
    </main>
  );
}
