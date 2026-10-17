import { CARD_LAYOUT, spritePosition } from '@triple-triad/card-layout';
import type { Element } from '@triple-triad/engine';
import { DEFAULT_ASSET_PACK, type AssetPack } from '@/lib/asset-packs';
import { ELEMENT_LABELS } from '@/lib/elements';

/** One element icon from an asset pack's sprite sheet, sized by the parent. */
export function ElementIcon({
  element,
  pack = DEFAULT_ASSET_PACK,
  className = '',
}: {
  readonly element: Element;
  readonly pack?: AssetPack;
  readonly className?: string;
}) {
  return (
    <span
      role="img"
      aria-label={ELEMENT_LABELS[element]}
      className={`inline-block aspect-square bg-no-repeat ${className}`}
      style={{
        ...spritePosition(CARD_LAYOUT.sheets.elements, element),
        backgroundImage: `url(${JSON.stringify(pack.images.elements)})`,
      }}
    />
  );
}
