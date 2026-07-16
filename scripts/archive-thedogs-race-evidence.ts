/**
 * Retrieve exact TheDogs race-result pages into an immutable, raw-only archive.
 *
 * No database is opened and no canonical row is created. Every retrieved page
 * remains promotion-ineligible until a later, separately reviewed normalizer
 * proves its identity and relationships against the target database.
 */
import {
  access,
  appendFile,
  mkdir,
  readFile,
  stat,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { parseTheDogsRaceResult } from "../src/lib/live/thedogs";
import {
  sanitizeArchiveValue,
  sanitizeProviderHtml,
} from "../src/lib/live/raw-sanitizer";
import { readBoundedTextResponse } from "../src/lib/remote-response";
import {
  loadRaceEvidenceQueue,
  parseExactTheDogsRacePath,
  type RaceEvidenceQueueRow,
  sameRaceTriple,
  sha256Text,
  type TheDogsRaceIdentity,
} from "./build-thedogs-race-evidence-retrieval-queue";

export const RACE_EVIDENCE_ARCHIVE_VERSION =
  "giq-thedogs-race-evidence-raw/v1";
export const RACE_EVIDENCE_OUTCOME_VERSION =
  "giq-thedogs-race-evidence-outcome/v1";
export const RACE_EVIDENCE_NETWORK_CONFIRMATION =
  "I_CONFIRM_BOUNDED_THEDOGS_RACE_EVIDENCE_RETRIEVAL";

const THEDOGS_ORIGIN = "https://www.thedogs.com.au";
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
const MAX_REDIRECTS = 3;
const MAX_CONCURRENCY = 8;
const MAX_REQUESTS_PER_SECOND = 5;
const MAX_RESPONSE_BYTES = 5 * 1024 * 1024;
const MAX_TIMEOUT_MS = 120_000;
const MAX_RETRIES = 5;
const MAX_RETRY_DELAY_MS = 60_000;
const SHA256 = /^[0-9a-f]{64}$/;
const ALLOWED_CONTENT_TYPES = [
  "text/html",
  "application/xhtml+xml",
  "application/json",
  "application/javascript",
  "text/javascript",
  "+json",
] as const;

type FetchLike = typeof fetch;
type Sleep = (milliseconds: number) => Promise<void>;
type Now = () => Date;
type OutcomeName =
  | "archived-unverified"
  | "unavailable"
  | "identity-conflict"
  | "provider-contract-conflict"
  | "transient-error";

export type ArchiveRaceEvidenceOptions = {
  queueDir: string;
  outputDir: string;
  outcomeLedger: string;
  concurrency: number;
  requestIntervalMs: number;
  timeoutMs: number;
  maxBytes: number;
  retryAttempts: number;
  retryDelayMs: number;
  limit: number;
  dryRun: boolean;
  fetchImpl?: FetchLike;
  sleepImpl?: Sleep;
  now?: Now;
};

export type RaceEvidenceOutcome = {
  schemaVersion: 1;
  ledgerVersion: typeof RACE_EVIDENCE_OUTCOME_VERSION;
  provider: "thedogs";
  providerKey: string;
  racePath: string;
  identity: TheDogsRaceIdentity;
  queueManifestSha256: string;
  queueRowEvidenceSha256: string;
  outcome: OutcomeName;
  terminal: boolean;
  attempts: number;
  requestCount: number;
  archiveRelativePath: string | null;
  archiveSha256: string | null;
  errorClass: string | null;
  errorSha256: string | null;
  canonicalPromotionEligible: false;
  loggedAt: string;
  evidenceSha256: string;
};

export type ArchiveRaceEvidenceResult = {
  queueRows: number;
  alreadyTerminal: number;
  selected: number;
  archived: number;
  unavailable: number;
  conflicts: number;
  transient: number;
  dryRun: boolean;
};

type FailureKind = Exclude<OutcomeName, "archived-unverified">;

class RetrievalFailure extends Error {
  constructor(
    readonly outcome: FailureKind,
    readonly terminal: boolean,
    readonly errorClass: string,
  ) {
    super(errorClass);
    this.name = "RetrievalFailure";
  }
}

type ArchiveDocument = {
  schemaVersion: 1;
  archiveVersion: typeof RACE_EVIDENCE_ARCHIVE_VERSION;
  provider: "thedogs";
  providerKey: string;
  requestedRacePath: string;
  finalRacePath: string;
  identity: TheDogsRaceIdentity;
  queueManifestSha256: string;
  queueRowEvidenceSha256: string;
  fetchedAt: string;
  response: {
    status: 200;
    contentType: string;
    bytes: number;
    bodySha256: string;
    sanitizedBodySha256: string;
    sanitizedHtml: string;
  };
  identityProof: JsonRecord;
  parsedResult: unknown;
  normalizationStatus: "unverified-authoritative-result-page";
  canonicalPromotionEligible: false;
  archiveEvidenceSha256: string;
};

type JsonRecord = Record<string, unknown>;

export async function archiveRaceEvidence(
  options: ArchiveRaceEvidenceOptions,
): Promise<ArchiveRaceEvidenceResult> {
  validateOptions(options);
  const queue = await loadRaceEvidenceQueue(options.queueDir);
  const terminal = await readTerminalOutcomes(
    options.outcomeLedger,
    options.outputDir,
    queue.manifestSha256,
    queue.rows,
  );
  const pending = queue.rows.filter((row) => !terminal.has(row.providerKey));
  const selected = options.limit > 0 ? pending.slice(0, options.limit) : pending;
  const result: ArchiveRaceEvidenceResult = {
    queueRows: queue.rows.length,
    alreadyTerminal: terminal.size,
    selected: selected.length,
    archived: 0,
    unavailable: 0,
    conflicts: 0,
    transient: 0,
    dryRun: options.dryRun,
  };
  if (options.dryRun || selected.length === 0) return result;

  const outputDir = path.resolve(options.outputDir);
  const ledgerPath = path.resolve(options.outcomeLedger);
  await mkdir(outputDir, { recursive: true });
  await mkdir(path.dirname(ledgerPath), { recursive: true });
  const fetchImpl = options.fetchImpl ?? fetch;
  const sleepImpl = options.sleepImpl ?? sleep;
  const now = options.now ?? (() => new Date());
  const gate = new RequestGate(options.requestIntervalMs, sleepImpl);
  let ledgerWrite = Promise.resolve();
  const appendOutcome = (outcome: RaceEvidenceOutcome) => {
    ledgerWrite = ledgerWrite.then(() =>
      appendFile(ledgerPath, `${JSON.stringify(outcome)}\n`, "utf8"),
    );
    return ledgerWrite;
  };

  await mapLimit(selected, options.concurrency, async (row) => {
    const archiveRelativePath = archivePathFor(row.providerKey);
    const archivePath = safeChild(outputDir, archiveRelativePath);
    if (await exists(archivePath)) {
      const archiveSha256 = await verifyArchive(
        archivePath,
        row,
        queue.manifestSha256,
      );
      await appendOutcome(
        makeOutcome({
          row,
          queueManifestSha256: queue.manifestSha256,
          outcome: "archived-unverified",
          terminal: true,
          attempts: 0,
          requestCount: 0,
          archiveRelativePath,
          archiveSha256,
          errorClass: null,
          errorSha256: null,
          now,
        }),
      );
      result.archived += 1;
      return;
    }

    const retrieval = await retrieveWithRetries(row, {
      fetchImpl,
      gate,
      timeoutMs: options.timeoutMs,
      maxBytes: options.maxBytes,
      retryAttempts: options.retryAttempts,
      retryDelayMs: options.retryDelayMs,
      sleepImpl,
      now,
      queueManifestSha256: queue.manifestSha256,
    });
    if (retrieval.ok) {
      await mkdir(path.dirname(archivePath), { recursive: true });
      const archiveBody = `${JSON.stringify(retrieval.archive)}\n`;
      const archiveSha256 = sha256Text(archiveBody);
      try {
        await writeFile(archivePath, archiveBody, {
          encoding: "utf8",
          flag: "wx",
        });
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
        const existingSha256 = await verifyArchive(
          archivePath,
          row,
          queue.manifestSha256,
        );
        if (existingSha256 !== archiveSha256) {
          throw new Error(`immutable archive collision: ${archiveRelativePath}`);
        }
      }
      await appendOutcome(
        makeOutcome({
          row,
          queueManifestSha256: queue.manifestSha256,
          outcome: "archived-unverified",
          terminal: true,
          attempts: retrieval.attempts,
          requestCount: retrieval.requestCount,
          archiveRelativePath,
          archiveSha256,
          errorClass: null,
          errorSha256: null,
          now,
        }),
      );
      result.archived += 1;
      return;
    }
    await appendOutcome(
      makeOutcome({
        row,
        queueManifestSha256: queue.manifestSha256,
        outcome: retrieval.failure.outcome,
        terminal: retrieval.failure.terminal,
        attempts: retrieval.attempts,
        requestCount: retrieval.requestCount,
        archiveRelativePath: null,
        archiveSha256: null,
        errorClass: retrieval.failure.errorClass,
        errorSha256: sha256Text(retrieval.failure.message),
        now,
      }),
    );
    if (retrieval.failure.outcome === "unavailable") result.unavailable += 1;
    else if (retrieval.failure.outcome === "transient-error") result.transient += 1;
    else result.conflicts += 1;
  });
  await ledgerWrite;
  return result;
}

async function retrieveWithRetries(
  row: RaceEvidenceQueueRow,
  input: {
    fetchImpl: FetchLike;
    gate: RequestGate;
    timeoutMs: number;
    maxBytes: number;
    retryAttempts: number;
    retryDelayMs: number;
    sleepImpl: Sleep;
    now: Now;
    queueManifestSha256: string;
  },
) {
  const counter = { requests: 0 };
  const maxAttempts = input.retryAttempts + 1;
  let lastFailure = new RetrievalFailure(
    "transient-error",
    false,
    "provider-request-not-attempted",
  );
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const page = await fetchExactRacePage(row, input, counter);
      let html: string;
      try {
        html = await readBoundedTextResponse(page.response, {
          maxBytes: input.maxBytes,
          allowedContentTypes: ALLOWED_CONTENT_TYPES,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "";
        if (/remote_response\.(?:invalid_content_type|too_large|invalid_limit)/.test(message)) {
          throw new RetrievalFailure(
            "provider-contract-conflict",
            true,
            "provider-response-invalid-or-oversized",
          );
        }
        throw new RetrievalFailure(
          "transient-error",
          false,
          "provider-response-read-failed",
        );
      }
      if (!html.trim()) {
        throw new RetrievalFailure(
          "provider-contract-conflict",
          true,
          "provider-result-empty",
        );
      }
      const { parsedResult, identityProof } = proveResultPage(
        html,
        row,
        page.finalUrl,
      );
      const sanitizedHtml = sanitizeProviderHtml(html);
      const unsignedArchive = {
        schemaVersion: 1 as const,
        archiveVersion: RACE_EVIDENCE_ARCHIVE_VERSION as typeof RACE_EVIDENCE_ARCHIVE_VERSION,
        provider: "thedogs" as const,
        providerKey: row.providerKey,
        requestedRacePath: row.racePath,
        finalRacePath: `${page.finalUrl.pathname}${page.finalUrl.search}`,
        identity: row.identity,
        queueManifestSha256: input.queueManifestSha256,
        queueRowEvidenceSha256: row.evidenceSha256,
        fetchedAt: input.now().toISOString(),
        response: {
          status: 200 as const,
          contentType: contentType(page.response),
          bytes: Buffer.byteLength(html),
          bodySha256: sha256Text(html),
          sanitizedBodySha256: sha256Text(sanitizedHtml),
          sanitizedHtml,
        },
        identityProof,
        parsedResult: sanitizeArchiveValue(parsedResult),
        normalizationStatus: "unverified-authoritative-result-page" as const,
        canonicalPromotionEligible: false as const,
      };
      const archive: ArchiveDocument = {
        ...unsignedArchive,
        archiveEvidenceSha256: sha256Text(JSON.stringify(unsignedArchive)),
      };
      return {
        ok: true as const,
        archive,
        attempts: attempt,
        requestCount: counter.requests,
      };
    } catch (error) {
      lastFailure = classifyFailure(error);
      if (
        lastFailure.terminal ||
        lastFailure.outcome !== "transient-error" ||
        attempt >= maxAttempts
      ) {
        return {
          ok: false as const,
          failure: lastFailure,
          attempts: attempt,
          requestCount: counter.requests,
        };
      }
      if (input.retryDelayMs > 0) await input.sleepImpl(input.retryDelayMs);
    }
  }
  return {
    ok: false as const,
    failure: lastFailure,
    attempts: maxAttempts,
    requestCount: counter.requests,
  };
}

async function fetchExactRacePage(
  row: RaceEvidenceQueueRow,
  input: {
    fetchImpl: FetchLike;
    gate: RequestGate;
    timeoutMs: number;
  },
  counter: { requests: number },
) {
  const requested = new URL(row.racePath, THEDOGS_ORIGIN);
  let current = requested;
  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
    await input.gate.wait();
    counter.requests += 1;
    const response = await fetchWithTimeout(
      input.fetchImpl,
      current,
      input.timeoutMs,
    );
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      if (redirects === MAX_REDIRECTS) {
        await cancelBody(response);
        throw new RetrievalFailure(
          "identity-conflict",
          true,
          "provider-redirect-limit",
        );
      }
      const location = response.headers.get("location");
      await cancelBody(response);
      if (!location || location.length > 512) {
        throw new RetrievalFailure(
          "identity-conflict",
          true,
          "provider-redirect-invalid",
        );
      }
      let next: URL;
      try {
        next = new URL(location, current);
      } catch {
        throw new RetrievalFailure(
          "identity-conflict",
          true,
          "provider-redirect-invalid",
        );
      }
      const identity = exactOfficialRaceUrl(next);
      if (!sameRaceTriple(row.identity, identity)) {
        throw new RetrievalFailure(
          "identity-conflict",
          true,
          "provider-redirect-race-mismatch",
        );
      }
      current = next;
      continue;
    }
    if (response.url) {
      let responseUrl: URL;
      try {
        responseUrl = new URL(response.url);
      } catch {
        await cancelBody(response);
        throw new RetrievalFailure(
          "identity-conflict",
          true,
          "provider-final-url-invalid",
        );
      }
      let identity: TheDogsRaceIdentity;
      try {
        identity = exactOfficialRaceUrl(responseUrl);
      } catch (error) {
        await cancelBody(response);
        throw error;
      }
      if (!sameRaceTriple(row.identity, identity)) {
        await cancelBody(response);
        throw new RetrievalFailure(
          "identity-conflict",
          true,
          "provider-final-url-race-mismatch",
        );
      }
      current = responseUrl;
    }
    if (response.status === 404 || response.status === 410) {
      await cancelBody(response);
      throw new RetrievalFailure(
        "unavailable",
        true,
        "provider-race-unavailable",
      );
    }
    if ([429, 502, 503, 504].includes(response.status)) {
      await cancelBody(response);
      throw new RetrievalFailure(
        "transient-error",
        false,
        `provider-transient-${response.status}`,
      );
    }
    if (response.status !== 200) {
      await cancelBody(response);
      throw new RetrievalFailure(
        "provider-contract-conflict",
        true,
        `provider-unexpected-status-${response.status}`,
      );
    }
    return { response, finalUrl: current };
  }
  throw new RetrievalFailure(
    "identity-conflict",
    true,
    "provider-redirect-limit",
  );
}

async function fetchWithTimeout(
  fetchImpl: FetchLike,
  url: URL,
  timeoutMs: number,
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchImpl(url, {
      method: "GET",
      redirect: "manual",
      signal: controller.signal,
      headers: {
        accept: "application/json, text/javascript, */*; q=0.01",
        "accept-language": "en-AU,en;q=0.9",
        "user-agent": USER_AGENT,
        "X-Application-Layout": "injection",
      },
    });
  } catch {
    throw new RetrievalFailure(
      "transient-error",
      false,
      controller.signal.aborted
        ? "provider-request-timeout"
        : "provider-request-failed",
    );
  } finally {
    clearTimeout(timeout);
  }
}

function proveResultPage(
  html: string,
  row: RaceEvidenceQueueRow,
  finalUrl: URL,
) {
  const finalIdentity = exactOfficialRaceUrl(finalUrl);
  if (!sameRaceTriple(row.identity, finalIdentity)) {
    throw new RetrievalFailure(
      "identity-conflict",
      true,
      "provider-final-race-mismatch",
    );
  }
  const parsed = parseTheDogsRaceResult(
    html,
    { href: finalUrl.toString(), raceNumber: row.identity.raceNumber },
    row.identity.date,
  );
  if (!parsed || parsed.runners.length === 0) {
    throw new RetrievalFailure(
      "provider-contract-conflict",
      true,
      "provider-result-missing-runners",
    );
  }
  if (!parsed.sourceId) {
    throw new RetrievalFailure(
      "identity-conflict",
      true,
      "parsed-result-source-missing",
    );
  }
  let parsedSource: URL;
  try {
    parsedSource = new URL(parsed.sourceId);
  } catch {
    throw new RetrievalFailure(
      "identity-conflict",
      true,
      "parsed-result-source-invalid",
    );
  }
  const parsedIdentity = exactOfficialRaceUrl(parsedSource);
  if (
    !sameRaceTriple(row.identity, parsedIdentity) ||
    parsed.raceNumber !== row.identity.raceNumber ||
    parsed.resultStatus !== "posted"
  ) {
    throw new RetrievalFailure(
      "identity-conflict",
      true,
      "parsed-result-race-identity-mismatch",
    );
  }
  const runners = parsed.runners.map((runner, index) => {
    const dogId =
      runner.dog.sourceProvider === "thedogs" &&
      /^\d+$/.test(runner.dog.sourceId ?? "")
        ? runner.dog.sourceId
        : undefined;
    let rawDogId: unknown;
    try {
      rawDogId = JSON.parse(runner.sourceRawJson ?? "{}").dogId;
    } catch {
      rawDogId = null;
    }
    if (
      !dogId ||
      rawDogId !== dogId ||
      !Number.isSafeInteger(runner.boxNumber) ||
      runner.boxNumber < 1 ||
      runner.boxNumber > 12
    ) {
      throw new RetrievalFailure(
        "provider-contract-conflict",
        true,
        `provider-runner-relationship-invalid-${index + 1}`,
      );
    }
    return {
      dogProviderKey: `thedogs:dog:${dogId}`,
      boxNumber: runner.boxNumber,
      finishingPosition: runner.finishingPosition ?? null,
      scratched: runner.scratched,
    };
  });
  if (
    !runners.some((runner) => Number.isSafeInteger(runner.finishingPosition)) ||
    new Set(runners.map((runner) => runner.dogProviderKey)).size !== runners.length ||
    new Set(runners.map((runner) => runner.boxNumber)).size !== runners.length
  ) {
    throw new RetrievalFailure(
      "provider-contract-conflict",
      true,
      "provider-result-relationships-conflict",
    );
  }
  const canonicalMarkers = extractCanonicalRaceUrls(html);
  for (const marker of canonicalMarkers) {
    const identity = exactOfficialRaceUrl(marker);
    if (!sameRaceTriple(row.identity, identity)) {
      throw new RetrievalFailure(
        "identity-conflict",
        true,
        "provider-page-canonical-race-mismatch",
      );
    }
  }
  const relationshipSha256 = sha256Text(JSON.stringify(runners));
  return {
    parsedResult: parsed,
    identityProof: {
      provider: "thedogs",
      requestedProviderKey: row.providerKey,
      requestedRacePath: row.racePath,
      finalRacePath: `${finalUrl.pathname}${finalUrl.search}`,
      exactTrackDateRaceTripleVerified: true,
      parsedSourceRaceTripleVerified: true,
      providerPathNumericRaceIdentity: parsed.raceNumber,
      canonicalRaceNumberVerified: false,
      resultStatus: parsed.resultStatus,
      runnerCount: runners.length,
      canonicalMarkerCount: canonicalMarkers.length,
      runnerRelationships: runners,
      relationshipSha256,
      verificationStatus: "verified-provider-result-page-promotion-ineligible",
      canonicalPromotionEligible: false,
    },
  };
}

function extractCanonicalRaceUrls(html: string) {
  const tags = [
    ...html.matchAll(/<link\b[^>]*\brel=["'][^"']*\bcanonical\b[^"']*["'][^>]*>/gi),
    ...html.matchAll(/<meta\b[^>]*\bproperty=["']og:url["'][^>]*>/gi),
  ];
  return tags.map((match) => {
    const tag = match[0];
    const value = tag.match(/\b(?:href|content)=["']([^"']+)["']/i)?.[1];
    if (!value || value.length > 512) {
      throw new RetrievalFailure(
        "identity-conflict",
        true,
        "provider-page-canonical-url-invalid",
      );
    }
    try {
      return new URL(value, THEDOGS_ORIGIN);
    } catch {
      throw new RetrievalFailure(
        "identity-conflict",
        true,
        "provider-page-canonical-url-invalid",
      );
    }
  });
}

function exactOfficialRaceUrl(url: URL) {
  if (
    url.origin !== THEDOGS_ORIGIN ||
    url.username ||
    url.password ||
    url.hash
  ) {
    throw new RetrievalFailure(
      "identity-conflict",
      true,
      "provider-race-url-origin-invalid",
    );
  }
  try {
    return parseExactTheDogsRacePath(`${url.pathname}${url.search}`).identity;
  } catch {
    throw new RetrievalFailure(
      "identity-conflict",
      true,
      "provider-race-url-path-invalid",
    );
  }
}

async function readTerminalOutcomes(
  ledgerPath: string,
  outputDir: string,
  queueManifestSha256: string,
  queueRows: RaceEvidenceQueueRow[],
) {
  let body: string;
  try {
    body = await readFile(ledgerPath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return new Map<string, RaceEvidenceOutcome>();
    throw error;
  }
  const byProviderKey = new Map(queueRows.map((row) => [row.providerKey, row]));
  const terminal = new Map<string, RaceEvidenceOutcome>();
  const lines = body.split(/\r?\n/).filter(Boolean);
  for (let index = 0; index < lines.length; index += 1) {
    const outcome = validateOutcome(JSON.parse(lines[index]!), index + 1);
    if (outcome.queueManifestSha256 !== queueManifestSha256) {
      throw new Error(`outcome line ${index + 1} belongs to another queue`);
    }
    const row = byProviderKey.get(outcome.providerKey);
    if (
      !row ||
      row.evidenceSha256 !== outcome.queueRowEvidenceSha256 ||
      row.racePath !== outcome.racePath ||
      JSON.stringify(row.identity) !== JSON.stringify(outcome.identity)
    ) {
      throw new Error(`outcome line ${index + 1} is not bound to a queue row`);
    }
    if (!outcome.terminal) continue;
    const current = terminal.get(outcome.providerKey);
    if (current && current.evidenceSha256 !== outcome.evidenceSha256) {
      throw new Error(`contradictory terminal outcomes for ${outcome.providerKey}`);
    }
    if (outcome.outcome === "archived-unverified") {
      if (!outcome.archiveRelativePath || !outcome.archiveSha256) {
        throw new Error(`archived outcome ${index + 1} is missing its artifact`);
      }
      if (outcome.archiveRelativePath !== archivePathFor(outcome.providerKey)) {
        throw new Error(`archived outcome ${index + 1} has a noncanonical path`);
      }
      const archivePath = safeChild(path.resolve(outputDir), outcome.archiveRelativePath);
      const actualSha256 = await verifyArchive(
        archivePath,
        row,
        queueManifestSha256,
      );
      if (actualSha256 !== outcome.archiveSha256) {
        throw new Error(`archived outcome ${index + 1} digest mismatch`);
      }
    }
    terminal.set(outcome.providerKey, outcome);
  }
  return terminal;
}

function makeOutcome(input: {
  row: RaceEvidenceQueueRow;
  queueManifestSha256: string;
  outcome: OutcomeName;
  terminal: boolean;
  attempts: number;
  requestCount: number;
  archiveRelativePath: string | null;
  archiveSha256: string | null;
  errorClass: string | null;
  errorSha256: string | null;
  now: Now;
}): RaceEvidenceOutcome {
  const unsigned = {
    schemaVersion: 1 as const,
    ledgerVersion: RACE_EVIDENCE_OUTCOME_VERSION as typeof RACE_EVIDENCE_OUTCOME_VERSION,
    provider: "thedogs" as const,
    providerKey: input.row.providerKey,
    racePath: input.row.racePath,
    identity: input.row.identity,
    queueManifestSha256: input.queueManifestSha256,
    queueRowEvidenceSha256: input.row.evidenceSha256,
    outcome: input.outcome,
    terminal: input.terminal,
    attempts: input.attempts,
    requestCount: input.requestCount,
    archiveRelativePath: input.archiveRelativePath,
    archiveSha256: input.archiveSha256,
    errorClass: input.errorClass,
    errorSha256: input.errorSha256,
    canonicalPromotionEligible: false as const,
    loggedAt: input.now().toISOString(),
  };
  return { ...unsigned, evidenceSha256: sha256Text(JSON.stringify(unsigned)) };
}

function validateOutcome(value: unknown, lineNumber: number): RaceEvidenceOutcome {
  const row = requireRecord(value, `outcome line ${lineNumber}`);
  const allowed = new Set([
    "schemaVersion",
    "ledgerVersion",
    "provider",
    "providerKey",
    "racePath",
    "identity",
    "queueManifestSha256",
    "queueRowEvidenceSha256",
    "outcome",
    "terminal",
    "attempts",
    "requestCount",
    "archiveRelativePath",
    "archiveSha256",
    "errorClass",
    "errorSha256",
    "canonicalPromotionEligible",
    "loggedAt",
    "evidenceSha256",
  ]);
  assertExactKeys(row, allowed, `outcome line ${lineNumber}`);
  if (
    row.schemaVersion !== 1 ||
    row.ledgerVersion !== RACE_EVIDENCE_OUTCOME_VERSION ||
    row.provider !== "thedogs" ||
    row.canonicalPromotionEligible !== false ||
    typeof row.terminal !== "boolean"
  ) {
    throw new Error(`outcome line ${lineNumber} contract changed`);
  }
  const outcome = requireString(row.outcome, `outcome line ${lineNumber}.outcome`);
  if (![
    "archived-unverified",
    "unavailable",
    "identity-conflict",
    "provider-contract-conflict",
    "transient-error",
  ].includes(outcome)) {
    throw new Error(`outcome line ${lineNumber} has invalid outcome`);
  }
  const providerKey = requireString(row.providerKey, `outcome line ${lineNumber}.providerKey`);
  const racePath = requireString(row.racePath, `outcome line ${lineNumber}.racePath`);
  if (providerKey !== `thedogs:race:${racePath}`) {
    throw new Error(`outcome line ${lineNumber} provider key/path mismatch`);
  }
  const parsedPath = parseExactTheDogsRacePath(racePath);
  if (JSON.stringify(row.identity) !== JSON.stringify(parsedPath.identity)) {
    throw new Error(`outcome line ${lineNumber} identity mismatch`);
  }
  requireSha256(row.queueManifestSha256, `outcome line ${lineNumber}.queueManifestSha256`);
  requireSha256(row.queueRowEvidenceSha256, `outcome line ${lineNumber}.queueRowEvidenceSha256`);
  requireSha256(row.evidenceSha256, `outcome line ${lineNumber}.evidenceSha256`);
  requireNonNegativeInteger(row.attempts, `outcome line ${lineNumber}.attempts`);
  requireNonNegativeInteger(row.requestCount, `outcome line ${lineNumber}.requestCount`);
  if (!Number.isFinite(Date.parse(requireString(row.loggedAt, `outcome line ${lineNumber}.loggedAt`)))) {
    throw new Error(`outcome line ${lineNumber} loggedAt is invalid`);
  }
  const unsigned = Object.fromEntries(
    Object.entries(row).filter(([key]) => key !== "evidenceSha256"),
  );
  if (sha256Text(JSON.stringify(unsigned)) !== row.evidenceSha256) {
    throw new Error(`outcome line ${lineNumber} evidence digest mismatch`);
  }
  const archived = outcome === "archived-unverified";
  const transient = outcome === "transient-error";
  if (
    (archived &&
      (row.terminal !== true ||
        typeof row.archiveRelativePath !== "string" ||
        !SHA256.test(String(row.archiveSha256)) ||
        row.errorClass !== null ||
        row.errorSha256 !== null)) ||
    (!archived &&
      (row.archiveRelativePath !== null ||
        row.archiveSha256 !== null ||
        typeof row.errorClass !== "string" ||
        !SHA256.test(String(row.errorSha256)))) ||
    (transient ? row.terminal !== false : row.terminal !== true)
  ) {
    throw new Error(`outcome line ${lineNumber} terminal/artifact contract mismatch`);
  }
  return row as RaceEvidenceOutcome;
}

async function verifyArchive(
  archivePath: string,
  row: RaceEvidenceQueueRow,
  queueManifestSha256: string,
) {
  const fileStat = await stat(archivePath);
  if (fileStat.size <= 0 || fileStat.size > MAX_RESPONSE_BYTES * 8) {
    throw new Error(`archive has invalid size: ${path.basename(archivePath)}`);
  }
  const body = await readFile(archivePath, "utf8");
  const archive = requireRecord(JSON.parse(body), "race evidence archive");
  if (
    archive.schemaVersion !== 1 ||
    archive.archiveVersion !== RACE_EVIDENCE_ARCHIVE_VERSION ||
    archive.provider !== "thedogs" ||
    archive.providerKey !== row.providerKey ||
    archive.requestedRacePath !== row.racePath ||
    archive.queueManifestSha256 !== queueManifestSha256 ||
    archive.queueRowEvidenceSha256 !== row.evidenceSha256 ||
    archive.normalizationStatus !== "unverified-authoritative-result-page" ||
    archive.canonicalPromotionEligible !== false
  ) {
    throw new Error(`archive is not bound to ${row.providerKey}`);
  }
  const finalRacePath = requireString(archive.finalRacePath, "archive finalRacePath");
  if (
    !sameRaceTriple(
      row.identity,
      parseExactTheDogsRacePath(finalRacePath).identity,
    ) ||
    JSON.stringify(archive.identity) !== JSON.stringify(row.identity)
  ) {
    throw new Error(`archive race identity mismatch: ${row.providerKey}`);
  }
  const response = requireRecord(archive.response, "archive response");
  const identityProof = requireRecord(archive.identityProof, "archive identityProof");
  if (
    response.status !== 200 ||
    typeof response.sanitizedHtml !== "string" ||
    !Number.isSafeInteger(response.bytes) ||
    (response.bytes as number) < Buffer.byteLength(response.sanitizedHtml as string) ||
    (response.bytes as number) > MAX_RESPONSE_BYTES ||
    response.sanitizedBodySha256 !== sha256Text(response.sanitizedHtml as string) ||
    identityProof.verificationStatus !==
      "verified-provider-result-page-promotion-ineligible" ||
    identityProof.canonicalPromotionEligible !== false
  ) {
    throw new Error(`archive proof contract mismatch: ${row.providerKey}`);
  }
  const evidenceSha256 = requireSha256(
    archive.archiveEvidenceSha256,
    "archive evidence SHA256",
  );
  const unsigned = Object.fromEntries(
    Object.entries(archive).filter(([key]) => key !== "archiveEvidenceSha256"),
  );
  if (sha256Text(JSON.stringify(unsigned)) !== evidenceSha256) {
    throw new Error(`archive evidence digest mismatch: ${row.providerKey}`);
  }
  return sha256Text(body);
}

function archivePathFor(providerKey: string) {
  const digest = sha256Text(providerKey);
  return path.join("raw", digest.slice(0, 2), `${digest}.json`);
}

function classifyFailure(error: unknown) {
  if (error instanceof RetrievalFailure) return error;
  return new RetrievalFailure(
    "provider-contract-conflict",
    true,
    "unexpected-provider-contract-failure",
  );
}

function contentType(response: Response) {
  return response.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase() ?? "";
}

async function cancelBody(response: Response) {
  try {
    await response.body?.cancel();
  } catch {
    // The response is already unusable; cancellation is best-effort cleanup.
  }
}

class RequestGate {
  private nextStart = 0;
  private chain = Promise.resolve();

  constructor(
    private readonly intervalMs: number,
    private readonly sleepImpl: Sleep,
  ) {}

  wait() {
    this.chain = this.chain.then(async () => {
      const now = Date.now();
      const delay = Math.max(0, this.nextStart - now);
      if (delay > 0) await this.sleepImpl(delay);
      this.nextStart = Math.max(now, this.nextStart) + this.intervalMs;
    });
    return this.chain;
  }
}

async function mapLimit<T>(
  values: T[],
  concurrency: number,
  worker: (value: T) => Promise<void>,
) {
  const running = new Set<Promise<void>>();
  for (const value of values) {
    const promise = worker(value).finally(() => running.delete(promise));
    running.add(promise);
    if (running.size >= concurrency) await Promise.race(running);
  }
  await Promise.all(running);
}

function validateOptions(options: ArchiveRaceEvidenceOptions) {
  requireBoundedInteger(options.concurrency, 1, MAX_CONCURRENCY, "concurrency");
  requireBoundedInteger(options.requestIntervalMs, 0, 60_000, "requestIntervalMs");
  requireBoundedInteger(options.timeoutMs, 1, MAX_TIMEOUT_MS, "timeoutMs");
  requireBoundedInteger(options.maxBytes, 1, MAX_RESPONSE_BYTES, "maxBytes");
  requireBoundedInteger(options.retryAttempts, 0, MAX_RETRIES, "retryAttempts");
  requireBoundedInteger(options.retryDelayMs, 0, MAX_RETRY_DELAY_MS, "retryDelayMs");
  requireBoundedInteger(options.limit, 0, 1_000_000, "limit");
}

function safeChild(root: string, relative: string) {
  if (!relative || path.isAbsolute(relative)) throw new Error("unsafe archive path");
  const resolved = path.resolve(root, relative);
  if (!resolved.startsWith(`${path.resolve(root)}${path.sep}`)) {
    throw new Error("archive path escaped its root");
  }
  return resolved;
}

function requireRecord(value: unknown, label: string): JsonRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as JsonRecord;
}

function requireString(value: unknown, label: string) {
  if (typeof value !== "string" || !value) throw new Error(`${label} is required`);
  return value;
}

function requireSha256(value: unknown, label: string) {
  const digest = requireString(value, label);
  if (!SHA256.test(digest)) throw new Error(`${label} must be lowercase SHA-256`);
  return digest;
}

function requireNonNegativeInteger(value: unknown, label: string) {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    throw new Error(`${label} must be a non-negative safe integer`);
  }
  return value as number;
}

function requireBoundedInteger(
  value: number,
  minimum: number,
  maximum: number,
  label: string,
) {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${label} must be an integer from ${minimum} to ${maximum}`);
  }
}

function assertExactKeys(value: JsonRecord, allowed: Set<string>, label: string) {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) throw new Error(`${label} has unknown field ${key}`);
  }
  for (const key of allowed) {
    if (!(key in value)) throw new Error(`${label} is missing field ${key}`);
  }
}

async function exists(filePath: string) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function sleep(milliseconds: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
}

function parseOptions(args: string[]): ArchiveRaceEvidenceOptions {
  const allowed = new Set([
    "queue-dir",
    "output-dir",
    "outcome-ledger",
    "concurrency",
    "requests-per-second",
    "timeout-ms",
    "max-bytes",
    "retry-attempts",
    "retry-delay-ms",
    "limit",
    "dry-run",
    "confirm-network",
  ]);
  const values = parseFlags(args, allowed);
  const queueDir = optionString(values, "queue-dir");
  if (!queueDir) throw new Error("--queue-dir is required");
  const outputDir =
    optionString(values, "output-dir") ??
    ".backfill/thedogs-race-evidence-raw";
  const dryRun = values.get("dry-run") === true;
  if (
    !dryRun &&
    optionString(values, "confirm-network") !==
      RACE_EVIDENCE_NETWORK_CONFIRMATION
  ) {
    throw new Error(
      `network retrieval requires --confirm-network=${RACE_EVIDENCE_NETWORK_CONFIRMATION}`,
    );
  }
  const requestsPerSecond = numberOption(values, "requests-per-second", 1);
  if (
    !Number.isInteger(requestsPerSecond) ||
    requestsPerSecond < 1 ||
    requestsPerSecond > MAX_REQUESTS_PER_SECOND
  ) {
    throw new Error(
      `--requests-per-second must be an integer from 1 to ${MAX_REQUESTS_PER_SECOND}`,
    );
  }
  return {
    queueDir,
    outputDir,
    outcomeLedger:
      optionString(values, "outcome-ledger") ??
      path.join(outputDir, "outcomes.jsonl"),
    concurrency: numberOption(values, "concurrency", 2),
    requestIntervalMs: Math.ceil(1_000 / requestsPerSecond),
    timeoutMs: numberOption(values, "timeout-ms", 30_000),
    maxBytes: numberOption(values, "max-bytes", MAX_RESPONSE_BYTES),
    retryAttempts: numberOption(values, "retry-attempts", 2),
    retryDelayMs: numberOption(values, "retry-delay-ms", 2_000),
    limit: numberOption(values, "limit", 0),
    dryRun,
  };
}

function parseFlags(args: string[], allowed: Set<string>) {
  const values = new Map<string, string | true>();
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index]!;
    if (!argument.startsWith("--")) throw new Error(`unexpected argument: ${argument}`);
    const [key, inlineValue] = argument.slice(2).split("=", 2);
    if (!key || !allowed.has(key)) throw new Error(`unknown option: --${key}`);
    if (values.has(key)) throw new Error(`duplicate option: --${key}`);
    if (inlineValue != null) values.set(key, inlineValue);
    else if (key === "dry-run") values.set(key, true);
    else {
      const next = args[index + 1];
      if (!next || next.startsWith("--")) throw new Error(`--${key} requires a value`);
      values.set(key, next);
      index += 1;
    }
  }
  return values;
}

function optionString(values: Map<string, string | true>, key: string) {
  const value = values.get(key);
  return typeof value === "string" && value ? value : undefined;
}

function numberOption(
  values: Map<string, string | true>,
  key: string,
  fallback: number,
) {
  const value = optionString(values, key);
  if (value == null) return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) throw new Error(`--${key} must be an integer`);
  return parsed;
}

const isCli =
  process.argv[1] != null &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;

if (isCli) {
  archiveRaceEvidence(parseOptions(process.argv.slice(2)))
    .then((result) => console.log(JSON.stringify(result, null, 2)))
    .catch((error: unknown) => {
      console.error(
        `[archive:thedogs:race-evidence] failed: ${
          error instanceof Error ? error.message : "unknown error"
        }`,
      );
      process.exitCode = 1;
    });
}
