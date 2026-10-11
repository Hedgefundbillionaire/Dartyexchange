/**
 * DartySwap — pont entre l'app et ce Google Sheet.
 *
 * À coller dans : Extensions → Apps Script (depuis le Sheet).
 * Puis : Déployer → Nouveau déploiement → Application Web
 *        Exécuter en tant que : Moi · Accès : Tout le monde.
 * L'URL obtenue (…/exec) va dans Vercel, variable SHEETS_URL.
 *
 * L'URL de déploiement est la seule clé d'accès : ne la partage pas.
 * Le Sheet lui-même n'a pas besoin d'être partagé publiquement.
 */

var TABS = {
  students: {
    name: 'Inscriptions',
    headers: ['ID', 'Code', 'Nom', 'Email', 'Darty actuel',
              'Choix 1', 'Choix 2', 'Choix 3', 'Choix 4', 'Choix 5', 'Inscrit le'],
  },
  runs: {
    name: 'Calculs',
    headers: ['ID', 'Lancé le', 'Publié', 'Longueur max',
              'Inscrits', 'Demandeurs', 'Échanges', 'Mobiles'],
  },
  parts: {
    name: 'Échanges',
    headers: ['Calcul', 'Échange', 'Taille', 'Position', 'ID étudiant', 'Nom',
              'Darty actuel', 'Darty attribué', 'Rang', 'Réponse', 'Répondu le'],
  },
};

function tab_(key) {
  var def = TABS[key];
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(def.name);
  if (!sh) sh = ss.insertSheet(def.name);
  if (sh.getLastRow() === 0) {
    var head = sh.getRange(1, 1, 1, def.headers.length);
    head.setNumberFormat('@').setValues([def.headers]).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}

function rows_(key) {
  var sh = tab_(key);
  var n = sh.getLastRow();
  if (n < 2) return [];
  return sh.getRange(2, 1, n - 1, TABS[key].headers.length).getDisplayValues();
}

// Écrit des lignes en texte brut : « 2345-6789 » ne doit pas devenir une date.
function append_(key, values) {
  if (!values.length) return;
  var sh = tab_(key);
  var start = sh.getLastRow() + 1;
  var cols = TABS[key].headers.length;
  sh.getRange(start, 1, values.length, cols).setNumberFormat('@').setValues(values);
}

function nextId_(rows) {
  var max = 0;
  for (var i = 0; i < rows.length; i++) {
    var v = parseInt(rows[i][0], 10);
    if (v > max) max = v;
  }
  return max + 1;
}

function handle_(b) {
  switch (b.action) {
    case 'getAll':
      return { students: rows_('students'), runs: rows_('runs'), parts: rows_('parts') };

    case 'addStudent': {
      var rows = rows_('students');
      for (var i = 0; i < rows.length; i++) {
        if (rows[i][1] === b.code) throw new Error('CODE_DUPLIQUE');
      }
      var id = nextId_(rows);
      var p = (b.preferences || []).concat(['', '', '', '', '']).slice(0, 5);
      append_('students', [[String(id), b.code, b.fullName, b.email, b.currentStore,
                            p[0], p[1], p[2], p[3], p[4], b.at]]);
      return { id: id };
    }

    case 'addRun': {
      var runs = rows_('runs');
      var runId = nextId_(runs);
      // Les lignes d'échanges d'abord, le calcul ensuite : un lecteur ignore
      // les échanges dont le calcul n'existe pas encore.
      append_('parts', (b.parts || []).map(function (x) {
        return [String(runId), String(x.exchange), String(x.size), String(x.position),
                String(x.studentId), x.fullName, x.fromStore, x.toStore,
                String(x.rank), 'en attente', ''];
      }));
      var s = b.stats || {};
      append_('runs', [[String(runId), b.at, 'non', String(b.maxLen),
                        String(s.totalStudents), String(s.studentsRequesting),
                        String(s.possibleExchanges), String(s.studentsCanMove)]]);
      return { runId: runId };
    }

    case 'setPublished': {
      var sh = tab_('runs');
      var data = rows_('runs');
      for (var r = 0; r < data.length; r++) {
        var on = b.runId !== null && String(b.runId) === data[r][0];
        sh.getRange(r + 2, 3).setNumberFormat('@').setValue(on ? 'oui' : 'non');
      }
      return {};
    }

    case 'respond': {
      var shp = tab_('parts');
      var parts = rows_('parts');
      var updated = 0;
      for (var k = 0; k < parts.length; k++) {
        if (parts[k][0] === String(b.runId) && parts[k][1] === String(b.exchange)
            && parts[k][4] === String(b.studentId)) {
          shp.getRange(k + 2, 10, 1, 2).setNumberFormat('@').setValues([[b.response, b.at]]);
          updated++;
        }
      }
      return { updated: updated };
    }

    default:
      throw new Error('ACTION_INCONNUE');
  }
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  var body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return json_({ ok: false, error: 'JSON_INVALIDE' });
  }
  // Les lectures ne prennent pas le verrou : les écritures sont ordonnées
  // pour rester cohérentes, et 118 étudiants qui chargent leur page en même
  // temps ne doivent pas faire la queue.
  var needsLock = body.action !== 'getAll';
  var lock = LockService.getScriptLock();
  try {
    if (needsLock) lock.waitLock(25000);
    var out = handle_(body);
    out.ok = true;
    return json_(out);
  } catch (err) {
    return json_({ ok: false, error: String((err && err.message) || err) });
  } finally {
    if (needsLock) { try { lock.releaseLock(); } catch (x) {} }
  }
}

// Permet de vérifier l'URL dans un navigateur.
function doGet() {
  return json_({ ok: true, service: 'dartyswap-sheets' });
}
