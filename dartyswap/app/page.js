'use client';

import { useState } from 'react';
import Link from 'next/link';
import './globals.css';
import { STORES_BY_ZONE, storeLabel, MAX_PREFS } from '../lib/stores';

const EMPTY_PREFS = Array(MAX_PREFS).fill('');

function StoreOptions() {
  return (
    <>
      {Object.entries(STORES_BY_ZONE).map(([zone, stores]) => (
        <optgroup key={zone} label={zone}>
          {stores.map((st) => {
            const label = storeLabel(st);
            return <option key={label} value={label}>{label}</option>;
          })}
        </optgroup>
      ))}
    </>
  );
}


export default function Home() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [currentStore, setCurrentStore] = useState('');
  const [prefs, setPrefs] = useState(EMPTY_PREFS);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [code, setCode] = useState('');

  async function submit(e) {
    e.preventDefault();
    setError('');

    const resolvedPrefs = prefs.filter(Boolean);

    if (!currentStore) return setError('Indique ton Darty actuel.');
    if (resolvedPrefs.length === 0) return setError('Indique au moins un Darty souhaité.');

    setBusy(true);
    try {
      const res = await fetch('/api/inscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName,
          email,
          currentStore,
          preferences: resolvedPrefs,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur.');
      setCode(data.code);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (code) {
    return (
      <main className="wrap">
        <Link href="/" className="brand">Darty<b>Swap</b></Link>
        <h1>Inscription enregistrée</h1>
        <p className="lead">
          Voici ton code personnel. Il te servira à ouvrir ton espace et à
          accepter ou refuser un échange. Note-le maintenant : aucun email
          n’est envoyé.
        </p>
        <div className="code">{code}</div>
        <div className="actions">
          <Link href="/espace"><button>Ouvrir mon espace</button></Link>
          <button className="ghost" onClick={() => navigator.clipboard?.writeText(code)}>
            Copier le code
          </button>
        </div>
        <p className="foot">
          Les propositions d’échange apparaîtront dans ton espace une fois les
          résultats publiés.
        </p>
      </main>
    );
  }

  return (
    <main className="wrap">
      <Link href="/" className="brand">Darty<b>Swap</b></Link>
      <h1>Échange ton Darty</h1>
      <p className="lead">
        Indique ton magasin actuel et ceux qui t’arrangeraient. L’algorithme
        cherche des échanges à deux, trois ou quatre personnes. Tout se consulte
        ici : aucune notification par email.
      </p>

      {error && <div className="msg err">{error}</div>}

      <form className="card" onSubmit={submit}>
        <div className="field">
          <label htmlFor="n">Nom complet</label>
          <input id="n" type="text" required maxLength={100} value={fullName}
                 onChange={(e) => setFullName(e.target.value)} />
        </div>

        <div className="field">
          <label htmlFor="c">Adresse mail</label>
          <input id="c" type="email" required maxLength={120} value={email}
                 placeholder="prenom.nom@hec.edu"
                 onChange={(e) => setEmail(e.target.value)} />
        </div>

        <div className="field">
          <label htmlFor="s">Mon Darty actuel</label>
          <select id="s" required value={currentStore} onChange={(e) => setCurrentStore(e.target.value)}>
            <option value="">Choisir…</option>
            <StoreOptions />
          </select>
        </div>

        <h2 style={{ marginTop: 28 }}>Darty souhaités</h2>
        <p className="sub" style={{ marginTop: -8, marginBottom: 14 }}>
          Par ordre de préférence. Le premier est ton premier choix.
        </p>

        {prefs.map((value, i) => (
          <div className="field" key={i}>
            <label htmlFor={`p${i}`}>Choix {i + 1}{i > 0 && ' (optionnel)'}</label>
            <select id={`p${i}`} value={value} required={i === 0}
                    onChange={(e) => {
                      const next = [...prefs];
                      next[i] = e.target.value;
                      setPrefs(next);
                    }}>
              <option value="">{i === 0 ? 'Choisir…' : '—'}</option>
              <StoreOptions />
            </select>
          </div>
        ))}

        <div className="actions" style={{ marginTop: 22 }}>
          <button type="submit" disabled={busy}>
            {busy ? 'Enregistrement…' : 'M’inscrire'}
          </button>
          <Link href="/espace" className="sub">J’ai déjà un code</Link>
        </div>
      </form>

      <p className="foot">
        Un échange n’est confirmé que lorsque tous les participants l’ont
        accepté. Il reste soumis à la validation de HEC si celle-ci est
        nécessaire.
      </p>
    </main>
  );
}
