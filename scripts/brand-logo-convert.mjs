import sharp from "sharp";
import { readdir, stat, writeFile, rename } from "node:fs/promises";
import path from "node:path";

const imagesDir = "public/images";
const brandDir = path.join(imagesDir, "brand");

const loose = [
  "logo-main-purple-gold.webp",
  "logo-wordmark-purple-gold.webp",
  "wordmark-compact-ghiq.png",
].map((f) => path.join(imagesDir, f));

const inBrand = (await readdir(brandDir))
  .filter((f) => /\.(png|webp|jpe?g)$/i.test(f) && !/-stripe\.png$/i.test(f))
  .map((f) => path.join(brandDir, f));

const sources = [...loose, ...inBrand];
const base = (p) => path.basename(p).replace(/\.(png|webp|jpe?g)$/i, "");

for (const src of sources) {
  try {
    const meta = await sharp(src).metadata();
    const b = base(src);
    const webpOut = path.join(brandDir, `${b}.webp`);
    const pngOut = path.join(brandDir, `${b}-stripe.png`);

    await sharp(src)
      .resize({ width: Math.min(meta.width || 1600, 1600), withoutEnlargement: true })
      .webp({ quality: 90 })
      .toFile(webpOut + ".tmp");
    await rename(webpOut + ".tmp", webpOut);

    let w = Math.min(meta.width || 1024, 1024);
    let buf;
    for (;;) {
      buf = await sharp(src)
        .resize({ width: w, withoutEnlargement: true })
        .png({ compressionLevel: 9, palette: true })
        .toBuffer();
      if (buf.length < 512 * 1024 || w <= 256) break;
      w = Math.round(w * 0.85);
    }
    await writeFile(pngOut, buf);
    console.log(
      `${b}: webp ${(await stat(webpOut)).size}B | stripe-png ${buf.length}B @${w}px ${buf.length < 512 * 1024 ? "OK" : "STILL_BIG"}`
    );
  } catch (e) {
    console.log(`${src}: ERR ${e.message}`);
  }
}
