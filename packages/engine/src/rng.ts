/**
 * Small, seedable pseudo-random number generator (mulberry32).
 *
 * The engine never calls Math.random(): all randomness flows from a 32-bit state stored in the
 * game state, so any game can be reproduced exactly from its seed and its list of moves.
 * Callers that need unpredictability (the game server) should seed it from a secure source.
 */
export class Rng {
  #state: number;

  constructor(seed: number) {
    this.#state = seed >>> 0;
  }

  /** Current internal state; pass it to `new Rng(state)` to resume the sequence. */
  get state(): number {
    return this.#state;
  }

  /** Returns a float in [0, 1). */
  next(): number {
    this.#state = (this.#state + 0x6d2b79f5) >>> 0;
    let t = this.#state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  }

  /** Returns an integer in [min, max] (both inclusive). */
  int(min: number, max: number): number {
    if (!Number.isInteger(min) || !Number.isInteger(max) || max < min) {
      throw new RangeError(`Invalid integer range [${String(min)}, ${String(max)}]`);
    }
    return min + Math.floor(this.next() * (max - min + 1));
  }

  /** Returns a random element of a non-empty array. */
  pick<T>(items: readonly T[]): T {
    if (items.length === 0) {
      throw new RangeError('Cannot pick from an empty array');
    }
    return items[this.int(0, items.length - 1)] as T;
  }

  /** Returns a shuffled copy of `items` (Fisher–Yates). */
  shuffle<T>(items: readonly T[]): T[] {
    const result = [...items];
    for (let i = result.length - 1; i > 0; i--) {
      const j = this.int(0, i);
      [result[i], result[j]] = [result[j] as T, result[i] as T];
    }
    return result;
  }
}
