/**
 * Draws a card face from an asset pack and the shared card layout.
 *
 * Every layer is absolutely positioned in percentages of the card, and sprite cells are picked
 * with CSS background positioning, so a card renders crisply at any size with no image processing
 * and no client-side JavaScript. Size it with the parent's width.
 */
import {
  CARD_LAYOUT,
  boxToPercent,
  digitKey,
  spritePosition,
  type Box,
  type SpriteSheet,
} from '@triple-triad/card-layout';
import { SIDES, type PlayerColor } from '@triple-triad/engine';
import type { CSSProperties, ReactNode } from 'react';
import { DEFAULT_ASSET_PACK, type AssetPack } from '@/lib/asset-packs';
import { describeCard, type DescribableCard } from '@/lib/describe-card';

export interface CardFace extends DescribableCard {
  /** Card art (transparent PNG at card size); null shows the background only. */
  readonly artUrl: string | null;
}

interface CardViewProps {
  readonly card: CardFace;
  /** Which colour's background to show: the player currently controlling the card. */
  readonly side: PlayerColor;
  /** The card owner's asset pack. */
  readonly pack?: AssetPack;
  readonly className?: string;
}

const layout = CARD_LAYOUT;
/** Name text height as a share of the name box, in container-width units (cqw). */
const NAME_FONT_SIZE = `${String(((layout.name[3] - layout.name[1]) * 0.6 * 100) / layout.width)}cqw`;

export function CardView({ card, side, pack = DEFAULT_ASSET_PACK, className = '' }: CardViewProps) {
  return (
    <CardShell label={describeCard(card)} className={className}>
      {pack.font && <PackFontFace font={pack.font} />}
      <ImageLayer url={side === 'blue' ? pack.images.bgBlue : pack.images.bgRed} />
      {card.artUrl && <ImageLayer url={card.artUrl} />}
      <ImageLayer url={pack.images.frame} />

      {SIDES.map((statSide) => (
        <Sprite
          key={statSide}
          box={layout.stats[statSide]}
          url={pack.images.digits}
          sheet={layout.sheets.digits}
          cell={digitKey(card.stats[statSide])}
        />
      ))}

      {card.element && (
        <Sprite
          box={layout.element}
          url={pack.images.elements}
          sheet={layout.sheets.elements}
          cell={card.element}
        />
      )}

      {layout.stars.map((box, index) => (
        <Sprite
          key={box.join()}
          box={box}
          url={pack.images.stars}
          sheet={layout.sheets.stars}
          cell={index < card.stars ? 'filled' : 'empty'}
        />
      ))}

      <div
        aria-hidden
        className="absolute flex items-center justify-center overflow-hidden px-[1%] leading-none font-bold whitespace-nowrap text-white [text-shadow:0_0.3cqw_0.6cqw_rgb(0_0_0/0.8)]"
        style={{
          ...boxToPercent(layout.name),
          fontSize: NAME_FONT_SIZE,
          fontFamily: pack.font ? `"${pack.font.family}"` : 'var(--font-display)',
        }}
      >
        <span className="truncate">{card.name}</span>
      </div>
    </CardShell>
  );
}

/** The back of a card, e.g. for the opponent's hidden hand. */
export function CardBack({
  pack = DEFAULT_ASSET_PACK,
  className = '',
}: Pick<CardViewProps, 'pack' | 'className'>) {
  return (
    <CardShell label="Face-down card" className={className}>
      <ImageLayer url={pack.images.cardBack} />
    </CardShell>
  );
}

function CardShell({
  label,
  className,
  children,
}: {
  readonly label: string;
  readonly className: string;
  readonly children: ReactNode;
}) {
  return (
    <div
      role="img"
      aria-label={label}
      className={`relative w-full overflow-hidden rounded-[3%/2.2%] shadow-[0_4px_10px_rgb(0_0_0/0.6)] select-none [container-type:inline-size] ${className}`}
      style={{ aspectRatio: `${String(layout.width)} / ${String(layout.height)}` }}
    >
      {children}
    </div>
  );
}

function ImageLayer({ url }: { readonly url: string }) {
  return (
    <div
      aria-hidden
      className="absolute inset-0 bg-cover bg-center bg-no-repeat"
      style={{ backgroundImage: cssUrl(url) }}
    />
  );
}

function Sprite<Key extends string>({
  box,
  url,
  sheet,
  cell,
}: {
  readonly box: Box;
  readonly url: string;
  readonly sheet: SpriteSheet<Key>;
  readonly cell: Key;
}) {
  const style: CSSProperties = {
    ...boxToPercent(box),
    ...spritePosition(sheet, cell),
    backgroundImage: cssUrl(url),
  };
  return <div aria-hidden className="absolute bg-no-repeat" style={style} />;
}

function cssUrl(url: string): string {
  return `url(${JSON.stringify(url)})`;
}

/**
 * Loads a pack's custom font. React hoists <style> tags with an `href` into the document head and
 * keeps one per href, so many cards using the same pack load the font once.
 */
function PackFontFace({ font }: { readonly font: NonNullable<AssetPack['font']> }) {
  return (
    <style href={`pack-font-${font.family}`} precedence="default">
      {`@font-face{font-family:${JSON.stringify(font.family)};src:url(${JSON.stringify(font.url)});font-display:swap}`}
    </style>
  );
}
