import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const [queuePath, outputDirectory, waveName, ...slugs] = process.argv.slice(2);

if (!queuePath || !outputDirectory || !waveName || slugs.length === 0) {
  throw new Error(
    "Usage: node scripts/split-image-generation-queue.mjs <queue.json> <output-directory> <wave-name> <slug> [slug ...]"
  );
}

if (new Set(slugs).size !== slugs.length) {
  throw new Error("Assigned image-generation slugs must be unique.");
}

const queue = JSON.parse(await readFile(queuePath, "utf8"));
if (!Array.isArray(queue)) {
  throw new Error("The source image-generation queue must be a JSON array.");
}

const itemsBySlug = new Map(queue.map((item) => [item.slug, item]));
const missing = slugs.filter((slug) => !itemsBySlug.has(slug));
if (missing.length > 0) {
  throw new Error(`Unknown image-generation slugs: ${missing.join(", ")}`);
}

await mkdir(outputDirectory, { recursive: true });

for (const [index, slug] of slugs.entries()) {
  const filename = `${waveName}-generation-agent-${index + 1}.json`;
  const destination = path.join(outputDirectory, filename);
  await writeFile(
    destination,
    `${JSON.stringify([itemsBySlug.get(slug)], null, 2)}\n`,
    "utf8"
  );
  console.log(`${filename}: ${slug}`);
}
