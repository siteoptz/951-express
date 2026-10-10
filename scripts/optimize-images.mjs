// Resizes originals into public/images/, blurs readable license plates, converts to WebP.
// Usage: node scripts/optimize-images.mjs   (originals live in /originals, which is gitignored)
import sharp from 'sharp';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
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

// ---------------------------------------------------------------------------------------------------------------
// Logo. Source: originals/951-express-logo.png (transparent). If only the JPEG on a black background exists, the
// black is cut out first (and the transparent master is saved as originals/951-express-logo.png for next time).
// ---------------------------------------------------------------------------------------------------------------
const LOGO_PNG = 'originals/951-express-logo.png';
const LOGO_JPG = 'originals/951-express-logo.JPG';
const LOGOS = path.join(OUT, 'logos');
await mkdir(LOGOS, { recursive: true });

/** Removes a solid black background. Only black connected to the image edge goes; the logo's own dark navy stays. */
async function cutOutBlack(file) {
  const { data, info } = await sharp(file)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  const at = (x, y) => (y * w + x) * 4;
  const dark = (i) => Math.max(data[i], data[i + 1], data[i + 2]) < 28;
  const outside = new Uint8Array(w * h);
  const stack = [];
  const push = (x, y) => {
    if (x < 0 || y < 0 || x >= w || y >= h || outside[y * w + x] || !dark(at(x, y))) return;
    outside[y * w + x] = 1;
    stack.push(x, y);
  };
  for (let x = 0; x < w; x++) {
    push(x, 0);
    push(x, h - 1);
  }
  for (let y = 0; y < h; y++) {
    push(0, y);
    push(w - 1, y);
  }
  while (stack.length) {
    const y = stack.pop();
    const x = stack.pop();
    push(x + 1, y);
    push(x - 1, y);
    push(x, y + 1);
    push(x, y - 1);
  }
  // A 3px band around the outside region holds the anti-aliased edge: turn its brightness into alpha and remove the black matte.
  const band = new Uint8Array(w * h);
  const R = 3;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (!outside[y * w + x]) continue;
      for (let dy = -R; dy <= R; dy++)
        for (let dx = -R; dx <= R; dx++) {
          const xx = x + dx,
            yy = y + dy;
          if (xx >= 0 && yy >= 0 && xx < w && yy < h && !outside[yy * w + xx])
            band[yy * w + xx] = 1;
        }
    }
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = at(x, y);
      if (outside[y * w + x]) data[i + 3] = 0;
      else if (band[y * w + x]) {
        const a = Math.min(1, Math.max(data[i], data[i + 1], data[i + 2]) / 225);
        data[i + 3] = Math.round(a * 255);
        for (let c = 0; c < 3; c++)
          data[i + c] = Math.min(255, Math.round(data[i + c] / Math.max(a, 0.05)));
      }
    }
  return sharp(data, { raw: { width: w, height: h, channels: 4 } })
    .png()
    .toBuffer();
}

let master;
if (existsSync(LOGO_PNG)) master = await sharp(LOGO_PNG).ensureAlpha().toBuffer();
else if (existsSync(LOGO_JPG)) {
  master = await cutOutBlack(LOGO_JPG);
  await writeFile(LOGO_PNG, master);
  console.log(`cut the black background out of ${LOGO_JPG} -> ${LOGO_PNG}`);
}
if (master) {
  const trimmed = await sharp(master).trim({ background: '#00000000', threshold: 1 }).toBuffer();
  const meta = await sharp(trimmed).metadata();
  const ratio = meta.width / meta.height;
  console.log(`logo master ${meta.width}x${meta.height} (ratio ${ratio.toFixed(3)})`);

  const sized = async (name, height, density, fmt) => {
    const width = Math.round(height * ratio) * density;
    const file = path.join(LOGOS, `${name}.${fmt}`);
    const pipeline = sharp(trimmed).resize({
      width,
      height: height * density,
      fit: 'fill',
      kernel: 'lanczos3',
    });
    const info = await (
      fmt === 'webp'
        ? pipeline.webp({ quality: 90, alphaQuality: 100 })
        : pipeline.png({ palette: true, quality: 90, compressionLevel: 9 })
    ).toFile(file);
    console.log(
      `logos/${name}.${fmt}  ${info.width}x${info.height}  ${(info.size / 1024).toFixed(0)} KB`,
    );
  };
  // Header 72px tall, footer 96px tall (the largest sizes; phones show them smaller); each with a 2x retina file. The page uses the 2x file through next/image.
  await sized('logo-header', 72, 1, 'webp');
  await sized('logo-header@2x', 72, 2, 'webp');
  await sized('logo-footer', 96, 1, 'webp');
  await sized('logo-footer@2x', 96, 2, 'webp');
  // Email clients want PNG at an absolute URL; 2x of a 120px-tall display.
  await sized('logo-email', 120, 2, 'png'); // shown at 190x80
  // Open Graph card.
  await sized('logo-og', 220, 2, 'png');

  // Favicon: the truck-and-arrow only (the full logo is unreadable at 16px). It is the right-hand part of the logo,
  // above the "INC." text, shown on a navy tile.
  const left = Math.round(meta.width * 0.575);
  const cropH = Math.round(meta.height * 0.78);
  const mark = await sharp(trimmed)
    .extract({ left, top: 0, width: meta.width - left, height: cropH })
    .toBuffer();
  const NAVY = '#0E1A2B';
  const tile = async (size, rounded) => {
    const inner = Math.round(size * 0.84);
    const art = await sharp(mark)
      .resize({ width: inner, height: inner, fit: 'contain', background: '#00000000' })
      .toBuffer();
    let img = sharp({
      create: { width: size, height: size, channels: 4, background: NAVY },
    }).composite([{ input: art, gravity: 'center' }]);
    if (rounded) {
      const mask = Buffer.from(
        `<svg width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${Math.round(size * 0.22)}" fill="#fff"/></svg>`,
      );
      img = sharp(await img.png().toBuffer()).composite([{ input: mask, blend: 'dest-in' }]);
    }
    return img.png({ compressionLevel: 9 });
  };
  await mkdir('src/app', { recursive: true });
  await (await tile(512, true)).toFile('src/app/icon.png');
  await (await tile(180, false)).toFile('src/app/apple-icon.png');
  const png32 = await (await tile(32, true)).toBuffer();
  // favicon.ico: a one-image ICO wrapping the 32x32 PNG
  const header = Buffer.alloc(22);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(1, 4); // one image
  header.writeUInt8(32, 6); // width
  header.writeUInt8(32, 7); // height
  header.writeUInt16LE(1, 10); // color planes
  header.writeUInt16LE(32, 12); // bits per pixel
  header.writeUInt32LE(png32.length, 14); // image size
  header.writeUInt32LE(22, 18); // image offset
  await writeFile('src/app/favicon.ico', Buffer.concat([header, png32]));
  console.log('src/app/icon.png 512, apple-icon.png 180, favicon.ico 32 (truck and arrow)');
} else {
  console.log('no logo found in originals/, skipped');
}
