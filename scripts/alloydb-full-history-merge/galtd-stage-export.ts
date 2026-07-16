/**
 * Converts the already reviewed, parse-only GALTD audit inputs into immutable
 * JSONL staging records. It deliberately does not resolve a GALTD name to a
 * canonical Dog: that requires a separately reviewed, identifier-bearing
 * crosswalk in the candidate normalization phase.
 */
import { createHash } from "node:crypto";
import { createWriteStream, readFileSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { once } from "node:events";
import type { DogObservation } from "../import-galtd-studbook";

// Node's type-stripping runtime requires the .ts suffix, while TypeScript's
// project configuration deliberately rejects a literal .ts import. Keeping
// the runtime suffix non-literal satisfies both contracts without weakening
// the repository-wide compiler settings.
const galtdParser = (await import("../import-galtd-studbook" + ".ts")) as
  typeof import("../import-galtd-studbook");
const { findConflictingObservations, parseStudBook } = galtdParser;

const PARSER_VERSION = "galtd-studbook-audit-v1";
const EXPORT_VERSION = "giq-galtd-stage-export/v1";

const sources = [
  { volume: 66, pdf: "GALTD-Vol-66-2018_Final.pdf", text: "GALTD-Vol-66-2018_Final.txt" },
  { volume: 67, pdf: "Stud-Book-67-V3.pdf", text: "Stud-Book-67-V3.txt" },
  { volume: 68, pdf: "Stud-Book-68.pdf", text: "Stud-Book-68.txt" },
  { volume: 69, pdf: "Stud-Book-69.pdf", text: "Stud-Book-69.txt" },
  { volume: 70, pdf: "Stud-Book-70.pdf", text: "Stud-Book-70.txt" },
  { volume: 71, pdf: "Stud-Book-71.pdf", text: "Stud-Book-71.txt" },
  { volume: 72, pdf: "Stud-Book-72.pdf", text: "Stud-Book-72.txt" },
  { volume: 73, pdf: "Stud-Book-73-v.pdf", text: "Stud-Book-73-v.txt" },
] as const;

function arg(name: string): string {
  const index = process.argv.indexOf(`--${name}`);
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  if (!value) throw new Error(`--${name} is required`);
  return resolve(value);
}

function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

function normalizeName(value: string): string {
  return value
    .normalize("NFKC")
    .replace(/[’]/gu, "'")
    .replace(/\s*\((?:eire|old|imp)\)\s*$/iu, "")
    .replace(/\s+/gu, " ")
    .trim()
    .toLocaleLowerCase("en-AU");
}

function compact<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, member]) => member !== undefined),
  ) as T;
}

async function writeJsonLine(
  stream: ReturnType<typeof createWriteStream>,
  value: unknown,
): Promise<void> {
  if (!stream.write(`${JSON.stringify(value)}\n`, "utf8")) {
    await once(stream, "drain");
  }
}

function location(
  observation: DogObservation,
  relationship?: "sire" | "dam",
) {
  const evidence = relationship
    ? observation[relationship === "sire" ? "sireEvidence" : "damEvidence"]
    : observation;
  if (!evidence) throw new Error(`${observation.sourceId}:${relationship} lacks evidence`);
  return {
    sourcePage: evidence.sourcePage,
    sourceLine: evidence.sourceLine,
    artifactOffsetLine: evidence.artifactOffsetLine,
    evidenceSha256: evidence.evidenceSha256,
  };
}

async function main(): Promise<void> {
  const root = arg("root");
  const observationsPath = arg("observations");
  const assertionsPath = arg("assertions");
  const reportPath = arg("report");
  const strictReport = JSON.parse(
    readFileSync(join(root, "strict-audit-report.json"), "utf8"),
  ) as {
    parserVersion: string;
    sourceProvider: string;
    runInstanceId: string;
    generatedAt: string;
    totals: { observations: number; assertions: number; issues: number };
    sources: Array<{ artifact: string; artifactSha256: string; artifactBytes: number; volume: number }>;
  };
  if (
    strictReport.parserVersion !== PARSER_VERSION ||
    strictReport.sourceProvider !== "galtd" ||
    !/^[A-Za-z0-9._:-]{16,128}$/.test(strictReport.runInstanceId) ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?Z$/.test(strictReport.generatedAt) ||
    strictReport.totals.observations !== 105374 ||
    strictReport.totals.assertions !== 210734 ||
    strictReport.totals.issues !== 5
  ) {
    throw new Error("strict GALTD report contract changed");
  }

  const parsedSources = sources.map((source) => {
    const textPath = join(root, "text-layout", source.text);
    const text = readFileSync(textPath, "utf8");
    const parsed = parseStudBook(text, source.volume);
    const reportSource = strictReport.sources.find(
      (candidate) => candidate.volume === source.volume && candidate.artifact === source.pdf,
    );
    if (!reportSource) throw new Error(`strict report lacks volume ${source.volume}`);
    return { source, textPath, textSha256: sha256(Buffer.from(text)), parsed, reportSource };
  });
  const observations = parsedSources.flatMap(({ parsed }) => parsed.observations);
  const conflicts = findConflictingObservations(observations);
  if (
    observations.length !== strictReport.totals.observations ||
    observations.reduce(
      (count, row) => count + Number(Boolean(row.sireName)) + Number(Boolean(row.damName)),
      0,
    ) !== strictReport.totals.assertions ||
    conflicts.length !== strictReport.totals.issues
  ) {
    throw new Error("reparsed GALTD totals differ from the immutable strict report");
  }

  const conflictBySource = new Map<string, string>();
  for (const [index, conflict] of conflicts.entries()) {
    const conflictId = `galtd-conflict-${String(index + 1).padStart(2, "0")}`;
    for (const sourceId of conflict.relatedSourceIds ?? []) {
      if (conflictBySource.has(sourceId)) throw new Error(`${sourceId} is in two conflict groups`);
      conflictBySource.set(sourceId, conflictId);
    }
  }

  const observationStream = createWriteStream(observationsPath, { encoding: "utf8", mode: 0o600 });
  const assertionStream = createWriteStream(assertionsPath, { encoding: "utf8", mode: 0o600 });
  let assertionCount = 0;
  for (const parsedSource of parsedSources) {
    for (const observation of parsedSource.parsed.observations) {
      const conflictGroup = conflictBySource.get(observation.sourceId);
      await writeJsonLine(observationStream, compact({
        sourceProvider: "galtd",
        sourceId: observation.sourceId,
        volume: parsedSource.source.volume,
        artifact: parsedSource.source.pdf,
        artifactSha256: parsedSource.reportSource.artifactSha256,
        textArtifact: basename(parsedSource.textPath),
        textArtifactSha256: parsedSource.textSha256,
        sourceName: observation.sourceName,
        normalizedName: observation.normalizedName,
        registryToken: observation.registryToken,
        imported: observation.imported,
        dna: observation.dna,
        sex: observation.sex,
        colour: observation.colour,
        whelpDate: observation.whelpDate?.toISOString(),
        conflictGroup,
        verificationStatus: conflictGroup ? "conflicting" : "parsed",
        canonicalPromotionEligible: false,
        ...location(observation),
      }));

      for (const relationship of ["sire", "dam"] as const) {
        const parentName = observation[`${relationship}Name`];
        if (!parentName) continue;
        assertionCount += 1;
        await writeJsonLine(assertionStream, compact({
          sourceProvider: "galtd",
          sourceId: `${observation.sourceId}:${relationship}`,
          subjectSourceId: observation.sourceId,
          relationship,
          assertedParentName: parentName,
          assertedParentNormalizedName: normalizeName(parentName),
          volume: parsedSource.source.volume,
          artifact: parsedSource.source.pdf,
          artifactSha256: parsedSource.reportSource.artifactSha256,
          conflictGroup,
          verificationStatus: conflictGroup ? "conflicting" : "parsed",
          canonicalPromotionEligible: false,
          ...location(observation, relationship),
        }));
      }
    }
  }
  observationStream.end();
  assertionStream.end();
  await Promise.all([once(observationStream, "finish"), once(assertionStream, "finish")]);
  if (assertionCount !== strictReport.totals.assertions) {
    throw new Error(`assertion write count changed: ${assertionCount}`);
  }

  const exportReport = {
    schemaVersion: 1,
    exportVersion: EXPORT_VERSION,
    parserVersion: PARSER_VERSION,
    sourceProvider: "galtd",
    runInstanceId: strictReport.runInstanceId,
    sourceGeneratedAt: strictReport.generatedAt,
    observations: observations.length,
    assertions: assertionCount,
    conflictGroups: conflicts.length,
    canonicalPromotionEligible: 0,
    observationsSha256: sha256(readFileSync(observationsPath)),
    assertionsSha256: sha256(readFileSync(assertionsPath)),
    sources: parsedSources.map(({ source, textSha256, parsed, reportSource }) => ({
      volume: source.volume,
      artifact: source.pdf,
      artifactSha256: reportSource.artifactSha256,
      artifactBytes: reportSource.artifactBytes,
      textArtifact: source.text,
      textArtifactSha256: textSha256,
      observations: parsed.observations.length,
      assertions: parsed.assertions,
    })),
  };
  writeFileSync(reportPath, `${JSON.stringify(exportReport, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
}

main().catch((error: unknown) => {
  console.error(`[galtd-stage-export] failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
