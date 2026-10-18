/**
 * Lets Next.js server code reach the live game server.
 *
 * The custom server (src/server/index.ts) and the Next.js runtime run in one Node.js process but
 * load separate copies of this app's modules, so a plain module-level variable would not be
 * shared. A symbol from the global registry is the same in both copies.
 */
const REGISTRY_KEY = Symbol.for('triple-triad.realtime');

export interface RealtimeControl {
  /** Ends every room, telling its players why. */
  closeAllRooms(reason: string): void;
}

type GlobalWithRealtime = typeof globalThis & { [REGISTRY_KEY]?: RealtimeControl | null };

/** Called by the game server when it starts (and with null when it stops). */
export function registerRealtime(control: RealtimeControl | null): void {
  (globalThis as GlobalWithRealtime)[REGISTRY_KEY] = control;
}

/** The running game server, or null when there is none (tests, command-line tools). */
export function getRealtime(): RealtimeControl | null {
  return (globalThis as GlobalWithRealtime)[REGISTRY_KEY] ?? null;
}
