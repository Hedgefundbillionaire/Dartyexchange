// Les 36 Darty préchargés dans le formulaire, identifiés par ville + magasin.
// + l'option "Autre Darty" (saisie libre).

export const OTHER_STORE = 'Autre Darty';

export const STORES = [
  // Paris
  { magasin: 'Rivoli', ville: 'Paris 1er' },
  { magasin: 'République', ville: 'Paris 3e' },
  { magasin: 'Madeleine', ville: 'Paris 8e' },
  { magasin: 'Saint-Lazare', ville: 'Paris 8e' },
  { magasin: 'Nation', ville: 'Paris 12e' },
  { magasin: 'Daumesnil', ville: 'Paris 12e' },
  { magasin: 'BNF', ville: 'Paris 13e' },
  { magasin: 'Italie', ville: 'Paris 13e' },
  { magasin: 'Alésia', ville: 'Paris 14e' },
  { magasin: 'Beaugrenelle', ville: 'Paris 15e' },
  { magasin: 'Passy', ville: 'Paris 16e' },
  { magasin: 'Ternes', ville: 'Paris 17e' },
  { magasin: 'Montmartre', ville: 'Paris 18e' },
  { magasin: 'Belleville', ville: 'Paris 19e' },
  { magasin: 'Gambetta', ville: 'Paris 20e' },
  // Hauts-de-Seine
  { magasin: 'La Défense', ville: 'Courbevoie' },
  { magasin: 'Boulogne', ville: 'Boulogne-Billancourt' },
  { magasin: 'Levallois', ville: 'Levallois-Perret' },
  { magasin: 'Neuilly', ville: 'Neuilly-sur-Seine' },
  { magasin: 'Issy', ville: 'Issy-les-Moulineaux' },
  { magasin: 'Châtenay', ville: 'Châtenay-Malabry' },
  // Seine-Saint-Denis
  { magasin: 'Saint-Denis', ville: 'Saint-Denis' },
  { magasin: 'Bobigny', ville: 'Bobigny' },
  { magasin: 'Rosny', ville: 'Rosny-sous-Bois' },
  { magasin: 'Montreuil', ville: 'Montreuil' },
  { magasin: 'Aulnay', ville: 'Aulnay-sous-Bois' },
  // Val-de-Marne
  { magasin: 'Créteil', ville: 'Créteil' },
  { magasin: 'Bonneuil', ville: 'Bonneuil-sur-Marne' },
  { magasin: 'Vincennes', ville: 'Vincennes' },
  { magasin: 'Ivry', ville: 'Ivry-sur-Seine' },
  { magasin: 'Thiais', ville: 'Thiais' },
  // Grande couronne
  { magasin: 'Vélizy', ville: 'Vélizy-Villacoublay' },
  { magasin: 'Saint-Germain', ville: 'Saint-Germain-en-Laye' },
  { magasin: 'Villebon', ville: 'Villebon-sur-Yvette' },
  { magasin: 'Massy', ville: 'Massy' },
  { magasin: 'Cergy', ville: 'Cergy' },
];

/** Libellé unique d'un magasin : "Darty Rivoli — Paris 1er". */
export function storeLabel(store) {
  if (store.magasin === store.ville) return `Darty ${store.magasin}`;
  return `Darty ${store.magasin} — ${store.ville}`;
}

export const STORE_LABELS = STORES.map(storeLabel);

/** Villes dans l'ordre, pour grouper la liste déroulante. */
export const STORES_BY_VILLE = STORES.reduce((acc, s) => {
  const group = s.ville.startsWith('Paris') ? 'Paris' : 'Île-de-France';
  if (!acc[group]) acc[group] = [];
  acc[group].push(s);
  return acc;
}, {});

export const DIF_GROUPS = ['DIF01', 'DIF02', 'DIF03', 'DIF04'];

export const MAX_PREFS = 5;

export function isKnownStore(label) {
  return STORE_LABELS.includes(label);
}
