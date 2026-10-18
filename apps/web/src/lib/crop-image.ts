import { CARD_LAYOUT } from '@triple-triad/card-layout';

export interface PixelCrop {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

const CARD_WIDTH = CARD_LAYOUT.width;
const CARD_HEIGHT = CARD_LAYOUT.height;

export async function cropImage(imageSrc: string, crop: PixelCrop): Promise<Blob> {
  const image = await loadImage(imageSrc);
  const canvas = document.createElement('canvas');
  canvas.width = CARD_WIDTH;
  canvas.height = CARD_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');

  ctx.drawImage(image, crop.x, crop.y, crop.width, crop.height, 0, 0, CARD_WIDTH, CARD_HEIGHT);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Canvas toBlob failed'));
    }, 'image/png');
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.addEventListener('load', () => {
      resolve(img);
    });
    img.addEventListener('error', () => {
      reject(new Error('The image could not be loaded'));
    });
    img.src = src;
  });
}
