/**
 * Strict, database-free audit of official Greyhounds Australasia stud books.
 *
 * This command never imports or links dogs. It records immutable PDF/text
 * fingerprints and page/line provenance, rejects ambiguous source observations,
 * and leaves canonical identity resolution to the reviewed merge workflow.
 *
 * Usage:
 *   npx tsx scripts/import-galtd-studbook.ts --file <vol.pdf|vol.txt>
 *   npx tsx scripts/import-galtd-studbook.ts --dir <folder> --expected-volumes 66-73
 *
 * PDF input requires `pdftotext` (Poppler). Set PDFTOTEXT_PATH or pass
 * `--pdftotext <executable>` when it is not on PATH.
 */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { basename, extname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const SOURCE = "galtd";
const PARSER_VERSION = "galtd-studbook-audit-v1";
const UNKNOWN_SIRE = Symbol("unknown-sire");
const MONTH_PATTERN = "Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec";
const MONTHS: Record<string, number> = {
  Jan: 1,
  Feb: 2,
  Mar: 3,
  Apr: 4,
  May: 5,
  Jun: 6,
  Jul: 7,
  Aug: 8,
  Sep: 9,
  Oct: 10,
  Nov: 11,
  Dec: 12,
};

export type EvidenceLocation = {
  sourcePage?: number;
  sourceLine?: number;
  artifactOffsetLine: number;
  evidenceSha256: string;
};

export type DogObservation = EvidenceLocation & {
  sourceId: string;
  sourceName: string;
  normalizedName: string;
  registryToken?: string;
  imported: boolean;
  dna: boolean;
  sex?: "M" | "F";
  colour?: string;
  whelpDate?: Date;
  sireName?: string;
  damName?: string;
  sireEvidence?: EvidenceLocation;
  damEvidence?: EvidenceLocation;
};

export type ParseIssue = {
  code: string;
  message: string;
  sourcePage?: number;
  sourceLine?: number;
  artifactOffsetLine?: number;
  relatedSourceIds?: string[];
  relatedEvidenceSha256?: string[];
};

export type StudBookParseResult = {
  observations: DogObservation[];
  namedPuppies: number;
  unnamedLitters: number;
  assertions: number;
  importedEntries: number;
  entryPages: number;
  issues: ParseIssue[];
};

type Artifact = {
  file: string;
  name: string;
  volume: number;
  bytes: number;
  sha256: string;
  text: string;
};

type ParsedEntry = {
  isSire: boolean;
  name: string;
  registryToken?: string;
  imported: boolean;
  dna: boolean;
  colour: string;
  sex: "M" | "F";
  whelpDate?: Date;
  tail: string;
};

type ParentPair = { sireName: string; damName: string };

const entryTailPattern = new RegExp(
  `^(\\s*)(.+?)\\s+([A-Z/]{1,8}),\\s+(${MONTH_PATTERN})\\s+(\\d{1,4})(.*)$`,
  "u",
);
const puppyPattern = new RegExp(
  `^(\\s{5,})(\\S.*?)\\s+([a-z]{1,8})\\s+([db]),\\s+(${MONTH_PATTERN})\\s+(\\d{4});\\s*(.*)$`,
  "u",
);
const unnamedLitterPattern = new RegExp(
  `^\\s{5,}(?:(?:\\d+\\s+dogs?\\([^)]*\\))(?:\\s+(?:\\d+\\s+bitch(?:es)?\\([^)]*\\)))?|(?:\\d+\\s+bitch(?:es)?\\([^)]*\\))),\\s+(${MONTH_PATTERN})\\s+\\d{4}\\s*$`,
  "iu",
);
const datedCandidatePattern = new RegExp(
  `\\b(${MONTH_PATTERN})\\s+\\d{1,4}\\b`,
  "u",
);
const puppyCandidatePattern = new RegExp(
  `\\b(${MONTH_PATTERN})\\s+\\d{4};`,
  "u",
);
const entryCandidatePattern = new RegExp(
  `\\b[A-Z/]{1,8},\\s+(?:${MONTH_PATTERN})\\s+\\d{1,4}\\b`,
  "u",
);

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

function cleanName(value: string): string {
  return value.normalize("NFKC").replace(/\s+/gu, " ").trim();
}

function isSireName(value: string): boolean {
  const letters = value.replace(/[^\p{L}]/gu, "");
  return Boolean(letters) && letters === letters.toLocaleUpperCase("en-AU");
}

function toWhelpDate(month: string, year: string): Date | undefined {
  const monthNumber = MONTHS[month];
  const yearNumber = Number(year);
  if (
    !monthNumber ||
    !Number.isInteger(yearNumber) ||
    yearNumber < 1900 ||
    yearNumber > 2100
  ) {
    return undefined;
  }
  return new Date(Date.UTC(yearNumber, monthNumber - 1, 1));
}

function popTrailingParenthetical(value: string) {
  const trimmed = value.trimEnd();
  if (!trimmed.endsWith(")")) return undefined;
  let depth = 0;
  for (let index = trimmed.length - 1; index >= 0; index -= 1) {
    const character = trimmed[index];
    if (character === ")") depth += 1;
    if (character !== "(") continue;
    depth -= 1;
    if (depth === 0) {
      return {
        before: trimmed.slice(0, index).trimEnd(),
        value: trimmed.slice(index + 1, -1).trim(),
      };
    }
  }
  return undefined;
}

function parseEntry(line: string): ParsedEntry | undefined {
  const matched = line.match(entryTailPattern);
  if (!matched) return undefined;
  const [, , metadata, colour, month, year, tail] = matched;
  let nameAndMarkers = metadata;
  let registryToken: string | undefined;
  let dna = false;
  let imported = false;
  for (;;) {
    const marker = popTrailingParenthetical(nameAndMarkers);
    if (!marker) break;
    if (/^DNA$/iu.test(marker.value)) {
      dna = true;
      nameAndMarkers = marker.before;
      continue;
    }
    if (/^Imp$/iu.test(marker.value)) {
      imported = true;
      nameAndMarkers = marker.before;
      continue;
    }
    if (!registryToken && /^[\p{L}\p{N} .()/-]+$/u.test(marker.value)) {
      registryToken = cleanName(marker.value);
      nameAndMarkers = marker.before;
      continue;
    }
    break;
  }

  const name = cleanName(nameAndMarkers);
  const whelpDate = toWhelpDate(month, year);
  if (!name) return undefined;
  return {
    isSire: isSireName(name),
    name,
    registryToken,
    imported,
    dna,
    colour,
    sex: isSireName(name) ? "M" : "F",
    whelpDate,
    tail,
  };
}

function parseParents(value: string): ParentPair | undefined {
  const trimmed = value.trim();
  const lower = trimmed.toLocaleLowerCase("en-AU");
  const markers: number[] = lower.startsWith("by ") ? [0] : [];
  let depth = 0;
  for (let index = 0; index < lower.length - 3; index += 1) {
    if (lower[index] === "(") depth += 1;
    if (lower[index] === ")") depth = Math.max(0, depth - 1);
    if (depth === 0 && lower.slice(index, index + 4) === " by ") {
      markers.push(index + 1);
    }
  }
  for (const marker of markers) {
    const clause = trimmed
      .slice(marker + 3)
      .replace(/[–—]/gu, "-")
      .trim();
    const separator = clause.indexOf("-");
    if (separator <= 0 || separator !== clause.lastIndexOf("-")) continue;
    const sireName = cleanName(clause.slice(0, separator));
    const damName = cleanName(clause.slice(separator + 1));
    if (sireName && damName) return { sireName, damName };
  }
  const lastClosingParenthesis = lower.lastIndexOf(")");
  const fallback = lower.indexOf(" by ", lastClosingParenthesis + 1);
  if (fallback >= 0) {
    const clause = trimmed
      .slice(fallback + 4)
      .replace(/[–—]/gu, "-")
      .trim();
    const separator = clause.indexOf("-");
    if (separator > 0 && separator === clause.lastIndexOf("-")) {
      const sireName = cleanName(clause.slice(0, separator));
      const damName = cleanName(clause.slice(separator + 1));
      if (sireName && damName) return { sireName, damName };
    }
  }
  return undefined;
}

function printedPageNumber(page: string): number | undefined {
  const candidates = page
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 8);
  for (const line of candidates) {
    const matched = line.match(/^(?:\d{1,3}\s+)?(\d{1,3})$/u);
    if (matched) return Number(matched[1]);
  }
  return undefined;
}

function indexReferenceCount(page: string): number {
  return [...page.matchAll(/,\s*(?:d,\s*)?\d{2,3}(?=\s*(?:,|$))/gmu)].length;
}

function evidence(
  line: string,
  sourcePage: number | undefined,
  sourceLine: number,
  artifactOffsetLine: number,
): EvidenceLocation {
  return {
    sourcePage,
    sourceLine,
    artifactOffsetLine,
    evidenceSha256: sha256(line.normalize("NFKC").trim()),
  };
}

function contextualEvidence(
  line: string,
  location: EvidenceLocation,
  relationship: "sire" | "dam",
  parentSourceId: string,
): EvidenceLocation {
  return {
    ...location,
    evidenceSha256: sha256(
      `${line.normalize("NFKC").trim()}\n${relationship}:${parentSourceId}`,
    ),
  };
}

function sourceId(volume: number, location: EvidenceLocation): string {
  const page =
    location.sourcePage == null ? "unknown" : String(location.sourcePage);
  const line =
    location.sourceLine == null ? "unknown" : String(location.sourceLine);
  return `${SOURCE}:vol-${volume}:page-${page}:line-${line}:offset-${location.artifactOffsetLine}`;
}

export function parseStudBook(
  text: string,
  volume: number,
): StudBookParseResult {
  const pages = text.replace(/\r\n?/gu, "\n").split("\f");
  const startPage = pages.findIndex((page) =>
    page.includes("ENTRIES RECEIVED BETWEEN"),
  );
  const issues: ParseIssue[] = [];
  if (startPage < 0) {
    return {
      observations: [],
      namedPuppies: 0,
      unnamedLitters: 0,
      assertions: 0,
      importedEntries: 0,
      entryPages: 0,
      issues: [
        {
          code: "entries_marker_missing",
          message: "stud-book entries marker is missing",
        },
      ],
    };
  }

  const indexPage = pages.findIndex(
    (page, pageIndex) =>
      pageIndex > startPage &&
      !datedCandidatePattern.test(page) &&
      indexReferenceCount(page) >= 20,
  );
  if (indexPage < 0) {
    return {
      observations: [],
      namedPuppies: 0,
      unnamedLitters: 0,
      assertions: 0,
      importedEntries: 0,
      entryPages: 0,
      issues: [
        {
          code: "index_boundary_missing",
          message: "stud-book index boundary is missing",
        },
      ],
    };
  }

  const observations: DogObservation[] = [];
  let namedPuppies = 0;
  let unnamedLitters = 0;
  let importedEntries = 0;
  let offset = 1;
  let currentSire: DogObservation | typeof UNKNOWN_SIRE | undefined;
  let currentDam: DogObservation | undefined;
  let pendingEntry: DogObservation | undefined;

  for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
    const page = pages[pageIndex];
    const lines = page.split("\n");
    if (pageIndex < startPage || pageIndex >= indexPage) {
      offset += lines.length;
      continue;
    }
    const sourcePage = printedPageNumber(page);

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
      const line = lines[lineIndex];
      const trimmed = line.trim();
      const location = evidence(
        line,
        sourcePage,
        lineIndex + 1,
        offset + lineIndex,
      );
      if (!trimmed) continue;

      if (/^[A-Z]$/u.test(trimmed)) {
        currentSire = undefined;
        currentDam = undefined;
        pendingEntry = undefined;
        continue;
      }

      if (/^UNKNOWN SIRE(?:\s+\(MIG\))?$/u.test(trimmed)) {
        currentSire = UNKNOWN_SIRE;
        currentDam = undefined;
        pendingEntry = undefined;
        continue;
      }

      if (
        /^by\s+/iu.test(trimmed) &&
        !datedCandidatePattern.test(line) &&
        !puppyCandidatePattern.test(line)
      ) {
        const parents = parseParents(trimmed);
        if (!pendingEntry || pendingEntry.sireName || !parents) {
          issues.push({
            code: "orphan_or_ambiguous_parent_continuation",
            message:
              "a parent continuation is not bound to one immediately preceding entry",
            ...location,
          });
          pendingEntry = undefined;
          continue;
        }
        pendingEntry.sireName = parents.sireName;
        pendingEntry.damName = parents.damName;
        pendingEntry.sireEvidence = location;
        pendingEntry.damEvidence = location;
        pendingEntry = undefined;
        continue;
      }

      const puppy = line.match(puppyPattern);
      if (puppy) {
        pendingEntry = undefined;
        const [, , rawName, colour, sexCode, month, year] = puppy;
        const name = cleanName(rawName);
        const whelpDate = toWhelpDate(month, year);
        if (
          currentSire === undefined ||
          !currentDam ||
          !name ||
          !whelpDate
        ) {
          issues.push({
            code: "puppy_without_current_litter",
            message:
              "a named puppy is not bound to an unambiguous sire and dam",
            ...location,
          });
          continue;
        }
        const observation: DogObservation = {
          ...location,
          sourceId: sourceId(volume, location),
          sourceName: name,
          normalizedName: normalizeName(name),
          imported: false,
          dna: false,
          sex: sexCode === "d" ? "M" : "F",
          colour: colour.toUpperCase(),
          whelpDate,
          sireName:
            currentSire === UNKNOWN_SIRE ? undefined : currentSire.sourceName,
          damName: currentDam.sourceName,
          sireEvidence:
            currentSire === UNKNOWN_SIRE
              ? undefined
              : contextualEvidence(
                  line,
                  location,
                  "sire",
                  currentSire.sourceId,
                ),
          damEvidence: contextualEvidence(
            line,
            location,
            "dam",
            currentDam.sourceId,
          ),
        };
        observations.push(observation);
        namedPuppies += 1;
        continue;
      }

      if (unnamedLitterPattern.test(line)) {
        pendingEntry = undefined;
        if (currentSire === undefined || !currentDam) {
          issues.push({
            code: "unnamed_litter_without_current_parents",
            message:
              "an unnamed litter is not bound to an unambiguous sire and dam",
            ...location,
          });
          continue;
        }
        unnamedLitters += 1;
        continue;
      }

      const entry = parseEntry(line);
      if (entry) {
        const parents = parseParents(entry.tail);
        if (/\sby\s/iu.test(entry.tail) && entry.tail.includes("-") && !parents) {
          issues.push({
            code: "ambiguous_inline_parent_clause",
            message:
              "an inline parent clause does not contain exactly one sire-dam separator",
            ...location,
          });
        }
        const observation: DogObservation = {
          ...location,
          sourceId: sourceId(volume, location),
          sourceName: entry.name,
          normalizedName: normalizeName(entry.name),
          registryToken: entry.registryToken,
          imported: entry.imported,
          dna: entry.dna,
          sex: entry.sex,
          colour: entry.colour,
          whelpDate: entry.whelpDate,
          sireName: parents?.sireName,
          damName: parents?.damName,
          sireEvidence: parents ? location : undefined,
          damEvidence: parents ? location : undefined,
        };
        observations.push(observation);
        if (entry.imported) importedEntries += 1;
        if (entry.isSire) {
          currentSire = observation;
          currentDam = undefined;
        } else if (currentSire === undefined) {
          issues.push({
            code: "dam_without_current_sire",
            message: "an indented dam entry is not bound to a current sire",
            ...location,
          });
          currentDam = undefined;
        } else {
          currentDam = observation;
        }
        pendingEntry = observation;
        continue;
      }

      if (
        (datedCandidatePattern.test(line) &&
          entryCandidatePattern.test(line)) ||
        puppyCandidatePattern.test(line) ||
        /^\s{5,}\d+\s+(?:dogs?|bitch(?:es)?)\b/iu.test(line)
      ) {
        issues.push({
          code: "unparsed_pedigree_record",
          message:
            "a pedigree-shaped source line did not match the strict grammar",
          ...location,
        });
        currentSire = undefined;
        currentDam = undefined;
        pendingEntry = undefined;
      }
    }
    offset += lines.length;
  }

  const assertions = observations.reduce(
    (total, observation) =>
      total +
      Number(Boolean(observation.sireName)) +
      Number(Boolean(observation.damName)),
    0,
  );
  for (const observation of observations) {
    if (
      (observation.sireName && !observation.sireEvidence) ||
      (observation.damName && !observation.damEvidence)
    ) {
      issues.push({
        code: "assertion_without_evidence",
        message: "a parsed parent assertion is missing deterministic provenance",
        sourcePage: observation.sourcePage,
        sourceLine: observation.sourceLine,
        artifactOffsetLine: observation.artifactOffsetLine,
      });
    }
  }
  issues.push(...findConflictingObservations(observations));
  return {
    observations,
    namedPuppies,
    unnamedLitters,
    assertions,
    importedEntries,
    entryPages: indexPage - startPage,
    issues,
  };
}

export function findConflictingObservations(
  observations: DogObservation[],
): ParseIssue[] {
  const byNaturalEvidence = new Map<string, DogObservation[]>();
  for (const observation of observations) {
    if (!observation.whelpDate) continue;
    const month = observation.whelpDate.toISOString().slice(0, 7);
    const key = `${observation.normalizedName}|${month}`;
    const rows = byNaturalEvidence.get(key) ?? [];
    rows.push(observation);
    byNaturalEvidence.set(key, rows);
  }

  const issues: ParseIssue[] = [];
  for (const rows of byNaturalEvidence.values()) {
    if (rows.length < 2) continue;
    const sexes = new Set(rows.map((row) => row.sex).filter(Boolean));
    const parentPairs = new Set(
      rows
        .filter((row) => row.sireName && row.damName)
        .map(
          (row) =>
            `${normalizeName(row.sireName!)}|${normalizeName(row.damName!)}`,
        ),
    );
    if (sexes.size <= 1 && parentPairs.size <= 1) continue;
    const first = rows[0];
    issues.push({
      code: "conflicting_source_observation",
      message:
        "the same normalized name and whelp month has conflicting sex or parent evidence",
      sourcePage: first.sourcePage,
      sourceLine: first.sourceLine,
      artifactOffsetLine: first.artifactOffsetLine,
      relatedSourceIds: rows.map((row) => row.sourceId).sort(),
      relatedEvidenceSha256: rows
        .map((row) => row.evidenceSha256)
        .sort(),
    });
  }
  return issues;
}

function inferVolume(file: string): number | undefined {
  const matched = basename(file).match(
    /(?:vol(?:ume)?|stud[-_ ]?book)[-_ ]?(\d{2})/iu,
  );
  return matched ? Number(matched[1]) : undefined;
}

function extractArtifact(file: string, volumeOverride?: number): Artifact {
  const bytes = readFileSync(file);
  const volume = volumeOverride ?? inferVolume(file);
  if (!volume || volume < 1 || volume > 999) {
    throw new Error(
      `Cannot infer a stud-book volume from ${basename(file)}; pass --volume for one file.`,
    );
  }
  let text: string;
  if (extname(file).toLocaleLowerCase("en-AU") === ".txt") {
    text = bytes.toString("utf8");
  } else {
    const executable =
      arg("pdftotext") ?? process.env.PDFTOTEXT_PATH ?? "pdftotext";
    const extracted = spawnSync(
      executable,
      ["-layout", "-enc", "UTF-8", file, "-"],
      { encoding: "utf8", maxBuffer: 64 * 1024 * 1024, windowsHide: true },
    );
    if (extracted.error || extracted.status !== 0) {
      const reason =
        (extracted.error?.message ?? extracted.stderr.trim()) ||
        `exit ${extracted.status}`;
      throw new Error(`pdftotext failed for ${basename(file)}: ${reason}`);
    }
    text = extracted.stdout;
  }
  return {
    file,
    name: basename(file),
    volume,
    bytes: statSync(file).size,
    sha256: sha256(bytes),
    text,
  };
}

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function resolveFiles(): string[] {
  const directory = arg("dir");
  if (directory) {
    return readdirSync(directory)
      .filter((file) => /\.(pdf|txt)$/iu.test(file))
      .sort((left, right) => left.localeCompare(right, "en-AU"))
      .map((file) => join(directory, file));
  }
  const file = arg("file");
  if (!file)
    throw new Error("--file <path.pdf|.txt> or --dir <folder> is required");
  return [file];
}

function expectedVolumes(value: string | undefined): number[] | undefined {
  if (!value) return undefined;
  const range = value.match(/^(\d{1,3})-(\d{1,3})$/u);
  if (!range)
    throw new Error("--expected-volumes must be a closed range such as 66-73");
  const first = Number(range[1]);
  const last = Number(range[2]);
  if (first > last || last - first > 100)
    throw new Error("--expected-volumes range is invalid");
  return Array.from({ length: last - first + 1 }, (_, index) => first + index);
}

export function verifyVolumeSet(
  actual: readonly number[],
  expected: readonly number[],
): void {
  const sortedActual = [...actual].sort((left, right) => left - right);
  const sortedExpected = [...expected].sort((left, right) => left - right);
  if (new Set(sortedActual).size !== sortedActual.length) {
    throw new Error("duplicate stud-book volumes are not allowed");
  }
  if (JSON.stringify(sortedActual) !== JSON.stringify(sortedExpected)) {
    throw new Error(
      `expected volumes ${sortedExpected.join(",")}; received ${sortedActual.join(",")}`,
    );
  }
}

async function main(): Promise<void> {
  if (
    ["--apply", "--import", "--write"].some((flag) =>
      process.argv.includes(flag),
    )
  ) {
    throw new Error(
      "This command is parse-only and cannot write pedigree data.",
    );
  }
  const files = resolveFiles();
  const singleVolume =
    files.length === 1 && arg("volume") ? Number(arg("volume")) : undefined;
  const artifacts = files.map((file) => extractArtifact(file, singleVolume));
  const expected = expectedVolumes(arg("expected-volumes"));
  if (expected)
    verifyVolumeSet(
      artifacts.map((artifact) => artifact.volume),
      expected,
    );

  const sources = artifacts.map((artifact) => {
    const parsed = parseStudBook(artifact.text, artifact.volume);
    return { artifact, parsed };
  });
  const issues = [
    ...sources.flatMap(({ artifact, parsed }) =>
      parsed.issues.map((issue) => ({ artifact: artifact.name, ...issue })),
    ),
    ...findConflictingObservations(
      sources.flatMap(({ parsed }) => parsed.observations),
    ).map((issue) => ({ artifact: "combined-volumes", ...issue })),
  ];
  const report = {
    schemaVersion: 1,
    parserVersion: PARSER_VERSION,
    mode: "parse-only",
    status: issues.length === 0 ? "passed" : "failed",
    generatedAt: new Date().toISOString(),
    sourceProvider: SOURCE,
    sources: sources.map(({ artifact, parsed }) => ({
      artifact: artifact.name,
      artifactSha256: artifact.sha256,
      artifactBytes: artifact.bytes,
      volume: artifact.volume,
      entryPages: parsed.entryPages,
      observations: parsed.observations.length,
      assertions: parsed.assertions,
      namedPuppies: parsed.namedPuppies,
      unnamedLitters: parsed.unnamedLitters,
      importedEntries: parsed.importedEntries,
      issues: parsed.issues.length,
    })),
    findings: issues.map((issue) => ({
      artifact: issue.artifact,
      code: issue.code,
      sourcePage: issue.sourcePage,
      sourceLine: issue.sourceLine,
      artifactOffsetLine: issue.artifactOffsetLine,
      relatedSourceIds: issue.relatedSourceIds,
      relatedEvidenceSha256: issue.relatedEvidenceSha256,
    })),
    totals: {
      observations: sources.reduce(
        (sum, source) => sum + source.parsed.observations.length,
        0,
      ),
      assertions: sources.reduce(
        (sum, source) => sum + source.parsed.assertions,
        0,
      ),
      namedPuppies: sources.reduce(
        (sum, source) => sum + source.parsed.namedPuppies,
        0,
      ),
      unnamedLitters: sources.reduce(
        (sum, source) => sum + source.parsed.unnamedLitters,
        0,
      ),
      importedEntries: sources.reduce(
        (sum, source) => sum + source.parsed.importedEntries,
        0,
      ),
      issues: issues.length,
    },
  };
  const reportPath = arg("report");
  if (reportPath)
    writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  if (issues.length > 0) {
    for (const issue of issues.slice(0, 25)) {
      const location = issue.sourcePage
        ? ` page ${issue.sourcePage}${issue.sourceLine ? ` line ${issue.sourceLine}` : ""}`
        : issue.artifactOffsetLine
          ? ` offset-line ${issue.artifactOffsetLine}`
          : "";
      console.error(
        `[galtd-audit] ${issue.artifact}${location}: ${issue.code}`,
      );
    }
    throw new Error(
      `strict GALTD audit rejected ${issues.length} unparsed or ambiguous observations`,
    );
  }
  for (const source of report.sources) {
    console.log(
      `[galtd-audit] volume ${source.volume}: ${source.observations} observations, ` +
        `${source.assertions} assertions, sha256=${source.artifactSha256}`,
    );
  }
  console.log(
    `[galtd-audit] PASS parse-only: ${report.totals.observations} observations, ` +
      `${report.totals.assertions} assertions, 0 issues`,
  );
}

function isMainModule(): boolean {
  return Boolean(
    process.argv[1] &&
    pathToFileURL(resolve(process.argv[1])).href === import.meta.url,
  );
}

if (isMainModule()) {
  main().catch((error: unknown) => {
    console.error(
      `[galtd-audit] failed: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 1;
  });
}
