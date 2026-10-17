import type { DeckViolation } from '@triple-triad/engine';

/** A stable React key for a deck-rule violation. */
export function violationKey(violation: DeckViolation): string {
  switch (violation.code) {
    case 'WRONG_SIZE':
      return violation.code;
    case 'TOO_MANY_COPIES':
      return `${violation.code}-${violation.key}`;
    case 'STAR_CAP_EXCEEDED':
      return `${violation.code}-${String(violation.stars)}`;
  }
}

/** A player-facing explanation of a deck-rule violation. */
export function describeViolation(violation: DeckViolation): string {
  switch (violation.code) {
    case 'WRONG_SIZE':
      return `A deck needs exactly ${String(violation.expected)} cards (this one has ${String(violation.actual)}).`;
    case 'TOO_MANY_COPIES':
      return `At most ${String(violation.max)} cards with the same stats (found ${String(violation.count)}).`;
    case 'STAR_CAP_EXCEEDED':
      return `At most ${String(violation.max)} ${String(violation.stars)}-star cards (found ${String(violation.count)}).`;
  }
}
