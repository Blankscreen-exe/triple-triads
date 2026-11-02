/**
 * Default generic cards and starter decks, inserted on first startup so the game is playable out
 * of the box. Most are placeholders until the owner supplies art; afterwards the catalogue is
 * managed from the admin panel.
 *
 * Every starter deck must satisfy the deck rules; `starter-content.test.ts` enforces this.
 */
import { rankCard, type Element, type StatValue } from '@triple-triad/engine';

export interface StarterCard {
  readonly id: string;
  readonly name: string;
  /** [top, right, bottom, left] */
  readonly stats: readonly [StatValue, StatValue, StatValue, StatValue];
  readonly element: Element | null;
  /** The card's art, a file name in assets/starter-art without extension; null for none yet. */
  readonly art: string | null;
}

export interface StarterDeck {
  readonly id: string;
  readonly name: string;
  readonly isDefault: boolean;
  /** Card id → number of copies. */
  readonly cards: Readonly<Record<string, number>>;
}

const card = (
  slug: string,
  name: string,
  stats: StarterCard['stats'],
  element: Element | null = null,
): StarterCard => ({ id: `generic-${slug}`, name, stats, element, art: null });

/** A card with a portrait, in assets/starter-art/<slug>.webp. */
const portrait = (
  slug: string,
  name: string,
  stats: StarterCard['stats'],
  element: Element | null = null,
): StarterCard => ({ ...card(slug, name, stats, element), art: slug });

const GENERIC_CARDS: readonly StarterCard[] = [
  // ★
  card('sand-lizard', 'Sand Lizard', [1, 4, 1, 5]),
  card('spore-cap', 'Spore Cap', [5, 1, 1, 3]),
  card('field-mouse', 'Field Mouse', [2, 3, 4, 2]),
  card('glow-moth', 'Glow Moth', [2, 5, 3, 1]),
  card('bog-beetle', 'Bog Beetle', [3, 5, 2, 1], 'poison'),
  card('pebble-golem', 'Pebble Golem', [4, 2, 4, 2], 'earth'),
  // ★★
  card('ember-imp', 'Ember Imp', [6, 3, 5, 4], 'fire'),
  card('frost-wisp', 'Frost Wisp', [4, 6, 2, 7], 'ice'),
  card('storm-hawk', 'Storm Hawk', [7, 2, 6, 5], 'thunder'),
  card('lantern-ghost', 'Lantern Ghost', [2, 7, 7, 3]),
  card('prickle-jack', 'Prickle Jack', [6, 2, 6, 3], 'earth'),
  card('reef-crab', 'Reef Crab', [5, 6, 3, 4], 'water'),
  card('thorn-wolf', 'Thorn Wolf', [6, 5, 2, 5]),
  // ★★★
  card('iron-knight', 'Iron Knight', [8, 4, 7, 3]),
  card('tide-siren', 'Tide Siren', [5, 8, 3, 6], 'water'),
  card('grave-hound', 'Grave Hound', [7, 6, 6, 4], 'poison'),
  card('sky-lancer', 'Sky Lancer', [8, 2, 8, 5], 'wind'),
  // ★★★★
  card('seraph', 'Seraph', [9, 6, 2, 8], 'holy'),
  card('magma-titan', 'Magma Titan', [9, 7, 4, 7], 'fire'),
  card('tempest-roc', 'Tempest Roc', [7, 9, 6, 3], 'thunder'),
  // ★★★★★
  card('sky-wyrm', 'Sky Wyrm', [10, 4, 6, 9], 'wind'),
];

const STARDUST_CRUSADERS: readonly StarterCard[] = [
  // ★
  portrait('alessi', 'Alessi', [2, 5, 3, 4]),
  portrait('steely-dan', 'Steely Dan', [4, 2, 4, 3]),
  // ★★
  portrait('hol-horse', 'Hol Horse', [6, 4, 2, 6]),
  portrait('enya-the-hag', 'Enya the Hag', [5, 5, 2, 5], 'poison'),
  portrait('anubis', 'Anubis', [7, 2, 3, 5]),
  portrait('mariah', 'Mariah', [2, 6, 5, 3], 'thunder'),
  portrait('j-geil', 'J. Geil', [3, 5, 3, 6]),
  portrait('daniel-darby', "Daniel J. D'Arby", [4, 3, 6, 2]),
  portrait('forever', 'Forever', [6, 2, 4, 5]),
  portrait('imposter-tennille', 'Imposter Tennille', [3, 4, 4, 6], 'water'),
  // ★★★
  portrait('noriaki-kakyoin', 'Noriaki Kakyoin', [7, 6, 3, 6], 'water'),
  portrait('polnareff', 'Polnareff', [8, 5, 2, 6]),
  portrait('avdol', 'Avdol', [6, 7, 5, 3], 'fire'),
  portrait('iggy', 'Iggy', [4, 7, 2, 8], 'earth'),
  portrait('telence-darby', "Telence T. D'Arby", [3, 6, 8, 4]),
  portrait('will-zeppeli', 'Will A. Zeppeli', [7, 3, 6, 5], 'holy'),
  // ★★★★
  portrait('jotaro-kujo', 'Jotaro Kujo', [9, 8, 4, 6]),
  portrait('joseph-joestar', 'Joseph Joestar', [7, 8, 7, 4], 'thunder'),
  portrait('vanilla-ice', 'Vanilla Ice', [9, 4, 8, 6]),
  // ★★★★★
  portrait('dio', 'DIO', [10, 7, 3, 9]),
];

const NETHERWORLD: readonly StarterCard[] = [
  // ★
  portrait('prinny', 'Prinny', [3, 2, 5, 1], 'water'),
  portrait('tink', 'Tink', [1, 3, 2, 6]),
  // ★★
  portrait('jennifer', 'Jennifer', [3, 6, 5, 2]),
  portrait('kurtis', 'Kurtis', [6, 3, 5, 2], 'thunder'),
  portrait('axel', 'Axel', [5, 2, 6, 4], 'thunder'),
  portrait('hanako', 'Hanako', [2, 5, 3, 6]),
  portrait('taro', 'Taro', [4, 4, 5, 3]),
  portrait('dad', 'Dad', [6, 5, 3, 3]),
  portrait('mom', 'Mom', [3, 3, 6, 5], 'holy'),
  portrait('director', 'Director', [5, 6, 2, 4]),
  // ★★★
  portrait('etna', 'Etna', [7, 4, 6, 5]),
  portrait('flonne', 'Flonne', [3, 7, 5, 7], 'holy'),
  portrait('pleinair', 'Pleinair', [8, 3, 6, 4]),
  portrait('yukimaru', 'Yukimaru', [6, 8, 2, 5], 'wind'),
  portrait('fubuki', 'Fubuki', [4, 6, 7, 4], 'ice'),
  portrait('gordon', 'Gordon', [7, 5, 6, 4], 'earth'),
  // ★★★★
  portrait('laharl', 'Laharl', [6, 9, 4, 8], 'fire'),
  portrait('adell', 'Adell', [9, 6, 5, 7], 'earth'),
  portrait('zenon', 'Zenon', [8, 5, 8, 6], 'poison'),
  // ★★★★★
  portrait('rozalin', 'Rozalin', [10, 8, 4, 8]),
];

const PRETTY_DERBY: readonly StarterCard[] = [
  // ★
  portrait('haru-urara', 'Haru Urara', [2, 4, 1, 5]),
  // ★★
  portrait('daiwa-scarlet', 'Daiwa Scarlet', [6, 4, 6, 2], 'fire'),
  portrait('taiki-shuttle', 'Taiki Shuttle', [3, 6, 4, 5], 'wind'),
  portrait('rice-shower', 'Rice Shower', [5, 3, 7, 2]),
  portrait('nice-nature', 'Nice Nature', [4, 5, 4, 5]),
  // ★★★
  portrait('mejiro-mcqueen', 'Mejiro McQueen', [7, 5, 7, 3], 'holy'),
  portrait('gold-ship', 'Gold Ship', [5, 8, 3, 7], 'thunder'),
  portrait('maruzensky', 'Maruzensky', [8, 4, 5, 6], 'fire'),
  // ★★★★
  portrait('silence-suzuka', 'Silence Suzuka', [9, 7, 3, 8], 'wind'),
  portrait('tokai-teio', 'Tokai Teio', [8, 9, 6, 4]),
  portrait('oguri-cap', 'Oguri Cap', [7, 8, 8, 3], 'earth'),
  // ★★★★★
  portrait('special-week', 'Special Week', [9, 9, 5, 8]),
];

/** Sets of starter cards with portraits, each one the cards of a starter deck. */
export interface PortraitSet {
  readonly id: string;
  readonly cards: readonly StarterCard[];
}

export const PORTRAIT_SETS: readonly PortraitSet[] = [
  { id: 'stardust-crusaders', cards: STARDUST_CRUSADERS },
  { id: 'netherworld', cards: NETHERWORLD },
  { id: 'pretty-derby', cards: PRETTY_DERBY },
];

export const STARTER_CARDS: readonly StarterCard[] = [
  ...GENERIC_CARDS,
  ...PORTRAIT_SETS.flatMap((set) => set.cards),
];

const oneOfEach = (set: readonly StarterCard[]): Readonly<Record<string, number>> =>
  Object.fromEntries(set.map((starter) => [starter.id, 1]));

/** One of each 4★ and 5★ card, and two of the others: decks may hold only a few strong cards. */
const pairsBelowFourStars = (set: readonly StarterCard[]): Readonly<Record<string, number>> =>
  Object.fromEntries(
    set.map(({ id, stats: [top, right, bottom, left], element }) => [
      id,
      rankCard({ top, right, bottom, left }, element).stars >= 4 ? 1 : 2,
    ]),
  );

export const STARDUST_CRUSADERS_DECK_ID = 'starter-stardust-crusaders';
export const NETHERWORLD_DECK_ID = 'starter-netherworld';
export const PRETTY_DERBY_DECK_ID = 'starter-pretty-derby';

export const STARTER_DECKS: readonly StarterDeck[] = [
  {
    id: 'starter-wanderer',
    name: 'Wanderer',
    isDefault: true,
    cards: {
      'generic-sand-lizard': 3,
      'generic-field-mouse': 3,
      'generic-glow-moth': 2,
      'generic-ember-imp': 2,
      'generic-frost-wisp': 2,
      'generic-lantern-ghost': 2,
      'generic-thorn-wolf': 2,
      'generic-iron-knight': 2,
      'generic-grave-hound': 1,
      'generic-seraph': 1,
    },
  },
  {
    id: STARDUST_CRUSADERS_DECK_ID,
    name: 'Stardust Crusaders',
    isDefault: false,
    cards: oneOfEach(STARDUST_CRUSADERS),
  },
  {
    id: 'starter-vanguard',
    name: 'Vanguard',
    isDefault: false,
    cards: {
      'generic-spore-cap': 3,
      'generic-sand-lizard': 2,
      'generic-thorn-wolf': 3,
      'generic-storm-hawk': 2,
      'generic-lantern-ghost': 2,
      'generic-iron-knight': 3,
      'generic-grave-hound': 2,
      'generic-sky-lancer': 1,
      'generic-magma-titan': 1,
      'generic-sky-wyrm': 1,
    },
  },
  {
    id: NETHERWORLD_DECK_ID,
    name: 'Netherworld',
    isDefault: false,
    cards: oneOfEach(NETHERWORLD),
  },
  {
    id: PRETTY_DERBY_DECK_ID,
    name: 'Pretty Derby',
    isDefault: false,
    cards: pairsBelowFourStars(PRETTY_DERBY),
  },
];
