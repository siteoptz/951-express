// Resizes originals into public/images/, blurs readable license plates, converts to WebP.
// Usage: node scripts/optimize-images.mjs   (originals live in /originals, which is gitignored)
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const SRC = 'originals/pictures';
const OUT = 'public/images';

// plates: [left, top, width, height] in source pixels
const jobs = [
  {
    src: '64ef2c00-1564-47c7-8a02-59f34ca6e6dc.JPG',
    out: 'hero/red-cascadia-profile.webp',
    max: 2400,
    quality: 68,
    plates: [],
  },
  {
    src: '4954054071354628248.JPG',
    out: 'about/white-cascadia-loaded.webp',
    max: 1600,
    plates: [[115, 802, 36, 48]],
  },
  {
    src: 'IMG_20231007_104110_826.JPG',
    out: 'services/white-cascadia-front.webp',
    max: 1600,
    plates: [],
  },
  {
    src: '1462738097176575252.JPG',
    out: 'gallery/red-cascadia-night.webp',
    max: 1600,
    plates: [[100, 824, 56, 56]],
  },
  {
    src: 'IMG_20260606_191132_361.WEBP',
    out: 'gallery/hauler-black-white.webp',
    max: 1600,
    plates: [[1378, 991, 34, 35]],
  },
];

for (const { src, out, max, plates, quality = 80 } of jobs) {
  const input = path.join(SRC, src);
  let buf = await sharp(input).rotate().toBuffer();
  for (const [left, top, width, height] of plates) {
    const patch = await sharp(buf).extract({ left, top, width, height }).blur(14).toBuffer();
    buf = await sharp(buf)
      .composite([{ input: patch, left, top }])
      .toBuffer();
  }
  const dest = path.join(OUT, out);
  await mkdir(path.dirname(dest), { recursive: true });
  const info = await sharp(buf)
    .resize({ width: max, height: max, fit: 'inside', withoutEnlargement: true })
    .webp({ quality })
    .toFile(dest);
  console.log(`${out}  ${info.width}x${info.height}  ${(info.size / 1024).toFixed(0)} KB`);
}
await mkdir(path.join(OUT, 'logos'), { recursive: true });
