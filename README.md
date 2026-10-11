# DartySwap

Échange de magasins Darty entre étudiants HEC. Next.js 14 + Postgres.

## Ce que fait l'app

- **`/`** — formulaire d'inscription : 36 Darty préchargés (ville + magasin),
  option « Autre Darty » en saisie libre, groupe DIF, jusqu'à 5 souhaits classés.
  Renvoie un **code personnel** (ex. `WQ2X-6D2Q`) qui sert de login.
- **`/espace`** — l'étudiant entre son code, voit sa proposition d'échange et
  **accepte ou refuse**. Les autres participants restent anonymes.
- **`/resultat`** — page privée protégée par mot de passe partagé. Dashboard
  (inscrits / demandeurs / échanges / mobiles) + liste des échanges avec des
  **identifiants anonymisés** (Étudiant A, B, C). Jamais de noms ni de contacts.
- **`/admin`** — lancer l'algorithme, relancer l'optimisation, publier,
  masquer, exporter en CSV. Seul endroit où les noms apparaissent.

**Aucun email n'est envoyé nulle part.** Il n'y a aucune dépendance d'envoi
dans le projet.

## Algorithme

Chaque étudiant occupe un magasin et classe ceux qu'il veut. On construit le
graphe `A -> B` (A veut le magasin de B) et on cherche des **cycles** de 2 à 5
personnes : un cycle est une rotation où chaque magasin reste occupé par
exactement une personne. Les cycles disjoints sont empaquetés par un glouton
avec restarts randomisés, en maximisant d'abord le nombre d'étudiants servis,
puis la qualité des voeux obtenus.

Tests : `node scripts/test-matching.mjs` (37 cas).

## Groupes DIF01–DIF04

Portés comme donnée déclarée : stockés, affichés, exportés. **Aucune règle
métier n'est imposée** sur eux, la règle n'ayant pas été spécifiée. Une case
dans `/admin` permet d'exiger que tous les participants d'un échange partagent
le même groupe DIF — décochée par défaut. Sur un jeu de 150 étudiants, l'activer
fait passer la mobilité de 138 à 82.

## Variables d'environnement

| Variable | Rôle |
|---|---|
| `RESULTS_PASSWORD` | mot de passe de `/resultat` (partagé aux étudiants) |
| `ADMIN_PASSWORD` | mot de passe de `/admin` |
| `SESSION_SECRET` | clé de signature des cookies de session (64 hex) |
| `POSTGRES_URL` | injectée par l'intégration Postgres de Vercel |

Le mot de passe est vérifié **côté serveur** uniquement : il n'apparaît ni dans
le bundle client ni dans le HTML. Les sessions sont des cookies httpOnly signés
en HMAC-SHA256. `/resultat`, `/admin` et `/espace` renvoient `X-Robots-Tag:
noindex` et sont exclus de `robots.txt`.

Les tables sont créées automatiquement à la première requête.

## Local

```bash
npm install
cp .env.example .env.local   # remplir les valeurs
npm run dev
```
