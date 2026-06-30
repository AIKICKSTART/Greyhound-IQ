import { readFile, readdir, stat } from "fs/promises";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import {
  SITE_ASSETS_BUCKET,
  siteAssetObjectPath,
} from "../src/lib/storage-paths";

const root = path.resolve(process.cwd(), "public", "images");

async function main() {
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const files = await listFiles(root);
  for (const filePath of files) {
    const relativePublicPath = `/${path
      .relative(path.resolve(process.cwd(), "public"), filePath)
      .replace(/\\/g, "/")}`;
    const objectPath = siteAssetObjectPath(relativePublicPath);
    const body = await readFile(filePath);
    const { error } = await supabase.storage
      .from(SITE_ASSETS_BUCKET)
      .upload(objectPath, body, {
        upsert: true,
        contentType: contentTypeFor(filePath),
        cacheControl: "31536000",
      });

    if (error) throw new Error(`${relativePublicPath}: ${error.message}`);
    console.log(`${relativePublicPath} -> ${SITE_ASSETS_BUCKET}/${objectPath}`);
  }
}

async function listFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir);
  const files = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(dir, entry);
      const info = await stat(fullPath);
      return info.isDirectory() ? listFiles(fullPath) : [fullPath];
    })
  );
  return files.flat();
}

function contentTypeFor(filePath: string) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".avif") return "image/avif";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  if (ext === ".mp4") return "video/mp4";
  if (ext === ".webm") return "video/webm";
  return "application/octet-stream";
}

main().catch((err) => {
  console.error("[upload-site-assets] failed:", err);
  process.exit(1);
});
