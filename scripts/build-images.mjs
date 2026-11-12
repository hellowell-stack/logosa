/**
 * Prepares the photographs for the web.
 *
 * The originals stay in /images, exactly as supplied. For every entry in
 * src/data/photos.ts this writes the copy the site serves, under
 * public/images/photos/: WebP, sRGB, no alpha channel, and no larger than the
 * site ever shows. Next's image optimiser cuts every smaller size from that one
 * file on demand.
 *
 * This is the only thing that should write to public/images/photos/. A copy
 * whose photograph has been taken out of the library is deleted, so the folder
 * never serves a picture the site has stopped describing.
 *
 * Run after adding or replacing a photograph:
 *   npm run build:images
 */
import sharp from "sharp";
import { existsSync, mkdirSync, readdirSync, unlinkSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

// Node strips TypeScript types natively, so the library is read from the app
// itself rather than copied in here, where the two would drift apart.
const { photos } = await import(pathToFileURL(join(root, "src", "data", "photos.ts")).href);

const OUT = join(root, "public", "images", "photos");
const PREFIX = "/images/photos/";

/** The widest the site ever needs: a full-bleed plate on a large, dense screen. */
const LONG_EDGE_MAX = 2400;

/**
 * Below this, the original is enlarged here rather than in the browser.
 *
 * Several originals are well under 1,000 px wide, and the site shows them
 * across a desktop screen. Left to the browser they are stretched with a soft
 * filter at paint time; enlarged here they get Lanczos resampling and a light
 * sharpen, which holds edges better. It adds no detail that was not in the
 * file — a larger original is the only real fix — but it is the better of the
 * two ways to show a small photograph large.
 */
const LONG_EDGE_MIN = 1600;

const entries = Object.entries(photos);
const expected = new Set();
let failed = false;

for (const [key, photo] of entries) {
  const name = basename(photo.src);
  if (!photo.src.startsWith(PREFIX) || !name.endsWith(".webp")) {
    console.error(`  ✗ ${key}: src must be ${PREFIX}<name>.webp, not ${photo.src}`);
    failed = true;
  } else if (expected.has(name)) {
    console.error(`  ✗ ${key}: ${photo.src} is already used by another photograph`);
    failed = true;
  }
  if (!existsSync(join(root, photo.source))) {
    console.error(`  ✗ ${key}: original not found at ${photo.source}`);
    failed = true;
  }
  expected.add(name);
}
if (failed) process.exit(1);

mkdirSync(OUT, { recursive: true });
let total = 0;

for (const [, photo] of entries) {
  const from = join(root, photo.source);
  const name = basename(photo.src);

  const meta = await sharp(from).metadata();
  // EXIF orientations 5–8 are a quarter turn, so width and height swap.
  const [w, h] =
    (meta.orientation ?? 1) >= 5 ? [meta.height, meta.width] : [meta.width, meta.height];
  const long = Math.max(w, h);
  const scale = Math.min(LONG_EDGE_MAX, Math.max(LONG_EDGE_MIN, long)) / long;

  let img = sharp(from).rotate().removeAlpha().toColourspace("srgb");
  if (scale !== 1) {
    img = img.resize({
      width: Math.round(w * scale),
      height: Math.round(h * scale),
      kernel: "lanczos3",
    });
  }
  if (scale > 1) img = img.sharpen({ sigma: 0.8, m1: 0.4, m2: 1.2 });

  const info = await img
    .webp({ quality: 82, effort: 6, smartSubsample: true })
    .toFile(join(OUT, name));
  total += info.size;

  const note = scale > 1 ? `enlarged from ${w}×${h}` : scale < 1 ? `reduced from ${w}×${h}` : "";
  console.log(
    `  ${name.padEnd(30)} ${`${info.width}×${info.height}`.padEnd(10)} ${`${(info.size / 1024).toFixed(0)} kB`.padStart(7)}  ${note}`,
  );
}

for (const f of readdirSync(OUT)) {
  if (expected.has(f)) continue;
  unlinkSync(join(OUT, f));
  console.log(`  removed ${f} — no longer in photos.ts`);
}

console.log(`\n${entries.length} photographs, ${(total / 1024).toFixed(0)} kB → public/images/photos/`);
