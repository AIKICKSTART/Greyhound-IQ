import path from "node:path";

export const MAX_DOG_CARD_SOURCE_BYTES = 20 * 1024 * 1024;

export function resolveBundledDogCardPhotoPath(
  pathname: string,
  projectRoot = process.cwd(),
) {
  if (!/^\/images\/[a-zA-Z0-9/_-]+\.(?:jpe?g|png|webp)$/i.test(pathname)) {
    throw new Error("dog_card.photo_path_invalid");
  }

  const imageRoot = path.resolve(projectRoot, "public", "images");
  const resolved = path.resolve(projectRoot, "public", pathname.slice(1));
  if (resolved !== imageRoot && !resolved.startsWith(`${imageRoot}${path.sep}`)) {
    throw new Error("dog_card.photo_path_invalid");
  }
  return resolved;
}

export function assertDogCardPhotoSize(
  bytes: number,
  declaredBytes: number | null = null,
) {
  if (
    !Number.isSafeInteger(bytes) ||
    bytes <= 0 ||
    bytes > MAX_DOG_CARD_SOURCE_BYTES ||
    (declaredBytes !== null &&
      (!Number.isSafeInteger(declaredBytes) ||
        declaredBytes <= 0 ||
        declaredBytes > MAX_DOG_CARD_SOURCE_BYTES ||
        declaredBytes !== bytes))
  ) {
    throw new Error("dog_card.photo_size_invalid");
  }
}
