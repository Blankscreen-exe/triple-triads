/**
 * Prepares portraits for the starter cards: cuts out plain backgrounds, so the card's red or blue
 * shows through, and frames each character from the head down on the card canvas.
 *
 *   node scripts/build-starter-art.mjs <directory of portraits> [card slug...]
 *
 * The results are committed in assets/starter-art, and stored as card art on first startup.
 */
import { mkdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import sharp from 'sharp';

const CANVAS = { width: 1024, height: 1434 };
const OUTPUT_DIR = resolve('assets/starter-art');
/** How close to the background colour a pixel must be to count as background (0–255). */
const BACKGROUND_TOLERANCE = 30;
/** Pixels up to this far from the background colour fade out where they touch it. */
const FEATHER_TOLERANCE = 90;
/** Character width and top margin as fractions of the canvas: the stats overlap the corners. */
const CHARACTER_WIDTH = 0.92;
const TOP_MARGIN = 0.04;
/** Where the frame's name plate starts: shorter characters are centred above it. */
const PLATE_TOP = 0.84;

/** Enclosed areas this close to the background, and this many pixels or more, are gaps too. */
const GAP_TOLERANCE = 10;
const GAP_MIN_PIXELS = 40;

/**
 * `zoom` enlarges the character beyond fitting the canvas width, and `shift` moves them sideways (a
 * fraction of the canvas width). `white` marks characters wearing white: areas they enclose are
 * kept, as their clothes would otherwise get holes, rather than treated as gaps in the figure.
 * `gapsFrom` looks for gaps only below this fraction of the image, to spare white hair.
 */
const PORTRAITS = {
  alessi: { file: 'Alessi.jpg', white: true },
  avdol: { file: 'Avdol.jpg' },
  'daniel-darby': { file: "Daniel J_ D'Arby.jpg", white: true },
  'enya-the-hag': { file: 'Enya the Hag.jpg', white: true },
  forever: { file: 'Forever.webp' },
  iggy: { file: 'Iggy.jpg', white: true },
  'imposter-tennille': { file: 'Imposter Captain Tennille.jpg', shift: 0.08 },
  'j-geil': { file: 'J.geil.webp' },
  mariah: { file: 'Mariah.jpg' },
  'steely-dan': { file: 'STELLY DAN.jpg', shift: 0.14 },
  'telence-darby': { file: "Telence T. D'Arby.jpg", white: true },
  anubis: { file: 'anubis.jpg' },
  dio: { file: 'dio.jpg' },
  'hol-horse': { file: 'hol horse.jpg', shift: 0.16 },
  'joseph-joestar': { file: 'josph joestar.jpg' },
  'jotaro-kujo': { file: 'jotaro.jpg' },
  'noriaki-kakyoin': { file: 'kakyoin.jpg' },
  polnareff: { file: 'polnareff ; ⚔️.jpg', gapsFrom: 0.25 },
  'vanilla-ice': { file: 'vanilla ice ; 🪄.jpg' },
  'will-zeppeli': { file: 'william zeppeli ; 🎲.jpg', white: true },
};

/** The colour of a corner, which on these portraits is the background. */
function cornerColours({ data, width, height }) {
  const at = (x, y) => [...data.subarray((y * width + x) * 4, (y * width + x) * 4 + 3)];
  return [at(2, 2), at(width - 3, 2), at(2, height - 3), at(width - 3, height - 3)];
}

/** Makes the background transparent: flood-fills from the edges, then any gaps in the figure. */
function cutOutBackground(image, keepEnclosed, gapsFrom) {
  const { data, width, height } = image;
  const colours = cornerColours(image);
  const distance = (index) => {
    const offset = index * 4;
    return Math.min(
      ...colours.map((colour) =>
        Math.max(
          Math.abs(data[offset] - colour[0]),
          Math.abs(data[offset + 1] - colour[1]),
          Math.abs(data[offset + 2] - colour[2]),
        ),
      ),
    );
  };

  const seen = new Uint8Array(width * height);
  const stack = [];
  const visit = (index) => {
    if (seen[index] || distance(index) > BACKGROUND_TOLERANCE) return;
    seen[index] = 1;
    stack.push(index);
  };
  for (let x = 0; x < width; x++) {
    visit(x);
    visit((height - 1) * width + x);
  }
  for (let y = 0; y < height; y++) {
    visit(y * width);
    visit(y * width + width - 1);
  }
  const neighbours = (index) => {
    const x = index % width;
    return [
      ...(x > 0 ? [index - 1] : []),
      ...(x < width - 1 ? [index + 1] : []),
      ...(index >= width ? [index - width] : []),
      ...(index < width * (height - 1) ? [index + width] : []),
    ];
  };
  const fill = () => {
    while (stack.length > 0) {
      const index = stack.pop();
      data[index * 4 + 3] = 0;
      for (const next of neighbours(index)) visit(next);
    }
  };
  fill();

  if (!keepEnclosed) {
    const checked = new Uint8Array(width * height);
    for (let start = width * Math.floor(height * gapsFrom); start < seen.length; start++) {
      if (seen[start] || checked[start] || distance(start) > GAP_TOLERANCE) continue;
      const area = [start];
      checked[start] = 1;
      for (const index of area) {
        for (const next of neighbours(index)) {
          if (!seen[next] && !checked[next] && distance(next) <= GAP_TOLERANCE) {
            checked[next] = 1;
            area.push(next);
          }
        }
      }
      if (area.length >= GAP_MIN_PIXELS) {
        for (const index of area) visit(index);
        fill();
      }
    }
  }

  // Anti-aliased edge pixels are part background: fade them instead of leaving a pale fringe.
  for (let index = 0; index < seen.length; index++) {
    if (seen[index]) continue;
    if (!neighbours(index).some((next) => seen[next])) continue;
    const away = distance(index);
    if (away < FEATHER_TOLERANCE) {
      data[index * 4 + 3] = Math.round((255 * (away - BACKGROUND_TOLERANCE)) / FEATHER_TOLERANCE);
    }
  }
}

/** The smallest box around the visible pixels. */
function visibleBox({ data, width, height }) {
  let [left, top, right, bottom] = [width, height, 0, 0];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] < 16) continue;
      left = Math.min(left, x);
      right = Math.max(right, x);
      top = Math.min(top, y);
      bottom = Math.max(bottom, y);
    }
  }
  return { left, top, width: right - left + 1, height: bottom - top + 1 };
}

async function buildPortrait(
  sourceDir,
  slug,
  { file, zoom = 1, shift = 0, white = false, gapsFrom = 0 },
) {
  const source = sharp(readFileSync(join(sourceDir, file))).ensureAlpha();
  const { data, info } = await source.raw().toBuffer({ resolveWithObject: true });
  const image = { data, width: info.width, height: info.height };
  const stats = await sharp(data, { raw: { ...info } }).stats();
  if (stats.isOpaque) cutOutBackground(image, white, gapsFrom);

  const box = visibleBox(image);
  const plateTop = CANVAS.height * PLATE_TOP;
  const marginTop = CANVAS.height * TOP_MARGIN;
  const widthScale = (CANVAS.width * CHARACTER_WIDTH) / box.width;
  const scale = widthScale * zoom;
  const scaled = {
    width: Math.round(box.width * scale),
    height: Math.round(box.height * scale),
  };
  const character = await sharp(data, { raw: { ...info } })
    .extract(box)
    .resize(scaled.width, scaled.height)
    .png()
    .toBuffer();

  const left = Math.round((CANVAS.width - scaled.width) / 2 + shift * CANVAS.width);
  const top = Math.round(
    scaled.height < plateTop - marginTop ? (plateTop - scaled.height) / 2 : marginTop,
  );
  // Characters taller or wider than the card run off its edge: only the visible part is kept.
  const cropLeft = Math.max(0, -left);
  const visible = await sharp(character)
    .extract({
      left: cropLeft,
      top: 0,
      width: Math.min(scaled.width - cropLeft, CANVAS.width - Math.max(0, left)),
      height: Math.min(scaled.height, CANVAS.height - top),
    })
    .toBuffer();

  await sharp({
    create: { ...CANVAS, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([{ input: visible, left: Math.max(0, left), top }])
    .webp({ quality: 90, alphaQuality: 95 })
    .toFile(join(OUTPUT_DIR, `${slug}.webp`));
  console.log(slug, `${String(box.width)}x${String(box.height)}`, `×${scale.toFixed(2)}`);
}

const [sourceDir, ...only] = process.argv.slice(2);
if (!sourceDir) throw new Error('Usage: build-starter-art.mjs <directory of portraits> [slug...]');
mkdirSync(OUTPUT_DIR, { recursive: true });
for (const [slug, portrait] of Object.entries(PORTRAITS)) {
  if (only.length === 0 || only.includes(slug)) await buildPortrait(sourceDir, slug, portrait);
}
