import { computeExchanges } from '../lib/matching.js';

let pass = 0, fail = 0;
function check(name, cond, extra='') {
  if (cond) { pass++; console.log(`  ok   ${name}`); }
  else { fail++; console.log(`  FAIL ${name} ${extra}`); }
}

function S(id, cur, prefs) {
  return { id, code: id, currentStore: cur, preferences: prefs };
}

// 1. Échange simple A<->B
console.log('\n1. Échange simple');
{
  const r = computeExchanges([
    S('A','Darty Créteil',['Darty République']),
    S('B','Darty République',['Darty Créteil']),
  ]);
  check('1 échange trouvé', r.exchanges.length === 1, JSON.stringify(r.stats));
  check('2 participants', r.exchanges[0]?.size === 2);
  check('2 étudiants mobiles', r.stats.studentsCanMove === 2);
  const p = r.exchanges[0].participants;
  const a = p.find(x=>x.studentId==='A');
  check('A va à République', a.toStore === 'Darty République', a.toStore);
  const b = p.find(x=>x.studentId==='B');
  check('B va à Créteil', b.toStore === 'Darty Créteil', b.toStore);
}

// 2. Cycle à 3
console.log('\n2. Cycle à 3 (échange multiple)');
{
  const r = computeExchanges([
    S('A','Darty Nation',['Darty Belleville']),
    S('B','Darty Belleville',['Darty Madeleine']),
    S('C','Darty Madeleine',['Darty Nation']),
  ]);
  check('1 cycle', r.exchanges.length === 1);
  check('taille 3', r.exchanges[0]?.size === 3);
  check('type multiple', r.exchanges[0]?.type === 'multiple');
  check('3 mobiles', r.stats.studentsCanMove === 3);
  // vérifie la permutation : chaque magasin de départ est repris une fois
  const p = r.exchanges[0].participants;
  const froms = p.map(x=>x.fromStore).sort();
  const tos = p.map(x=>x.toStore).sort();
  check('permutation valide', JSON.stringify(froms)===JSON.stringify(tos), froms+' vs '+tos);
}

// 3. Aucun échange possible
console.log('\n3. Aucun échange possible');
{
  const r = computeExchanges([
    S('A','Darty Nation',['Darty Cergy']),   // personne à Cergy
    S('B','Darty Belleville',['Darty Thiais']),
  ]);
  check('0 échange', r.exchanges.length === 0);
  check('0 mobile', r.stats.studentsCanMove === 0);
  check('2 demandeurs', r.stats.studentsRequesting === 2);
}

// 5. Cycles disjoints : un étudiant ne peut pas être dans 2 échanges
console.log('\n5. Disjonction');
{
  const r = computeExchanges([
    S('A','S1',['S2']), S('B','S2',['S1']),
    S('C','S3',['S4']), S('D','S4',['S3']),
  ]);
  check('2 échanges', r.exchanges.length === 2, JSON.stringify(r.stats));
  const ids = r.exchanges.flatMap(e=>e.participants.map(p=>p.studentId));
  check('aucun doublon', new Set(ids).size === ids.length);
  check('4 mobiles', r.stats.studentsCanMove === 4);
}

// 6. Respect de maxCycleLength
console.log('\n6. Longueur max de cycle');
{
  const roster = [
    S('A','S1',['S2']), S('B','S2',['S3']),
    S('C','S3',['S4']), S('D','S4',['S5']), S('E','S5',['S1']),
  ]; // cycle de longueur 5 uniquement
  const r4 = computeExchanges(roster, { maxCycleLength: 4 });
  check('cycle de 5 rejeté si max=4', r4.exchanges.length === 0, JSON.stringify(r4.stats));
  const r5 = computeExchanges(roster, { maxCycleLength: 5 });
  check('cycle de 5 accepté si max=5', r5.exchanges.length === 1 && r5.exchanges[0].size===5);
}

// 7. Préférence ordonnée : le 1er choix doit primer
console.log('\n7. Ordre des préférences');
{
  // A préfère S2 (rang1) puis S3 (rang2). Les deux sont disponibles en cycle.
  const r = computeExchanges([
    S('A','S1',['S2','S3']),
    S('B','S2',['S1']),
    S('C','S3',['S1']),
  ]);
  check('1 échange', r.exchanges.length === 1);
  const a = r.exchanges[0].participants.find(x=>x.studentId==='A');
  check('A obtient son 1er choix S2', a.toStore === 'S2', a.toStore);
  check('rang 1 rapporté', a.preferenceRank === 1, String(a.preferenceRank));
}

// 8. Maximiser le nombre de personnes servies
console.log('\n8. Maximisation');
{
  // Soit A<->B (2 pers), soit A->C->D->A (3 pers). Doit choisir le cycle de 3.
  const r = computeExchanges([
    S('A','S1',['S3','S2']),
    S('B','S2',['S1']),
    S('C','S3',['S4']),
    S('D','S4',['S1']),
  ]);
  check('3 mobiles plutôt que 2', r.stats.studentsCanMove === 3, JSON.stringify(r.stats));
}

// 9. "Autre Darty" en texte libre
console.log('\n9. Autre Darty (texte libre)');
{
  const r = computeExchanges([
    S('A','Darty Meaux (autre)',['Darty Créteil']),
    S('B','Darty Créteil',['Darty Meaux (autre)']),
  ]);
  check('échange sur magasin libre', r.exchanges.length === 1);
}

// 10. Normalisation (casse / espaces)
console.log('\n10. Normalisation');
{
  const r = computeExchanges([
    S('A','Darty Créteil',['  darty   RÉPUBLIQUE  ']),
    S('B','Darty République',['DARTY CRÉTEIL']),
  ]);
  check('casse et espaces tolérés', r.exchanges.length === 1);
}

// 11. Pas d'auto-échange, pas de préférence = magasin actuel
console.log('\n11. Cas dégénérés');
{
  const r = computeExchanges([ S('A','S1',['S1','S1']) ]);
  check('aucun auto-échange', r.exchanges.length === 0);
  const r2 = computeExchanges([]);
  check('liste vide ok', r2.exchanges.length === 0 && r2.stats.totalStudents === 0);
  const r3 = computeExchanges([S('A','S1',[]), S('B','S2',[])]);
  check('0 demandeur', r3.stats.studentsRequesting === 0);
}

// 12. Deux étudiants dans le même magasin
console.log('\n12. Même magasin, deux occupants');
{
  const r = computeExchanges([
    S('A','S1',['S2']),
    S('B','S1',['S2']),
    S('C','S2',['S1']),
  ]);
  check('un seul des deux part', r.exchanges.length === 1 && r.stats.studentsCanMove === 2, JSON.stringify(r.stats));
}

// 13. Charge : 150 étudiants
console.log('\n13. Performance (150 étudiants)');
{
  const stores = Array.from({length:36},(_,i)=>`Darty ${i}`);
  const rand = (() => { let a = 12345; return () => (a = (a*1103515245+12345) & 0x7fffffff) / 0x7fffffff; })();
  const roster = [];
  for (let i=0;i<150;i++){
    const cur = stores[Math.floor(rand()*36)];
    const prefs = [];
    while (prefs.length < 3) {
      const c = stores[Math.floor(rand()*36)];
      if (c !== cur && !prefs.includes(c)) prefs.push(c);
    }
    roster.push(S('E'+i, cur, prefs));
  }
  const t0 = Date.now();
  const r = computeExchanges(roster);
  const ms = Date.now()-t0;
  console.log(`     ${r.exchanges.length} échanges, ${r.stats.studentsCanMove}/150 mobiles, ${ms}ms`);
  check('termine en < 10s', ms < 10000, ms+'ms');
  check('trouve des échanges', r.exchanges.length > 0);
  const ids = r.exchanges.flatMap(e=>e.participants.map(p=>p.studentId));
  check('aucun doublon à l\'échelle', new Set(ids).size === ids.length);
  let okPerm = true;
  for (const e of r.exchanges) {
    const f = e.participants.map(x=>x.fromStore).sort();
    const t = e.participants.map(x=>x.toStore).sort();
    if (JSON.stringify(f)!==JSON.stringify(t)) okPerm = false;
  }
  check('toutes rotations valides', okPerm);
  let okWish = true;
  const byId = new Map(roster.map(s=>[s.id,s]));
  for (const e of r.exchanges) for (const p of e.participants) {
    if (!byId.get(p.studentId).preferences.includes(p.toStore)) okWish = false;
  }
  check('chaque mouvement correspond à un voeu', okWish);
}

console.log(`\n${pass} passés, ${fail} échoués`);
process.exit(fail ? 1 : 0);
