import "./load-env";

import { prisma } from "../src/lib/db";
import { withDbSystemContext } from "../src/lib/db-context";
import {
  resolveRaceVideoReplay,
} from "../src/lib/live/race-replay";
import {
  verifyReplaySource,
  type ReplayVerificationInput,
} from "../src/lib/live/replay-verification";

const APPLY_CONFIRMATION = "AUDIT-RACE-VIDEO-PLAYBACK";
const DEFAULT_BATCH_SIZE = 250;
const DEFAULT_CONCURRENCY = 8;

async function main() {
  const apply = process.argv.includes("--apply");
  const confirmation = flag("--confirm");
  if (apply && confirmation !== APPLY_CONFIRMATION) {
    throw new Error(`Apply mode requires --confirm=${APPLY_CONFIRMATION}.`);
  }
  const batchSize = positiveInt(flag("--batch-size"), DEFAULT_BATCH_SIZE, 1_000);
  const concurrency = positiveInt(flag("--concurrency"), DEFAULT_CONCURRENCY, 16);
  const delayMs = nonNegativeInt(flag("--delay-ms"), 0, 60_000);
  const maxBatches = positiveInt(flag("--max-batches"), 1, 10_000);
  const from = optionalDate(flag("--from"));
  const sourceProvider = flag("--source-provider")?.trim().toLowerCase() || null;

  for (let batch = 0; batch < maxBatches; batch += 1) {
    const videos = await prisma.raceVideo.findMany({
      where: {
        lastVerifiedAt: null,
        ...(sourceProvider ? { sourceProvider } : {}),
        ...(from ? { race: { raceTime: { gte: from } } } : {}),
      },
      orderBy: { id: "asc" },
      take: batchSize,
      select: {
        id: true,
        raceId: true,
        sourceProvider: true,
        sourceId: true,
        pageUrl: true,
        embedSourceType: true,
        sourceStatus: true,
        sourceCode: true,
        streamUrl: true,
        streamContentType: true,
        title: true,
        description: true,
        race: { select: { meeting: { select: { track: { select: { state: true } } } } } },
      },
    });
    if (videos.length === 0) break;

    const checked = await concurrentMap(videos, concurrency, async (video) => {
      const resolved = await resolveRaceVideoReplay(video).catch(() => null);
      const input: ReplayVerificationInput = {
        id: video.id,
        raceId: video.raceId,
        sourceProvider: video.sourceProvider,
        sourceId: video.sourceId,
        pageUrl: resolved?.embedUrl ?? resolved?.pageUrl ?? video.pageUrl,
        embedSourceType: video.embedSourceType,
        sourceStatus: resolved?.sourceStatus ?? video.sourceStatus,
        sourceCode: resolved?.sourceCode ?? video.sourceCode,
        streamUrl: resolved?.streamUrl ?? video.streamUrl,
        streamContentType:
          resolved?.streamContentType ?? video.streamContentType,
        jurisdiction: video.race.meeting.track.state,
      };
      const verification = await verifyReplaySource(input);
      if (delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
      return {
        input,
        verification,
      };
    });
    console.log(
      JSON.stringify({
        mode: apply ? "apply" : "dry-run",
        batch: batch + 1,
        checked: checked.length,
        outcomes: countBy(
          checked.map((entry) => entry.verification.outcome),
        ),
        nonVerifiedSamples: checked
          .filter((entry) => entry.verification.outcome !== "verified")
          .slice(0, 5)
          .map((entry) => ({
            sourceId: entry.input.sourceId,
            checkedUrl: entry.verification.checkedUrl,
            httpStatus: entry.verification.httpStatus,
          })),
      }),
    );
    if (!apply) break;

    await withDbSystemContext(
      async (tx) => {
        await tx.$executeRawUnsafe(`SET LOCAL lock_timeout = '5s'`);
        for (const { input, verification } of checked) {
          await tx.raceVideoVerification.upsert({
            where: {
              raceVideoId_evidenceSha256: {
                raceVideoId: input.id,
                evidenceSha256: verification.evidenceSha256,
              },
            },
            create: {
              raceVideoId: input.id,
              playbackState: verification.playbackState,
              outcome: verification.outcome,
              httpStatus: verification.httpStatus,
              mediaContentType: verification.mediaContentType,
              evidenceSha256: verification.evidenceSha256,
            },
            update: {},
          });
          await tx.raceVideo.update({
            where: { id: input.id },
            data: {
              verificationStatus: verification.verificationStatus,
              lastVerifiedAt: new Date(),
              verificationEvidenceSha256: verification.evidenceSha256,
            },
          });
        }
      },
      { maxWait: 10_000, timeout: 120_000 },
    );
  }
}

async function concurrentMap<T, R>(
  values: T[],
  concurrency: number,
  map: (value: T) => Promise<R>,
) {
  const output = new Array<R>(values.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(concurrency, values.length) }, async () => {
      while (next < values.length) {
        const index = next;
        next += 1;
        output[index] = await map(values[index]!);
      }
    }),
  );
  return output;
}

function flag(name: string) {
  return process.argv
    .find((value) => value.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}

function positiveInt(value: string | undefined, fallback: number, maximum: number) {
  const parsed = value == null ? fallback : Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > maximum) {
    throw new Error(`Expected a positive integer no greater than ${maximum}.`);
  }
  return parsed;
}

function nonNegativeInt(
  value: string | undefined,
  fallback: number,
  maximum: number,
) {
  const parsed = value == null ? fallback : Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > maximum) {
    throw new Error(`Expected a non-negative integer no greater than ${maximum}.`);
  }
  return parsed;
}

function optionalDate(value: string | undefined) {
  if (!value) return null;
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) {
    throw new Error(`Expected a valid --from timestamp, received ${value}.`);
  }
  return parsed;
}

function countBy(values: string[]) {
  return values.reduce<Record<string, number>>((counts, value) => {
    counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {});
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
