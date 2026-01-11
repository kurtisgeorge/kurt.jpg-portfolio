import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import sharp from "sharp";

const ROOT = process.cwd();
const INPUT_DIR = path.join(ROOT, "assets", "images", "originals");
const OUT_BASE = path.join(ROOT, "assets", "generated");
const OUT_THUMBS = path.join(OUT_BASE, "thumbs");
const OUT_FULL = path.join(OUT_BASE, "full");
const MANIFEST_PATH = path.join(ROOT, "assets", "images.json");

// Tweak these once, then forget about it.
const THUMB_W = 520;          // grid thumbs
const FULL_W = 2200;          // lightbox images (big enough for most screens)
const JPEG_QUALITY = 82;      // good balance for photos
const WEBP_QUALITY = 78;

const ALLOWED_EXT = new Set([".jpg", ".jpeg", ".png", ".tif", ".tiff", ".webp", ".avif"]);

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function isImageFile(filename) {
  const ext = path.extname(filename).toLowerCase();
  return ALLOWED_EXT.has(ext);
}

function fileHash(absPath) {
  const buf = fs.readFileSync(absPath);
  return crypto.createHash("sha1").update(buf).digest("hex").slice(0, 10);
}

function baseNameNoExt(filename) {
  return path.basename(filename, path.extname(filename));
}

async function buildOne(absInPath, relInName) {
  const originalName = relInName;
  const base = baseNameNoExt(originalName);

  const hash = fileHash(absInPath);
  const outBaseName = `${base}-${hash}`;

  const outThumbJpg = path.join(OUT_THUMBS, `${outBaseName}.jpg`);
  const outThumbWebp = path.join(OUT_THUMBS, `${outBaseName}.webp`);
  const outFullJpg = path.join(OUT_FULL, `${outBaseName}.jpg`);
  const outFullWebp = path.join(OUT_FULL, `${outBaseName}.webp`);

  // Load once
  const img = sharp(absInPath, { failOn: "none" });

  // Read metadata for width/height (helps layout stability if you use it later)
  const meta = await img.metadata();
  const w = meta.width || null;
  const h = meta.height || null;

  // Generate thumb (jpg + webp)
  await sharp(absInPath, { failOn: "none" })
    .rotate()
    .resize({ width: THUMB_W, withoutEnlargement: true })
    .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
    .toFile(outThumbJpg);

  await sharp(absInPath, { failOn: "none" })
    .rotate()
    .resize({ width: THUMB_W, withoutEnlargement: true })
    .webp({ quality: WEBP_QUALITY })
    .toFile(outThumbWebp);

  // Generate full (jpg + webp)
  await sharp(absInPath, { failOn: "none" })
    .rotate()
    .resize({ width: FULL_W, withoutEnlargement: true })
    .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
    .toFile(outFullJpg);

  await sharp(absInPath, { failOn: "none" })
    .rotate()
    .resize({ width: FULL_W, withoutEnlargement: true })
    .webp({ quality: WEBP_QUALITY })
    .toFile(outFullWebp);

  // These are the paths your website will use:
  const webThumbJpg = `./assets/generated/thumbs/${path.basename(outThumbJpg)}`;
  const webThumbWebp = `./assets/generated/thumbs/${path.basename(outThumbWebp)}`;
  const webFullJpg = `./assets/generated/full/${path.basename(outFullJpg)}`;
  const webFullWebp = `./assets/generated/full/${path.basename(outFullWebp)}`;

  // srcset: browser can pick webp if supported, else jpg via <img src>
  // We keep it simple: src is jpg, srcset includes both formats.
  const srcset = `${webThumbWebp} 520w, ${webThumbJpg} 520w`;

  return {
    file: originalName,
    w,
    h,
    alt: "",
    caption: "",
    src: {
      thumb: webThumbJpg,
      srcset,
      full: webFullJpg,
      fullWebp: webFullWebp
    }
  };
}

async function main() {
  if (!fs.existsSync(INPUT_DIR)) {
    console.error(`Missing folder: ${INPUT_DIR}`);
    process.exit(1);
  }

  ensureDir(OUT_THUMBS);
  ensureDir(OUT_FULL);

  const files = fs.readdirSync(INPUT_DIR).filter(isImageFile);

  if (files.length === 0) {
    fs.writeFileSync(MANIFEST_PATH, JSON.stringify({ items: [] }, null, 2));
    console.log("No images found. Wrote empty assets/images.json");
    return;
  }

  const built = [];

  for (const filename of files) {
    const abs = path.join(INPUT_DIR, filename);
    process.stdout.write(`Processing ${filename}...\n`);
    const item = await buildOne(abs, filename);
    built.push(item);
  }

  // Sort stable (alphabetical). You can change later (date, EXIF, etc).
  built.sort((a, b) => a.file.localeCompare(b.file));

  fs.writeFileSync(MANIFEST_PATH, JSON.stringify({ items: built }, null, 2));
  console.log(`\nDone. Generated ${built.length} images + assets/images.json`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});