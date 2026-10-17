/**
 * Default generic cards and starter decks, inserted on first startup so the game is playable out
 * of the box. These are placeholders until the owner supplies art; afterwards the catalogue is
 * managed from the admin panel.
 *
 * Every starter deck must satisfy the deck rules; `starter-content.test.ts` enforces this.
 */
import type { Element, StatValue } from '@triple-triad/engine';

export interface StarterCard {
  readonly id: string;
  readonly name: string;
  /** [top, right, bottom, left] */
  readonly stats: readonly [StatValue, StatValue, StatValue, StatValue];
  readonly element: Element | null;
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
): StarterCard => ({ id: `generic-${slug}`, name, stats, element });

export const STARTER_CARDS: readonly StarterCard[] = [
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
    id: 'starter-elementalist',
    name: 'Elementalist',
    isDefault: false,
    cards: {
      'generic-bog-beetle': 3,
      'generic-pebble-golem': 3,
      'generic-ember-imp': 1,
      'generic-frost-wisp': 1,
      'generic-storm-hawk': 3,
      'generic-prickle-jack': 2,
      'generic-reef-crab': 3,
      'generic-tide-siren': 2,
      'generic-sky-lancer': 1,
      'generic-tempest-roc': 1,
    },
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
];
