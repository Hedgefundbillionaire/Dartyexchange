// Les 36 Darty de la promotion, identifiés par magasin + ville.
// Liste fermée : l'étudiant ne peut choisir que dans celle-ci.
// Source : liste d'affectation fournie par l'administration.

export const STORES = [
  // Paris
  { magasin: 'Alésia', ville: 'Paris' },
  { magasin: 'Batignolles', ville: 'Paris' },
  { magasin: 'Beaugrenelle', ville: 'Paris' },
  { magasin: 'Belleville', ville: 'Paris' },
  { magasin: 'BNF', ville: 'Paris' },
  { magasin: 'Forum', ville: 'Paris' },
  { magasin: 'Madeleine', ville: 'Paris' },
  { magasin: 'Montparnasse', ville: 'Paris' },
  { magasin: 'Nation', ville: 'Paris' },
  { magasin: 'Passy 2', ville: 'Paris' },
  { magasin: 'République', ville: 'Paris' },
  { magasin: 'Saint-Ouen', ville: 'Paris' },
  { magasin: 'Ternes', ville: 'Paris' },
  // Petite couronne
  { magasin: 'Arcueil', ville: 'Arcueil' },
  { magasin: 'Bondy', ville: 'Bondy' },
  { magasin: 'Bonneuil', ville: 'Bonneuil-sur-Marne' },
  { magasin: 'Boulogne', ville: 'Boulogne-Billancourt' },
  { magasin: 'Châtillon', ville: 'Châtillon' },
  { magasin: 'Créteil', ville: 'Créteil' },
  { magasin: 'Fresnes', ville: 'Fresnes' },
  { magasin: 'Gennevilliers', ville: 'Gennevilliers' },
  { magasin: 'La Défense', ville: 'Puteaux' },
  { magasin: 'Ormesson', ville: 'Chennevières-sur-Marne' },
  { magasin: 'Parinor', ville: 'Aulnay-sous-Bois' },
  { magasin: 'Rosny', ville: 'Rosny-sous-Bois' },
  { magasin: 'Rungis', ville: 'Thiais' },
  // Grande couronne
  { magasin: 'Clos du Chêne', ville: 'Montévrain' },
  { magasin: 'Herblay', ville: 'Herblay-sur-Seine' },
  { magasin: 'Orgeval', ville: 'Villennes-sur-Seine' },
  { magasin: 'Parly 2', ville: 'Le Chesnay' },
  { magasin: 'Plaisir', ville: 'Plaisir' },
  { magasin: 'Saint-Brice', ville: 'Saint-Brice-sous-Forêt' },
  { magasin: 'Sainte-Geneviève', ville: 'Sainte-Geneviève-des-Bois' },
  { magasin: 'Sartrouville', ville: 'Sartrouville' },
  { magasin: 'Torcy', ville: 'Marne-la-Vallée' },
  { magasin: 'Villebon', ville: 'Villebon-sur-Yvette' },
];

/** Libellé unique : "Darty Alésia — Paris", ou "Darty Créteil" si ville = magasin. */
export function storeLabel(store) {
  if (store.magasin === store.ville) return `Darty ${store.magasin}`;
  return `Darty ${store.magasin} — ${store.ville}`;
}

export const STORE_LABELS = STORES.map(storeLabel);

/** Regroupement pour la liste déroulante. */
export const STORES_BY_ZONE = STORES.reduce((acc, s) => {
  const zone = s.ville === 'Paris' ? 'Paris' : 'Île-de-France';
  if (!acc[zone]) acc[zone] = [];
  acc[zone].push(s);
  return acc;
}, {});

export const MAX_PREFS = 5;

/** Liste fermée : tout magasin hors liste est refusé. */
export function isKnownStore(label) {
  return STORE_LABELS.includes(label);
}
