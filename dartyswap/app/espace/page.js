'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import '../globals.css';

function Login({ onDone }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/espace/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Code incorrect. Réessaie.');
      onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="wrap">
      <div className="gate">
        <div style={{ textAlign: 'center' }}>
          <Link href="/" className="brand">Darty<b>Swap</b></Link>
          <h1 style={{ fontSize: 26, margin: '18px 0 8px' }}>Mon résultat</h1>
          <p className="sub" style={{ marginBottom: 24 }}>
            Entre le code personnel reçu à l’inscription.
          </p>
        </div>
        {error && <div className="msg err">{error}</div>}
        <form className="card" onSubmit={submit}>
          <div className="field" style={{ marginBottom: 14 }}>
            <label htmlFor="code">Code personnel</label>
            <input id="code" type="text" autoFocus placeholder="XXXX-XXXX"
                   value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} />
          </div>
          <button type="submit" disabled={busy} style={{ width: '100%' }}>
            {busy ? 'Vérification…' : 'Voir mon résultat'}
          </button>
        </form>
        <p className="foot" style={{ textAlign: 'center' }}>
          Pas encore inscrit ? <Link href="/">Remplir le formulaire</Link>
        </p>
      </div>
    </main>
  );
}

export default function Espace() {
  const [state, setState] = useState({ phase: 'loading' });
  const [acting, setActing] = useState(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/espace/me', { cache: 'no-store' });
      if (res.status === 401) return setState({ phase: 'login' });
      const data = await res.json();
      if (!res.ok) return setState({ phase: 'error', error: data.error || 'Erreur.' });
      setState({ phase: 'ready', data });
    } catch {
      setState({ phase: 'error', error: 'Service indisponible.' });
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function respond(exchangeId, action) {
    setActing(`${exchangeId}:${action}`);
    try {
      await fetch('/api/espace/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ exchangeId, action }),
      });
      await load();
    } finally {
      setActing(null);
    }
  }

  if (state.phase === 'loading') {
    return <main className="wrap"><p className="sub">Chargement…</p></main>;
  }
  if (state.phase === 'login') return <Login onDone={load} />;
  if (state.phase === 'error') {
    return <main className="wrap"><div className="msg err">{state.error}</div></main>;
  }

  const { student, published, proposals } = state.data;

  return (
    <main className="wrap">
      <div className="row">
        <Link href="/" className="brand">Darty<b>Swap</b></Link>
        <button className="ghost small" onClick={async () => {
          await fetch('/api/espace/logout', { method: 'POST' });
          setState({ phase: 'login' });
        }}>Se déconnecter</button>
      </div>

      <h1>Bonjour {student.fullName.split(' ')[0]}</h1>

      <div className="card">
        <h3>Ma situation</h3>
        <p className="sub" style={{ margin: '2px 0 12px' }}>
          Actuellement à <strong>{student.currentStore}</strong>
        </p>
        <h3>Mes souhaits</h3>
        <ol className="prefs">
          {student.preferences.map((p) => <li key={p}>{p}</li>)}
        </ol>
      </div>

      <h2>Mes propositions d’échange</h2>

      {!published ? (
        <div className="card empty">
          <div className="lock">⏳</div>
          <h3>Résultats pas encore publiés</h3>
          <p className="sub">
            Reviens ici une fois les résultats publiés : tu pourras accepter ou
            refuser ton échange.
          </p>
        </div>
      ) : proposals.length === 0 ? (
        <div className="card empty">
          <h3>Aucun échange pour toi cette fois</h3>
          <p className="sub">
            Aucune rotation ne correspond à tes souhaits dans le dernier calcul.
          </p>
        </div>
      ) : (
        proposals.map((p) => (
          <div className="exchange" key={p.id}>
            <header>
              <span className="t">ÉCHANGE #{p.index}</span>
              <span className="actions">
                <span className="tag">{p.size} participants</span>
                {p.status === 'confirme' && <span className="tag ok">Confirmé</span>}
                {p.status === 'refuse' && <span className="tag bad">Refusé</span>}
                {p.status === 'propose' && <span className="tag warn">En attente</span>}
              </span>
            </header>
            <div className="body">
              <div className="leg">
                <div className="who">Moi</div>
                <div className="move">
                  <span>{p.fromStore}</span>
                  <span className="arrow">→</span>
                  <span className="to">{p.toStore}</span>
                </div>
              </div>
              {p.others.map((o) => (
                <div className="leg" key={o.label}>
                  <div className="who">
                    {o.label}{' '}
                    {o.response === 'accepted' && <span className="tag ok">a accepté</span>}
                    {o.response === 'refused' && <span className="tag bad">a refusé</span>}
                    {o.response === 'pending' && <span className="tag">en attente</span>}
                  </div>
                  <div className="move">
                    <span>{o.fromStore}</span>
                    <span className="arrow">→</span>
                    <span className="to">{o.toStore}</span>
                  </div>
                </div>
              ))}

              <p className="sub" style={{ marginTop: 12 }}>Statut : {p.statusLabel}</p>

              <div className="actions" style={{ marginTop: 6 }}>
                <button className="small" disabled={acting !== null || p.myResponse === 'accepted'}
                        onClick={() => respond(p.id, 'accept')}>
                  {p.myResponse === 'accepted' ? 'Tu as accepté' : 'Accepter'}
                </button>
                <button className="ghost small" disabled={acting !== null || p.myResponse === 'refused'}
                        onClick={() => respond(p.id, 'refuse')}>
                  {p.myResponse === 'refused' ? 'Tu as refusé' : 'Refuser'}
                </button>
              </div>
            </div>
          </div>
        ))
      )}

      <p className="foot">
        Un échange n’est confirmé que lorsque tous les participants l’ont
        accepté. Il reste soumis à la validation de HEC si celle-ci est
        nécessaire.
      </p>
    </main>
  );
}
