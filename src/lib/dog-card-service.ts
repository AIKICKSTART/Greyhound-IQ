import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { randomUUID } from "node:crypto";
import { withDbRequestContext, withDbSystemContext } from "@/lib/db-context";
import type { CurrentUserProfile } from "@/lib/auth-types";
import { assertPaidFeatureAccess } from "@/lib/tier-access";
import { getPlatformFlag, PLATFORM_FLAGS } from "@/lib/platform-settings";
import {
  downloadStorageObject,
} from "@/lib/supabase-storage";
import { objectStorage } from "@/lib/object-storage";
import {
  isSupabaseStorageBucket,
  PUBLIC_USER_MEDIA_BUCKET,
  publicStorageUrl,
} from "@/lib/storage-paths";
import { createAuditLog } from "@/lib/account-service";
import {
  parseCustomPageContent,
  resolveCustomPageMedia,
} from "@/lib/custom-page-service";
import { computeCardTier, type CardTierResult } from "@/lib/dog-card-tier";
import { isEmergencyControlActive } from "@/lib/emergency-controls";
import {
  assertDogCardPhotoSize,
  MAX_DOG_CARD_SOURCE_BYTES,
  resolveBundledDogCardPhotoPath,
} from "@/lib/dog-card-photo-policy";
import { readBoundedTextResponse } from "@/lib/remote-response";

const OPENAI_IMAGE_EDITS_URL = "https://api.openai.com/v1/images/edits";
const CARD_SIZE = "1024x1536"; // portrait trading-card
const WORDMARK_PATH = "public/images/brand/logo-wordmark-purple-gold.webp";
const OPENAI_IMAGE_RESPONSE_POLICY = {
  maxBytes: 35 * 1024 * 1024,
  allowedContentTypes: ["application/json"],
} as const;

// Per-tier prompt. gpt-image-2 gets the dog photo + wordmark as reference images.
// GreyhoundsIQ wordmark is REQUIRED (also composited post-gen as a guarantee).
function cardPrompt(dogName: string, tier: CardTierResult, statLines: string[]) {
  return [
    `Premium collectible greyhound racing trading card, portrait orientation.`,
    `Tier: ${tier.label} (${tier.stars} stars). Dramatic dark background with`,
    tier.stars >= 4 ? "gold and black luxury styling" : "purple and gold styling",
    `, stadium lights and subtle nebula. Place the greyhound from the first`,
    `reference image as the hero, cleanly cut in. Show the GreyhoundsIQ wordmark`,
    `(second reference image) prominently at the top. Render the dog name`,
    `"${dogName}" in large bold metallic type. Include a clean stats panel with`,
    `these exact values: ${statLines.join("; ")}. Sharp, legible text. No extra`,
    `logos, no watermark other than GreyhoundsIQ.`,
  ].join(" ");
}

// Belt-and-suspenders wordmark guarantee: composite the official wordmark onto
// the generated card so the hard rule holds regardless of model output.
async function stampWordmark(cardPng: Buffer): Promise<Buffer> {
  const wordmark = await readFile(path.join(process.cwd(), WORDMARK_PATH));
  const logo = await sharp(wordmark).resize({ width: 360 }).png().toBuffer();
  const base = sharp(cardPng);
  const meta = await base.metadata();
  const left = Math.max(24, ((meta.width ?? 1024) - 360) - 32);
  return base
    .composite([{ input: logo, top: 28, left }])
    .png()
    .toBuffer();
}

export async function generateDogCard(current: CurrentUserProfile, pageId: string) {
  if (isEmergencyControlActive(process.env.AI_DISABLED)) {
    throw new Error("dog_card.disabled");
  }

  assertPaidFeatureAccess(current);
  if (!(await getPlatformFlag(PLATFORM_FLAGS.cardGenerationEnabled, false))) {
    throw new Error("dog_card.disabled");
  }
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("dog_card.not_configured");

  const page = await withDbRequestContext(current, (tx) =>
    tx.customPage.findFirst({
      where: { id: pageId, ownerProfileId: current.profileId, pageType: "dog" },
      include: { dog: true, socialActor: { select: { id: true } } },
    })
  );
  if (!page || !page.dog || !page.socialActor) {
    throw new Error("dog_card.page_not_found");
  }

  // Read only an actor-owned, clean storage object. The demo fallback is a
  // bounded local public image; this path never follows a database/provider URL.
  const photo = await readDogCardPhoto(page.contentJson, page.socialActor.id);

  const dog = page.dog;
  const tier = computeCardTier({
    careerStarts: dog.careerStarts,
    careerWins: dog.careerWins,
    winPercentage: dog.winPercentage,
    prizeMoney: dog.prizeMoney,
  });
  const statLines = [
    `Starts ${dog.careerStarts ?? 0}`,
    `Wins ${dog.careerWins ?? 0}`,
    dog.prizeMoney ? `Prize $${Math.round(dog.prizeMoney).toLocaleString("en-AU")}` : null,
  ].filter((s): s is string => Boolean(s));

  const wordmark = await readFile(path.join(process.cwd(), WORDMARK_PATH));
  const form = new FormData();
  form.append("model", "gpt-image-2");
  form.append("prompt", cardPrompt(dog.name, tier, statLines));
  form.append("size", CARD_SIZE);
  form.append("n", "1");
  form.append("image[]", new Blob([new Uint8Array(photo)], { type: "image/png" }), "dog.png");
  form.append(
    "image[]",
    new Blob([new Uint8Array(wordmark)], { type: "image/webp" }),
    "wordmark.webp"
  );

  const res = await fetch(OPENAI_IMAGE_EDITS_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
    redirect: "manual",
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) {
    throw new Error(`dog_card.generation_failed:${res.status}`);
  }
  const json = JSON.parse(
    await readBoundedTextResponse(res, OPENAI_IMAGE_RESPONSE_POLICY),
  ) as { data?: { b64_json?: string }[] };
  const b64 = json.data?.[0]?.b64_json;
  if (!b64) throw new Error("dog_card.no_image");

  const stamped = await stampWordmark(Buffer.from(b64, "base64"));

  // Upload to public bucket + register a clean MediaAsset linked to the page.
  const objectPath = `users/${current.dbUserId}/custom-page/${pageId}/card-${randomUUID()}.png`;
  try {
    await objectStorage.putObject({
      bucket: PUBLIC_USER_MEDIA_BUCKET,
      key: objectPath,
      body: stamped,
      contentType: "image/png",
      upsert: false,
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.startsWith("storage.upload_failed:")
    ) {
      throw new Error("dog_card.upload_failed");
    }
    throw error;
  }
  const publicUrl = publicStorageUrl(PUBLIC_USER_MEDIA_BUCKET, objectPath);

  const asset = await withDbSystemContext((tx) =>
    tx.mediaAsset.create({
      data: {
        uploaderId: current.dbUserId,
        storageBucket: PUBLIC_USER_MEDIA_BUCKET,
        storagePath: objectPath,
        publicUrl,
        mediaType: "image",
        originalName: `${dog.name}-card.png`,
        mimeType: "image/png",
        sizeBytes: stamped.length,
        scanStatus: "clean",
        scanCompletedAt: new Date(),
        linkedEntityType: "custom_page",
        linkedEntityId: pageId,
      },
    })
  );

  // Store the card id in contentJson.
  const content = JSON.parse(page.contentJson ?? "{}");
  content.cardMediaId = asset.id;
  content.cardTier = tier.tier;
  await withDbRequestContext(current, (tx) =>
    tx.customPage.update({
      where: { id: pageId },
      data: { contentJson: JSON.stringify(content) },
    })
  );

  await createAuditLog({
    actorId: current.dbUserId,
    actorType: "user",
    action: "dog_card.generate",
    targetType: "custom_page",
    targetId: pageId,
    metadata: { tier: tier.tier, mediaId: asset.id },
  });

  return { mediaId: asset.id, publicUrl, tier: tier.tier };
}

async function readDogCardPhoto(contentJson: string | null, actorId: string) {
  const content = parseCustomPageContent(contentJson);
  const preferredIds = [content.avatarMediaId, content.bannerMediaId].filter(
    (id): id is string => Boolean(id),
  );
  if (preferredIds.length > 0) {
    const attachments = await withDbSystemContext((tx) =>
      tx.actorGalleryMedia.findMany({
        where: {
          actorId,
          mediaId: { in: preferredIds },
          media: {
            deletedAt: null,
            scanStatus: "clean",
            processingStatus: "ready",
          },
        },
        select: {
          media: {
            select: {
              id: true,
              storageBucket: true,
              storagePath: true,
              mimeType: true,
              sizeBytes: true,
            },
          },
        },
        take: 2,
      }),
    );
    const byId = new Map(attachments.map(({ media }) => [media.id, media]));
    const source = preferredIds.map((id) => byId.get(id)).find(Boolean);
    if (source) {
      if (
        !isSupabaseStorageBucket(source.storageBucket) ||
        !source.mimeType.startsWith("image/") ||
        source.sizeBytes <= 0 ||
        source.sizeBytes > MAX_DOG_CARD_SOURCE_BYTES
      ) {
        throw new Error("dog_card.photo_invalid");
      }
      const blob = await downloadStorageObject(
        source.storageBucket,
        source.storagePath,
      );
      const bytes = Buffer.from(await blob.arrayBuffer());
      assertDogCardPhotoSize(bytes.byteLength, source.sizeBytes);
      return bytes;
    }
  }

  const demoMedia = await resolveCustomPageMedia(contentJson, actorId);
  const bundledPathname = demoMedia.avatarUrl ?? demoMedia.bannerUrl;
  if (!bundledPathname) throw new Error("dog_card.photo_required");
  const bytes = await readFile(resolveBundledDogCardPhotoPath(bundledPathname));
  assertDogCardPhotoSize(bytes.byteLength);
  return bytes;
}
