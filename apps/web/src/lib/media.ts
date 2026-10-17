/**
 * URLs of uploaded files, served by the /media route.
 */

export type CardArtSize = 'card' | 'full';

/** `artKey` is the stored prefix, e.g. "cards/<card id>/<hash>". */
export function cardArtUrl(artKey: string | null, size: CardArtSize = 'card'): string | null {
  return artKey === null ? null : `/media/${artKey}-${size}.webp`;
}
