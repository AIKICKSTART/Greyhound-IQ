/**
 * Archive rich The Dogs dog profile pages without touching the database.
 *
 * Examples:
 *   npm run backfill:thedogs:dog-profile-raw -- --limit 25
 *   npm run backfill:thedogs:dog-profile-raw -- --source-id 60626 --no-resume
 *   npm run backfill:thedogs:dog-profile-raw -- --limit 2000 --sort appearances
 *   npm run backfill:thedogs:dog-profile-raw -- --full --concurrency 2
 *   npm run backfill:thedogs:dog-profile-raw -- --full --shard-index 1 --shard-count 20
 */
import "./load-env";
import { createHash } from "node:crypto";
import { appendFile, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { LiveMeeting, LiveRunner } from "../src/lib/live/provider";
import {
  buildTheDogsProfilePath,
  parseShowMorePath,
  parseTheDogsDogProfile,
  TheDogsDogProfileProvider,
} from "../src/lib/live/thedogs-profile";
import {
  sanitizeArchiveValue,
  sanitizeProviderHtml,
} from "../src/lib/live/raw-sanitizer";
import { verifyTheDogsProfileArchiveIdentity } from "./thedogs-profile-archive-identity";

const DEFAULT_RAW_DIR = ".backfill/thedogs-raw";
const DEFAULT_OUTPUT_DIR = ".backfill/thedogs-dog-profiles-raw";
const DEFAULT_PROGRESS = ".backfill/thedogs-dog-profile-raw-progress.jsonl";
const DEFAULT_AUTHORITATIVE_OUTCOME_LEDGER =
  ".backfill/thedogs-authoritative-pedigree-retrieval-outcomes.jsonl";
const LEGACY_AUTHORITATIVE_QUEUE_VERSION = "giq-authoritative-pedigree-retrieval/v1";
const AUTHORITATIVE_QUEUE_VERSION = "giq-authoritative-pedigree-retrieval/v2";
const AUTHORITATIVE_OUTCOME_LEDGER_VERSION =
  "giq-authoritative-pedigree-retrieval-outcome/v1";
const LEGACY_AUTHORITATIVE_MANIFEST_SHA256 =
  "b84eab94d931b4e038766db7393b141b190548ba4a4e6bdb906b5692cb7b1116";
const LEGACY_AUTHORITATIVE_CANDIDATE_FIELDS = new Set([
  "schemaVersion",
  "queueVersion",
  "provider",
  "sourceId",
  "providerKey",
  "profilePath",
  "preferredName",
  "observedNames",
  "relationships",
  "edgeCount",
  "edges",
  "sourceArchiveKeys",
  "classification",
  "verificationStatus",
  "identityProofRequired",
  "canonicalPromotionEligible",
  "normalizedManifestSha256",
  "sourceCutoff",
  "evidenceSha256",
]);
const AUTHORITATIVE_CANDIDATE_FIELDS = new Set([
  ...LEGACY_AUTHORITATIVE_CANDIDATE_FIELDS,
  "parentQueueGeneration",
  "priorGenerationManifestSha256",
  "parentSourceLineage",
  "parentSourceLineageSha256",
  "retrievalPathStatus",
]);

type Options = {
  rawDir: string;
  outputDir: string;
  progressFile: string;
  full: boolean;
  limit: number;
  concurrency: number;
  pauseMs: number;
  resume: boolean;
  continueOnError: boolean;
  maxErrors: number;
  retryAttempts: number;
  retryDelayMs: number;
  sort: "first-seen" | "appearances";
  sourceId?: string;
  candidateFile?: string;
  authoritativeOutcomeLedger: string;
  from?: string;
  to?: string;
  shardIndex?: number;
  shardCount?: number;
  dryRun: boolean;
};

type RawCandidate = {
  date: string;
  rawPath: string;
};

type DogCandidate = {
  sourceId: string;
  name: string;
  profilePath: string;
  firstSeenDate: string;
  lastSeenDate: string;
  raceAppearances: number;
  names: Record<string, number>;
  profilePaths: Record<string, number>;
  authoritativeEvidence?: Record<string, unknown>;
};

type ProgressRecord = {
  sourceId?: string;
  ok?: boolean;
  archived?: boolean;
};

type RawArchive = {
  source?: string;
  date?: string;
  meetings?: LiveMeeting[];
};

class ProfileIdentityConflictError extends Error {
  override name = "ProfileIdentityConflictError";
}

async function main() {
  const options = parseOptions(process.argv.slice(2));
  const [candidates, completed] = await Promise.all([
    discoverDogs(options),
    options.resume ? readCompletedProfiles(options) : Promise.resolve(new Set<string>()),
  ]);
  const shardCandidates = filterShard(candidates, options);
  const pending = sortCandidates(
    shardCandidates.filter((candidate) => !completed.has(candidate.sourceId)),
    options.sort
  );
  const selected = options.sourceId || options.full ? pending : pending.slice(0, options.limit);

  console.log(
    JSON.stringify(
      {
        rawDir: options.rawDir,
        outputDir: options.outputDir,
        progressFile: options.progressFile,
        from: options.from ?? null,
        to: options.to ?? null,
        sourceId: options.sourceId ?? null,
        candidateFile: options.candidateFile ?? null,
        authoritativeOutcomeLedger: options.candidateFile
          ? options.authoritativeOutcomeLedger
          : null,
        dryRun: options.dryRun,
        resume: options.resume,
        full: options.full,
        limit: options.limit,
        concurrency: options.concurrency,
        discoveredDogs: candidates.length,
        shardIndex: options.shardIndex ?? null,
        shardCount: options.shardCount ?? null,
        shardDogs: shardCandidates.length,
        completedProfiles: completed.size,
        pendingProfiles: pending.length,
        selectedProfiles: selected.length,
        retryAttempts: options.retryAttempts,
        retryDelayMs: options.retryDelayMs,
        sort: options.sort,
      },
      null,
      2
    )
  );

  if (!options.full && !options.sourceId && pending.length > selected.length) {
    console.log(
      `[backfill:thedogs:dog-profile-raw] Capped to ${selected.length} profile(s). Pass --full or raise --limit to archive more.`
    );
  }
  if (options.dryRun) return;

  const provider = new TheDogsDogProfileProvider();
  let errorCount = 0;
  await mapLimit(selected, options.concurrency, async (candidate) => {
    const startedAt = Date.now();
    const result = await archiveProfileWithRetries(candidate, provider, options);
    if (result.ok) {
      if (candidate.authoritativeEvidence) {
        await appendAuthoritativeOutcome(options.authoritativeOutcomeLedger, candidate, {
          outcome: "archived",
          terminal: true,
          attempts: result.attempts,
          archivePath: result.outputPath,
          archiveSha256: result.archiveSha256,
        });
      }
      await appendProgress(options.progressFile, {
        sourceId: candidate.sourceId,
        name: candidate.name,
        ok: true,
        archived: true,
        outputPath: result.outputPath,
        durationMs: Date.now() - startedAt,
        attempts: result.attempts,
        formRows: result.parsed.formRows.length,
        raceAppearances: candidate.raceAppearances,
      });
      console.log(
        `[backfill:thedogs:dog-profile-raw] ${candidate.name} (${candidate.sourceId}) ok: ${result.parsed.formRows.length} form rows in ${Date.now() - startedAt}ms (attempt ${result.attempts})`
      );
    } else {
      errorCount += 1;
      await appendProgress(options.progressFile, {
        sourceId: candidate.sourceId,
        name: candidate.name,
        ok: false,
        archived: false,
        durationMs: Date.now() - startedAt,
        attempts: result.attempts,
        error: errorMessage(result.error),
      });
      console.error(
        `[backfill:thedogs:dog-profile-raw] ${candidate.name} (${candidate.sourceId}) failed:`,
        result.error
      );
      if (candidate.authoritativeEvidence) {
        const outcome = classifyAuthoritativeFailure(result.error, candidate);
        await appendAuthoritativeOutcome(options.authoritativeOutcomeLedger, candidate, {
          outcome: outcome.outcome,
          terminal: outcome.terminal,
          attempts: result.attempts,
          errorClass: outcome.errorClass,
          errorSha256: sha256Text(errorMessage(result.error)),
        });
      }
      if (!options.continueOnError || errorCount >= options.maxErrors) {
        throw result.error;
      }
    }

    if (options.pauseMs > 0) await sleep(options.pauseMs);
  });
}

async function archiveProfileWithRetries(
  candidate: DogCandidate,
  provider: TheDogsDogProfileProvider,
  options: Options
) {
  const maxAttempts = options.retryAttempts + 1;
  let lastError: unknown;
  let attemptsUsed = 0;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    attemptsUsed = attempt;
    try {
      const profileHtml = await provider.fetchProfile(candidate.profilePath);
      const showMorePath = parseShowMorePath(profileHtml);
      const identityProof = proveFetchedProfileIdentity(
        profileHtml,
        candidate,
        showMorePath
      );
      const fullFormHtml = showMorePath
        ? await provider.fetchFullForm(showMorePath)
        : "";
      const parsed = parseTheDogsDogProfile(
        profileHtml,
        candidate.sourceId,
        candidate.profilePath,
        fullFormHtml
      );
      const archiveValue = {
        source: "thedogs",
        sourceId: candidate.sourceId,
        fetchedAt: new Date().toISOString(),
        candidate,
        showMorePath: showMorePath ?? null,
        profileHtml: sanitizeProviderHtml(profileHtml),
        fullFormHtml: sanitizeProviderHtml(fullFormHtml),
        parsed: sanitizeArchiveValue(parsed),
        identityProof,
      };
      const archiveIdentity = verifyTheDogsProfileArchiveIdentity(
        candidate.sourceId,
        archiveValue
      );
      if (!archiveIdentity.verified) {
        throw new ProfileIdentityConflictError(
          `provider archive identity failed: ${archiveIdentity.reasons.join("; ")}`
        );
      }
      const outputPath = profilePathFor(options.outputDir, candidate.sourceId);
      await mkdir(path.dirname(outputPath), { recursive: true });
      const archiveBody = `${JSON.stringify(archiveValue)}\n`;
      await writeFile(outputPath, archiveBody);

      return {
        ok: true as const,
        outputPath,
        archiveSha256: sha256Text(archiveBody),
        parsed,
        attempts: attempt,
      };
    } catch (error) {
      lastError = error;
      if (attempt >= maxAttempts || !isTransientProfileError(error)) break;
      console.warn(
        `[backfill:thedogs:dog-profile-raw] ${candidate.name} (${candidate.sourceId}) attempt ${attempt}/${maxAttempts} failed; retrying in ${options.retryDelayMs}ms: ${errorMessage(error)}`
      );
      if (options.retryDelayMs > 0) await sleep(options.retryDelayMs);
    }
  }

  return {
    ok: false as const,
    error: lastError,
    attempts: attemptsUsed,
  };
}

async function discoverDogs(options: Options) {
  if (options.sourceId) {
    return [
      {
        sourceId: options.sourceId,
        name: options.sourceId,
        profilePath: buildTheDogsProfilePath(options.sourceId, options.sourceId),
        firstSeenDate: "",
        lastSeenDate: "",
        raceAppearances: 0,
        names: {},
        profilePaths: {},
      },
    ];
  }

  if (options.candidateFile) {
    return readAuthoritativeCandidates(options.candidateFile);
  }

  const rawFiles = (await scanRawArchives(options.rawDir)).filter(
    (candidate) =>
      (!options.from || candidate.date >= options.from) &&
      (!options.to || candidate.date <= options.to)
  );
  const dogs = new Map<string, DogCandidate>();
  for (const rawFile of rawFiles) {
    const archive = await readRawArchive(rawFile);
    for (const meeting of archive.meetings ?? []) {
      for (const race of meeting.races) {
        for (const runner of race.runners) {
          addRunnerDog(dogs, rawFile.date, runner);
        }
      }
    }
  }

  return [...dogs.values()].sort((a, b) => {
    const dateOrder = a.firstSeenDate.localeCompare(b.firstSeenDate);
    if (dateOrder !== 0) return dateOrder;
    return a.sourceId.localeCompare(b.sourceId);
  });
}

async function readAuthoritativeCandidates(candidateFile: string): Promise<DogCandidate[]> {
  const body = await readFile(candidateFile, "utf8");
  const candidates: DogCandidate[] = [];
  const seenSourceIds = new Set<string>();
  let observedQueueVersion: string | undefined;
  let observedManifestSha256: string | undefined;
  let observedGeneration: number | undefined;
  let observedPriorGenerationSha256: string | null | undefined;
  for (const [index, line] of body.split(/\r?\n/).entries()) {
    if (!line.trim()) continue;
    let raw: unknown;
    try {
      raw = JSON.parse(line);
    } catch {
      throw new Error(`${candidateFile}:${index + 1} is not valid JSON`);
    }
    const row = requireRecord(raw, `${candidateFile}:${index + 1}`);
    const isLegacy = row.queueVersion === LEGACY_AUTHORITATIVE_QUEUE_VERSION;
    const isCurrent = row.queueVersion === AUTHORITATIVE_QUEUE_VERSION;
    if (!isLegacy && !isCurrent) {
      throw new Error(`${candidateFile}:${index + 1} has an unsupported queue version`);
    }
    assertExactKeys(
      row,
      isLegacy ? LEGACY_AUTHORITATIVE_CANDIDATE_FIELDS : AUTHORITATIVE_CANDIDATE_FIELDS,
      `${candidateFile}:${index + 1}`
    );
    if (
      row.schemaVersion !== (isLegacy ? 1 : 2) ||
      row.provider !== "thedogs" ||
      row.verificationStatus !== "provider-profile-required" ||
      row.identityProofRequired !==
        (isLegacy
          ? "returned-page-source-id-and-profile-path"
          : "requested-path-source-id-and-returned-page-source-id") ||
      row.canonicalPromotionEligible !== false
    ) {
      throw new Error(`${candidateFile}:${index + 1} has an unsupported authority contract`);
    }
    const normalizedManifestSha256 = requireSha256(
      row.normalizedManifestSha256,
      `${candidateFile}:${index + 1}.normalizedManifestSha256`
    );
    if (isLegacy && normalizedManifestSha256 !== LEGACY_AUTHORITATIVE_MANIFEST_SHA256) {
      throw new Error(`${candidateFile}:${index + 1} legacy manifest identity changed`);
    }
    if (observedQueueVersion == null) observedQueueVersion = row.queueVersion as string;
    if (observedManifestSha256 == null) observedManifestSha256 = normalizedManifestSha256;
    if (
      observedQueueVersion !== row.queueVersion ||
      observedManifestSha256 !== normalizedManifestSha256
    ) {
      throw new Error(`${candidateFile}:${index + 1} mixes queue versions or normalized manifests`);
    }
    const sourceId = requireTheDogsSourceId(row.sourceId, `${candidateFile}:${index + 1}.sourceId`);
    if (seenSourceIds.has(sourceId)) {
      throw new Error(`${candidateFile}:${index + 1} duplicates sourceId ${sourceId}`);
    }
    seenSourceIds.add(sourceId);
    if (row.providerKey !== `thedogs:dog:${sourceId}`) {
      throw new Error(`${candidateFile}:${index + 1} providerKey does not match sourceId`);
    }
    const preferredName = requireNonEmptyString(
      row.preferredName,
      `${candidateFile}:${index + 1}.preferredName`
    );
    const expectedPath = requireExactTheDogsProfilePath(
      row.profilePath,
      sourceId,
      `${candidateFile}:${index + 1}.profilePath`
    );
    if (isLegacy && expectedPath !== buildTheDogsProfilePath(sourceId, preferredName)) {
      throw new Error(`${candidateFile}:${index + 1} legacy profilePath does not match id/name`);
    }
    if (
      isCurrent &&
      row.retrievalPathStatus !== "unverified-exact-id-retrieval-path" &&
      row.retrievalPathStatus !== "unverified-name-derived-retrieval-path"
    ) {
      throw new Error(`${candidateFile}:${index + 1} retrieval path must remain explicitly unverified`);
    }
    if (
      row.classification !== "race-observed-parent-profile-required" &&
      row.classification !== "parent-only-provider-profile-required" &&
      (!isCurrent || row.classification !== "r2-only-identity-retrieval-required")
    ) {
      throw new Error(`${candidateFile}:${index + 1} has an unknown classification`);
    }
    if (typeof row.sourceCutoff !== "string" || Number.isNaN(Date.parse(row.sourceCutoff))) {
      throw new Error(`${candidateFile}:${index + 1} sourceCutoff is invalid`);
    }
    if (typeof row.evidenceSha256 !== "string" || !/^[0-9a-f]{64}$/.test(row.evidenceSha256)) {
      throw new Error(`${candidateFile}:${index + 1} evidenceSha256 is invalid`);
    }

    const observedNames = requireObservedNames(
      row.observedNames,
      `${candidateFile}:${index + 1}.observedNames`
    );
    if (!observedNames.some((entry) => entry.name === preferredName)) {
      throw new Error(`${candidateFile}:${index + 1} preferredName was not observed`);
    }
    const relationships = requireRelationships(
      row.relationships,
      `${candidateFile}:${index + 1}.relationships`
    );
    const edges = requirePedigreeEdges(row.edges, `${candidateFile}:${index + 1}.edges`);
    const edgeCount = requireNonNegativeInteger(
      row.edgeCount,
      `${candidateFile}:${index + 1}.edgeCount`
    );
    const identityOnly = row.classification === "r2-only-identity-retrieval-required";
    if (edges.length !== edgeCount || relationships.sire + relationships.dam !== edgeCount) {
      throw new Error(`${candidateFile}:${index + 1} edge/name/relationship conservation failed`);
    }
    if (
      (!identityOnly &&
        (edgeCount === 0 ||
          observedNames.reduce((sum, entry) => sum + entry.observations, 0) !== edgeCount)) ||
      (identityOnly && edgeCount !== 0)
    ) {
      throw new Error(`${candidateFile}:${index + 1} classification/evidence conservation failed`);
    }
    const sourceArchiveKeys = requireSortedUniqueStrings(
      row.sourceArchiveKeys,
      `${candidateFile}:${index + 1}.sourceArchiveKeys`
    );
    const edgeArchiveKeys = [...new Set(edges.map((edge) => edge.sourceArchiveKey))].sort();
    if (JSON.stringify(sourceArchiveKeys) !== JSON.stringify(edgeArchiveKeys)) {
      throw new Error(`${candidateFile}:${index + 1} sourceArchiveKeys do not cover every edge`);
    }
    let parentSourceLineage: Array<Record<string, unknown>> = [];
    if (isCurrent) {
      const parentQueueGeneration = requirePositiveInteger(
        row.parentQueueGeneration,
        `${candidateFile}:${index + 1}.parentQueueGeneration`
      );
      const priorGenerationManifestSha256 = requireOptionalSha256(
        row.priorGenerationManifestSha256,
        `${candidateFile}:${index + 1}.priorGenerationManifestSha256`
      );
      if (
        (parentQueueGeneration === 1 && priorGenerationManifestSha256 !== null) ||
        (parentQueueGeneration > 1 && priorGenerationManifestSha256 === null)
      ) {
        throw new Error(`${candidateFile}:${index + 1} has inconsistent generation lineage`);
      }
      if (observedGeneration == null) observedGeneration = parentQueueGeneration;
      if (observedPriorGenerationSha256 === undefined) {
        observedPriorGenerationSha256 = priorGenerationManifestSha256;
      }
      if (
        observedGeneration !== parentQueueGeneration ||
        observedPriorGenerationSha256 !== priorGenerationManifestSha256
      ) {
        throw new Error(`${candidateFile}:${index + 1} mixes parent queue generations`);
      }
      parentSourceLineage = requireParentSourceLineage(
        row.parentSourceLineage,
        sourceId,
        `${candidateFile}:${index + 1}.parentSourceLineage`
      );
      if (
        parentSourceLineage.length === 0 ||
        sha256Text(JSON.stringify(parentSourceLineage)) !== row.parentSourceLineageSha256
      ) {
        throw new Error(`${candidateFile}:${index + 1} parent source lineage digest mismatch`);
      }
    }
    const provenance = isCurrent
      ? { observedNames, relationships, edges, sourceArchiveKeys, parentSourceLineage }
      : { observedNames, relationships, edges, sourceArchiveKeys };
    if (sha256Text(JSON.stringify(provenance)) !== row.evidenceSha256) {
      throw new Error(`${candidateFile}:${index + 1} evidence digest mismatch`);
    }

    candidates.push({
      sourceId,
      name: preferredName,
      profilePath: expectedPath,
      firstSeenDate: "",
      lastSeenDate: "",
      raceAppearances: 0,
      names: Object.fromEntries(observedNames.map((entry) => [entry.name, entry.observations])),
      profilePaths: { [expectedPath]: 1 },
      authoritativeEvidence: row,
    });
  }
  if (candidates.length === 0) throw new Error(`${candidateFile} has no candidates`);
  return candidates.sort(
    (a, b) => Number(a.sourceId) - Number(b.sourceId) || a.sourceId.localeCompare(b.sourceId)
  );
}

function proveFetchedProfileIdentity(
  profileHtml: string,
  candidate: DogCandidate,
  showMorePath: string | null | undefined
) {
  const requested = new URL(candidate.profilePath, "https://www.thedogs.com.au");
  if (
    requested.origin !== "https://www.thedogs.com.au" ||
    !new RegExp(`^/dogs/${candidate.sourceId}/[a-z0-9-]+$`).test(requested.pathname)
  ) {
    throw new ProfileIdentityConflictError(
      `profile path does not bind exact TheDogs source id ${candidate.sourceId}`
    );
  }
  const pageDogIds = [...profileHtml.matchAll(
    /<blackbook-dog\b[^>]*\bdata-dog-id=["']([0-9]+)["'][^>]*>/gi
  )].map((match) => match[1]);
  if (pageDogIds.length === 0 || pageDogIds.some((sourceId) => sourceId !== candidate.sourceId)) {
    throw new ProfileIdentityConflictError(
      `returned profile page identity does not match TheDogs source id ${candidate.sourceId}`
    );
  }
  const observedProfilePaths = [...new Set(
    [...profileHtml.matchAll(/\/dogs\/([0-9]+)\/([a-z0-9-]+)(?:\/full-form)?(?:\?[^"'<\s]*)?/gi)]
      .filter((match) => match[1] === candidate.sourceId)
      .map((match) => match[0].replace(/&amp;/gi, "&"))
  )].sort();
  if (showMorePath) {
    const showMore = new URL(showMorePath, "https://www.thedogs.com.au");
    if (
      showMore.origin !== "https://www.thedogs.com.au" ||
      !new RegExp(`^/dogs/${candidate.sourceId}/[a-z0-9-]+/full-form$`).test(showMore.pathname)
    ) {
      throw new ProfileIdentityConflictError(
        `returned full-form path does not match TheDogs source id ${candidate.sourceId}`
      );
    }
  }
  return {
    provider: "thedogs",
    requestedSourceId: candidate.sourceId,
    requestedProfilePath: requested.pathname,
    pageDogIds: [...new Set(pageDogIds)].sort(),
    observedProfilePaths,
    showMorePath: showMorePath ?? null,
    verificationStatus: "verified-exact-provider-page-identity",
    canonicalPromotionEligible: false,
  };
}

function requireRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function assertExactKeys(value: Record<string, unknown>, allowed: Set<string>, label: string) {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) throw new Error(`${label} has unknown field ${key}`);
  }
  for (const key of allowed) {
    if (!(key in value)) throw new Error(`${label} is missing field ${key}`);
  }
}

function requireNonEmptyString(value: unknown, label: string) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} is required`);
  return value.trim();
}

function requireSha256(value: unknown, label: string) {
  const digest = requireNonEmptyString(value, label);
  if (!/^[0-9a-f]{64}$/.test(digest)) throw new Error(`${label} must be lowercase SHA-256`);
  return digest;
}

function requireOptionalSha256(value: unknown, label: string) {
  if (value === null) return null;
  return requireSha256(value, label);
}

function requireExactTheDogsProfilePath(value: unknown, sourceId: string, label: string) {
  const profilePath = requireNonEmptyString(value, label);
  const url = new URL(profilePath, "https://www.thedogs.com.au");
  if (
    url.origin !== "https://www.thedogs.com.au" ||
    url.search ||
    url.hash ||
    !new RegExp(`^/dogs/${sourceId}/[a-z0-9-]+$`).test(url.pathname)
  ) {
    throw new Error(`${label} must be an unverified retrieval path bound to exact sourceId`);
  }
  return url.pathname;
}

function requireTheDogsSourceId(value: unknown, label: string) {
  const sourceId = requireNonEmptyString(value, label);
  if (!/^[0-9]+$/.test(sourceId)) throw new Error(`${label} must be numeric`);
  return sourceId;
}

function requirePositiveInteger(value: unknown, label: string) {
  if (!Number.isInteger(value) || (value as number) <= 0) {
    throw new Error(`${label} must be a positive integer`);
  }
  return value as number;
}

function requireNonNegativeInteger(value: unknown, label: string) {
  if (!Number.isInteger(value) || (value as number) < 0) {
    throw new Error(`${label} must be a non-negative integer`);
  }
  return value as number;
}

function requireObservedNames(value: unknown, label: string) {
  if (!Array.isArray(value) || value.length === 0) throw new Error(`${label} must be non-empty`);
  const names = value.map((entry, index) => {
    const row = requireRecord(entry, `${label}[${index}]`);
    assertExactKeys(row, new Set(["name", "observations"]), `${label}[${index}]`);
    return {
      name: requireNonEmptyString(row.name, `${label}[${index}].name`),
      observations: requirePositiveInteger(row.observations, `${label}[${index}].observations`),
    };
  });
  const sorted = [...names].sort((a, b) => a.name.localeCompare(b.name));
  if (new Set(names.map((entry) => entry.name)).size !== names.length ||
      JSON.stringify(names) !== JSON.stringify(sorted)) {
    throw new Error(`${label} must be unique and sorted`);
  }
  return names;
}

function requireRelationships(value: unknown, label: string) {
  const row = requireRecord(value, label);
  assertExactKeys(row, new Set(["sire", "dam"]), label);
  for (const relationship of ["sire", "dam"] as const) {
    if (!Number.isInteger(row[relationship]) || (row[relationship] as number) < 0) {
      throw new Error(`${label}.${relationship} must be a non-negative integer`);
    }
  }
  return { sire: row.sire as number, dam: row.dam as number };
}

function requirePedigreeEdges(value: unknown, label: string) {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array`);
  const seen = new Set<string>();
  const edges = value.map((entry, index) => {
    const row = requireRecord(entry, `${label}[${index}]`);
    assertExactKeys(
      row,
      new Set(["edgeNaturalKey", "childNaturalKey", "relationship", "sourceArchiveKey"]),
      `${label}[${index}]`
    );
    const childNaturalKey = requireNonEmptyString(
      row.childNaturalKey,
      `${label}[${index}].childNaturalKey`
    );
    const relationship = row.relationship;
    if (!/^thedogs:dog:[0-9]+$/.test(childNaturalKey) ||
        (relationship !== "sire" && relationship !== "dam")) {
      throw new Error(`${label}[${index}] has an invalid child or relationship`);
    }
    const edgeNaturalKey = requireNonEmptyString(
      row.edgeNaturalKey,
      `${label}[${index}].edgeNaturalKey`
    );
    const sourceArchiveKey = requireNonEmptyString(
      row.sourceArchiveKey,
      `${label}[${index}].sourceArchiveKey`
    );
    if (edgeNaturalKey !== `${childNaturalKey}:pedigree:${relationship}` ||
        sourceArchiveKey !== `thedogs:dog-profile:${childNaturalKey.slice(12)}` ||
        seen.has(edgeNaturalKey)) {
      throw new Error(`${label}[${index}] has duplicate or inconsistent provenance`);
    }
    seen.add(edgeNaturalKey);
    return { edgeNaturalKey, childNaturalKey, relationship, sourceArchiveKey };
  });
  const sorted = [...edges].sort((a, b) => a.edgeNaturalKey.localeCompare(b.edgeNaturalKey));
  if (JSON.stringify(edges) !== JSON.stringify(sorted)) throw new Error(`${label} must be sorted`);
  return edges;
}

function requireParentSourceLineage(value: unknown, sourceId: string, label: string) {
  if (!Array.isArray(value) || value.length === 0) throw new Error(`${label} must be non-empty`);
  const lineage = value.map((entry, index) => {
    const row = requireRecord(entry, `${label}[${index}]`);
    if (row.sourceType === "normalized-profile-parent-edge") {
      assertExactKeys(
        row,
        new Set([
          "sourceType",
          "normalizedManifestSha256",
          "sourceArchiveKey",
          "edgeNaturalKey",
          "childProviderKey",
          "relationship",
          "exactParentSourceId",
          "exactParentProviderKey",
        ]),
        `${label}[${index}]`
      );
      requireSha256(row.normalizedManifestSha256, `${label}[${index}].normalizedManifestSha256`);
      requireNonEmptyString(row.sourceArchiveKey, `${label}[${index}].sourceArchiveKey`);
      requireNonEmptyString(row.edgeNaturalKey, `${label}[${index}].edgeNaturalKey`);
      if (
        !/^thedogs:dog:[0-9]+$/.test(requireNonEmptyString(
          row.childProviderKey,
          `${label}[${index}].childProviderKey`
        )) ||
        (row.relationship !== "sire" && row.relationship !== "dam")
      ) {
        throw new Error(`${label}[${index}] has invalid child/relationship lineage`);
      }
    } else if (row.sourceType === "r2-only-synthetic-identity") {
      assertExactKeys(
        row,
        new Set([
          "sourceType",
          "sourceName",
          "sourceRecordId",
          "sourceArtifactKey",
          "sourceArtifactSha256",
          "sourceObservedName",
          "exactParentSourceId",
          "exactParentProviderKey",
        ]),
        `${label}[${index}]`
      );
      if (row.sourceName !== "r2") throw new Error(`${label}[${index}] sourceName changed`);
      requireNonEmptyString(row.sourceRecordId, `${label}[${index}].sourceRecordId`);
      requireNonEmptyString(row.sourceArtifactKey, `${label}[${index}].sourceArtifactKey`);
      requireSha256(row.sourceArtifactSha256, `${label}[${index}].sourceArtifactSha256`);
      requireNonEmptyString(row.sourceObservedName, `${label}[${index}].sourceObservedName`);
    } else {
      throw new Error(`${label}[${index}] has an unsupported sourceType`);
    }
    if (
      row.exactParentSourceId !== sourceId ||
      row.exactParentProviderKey !== `thedogs:dog:${sourceId}`
    ) {
      throw new Error(`${label}[${index}] does not bind exact parent sourceId`);
    }
    return row;
  });
  const sorted = [...lineage].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  if (JSON.stringify(lineage) !== JSON.stringify(sorted)) {
    throw new Error(`${label} must be deterministic and sorted`);
  }
  return lineage;
}

function requireSortedUniqueStrings(value: unknown, label: string) {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string" || !entry)) {
    throw new Error(`${label} must contain non-empty strings`);
  }
  const strings = value as string[];
  const sorted = [...new Set(strings)].sort();
  if (JSON.stringify(strings) !== JSON.stringify(sorted)) {
    throw new Error(`${label} must be unique and sorted`);
  }
  return strings;
}

function sha256Text(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function addRunnerDog(
  dogs: Map<string, DogCandidate>,
  date: string,
  runner: LiveRunner
) {
  const sourceId =
    runner.dog.earBrand?.match(/^thedogs:(\d+)$/i)?.[1] ??
    sourceIdFromRaw(runner.sourceRawJson);
  if (!sourceId) return;

  const name = runner.dog.name?.trim() || sourceId;
  const profilePath =
    profilePathFromRaw(runner.sourceRawJson) ??
    buildTheDogsProfilePath(sourceId, name);
  const existing = dogs.get(sourceId);
  if (!existing) {
    dogs.set(sourceId, {
      sourceId,
      name,
      profilePath,
      firstSeenDate: date,
      lastSeenDate: date,
      raceAppearances: 1,
      names: { [name]: 1 },
      profilePaths: { [profilePath]: 1 },
    });
    return;
  }

  existing.raceAppearances += 1;
  existing.firstSeenDate = minDate(existing.firstSeenDate, date);
  existing.lastSeenDate = maxDate(existing.lastSeenDate, date);
  existing.names[name] = (existing.names[name] ?? 0) + 1;
  existing.profilePaths[profilePath] = (existing.profilePaths[profilePath] ?? 0) + 1;
  existing.name = mostCommon(existing.names);
  existing.profilePath = mostCommon(existing.profilePaths);
}

async function scanRawArchives(rawDir: string) {
  const files: RawCandidate[] = [];
  await collectRawArchives(rawDir, rawDir, files);
  return files.sort((a, b) => a.date.localeCompare(b.date));
}

async function collectRawArchives(
  rootDir: string,
  currentDir: string,
  files: RawCandidate[]
) {
  let entries: Array<{ name: string; isDirectory(): boolean; isFile(): boolean }>;
  try {
    entries = await readdir(currentDir, { withFileTypes: true });
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return;
    throw err;
  }

  for (const entry of entries) {
    const fullPath = path.join(currentDir, entry.name);
    if (entry.isDirectory()) {
      await collectRawArchives(rootDir, fullPath, files);
      continue;
    }
    if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
    const date = dateFromRawPath(rootDir, fullPath);
    if (date) files.push({ date, rawPath: fullPath });
  }
}

async function readRawArchive(candidate: RawCandidate): Promise<RawArchive> {
  const raw = JSON.parse(await readFile(candidate.rawPath, "utf8")) as RawArchive;
  if (!Array.isArray(raw.meetings)) {
    throw new Error(`${candidate.rawPath} is missing meetings[]`);
  }
  return raw;
}

async function readCompletedProfiles(options: Options) {
  const completed = new Set<string>();
  for (const record of await readProgress(options.progressFile)) {
    if (record.sourceId && record.ok && record.archived) completed.add(record.sourceId);
  }
  await collectExistingProfiles(options.outputDir, completed);
  return completed;
}

async function collectExistingProfiles(outputDir: string, completed: Set<string>) {
  let entries: Array<{ name: string; isDirectory(): boolean; isFile(): boolean }>;
  try {
    entries = await readdir(outputDir, { withFileTypes: true });
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return;
    throw err;
  }

  for (const entry of entries) {
    const fullPath = path.join(outputDir, entry.name);
    if (entry.isDirectory()) {
      await collectExistingProfiles(fullPath, completed);
    } else if (entry.isFile() && /^\d+\.json$/.test(entry.name)) {
      completed.add(entry.name.replace(/\.json$/, ""));
    }
  }
}

async function readProgress(progressFile: string) {
  try {
    const body = await readFile(progressFile, "utf8");
    return body
      .split(/\r?\n/)
      .filter((line) => line.trim())
      .map((line) => JSON.parse(line) as ProgressRecord);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }
}

async function appendProgress(progressFile: string, record: Record<string, unknown>) {
  await mkdir(path.dirname(progressFile), { recursive: true });
  await appendFile(
    progressFile,
    `${JSON.stringify({ ...record, loggedAt: new Date().toISOString() })}\n`
  );
}

async function appendAuthoritativeOutcome(
  outcomeLedger: string,
  candidate: DogCandidate,
  outcome: Record<string, unknown>
) {
  const evidence = candidate.authoritativeEvidence;
  if (!evidence) throw new Error("authoritative outcome requires candidate evidence");
  const queueVersion = requireNonEmptyString(evidence.queueVersion, "queueVersion");
  const parentQueueGeneration =
    queueVersion === AUTHORITATIVE_QUEUE_VERSION
      ? requirePositiveInteger(evidence.parentQueueGeneration, "parentQueueGeneration")
      : 1;
  const parentSourceLineageSha256 =
    queueVersion === AUTHORITATIVE_QUEUE_VERSION
      ? requireSha256(evidence.parentSourceLineageSha256, "parentSourceLineageSha256")
      : sha256Text(JSON.stringify(evidence.edges));
  const row = {
    schemaVersion: 1,
    ledgerVersion: AUTHORITATIVE_OUTCOME_LEDGER_VERSION,
    provider: "thedogs",
    sourceId: candidate.sourceId,
    providerKey: `thedogs:dog:${candidate.sourceId}`,
    parentQueueGeneration,
    normalizedManifestSha256: requireSha256(
      evidence.normalizedManifestSha256,
      "normalizedManifestSha256"
    ),
    queueEvidenceSha256: requireSha256(evidence.evidenceSha256, "evidenceSha256"),
    parentSourceLineageSha256,
    ...outcome,
    canonicalPromotionEligible: false,
    loggedAt: new Date().toISOString(),
  };
  await mkdir(path.dirname(outcomeLedger), { recursive: true });
  await appendFile(outcomeLedger, `${JSON.stringify(row)}\n`);
}

function parseOptions(args: string[]): Options {
  const values = parseFlags(args);
  const from = stringOption(values, "from");
  const to = stringOption(values, "to");
  const sourceId = stringOption(values, "source-id");
  const candidateFile = stringOption(values, "candidate-file");
  const authoritativeOutcomeLedger =
    stringOption(values, "authoritative-outcome-ledger") ??
    DEFAULT_AUTHORITATIVE_OUTCOME_LEDGER;
  const shardIndex = optionalPositiveInt(stringOption(values, "shard-index"));
  const shardCount = optionalPositiveInt(stringOption(values, "shard-count"));
  if (from) assertDate(from, "--from");
  if (to) assertDate(to, "--to");
  if (from && to && from > to) throw new Error("--from must be before or equal to --to");
  if (sourceId && candidateFile) {
    throw new Error("--source-id and --candidate-file are mutually exclusive");
  }
  if (candidateFile && (from || to)) {
    throw new Error("--candidate-file cannot be combined with --from or --to");
  }
  if ((shardIndex == null) !== (shardCount == null)) {
    throw new Error("--shard-index and --shard-count must be provided together");
  }
  if (shardIndex != null && shardCount != null && shardIndex > shardCount) {
    throw new Error("--shard-index must be less than or equal to --shard-count");
  }

  return {
    rawDir: stringOption(values, "raw-dir") ?? DEFAULT_RAW_DIR,
    outputDir: stringOption(values, "output-dir") ?? DEFAULT_OUTPUT_DIR,
    progressFile: stringOption(values, "progress-file") ?? DEFAULT_PROGRESS,
    full: values.has("full"),
    limit: positiveInt(stringOption(values, "limit"), 25),
    concurrency: positiveInt(stringOption(values, "concurrency"), 1),
    pauseMs: nonNegativeInt(stringOption(values, "pause-ms"), 1_000),
    resume: !values.has("no-resume"),
    continueOnError: values.has("continue-on-error"),
    maxErrors: positiveInt(stringOption(values, "max-errors"), 25),
    retryAttempts: nonNegativeInt(stringOption(values, "retry-attempts"), 2),
    retryDelayMs: nonNegativeInt(stringOption(values, "retry-delay-ms"), 2_000),
    sort: sortOption(stringOption(values, "sort")),
    sourceId,
    candidateFile,
    authoritativeOutcomeLedger,
    from,
    to,
    shardIndex,
    shardCount,
    dryRun: values.has("dry-run"),
  };
}

function parseFlags(args: string[]) {
  const values = new Map<string, string | true>();
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg.startsWith("--")) continue;
    const [rawKey, inlineValue] = arg.slice(2).split("=", 2);
    const next = args[index + 1];
    if (inlineValue != null) {
      values.set(rawKey, inlineValue);
    } else if (next && !next.startsWith("--")) {
      values.set(rawKey, next);
      index += 1;
    } else {
      values.set(rawKey, true);
    }
  }
  return values;
}

function stringOption(values: Map<string, string | true>, key: string) {
  const value = values.get(key);
  return typeof value === "string" ? value : undefined;
}

function sourceIdFromRaw(sourceRawJson?: string) {
  if (!sourceRawJson) return undefined;
  try {
    const raw = JSON.parse(sourceRawJson) as { dogId?: unknown };
    return typeof raw.dogId === "string" ? raw.dogId : undefined;
  } catch {
    return undefined;
  }
}

function profilePathFromRaw(sourceRawJson?: string) {
  if (!sourceRawJson) return undefined;
  try {
    const raw = JSON.parse(sourceRawJson) as { dogProfileUrl?: unknown };
    return typeof raw.dogProfileUrl === "string" ? raw.dogProfileUrl : undefined;
  } catch {
    return undefined;
  }
}

function profilePathFor(outputDir: string, sourceId: string) {
  const bucket = sourceId.padStart(2, "0").slice(-2);
  return path.join(outputDir, bucket, `${sourceId}.json`);
}

function sortCandidates(
  candidates: DogCandidate[],
  sort: Options["sort"]
) {
  return [...candidates].sort((a, b) => {
    if (sort === "appearances") {
      return (
        b.raceAppearances - a.raceAppearances ||
        a.firstSeenDate.localeCompare(b.firstSeenDate) ||
        a.sourceId.localeCompare(b.sourceId)
      );
    }
    const dateOrder = a.firstSeenDate.localeCompare(b.firstSeenDate);
    if (dateOrder !== 0) return dateOrder;
    return a.sourceId.localeCompare(b.sourceId);
  });
}

function filterShard(candidates: DogCandidate[], options: Options) {
  if (options.sourceId || options.shardIndex == null || options.shardCount == null) {
    return candidates;
  }
  return candidates.filter(
    (candidate) => shardIndexFor(candidate.sourceId, options.shardCount as number) === options.shardIndex
  );
}

function shardIndexFor(sourceId: string, shardCount: number) {
  return (stableHash(sourceId) % shardCount) + 1;
}

function stableHash(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function dateFromRawPath(rootDir: string, rawPath: string) {
  const relative = path.relative(rootDir, rawPath);
  const parts = relative.split(path.sep);
  if (parts.length !== 3) return null;
  const [year, month, fileName] = parts;
  const day = fileName.replace(/\.json$/i, "");
  const date = `${year}-${month}-${day}`;
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null;
}

function assertDate(value: string, label: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`${label} must be YYYY-MM-DD`);
  }
}

function positiveInt(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function optionalPositiveInt(value: string | undefined) {
  if (value == null) return undefined;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error("Shard options must be positive integers");
  }
  return parsed;
}

function nonNegativeInt(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function sortOption(value: string | undefined): Options["sort"] {
  if (value === "appearances" || value === "first-seen") return value;
  if (value) throw new Error("--sort must be either first-seen or appearances");
  return "first-seen";
}

function isTransientProfileError(error: unknown) {
  return /\b(429|502|503|504)\b|ECONNRESET|ETIMEDOUT|fetch failed|timeout/i.test(
    errorMessage(error)
  );
}

function classifyAuthoritativeFailure(error: unknown, candidate: DogCandidate) {
  const message = errorMessage(error);
  if (error instanceof ProfileIdentityConflictError) {
    return {
      outcome: "identity-conflict",
      terminal: true,
      errorClass: "provider-page-identity-conflict",
    };
  }
  if (/\b(?:404|410)\b/.test(message)) {
    const queueVersion = candidate.authoritativeEvidence?.queueVersion;
    const retrievalPathStatus = candidate.authoritativeEvidence?.retrievalPathStatus;
    if (
      queueVersion === LEGACY_AUTHORITATIVE_QUEUE_VERSION ||
      retrievalPathStatus === "unverified-exact-id-retrieval-path" ||
      retrievalPathStatus === "unverified-name-derived-retrieval-path"
    ) {
      return {
        outcome: "provider-contract-conflict",
        terminal: true,
        errorClass: "unverified-retrieval-path-not-found",
      };
    }
    return {
      outcome: "unavailable",
      terminal: true,
      errorClass: "provider-profile-unavailable",
    };
  }
  if (isTransientProfileError(error)) {
    return {
      outcome: "transient-error",
      terminal: false,
      errorClass: "transient-provider-error",
    };
  }
  return {
    outcome: "provider-contract-conflict",
    terminal: true,
    errorClass: "provider-profile-contract-conflict",
  };
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function mostCommon(values: Record<string, number>) {
  return Object.entries(values).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ?? "";
}

function minDate(a: string, b: string) {
  return a && a <= b ? a : b;
}

function maxDate(a: string, b: string) {
  return a && a >= b ? a : b;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function mapLimit<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>
) {
  const executing = new Set<Promise<void>>();
  for (const item of items) {
    const promise = worker(item).finally(() => executing.delete(promise));
    executing.add(promise);
    if (executing.size >= concurrency) await Promise.race(executing);
  }
  await Promise.all(executing);
}

main().catch((err) => {
  console.error("[backfill:thedogs:dog-profile-raw] failed:", err);
  process.exitCode = 1;
});
