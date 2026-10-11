/**
 * Algorithme d'échanges multiples pour DartySwap.
 *
 * Modèle : chaque étudiant occupe un Darty (currentStore) et liste par ordre
 * de préférence les Darty qu'il souhaite rejoindre (preferences).
 *
 * On construit le graphe orienté A -> B quand A souhaite rejoindre le Darty
 * actuellement occupé par B. Un cycle A -> B -> C -> A signifie :
 *   A prend le Darty de B, B prend le Darty de C, C prend le Darty de A.
 * Chaque Darty reste occupé par exactement une personne : c'est une rotation.
 *
 * Groupes DIF01 à DIF04
 * ---------------------
 * Le groupe DIF est porté comme une donnée déclarée par l'étudiant : il est
 * stocké, affiché et exporté, mais il ne restreint pas le calcul. La règle
 * métier associée n'est pas définie ici.
 *
 * L'option `sameDifGroup` est prête si cette règle doit un jour s'appliquer :
 * la passer à true impose que tous les participants d'un cycle partagent le
 * même groupe. Elle est désactivée par défaut.
 *
 * Les effectifs par magasin sont de toute façon préservés : tout échange est
 * une permutation, donc aucun magasin ne gagne ni ne perd de poste.
 */

export const DEFAULT_OPTIONS = {
  // Règle DIF non définie : désactivée. Passer à true pour imposer que tous
  // les participants d'un cycle partagent le même groupe DIF.
  sameDifGroup: false,
  // Longueur maximale d'un cycle (2 = échange simple, 3+ = échange multiple).
  maxCycleLength: 4,
  // Nombre de tentatives randomisées pour améliorer le packing.
  restarts: 240,
};

function normalizeStore(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Enumère les cycles simples de longueur 2..maxLen dans le graphe.
 * Chaque cycle n'est retenu qu'une fois, ancré sur son plus petit index.
 */
function enumerateCycles(nodes, adjacency, maxLen) {
  const cycles = [];
  const n = nodes.length;

  for (let start = 0; start < n; start++) {
    const path = [start];
    const onPath = new Set([start]);

    const walk = (current) => {
      for (const next of adjacency[current]) {
        if (next === start) {
          if (path.length >= 2) cycles.push([...path]);
          continue;
        }
        // Ancrage : on n'explore que les noeuds d'index supérieur au départ,
        // ce qui garantit l'unicité de chaque cycle.
        if (next < start || onPath.has(next)) continue;
        if (path.length >= maxLen) continue;
        path.push(next);
        onPath.add(next);
        walk(next);
        path.pop();
        onPath.delete(next);
      }
    };

    walk(start);
  }

  return cycles;
}

/**
 * Score d'un cycle : on privilégie le nombre d'étudiants servis, puis la
 * qualité des préférences obtenues (rang 1 vaut mieux que rang 3).
 */
function scoreCycle(cycle, students, prefRank) {
  let satisfaction = 0;
  for (let i = 0; i < cycle.length; i++) {
    const mover = cycle[i];
    const target = cycle[(i + 1) % cycle.length];
    const rank = prefRank.get(`${mover}:${target}`);
    // rank 0 => premier choix. On décroît doucement.
    satisfaction += 1 / (1 + (rank ?? 0));
  }
  // Le nombre de participants domine, la satisfaction arbitre les ex aequo.
  return cycle.length * 100 + satisfaction;
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Packing glouton de cycles disjoints, avec restarts randomisés.
 */
function packCycles(cycles, scores, studentCount, restarts) {
  let best = { chosen: [], moved: 0, total: 0 };

  const order = cycles.map((_, i) => i);
  // Première passe : purement gloutonne par score décroissant.
  const greedy = [...order].sort((a, b) => scores[b] - scores[a]);

  for (let attempt = 0; attempt <= restarts; attempt++) {
    let candidateOrder;
    if (attempt === 0) {
      candidateOrder = greedy;
    } else {
      const rand = mulberry32(attempt * 2654435761);
      // Tri bruité : garde le biais vers les bons scores sans être déterministe.
      candidateOrder = [...order].sort(
        (a, b) => scores[b] + rand() * 150 - (scores[a] + rand() * 150)
      );
    }

    const used = new Uint8Array(studentCount);
    const chosen = [];
    let moved = 0;
    let total = 0;

    for (const idx of candidateOrder) {
      const cycle = cycles[idx];
      let free = true;
      for (const s of cycle) {
        if (used[s]) {
          free = false;
          break;
        }
      }
      if (!free) continue;
      for (const s of cycle) used[s] = 1;
      chosen.push(idx);
      moved += cycle.length;
      total += scores[idx];
    }

    if (moved > best.moved || (moved === best.moved && total > best.total)) {
      best = { chosen, moved, total };
    }
  }

  return best;
}

/**
 * Point d'entrée.
 *
 * students: [{ id, code, difGroup, currentStore, preferences: [store, ...] }]
 * renvoie { exchanges, stats, options }
 */
export function computeExchanges(students, userOptions = {}) {
  const options = { ...DEFAULT_OPTIONS, ...userOptions };
  const maxLen = Math.max(2, Math.min(6, options.maxCycleLength));

  const list = Array.isArray(students) ? students : [];

  // Index magasin normalisé -> occupants
  const occupants = new Map();
  list.forEach((student, i) => {
    const key = normalizeStore(student.currentStore);
    if (!key) return;
    if (!occupants.has(key)) occupants.set(key, []);
    occupants.get(key).push(i);
  });

  const adjacency = list.map(() => []);
  const prefRank = new Map();

  list.forEach((student, i) => {
    const prefs = Array.isArray(student.preferences) ? student.preferences : [];
    const currentKey = normalizeStore(student.currentStore);
    const seen = new Set();

    prefs.forEach((pref, rank) => {
      const key = normalizeStore(pref);
      if (!key || key === currentKey || seen.has(key)) return;
      seen.add(key);
      const holders = occupants.get(key);
      if (!holders) return;
      for (const j of holders) {
        if (j === i) continue;
        if (options.sameDifGroup && list[i].difGroup !== list[j].difGroup) continue;
        adjacency[i].push(j);
        const mapKey = `${i}:${j}`;
        if (!prefRank.has(mapKey)) prefRank.set(mapKey, rank);
      }
    });
  });

  const nodes = list.map((_, i) => i);
  const cycles = enumerateCycles(nodes, adjacency, maxLen);
  const scores = cycles.map((c) => scoreCycle(c, list, prefRank));
  const packed = packCycles(cycles, scores, list.length, options.restarts);

  const exchanges = packed.chosen.map((idx, n) => {
    const cycle = cycles[idx];
    const participants = cycle.map((memberIdx, i) => {
      const student = list[memberIdx];
      const target = list[cycle[(i + 1) % cycle.length]];
      return {
        studentId: student.id,
        difGroup: student.difGroup,
        fromStore: student.currentStore,
        toStore: target.currentStore,
        preferenceRank: (prefRank.get(`${cycle[i]}:${cycle[(i + 1) % cycle.length]}`) ?? 0) + 1,
      };
    });
    return {
      index: n + 1,
      size: cycle.length,
      type: cycle.length === 2 ? 'simple' : 'multiple',
      difGroup: participants[0].difGroup,
      participants,
    };
  });

  const requested = list.filter(
    (s) => Array.isArray(s.preferences) && s.preferences.length > 0
  ).length;

  return {
    options: { ...options, maxCycleLength: maxLen },
    exchanges,
    stats: {
      totalStudents: list.length,
      studentsRequesting: requested,
      possibleExchanges: exchanges.length,
      studentsCanMove: packed.moved,
    },
  };
}
