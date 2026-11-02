/**
 * Prepares portraits for the starter cards: cuts out plain backgrounds, so the card's red or blue
 * shows through, and frames each character from the head down on the card canvas.
 *
 *   node scripts/build-starter-art.mjs <set> <directory of portraits> [card slug...]
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
 * The portraits of each set of starter cards, by card slug.
 *
 * `zoom` enlarges the character beyond fitting the canvas width, and `shift` moves them sideways (a
 * fraction of the canvas width). `white` marks characters wearing white: areas they enclose are
 * kept, as their clothes would otherwise get holes, rather than treated as gaps in the figure.
 * `gapsFrom` looks for gaps only below this fraction of the image, to spare white hair.
 *
 * A set's `busts` are cut off at the bottom of the image: they fill the card from the top margin
 * down to its bottom edge, and smaller ones (`zoom` below 1) still sit on it, so the cut is hidden.
 * A set of `fullFigures` shows the top half of each: from the top margin down to the card's bottom
 * edge, centred on the head.
 */
const SETS = {
  'stardust-crusaders': {
    portraits: {
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
    },
  },
  netherworld: {
    busts: true,
    portraits: {
      adell: { file: 'Adell.png' },
      axel: { file: 'Axel.png' },
      dad: { file: 'Dad.png' },
      director: { file: 'Director.png' },
      etna: { file: 'Etna.png' },
      flonne: { file: 'Flonne.png' },
      fubuki: { file: 'Fubuki.png' },
      gordon: { file: 'Gordon.png' },
      hanako: { file: 'Hanako.png' },
      jennifer: { file: 'Jennifer.png' },
      kurtis: { file: 'Kurtis.png', zoom: 0.7, shift: -0.14 },
      laharl: { file: 'Laharl.png' },
      mom: { file: 'Mom.png' },
      pleinair: { file: 'Pleinair.png' },
      prinny: { file: 'Prinny.png', zoom: 0.7, shift: 0.1 },
      rozalin: { file: 'Rozalin.png' },
      taro: { file: 'Taro.png' },
      tink: { file: 'Tink.png', zoom: 0.8, shift: 0.1 },
      yukimaru: { file: 'Yukimaru.png' },
      zenon: { file: 'Zenon.png' },
    },
  },
  'pretty-derby': {
    fullFigures: true,
    portraits: {
      'daiwa-scarlet': { file: 'daiwascarlet_02.webp' },
      'gold-ship': { file: 'goldship_02.webp' },
      'haru-urara': { file: 'haruurara_02.webp' },
      maruzensky: { file: 'maruzensky_02.webp' },
      'mejiro-mcqueen': { file: 'mejiromcqueen_02.webp' },
      'nice-nature': { file: 'nicenature_02.webp' },
      'oguri-cap': { file: 'oguricap_02.webp' },
      'rice-shower': { file: 'riceshower_02.webp' },
      'silence-suzuka': { file: 'silencesuzuka_02.webp' },
      'special-week': { file: 'specialweek_03.webp' },
      'taiki-shuttle': { file: 'taikishuttle_02.webp' },
      'tokai-teio': { file: 'tokaiteio_01.webp' },
    },
  },
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

/** The smallest box around the visible pixels, in the first `rows` rows of the image. */
function visibleBox({ data, width, height }, rows = height) {
  let [left, top, right, bottom] = [width, height, 0, 0];
  for (let y = 0; y < rows; y++) {
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

/** The middle of the head, from the left of `box`: the average column of its top quarter. */
function headCentre({ data, width }, box) {
  let [sum, count] = [0, 0];
  for (let y = box.top; y < box.top + box.height / 4; y++) {
    for (let x = box.left; x < box.left + box.width; x++) {
      if (data[(y * width + x) * 4 + 3] < 16) continue;
      sum += x - box.left;
      count++;
    }
  }
  return sum / count;
}

async function buildPortrait(
  sourceDir,
  slug,
  { file, zoom = 1, shift = 0, white = false, gapsFrom = 0 },
  { busts = false, fullFigures = false },
) {
  const source = sharp(readFileSync(join(sourceDir, file))).ensureAlpha();
  const { data, info } = await source.raw().toBuffer({ resolveWithObject: true });
  const image = { data, width: info.width, height: info.height };
  const stats = await sharp(data, { raw: { ...info } }).stats();
  if (stats.isOpaque) cutOutBackground(image, white, gapsFrom);

  const figure = visibleBox(image);
  const box = fullFigures ? visibleBox(image, figure.top + Math.round(figure.height / 2)) : figure;
  const plateTop = CANVAS.height * PLATE_TOP;
  const marginTop = CANVAS.height * TOP_MARGIN;
  const widthScale = fullFigures ? 0 : (CANVAS.width * CHARACTER_WIDTH) / box.width;
  // A bust cut off at the bottom, or half a figure, fills the card's height.
  const cutOff = fullFigures || (busts && box.top + box.height === info.height);
  const heightScale = cutOff ? (CANVAS.height - marginTop) / box.height : 0;
  const scale = Math.max(widthScale, heightScale) * zoom;
  const scaled = {
    width: Math.round(box.width * scale),
    height: Math.round(box.height * scale),
  };
  const character = await sharp(data, { raw: { ...info } })
    .extract(box)
    .resize(scaled.width, scaled.height)
    .png()
    .toBuffer();

  const centred = fullFigures
    ? CANVAS.width / 2 - headCentre(image, box) * scale
    : (CANVAS.width - scaled.width) / 2;
  const left = Math.round(centred + shift * CANVAS.width);
  const top = Math.round(
    cutOff
      ? Math.max(marginTop, CANVAS.height - scaled.height)
      : scaled.height < plateTop - marginTop
        ? (plateTop - scaled.height) / 2
        : marginTop,
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

const [setName, sourceDir, ...only] = process.argv.slice(2);
const set = SETS[setName];
if (!set || !sourceDir) {
  throw new Error(
    `Usage: build-starter-art.mjs <${Object.keys(SETS).join('|')}> <directory of portraits> [slug...]`,
  );
}
mkdirSync(OUTPUT_DIR, { recursive: true });
for (const [slug, portrait] of Object.entries(set.portraits)) {
  if (only.length === 0 || only.includes(slug)) {
    await buildPortrait(sourceDir, slug, portrait, set);
  }
}
