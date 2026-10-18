import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { IMAGE_PARTS, PACK_PARTS, PART_FILE_NAMES, templateUrl } from './asset-pack-spec';

const publicDir = fileURLToPath(new URL('../../public', import.meta.url));

describe('asset pack parts', () => {
  it('offer at least one template for every image part, and every template exists', () => {
    for (const spec of IMAGE_PARTS) {
      expect(spec.templates.length, spec.part).toBeGreaterThan(0);
      for (const template of spec.templates) {
        expect(existsSync(`${publicDir}${templateUrl(template)}`), template.file).toBe(true);
      }
    }
  });

  it('have a file name for every part', () => {
    expect(Object.keys(PART_FILE_NAMES).toSorted()).toEqual([...PACK_PARTS].toSorted());
  });
});
