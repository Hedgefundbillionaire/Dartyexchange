# DartySwap

Échange de magasins Darty entre étudiants HEC. Next.js 14 + Postgres.

## Ce que fait l'app

- **`/`** — formulaire d'inscription : les 36 Darty de la promotion
  (magasin + ville), adresse mail obligatoire, jusqu'à 5 souhaits classés.
  **Liste fermée** : seuls ces 36 magasins sont acceptés, côté client comme
  côté serveur. La liste vit dans `lib/stores.js`, qui en est l'unique source.
  Renvoie un **code personnel** (ex. `WQ2X-6D2Q`) qui sert de login.
- **`/espace`** — l'étudiant entre son code, voit sa proposition d'échange et
  **accepte ou refuse**. Les autres participants restent anonymes.
- **`/resultat`** — page privée protégée par mot de passe partagé. Dashboard
  (inscrits / demandeurs / échanges / mobiles) + liste des échanges avec des
  **identifiants anonymisés** (Étudiant A, B, C). Jamais de noms ni de contacts.
- **`/admin`** — lancer l'algorithme, relancer l'optimisation, publier,
  masquer, exporter en CSV. Seul endroit où les noms apparaissent.

**Aucun email n'est envoyé nulle part.** Il n'y a aucune dépendance d'envoi
dans le projet. L'adresse mail est demandée à l'inscription pour identifier
l'étudiant et permettre à l'administration de le joindre — elle n'est visible
que dans `/admin` et dans l'export CSV.

## Algorithme

Chaque étudiant occupe un magasin et classe ceux qu'il veut. On construit le
graphe `A -> B` (A veut le magasin de B) et on cherche des **cycles** de 2 à 5
personnes : un cycle est une rotation où chaque magasin reste occupé par
exactement une personne. Les cycles disjoints sont empaquetés par un glouton
avec restarts randomisés, en maximisant d'abord le nombre d'étudiants servis,
puis la qualité des voeux obtenus.

Tests : `node scripts/test-matching.mjs` (37 cas).

## Stockage : Google Sheets

Les données vivent dans un Google Sheet (onglets **Inscriptions**, **Calculs**,
**Échanges**, créés automatiquement). L'app y accède via un petit script Apps
Script attaché au Sheet et déployé en application Web : `apps-script/Code.gs`.

Mise en place, une fois :
1. Dans le Sheet : Extensions → Apps Script, coller `apps-script/Code.gs`.
2. Déployer → Nouveau déploiement → Application Web ;
   exécuter en tant que **Moi**, accès **Tout le monde** ; autoriser.
3. Copier l'URL `…/exec` dans Vercel, variable `SHEETS_URL`, puis redéployer.

L'URL de déploiement est la clé d'accès : elle ne doit pas sortir de Vercel.
Le Sheet n'a pas besoin d'être partagé publiquement — le script s'exécute en
ton nom.

## Variables d'environnement

| Variable | Rôle |
|---|---|
| `RESULTS_PASSWORD` | code partagé de `/resultat` et de l'écran Mon résultat |
| `ADMIN_PASSWORD` | mot de passe de `/admin` |
| `SESSION_SECRET` | clé de signature des cookies de session (64 hex) |
| `SHEETS_URL` | URL `…/exec` du script Apps Script |

Les mots de passe sont vérifiés côté serveur uniquement. Les sessions sont des
cookies httpOnly signés en HMAC-SHA256. `/resultat`, `/admin` et `/espace`
renvoient `X-Robots-Tag: noindex` et sont exclus de `robots.txt`.
