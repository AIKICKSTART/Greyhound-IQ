#!/usr/bin/env node

import { createHash } from "node:crypto";
import {
  createReadStream,
  createWriteStream,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { once } from "node:events";
import { basename, dirname, join, resolve } from "node:path";
import { createInterface } from "node:readline";

const QUEUE_VERSION = "giq-authoritative-pedigree-retrieval/v2";
const OUTCOME_LEDGER_VERSION = "giq-authoritative-pedigree-retrieval-outcome/v1";

const PROFILE_FIELDS = new Set([
  "provider",
  "sourceId",
  "providerKey",
  "naturalKey",
]);
const EDGE_FIELDS = new Set([
  "provider",
  "providerKey",
  "naturalKey",
  "childNaturalKey",
  "relation",
  "parentSourceId",
  "parentNaturalKey",
  "parentName",
  "resolution",
  "sourceArchiveKey",
]);
const ADDITIONAL_IDENTITY_FIELDS = new Set([
  "schemaVersion",
  "provider",
  "sourceId",
  "providerKey",
  "preferredName",
  "profilePath",
  "provenanceClass",
  "sourceName",
  "sourceRecordId",
  "sourceArtifactKey",
  "canonicalPromotionEligible",
]);
const OUTCOME_FIELDS = new Set([
  "schemaVersion",
  "ledgerVersion",
  "provider",
  "sourceId",
  "providerKey",
  "parentQueueGeneration",
  "normalizedManifestSha256",
  "queueEvidenceSha256",
  "parentSourceLineageSha256",
  "outcome",
  "terminal",
  "attempts",
  "archivePath",
  "archiveSha256",
  "errorClass",
  "errorSha256",
  "canonicalPromotionEligible",
  "loggedAt",
]);
const TERMINAL_OUTCOMES = new Set([
  "archived",
  "unavailable",
  "identity-conflict",
  "provider-contract-conflict",
]);

function requiredArg(name) {
  const value = optionalArg(name);
  if (!value) throw new Error(`--${name} is required`);
  return resolve(value);
}

function optionalArg(name) {
  const index = process.argv.indexOf(`--${name}`);
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  return value && !value.startsWith("--") ? value : undefined;
}

function positiveIntegerArg(name, fallback) {
  const value = optionalArg(name);
  if (value == null) return fallback;
  if (!/^[1-9][0-9]*$/.test(value)) throw new Error(`--${name} must be a positive integer`);
  return Number.parseInt(value, 10);
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function strictKeys(value, allowed, label) {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) throw new Error(`${label} has unknown field ${key}`);
  }
}

function requireText(value, label) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} is required`);
  return value.trim();
}

function requireSha256(value, label) {
  const digest = requireText(value, label);
  if (!/^[0-9a-f]{64}$/.test(digest)) throw new Error(`${label} must be lowercase SHA-256`);
  return digest;
}

function requireTheDogsId(value, label) {
  const sourceId = requireText(value, label);
  if (!/^[0-9]+$/.test(sourceId)) throw new Error(`${label} must be a numeric TheDogs id`);
  return sourceId;
}

function slug(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function eachJsonLine(file, visit) {
  const input = createReadStream(file, { encoding: "utf8" });
  const lines = createInterface({ input, crlfDelay: Infinity });
  let lineNumber = 0;
  for await (const line of lines) {
    lineNumber += 1;
    if (!line.trim()) continue;
    let value;
    try {
      value = JSON.parse(line);
    } catch {
      throw new Error(`${file}:${lineNumber} is not valid JSON`);
    }
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new Error(`${file}:${lineNumber} must contain a JSON object`);
    }
    await visit(value, lineNumber);
  }
}

function datasetFiles(root, manifest, dataset) {
  const files = [];
  let declaredRows = 0;
  for (const partition of manifest.partitions ?? []) {
    const output = partition.outputs?.find((candidate) => candidate.dataset === dataset);
    if (!output) throw new Error(`${partition.directory} lacks ${dataset}`);
    const file = join(root, partition.directory, output.file);
    if (!existsSync(file)) throw new Error(`${file} is absent`);
    files.push(file);
    declaredRows += output.rowCount;
  }
  const expected = manifest.datasets?.[dataset]?.rowCount;
  const expectedShards = manifest.datasets?.[dataset]?.shards;
  if (
    files.length === 0 ||
    files.length !== expectedShards ||
    declaredRows !== expected ||
    !Number.isSafeInteger(expected)
  ) {
    throw new Error(`${dataset} partition manifest is incomplete`);
  }
  return { files, expected };
}

function parentEvidence(parent) {
  const observedNames = [...parent.names.entries()]
    .map(([name, observations]) => ({ name, observations }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const edges = [...parent.edges.values()].sort((a, b) =>
    a.edgeNaturalKey.localeCompare(b.edgeNaturalKey),
  );
  const sourceArchiveKeys = [...parent.sourceArchiveKeys].sort();
  const parentSourceLineage = [...parent.lineage.values()].sort((a, b) =>
    JSON.stringify(a).localeCompare(JSON.stringify(b)),
  );
  const relationships = {
    sire: parent.relationships.sire,
    dam: parent.relationships.dam,
  };
  return { observedNames, relationships, edges, sourceArchiveKeys, parentSourceLineage };
}

function preferredName(observedNames) {
  return [...observedNames].sort(
    (a, b) => b.observations - a.observations || a.name.localeCompare(b.name),
  )[0]?.name;
}

function getOrCreateParent(parents, sourceId) {
  let parent = parents.get(sourceId);
  if (!parent) {
    parent = {
      names: new Map(),
      relationships: { sire: 0, dam: 0 },
      sourceArchiveKeys: new Set(),
      edges: new Map(),
      lineage: new Map(),
      provenanceClasses: new Set(),
      explicitProfilePath: null,
    };
    parents.set(sourceId, parent);
  }
  return parent;
}

async function writeLine(stream, value, digest) {
  const line = `${JSON.stringify(value)}\n`;
  digest.update(line);
  if (!stream.write(line, "utf8")) await once(stream, "drain");
}

function readPriorGenerationManifest(file, generation) {
  if (!file) {
    if (generation !== 1) {
      throw new Error("--prior-generation-manifest is required after parent queue generation 1");
    }
    return { sha256: null, manifest: null };
  }
  const resolved = resolve(file);
  const body = readFileSync(resolved);
  const manifest = JSON.parse(body.toString("utf8"));
  if (
    manifest.queueVersion !== QUEUE_VERSION ||
    manifest.parentQueueGeneration !== generation - 1 ||
    manifest.policy?.canonicalPromotionEligible !== 0
  ) {
    throw new Error("prior generation manifest does not immediately precede this generation");
  }
  return { sha256: sha256(body), manifest };
}

async function readOutcomeLedger(file) {
  const outcomes = new Map();
  const digest = createHash("sha256");
  let rows = 0;
  if (!file || !existsSync(file)) {
    return { outcomes, rows, sha256: null };
  }
  await eachJsonLine(file, (row, lineNumber) => {
    rows += 1;
    digest.update(`${JSON.stringify(row)}\n`);
    strictKeys(row, OUTCOME_FIELDS, `${file}:${lineNumber}`);
    if (
      row.schemaVersion !== 1 ||
      row.ledgerVersion !== OUTCOME_LEDGER_VERSION ||
      row.provider !== "thedogs" ||
      row.canonicalPromotionEligible !== false ||
      !Number.isSafeInteger(row.parentQueueGeneration) ||
      row.parentQueueGeneration < 1 ||
      !Number.isSafeInteger(row.attempts) ||
      row.attempts < 1
    ) {
      throw new Error(`${file}:${lineNumber} has an unsupported outcome contract`);
    }
    const sourceId = requireTheDogsId(row.sourceId, `${file}:${lineNumber}.sourceId`);
    if (row.providerKey !== `thedogs:dog:${sourceId}`) {
      throw new Error(`${file}:${lineNumber} providerKey does not match sourceId`);
    }
    requireSha256(row.normalizedManifestSha256, `${file}:${lineNumber}.normalizedManifestSha256`);
    requireSha256(row.queueEvidenceSha256, `${file}:${lineNumber}.queueEvidenceSha256`);
    requireSha256(row.parentSourceLineageSha256, `${file}:${lineNumber}.parentSourceLineageSha256`);
    if (
      ![...TERMINAL_OUTCOMES, "transient-error"].includes(row.outcome) ||
      row.terminal !== TERMINAL_OUTCOMES.has(row.outcome) ||
      typeof row.loggedAt !== "string" ||
      Number.isNaN(Date.parse(row.loggedAt))
    ) {
      throw new Error(`${file}:${lineNumber} has an invalid outcome/status/time`);
    }
    if (row.outcome === "archived") {
      requireText(row.archivePath, `${file}:${lineNumber}.archivePath`);
      requireSha256(row.archiveSha256, `${file}:${lineNumber}.archiveSha256`);
    } else if (row.outcome !== "transient-error" || row.errorClass || row.errorSha256) {
      requireText(row.errorClass, `${file}:${lineNumber}.errorClass`);
      requireSha256(row.errorSha256, `${file}:${lineNumber}.errorSha256`);
    }
    const records = outcomes.get(sourceId) ?? [];
    records.push(row);
    outcomes.set(sourceId, records);
  });
  return { outcomes, rows, sha256: digest.digest("hex") };
}

async function addAdditionalIdentityCandidates(file, parents) {
  if (!file) return { rows: 0, sha256: null };
  const resolved = resolve(file);
  const body = readFileSync(resolved);
  const sourceArtifactSha256 = sha256(body);
  const seen = new Set();
  let rows = 0;
  await eachJsonLine(resolved, (row, lineNumber) => {
    rows += 1;
    strictKeys(row, ADDITIONAL_IDENTITY_FIELDS, `${resolved}:${lineNumber}`);
    if (
      row.schemaVersion !== 1 ||
      row.provider !== "thedogs" ||
      row.provenanceClass !== "r2-only-identity-retrieval-required" ||
      row.sourceName !== "r2" ||
      row.canonicalPromotionEligible !== false
    ) {
      throw new Error(`${resolved}:${lineNumber} has an unsupported additional identity contract`);
    }
    const sourceId = requireTheDogsId(row.sourceId, `${resolved}:${lineNumber}.sourceId`);
    if (seen.has(sourceId)) throw new Error(`${resolved}:${lineNumber} duplicates ${sourceId}`);
    seen.add(sourceId);
    if (row.providerKey !== `thedogs:dog:${sourceId}`) {
      throw new Error(`${resolved}:${lineNumber} providerKey does not match sourceId`);
    }
    const name = requireText(row.preferredName, `${resolved}:${lineNumber}.preferredName`);
    const profilePath = requireText(row.profilePath, `${resolved}:${lineNumber}.profilePath`);
    if (!new RegExp(`^/dogs/${sourceId}/[a-z0-9-]+$`).test(profilePath)) {
      throw new Error(`${resolved}:${lineNumber} profilePath does not bind the exact sourceId`);
    }
    const sourceRecordId = requireText(row.sourceRecordId, `${resolved}:${lineNumber}.sourceRecordId`);
    const sourceArtifactKey = requireText(
      row.sourceArtifactKey,
      `${resolved}:${lineNumber}.sourceArtifactKey`,
    );
    const parent = getOrCreateParent(parents, sourceId);
    if (parent.edges.size === 0) {
      parent.names.set(name, (parent.names.get(name) ?? 0) + 1);
    }
    parent.provenanceClasses.add(row.provenanceClass);
    parent.explicitProfilePath = profilePath;
    const lineage = {
      sourceType: "r2-only-synthetic-identity",
      sourceName: "r2",
      sourceRecordId,
      sourceArtifactKey,
      sourceArtifactSha256,
      sourceObservedName: name,
      exactParentSourceId: sourceId,
      exactParentProviderKey: `thedogs:dog:${sourceId}`,
    };
    parent.lineage.set(sha256(JSON.stringify(lineage)), lineage);
  });
  return { rows, sha256: sourceArtifactSha256 };
}

function outcomeState(records) {
  if (!records || records.length === 0) return "unattempted";
  if (records.some((row) => row.outcome === "identity-conflict")) return "identity-conflict";
  if (records.some((row) => row.outcome === "provider-contract-conflict")) {
    return "provider-contract-conflict";
  }
  if (records.some((row) => row.outcome === "unavailable")) return "unavailable";
  if (records.some((row) => row.outcome === "archived")) return "archived";
  return "transient-error";
}

async function main() {
  const root = requiredArg("export-root");
  const output = requiredArg("output");
  const reportPath = requiredArg("manifest");
  const parentQueueGeneration = positiveIntegerArg("parent-queue-generation", 1);
  const outcomeLedgerPath = optionalArg("outcome-ledger");
  const additionalIdentityPath = optionalArg("additional-identity-candidates");
  const priorGeneration = readPriorGenerationManifest(
    optionalArg("prior-generation-manifest"),
    parentQueueGeneration,
  );
  if (output === reportPath) throw new Error("--output and --manifest must differ");

  const manifestPath = join(root, "manifest.json");
  const manifestBody = readFileSync(manifestPath);
  const manifestSha256 = sha256(manifestBody);
  const declaredManifestSha256 = readFileSync(join(root, "manifest.sha256"), "utf8").trim();
  if (manifestSha256 !== declaredManifestSha256) {
    throw new Error("normalized manifest SHA-256 does not match manifest.sha256");
  }

  const manifest = JSON.parse(manifestBody.toString("utf8"));
  if (
    !["thedogs-normalized-harvest/v1", "thedogs-normalized-harvest/v2"].includes(
      manifest.transformVersion,
    ) ||
    manifest.source?.provider !== "thedogs" ||
    !manifest.source?.sourceCutoff ||
    manifest.scope?.fullCorpus !== true ||
    manifest.scope?.from !== null ||
    manifest.scope?.to !== null ||
    manifest.scope?.limitProfiles !== 0 ||
    manifest.scope?.limitRaceDays !== 0
  ) {
    throw new Error("normalized export is not a complete TheDogs profile/race corpus");
  }

  const profileDataset = datasetFiles(root, manifest, "profiles");
  const edgeDataset = datasetFiles(root, manifest, "pedigree_edges");
  const orphanDataset = datasetFiles(root, manifest, "orphans");
  const archivedDogKeys = new Set();
  let profileRows = 0;
  for (const file of profileDataset.files) {
    await eachJsonLine(file, (row, lineNumber) => {
      profileRows += 1;
      strictKeys(
        Object.fromEntries(Object.entries(row).filter(([key]) => PROFILE_FIELDS.has(key))),
        PROFILE_FIELDS,
        `${file}:${lineNumber}`,
      );
      if (row.provider !== "thedogs") throw new Error(`${file}:${lineNumber} provider changed`);
      const sourceId = requireTheDogsId(row.sourceId, `${file}:${lineNumber}.sourceId`);
      const providerKey = `thedogs:dog:${sourceId}`;
      if (row.providerKey !== providerKey || row.naturalKey !== providerKey) {
        throw new Error(`${file}:${lineNumber} profile identity is inconsistent`);
      }
      if (archivedDogKeys.has(providerKey)) {
        throw new Error(`${file}:${lineNumber} duplicates profile identity ${providerKey}`);
      }
      archivedDogKeys.add(providerKey);
    });
  }
  if (profileRows !== profileDataset.expected) throw new Error("profile row conservation failed");

  const raceObservedDogKeys = new Set();
  let orphanRows = 0;
  for (const file of orphanDataset.files) {
    await eachJsonLine(file, (row) => {
      orphanRows += 1;
      if (row.issueType !== "runner-dog-profile-unresolved") return;
      const providerKey = requireText(row.missingProviderKey, "runner orphan missingProviderKey");
      if (!/^thedogs:dog:[0-9]+$/.test(providerKey)) {
        throw new Error(`runner orphan has malformed provider key ${providerKey}`);
      }
      raceObservedDogKeys.add(providerKey);
    });
  }
  if (orphanRows !== orphanDataset.expected) throw new Error("orphan row conservation failed");

  const parents = new Map();
  let edgeRows = 0;
  for (const file of edgeDataset.files) {
    await eachJsonLine(file, (row, lineNumber) => {
      edgeRows += 1;
      if (row.resolution !== "provider-stub") return;
      strictKeys(row, EDGE_FIELDS, `${file}:${lineNumber}`);
      if (row.provider !== "thedogs" || !["sire", "dam"].includes(row.relation)) {
        throw new Error(`${file}:${lineNumber} has invalid provider or relationship`);
      }
      const sourceId = requireTheDogsId(row.parentSourceId, "parentSourceId");
      if (row.parentNaturalKey !== `thedogs:dog:${sourceId}`) {
        throw new Error(`${file}:${lineNumber} parent natural key does not match source id`);
      }
      if (
        row.providerKey !==
        `thedogs:pedigree:${row.childNaturalKey.slice(12)}:${row.relation}:${sourceId}`
      ) {
        throw new Error(`${file}:${lineNumber} provider key does not match edge identity`);
      }
      const name = requireText(row.parentName, "parentName");
      const edgeNaturalKey = requireText(row.naturalKey, "naturalKey");
      const childNaturalKey = requireText(row.childNaturalKey, "childNaturalKey");
      const sourceArchiveKey = requireText(row.sourceArchiveKey, "sourceArchiveKey");
      if (!/^thedogs:dog:[0-9]+$/.test(childNaturalKey)) {
        throw new Error(`${file}:${lineNumber} child natural key is malformed`);
      }
      if (edgeNaturalKey !== `${childNaturalKey}:pedigree:${row.relation}`) {
        throw new Error(`${file}:${lineNumber} edge natural key is malformed`);
      }
      if (sourceArchiveKey !== `thedogs:dog-profile:${childNaturalKey.slice(12)}`) {
        throw new Error(`${file}:${lineNumber} source archive key is malformed`);
      }

      const parent = getOrCreateParent(parents, sourceId);
      if (parent.edges.has(edgeNaturalKey)) {
        throw new Error(`duplicate provider-stub edge ${edgeNaturalKey}`);
      }
      parent.names.set(name, (parent.names.get(name) ?? 0) + 1);
      parent.relationships[row.relation] += 1;
      parent.sourceArchiveKeys.add(sourceArchiveKey);
      parent.provenanceClasses.add("normalized-profile-parent");
      parent.edges.set(edgeNaturalKey, {
        edgeNaturalKey,
        childNaturalKey,
        relationship: row.relation,
        sourceArchiveKey,
      });
      const lineage = {
        sourceType: "normalized-profile-parent-edge",
        normalizedManifestSha256: manifestSha256,
        sourceArchiveKey,
        edgeNaturalKey,
        childProviderKey: childNaturalKey,
        relationship: row.relation,
        exactParentSourceId: sourceId,
        exactParentProviderKey: `thedogs:dog:${sourceId}`,
      };
      parent.lineage.set(sha256(JSON.stringify(lineage)), lineage);
    });
  }
  if (edgeRows !== edgeDataset.expected) throw new Error("pedigree edge row conservation failed");

  const additionalIdentity = await addAdditionalIdentityCandidates(additionalIdentityPath, parents);
  const outcomeLedger = await readOutcomeLedger(
    outcomeLedgerPath ? resolve(outcomeLedgerPath) : undefined,
  );

  const allCandidates = [...parents.entries()].sort(
    (a, b) => Number(a[0]) - Number(b[0]) || a[0].localeCompare(b[0]),
  );
  const exclusion = {
    profileAlreadyArchived: 0,
    outcomeArchived: 0,
    outcomeUnavailable: 0,
    outcomeIdentityConflict: 0,
    outcomeProviderContractConflict: 0,
  };
  let successfulOutcomesAwaitingCorpusRefresh = 0;
  const queuedCandidates = [];
  for (const [sourceId, parent] of allCandidates) {
    const providerKey = `thedogs:dog:${sourceId}`;
    const archivedInCorpus = archivedDogKeys.has(providerKey);
    const state = outcomeState(outcomeLedger.outcomes.get(sourceId));
    if (state === "archived" && !archivedInCorpus) {
      successfulOutcomesAwaitingCorpusRefresh += 1;
    }
    if (archivedInCorpus) {
      exclusion.profileAlreadyArchived += 1;
      continue;
    }
    if (state === "archived") {
      exclusion.outcomeArchived += 1;
      continue;
    }
    if (state === "unavailable") {
      exclusion.outcomeUnavailable += 1;
      continue;
    }
    if (state === "identity-conflict") {
      exclusion.outcomeIdentityConflict += 1;
      continue;
    }
    if (state === "provider-contract-conflict") {
      exclusion.outcomeProviderContractConflict += 1;
      continue;
    }
    queuedCandidates.push([sourceId, parent]);
  }

  mkdirSync(dirname(output), { recursive: true });
  mkdirSync(dirname(reportPath), { recursive: true });
  const temporaryOutput = `${output}.tmp-${process.pid}`;
  const stream = createWriteStream(temporaryOutput, { encoding: "utf8", mode: 0o600 });
  const digest = createHash("sha256");
  const classificationCounts = {
    raceObservedParentProfileRequired: 0,
    parentOnlyProviderProfileRequired: 0,
    r2OnlyIdentityRetrievalRequired: 0,
  };
  try {
    for (const [sourceId, parent] of queuedCandidates) {
      const provenance = parentEvidence(parent);
      const name = preferredName(provenance.observedNames);
      const nameSlug = slug(name);
      if (!nameSlug) throw new Error(`candidate ${sourceId} has no safe profile slug`);
      let classification;
      if (
        provenance.edges.length === 0 &&
        parent.provenanceClasses.has("r2-only-identity-retrieval-required")
      ) {
        classification = "r2-only-identity-retrieval-required";
        classificationCounts.r2OnlyIdentityRetrievalRequired += 1;
      } else if (raceObservedDogKeys.has(`thedogs:dog:${sourceId}`)) {
        classification = "race-observed-parent-profile-required";
        classificationCounts.raceObservedParentProfileRequired += 1;
      } else {
        classification = "parent-only-provider-profile-required";
        classificationCounts.parentOnlyProviderProfileRequired += 1;
      }
      const parentSourceLineageSha256 = sha256(
        JSON.stringify(provenance.parentSourceLineage),
      );
      await writeLine(
        stream,
        {
          schemaVersion: 2,
          queueVersion: QUEUE_VERSION,
          provider: "thedogs",
          sourceId,
          providerKey: `thedogs:dog:${sourceId}`,
          profilePath: parent.explicitProfilePath ?? `/dogs/${sourceId}/${nameSlug}`,
          retrievalPathStatus: parent.explicitProfilePath
            ? "unverified-exact-id-retrieval-path"
            : "unverified-name-derived-retrieval-path",
          preferredName: name,
          observedNames: provenance.observedNames,
          relationships: provenance.relationships,
          edgeCount: provenance.edges.length,
          edges: provenance.edges,
          sourceArchiveKeys: provenance.sourceArchiveKeys,
          classification,
          verificationStatus: "provider-profile-required",
          identityProofRequired: "requested-path-source-id-and-returned-page-source-id",
          canonicalPromotionEligible: false,
          parentQueueGeneration,
          priorGenerationManifestSha256: priorGeneration.sha256,
          parentSourceLineage: provenance.parentSourceLineage,
          parentSourceLineageSha256,
          normalizedManifestSha256: manifestSha256,
          sourceCutoff: manifest.source.sourceCutoff,
          evidenceSha256: sha256(JSON.stringify(provenance)),
        },
        digest,
      );
    }
    stream.end();
    await once(stream, "finish");
    renameSync(temporaryOutput, output);
  } catch (error) {
    stream.destroy();
    rmSync(temporaryOutput, { force: true });
    throw error;
  }

  const queueSha256 = digest.digest("hex");
  const queueBytes = statSync(output).size;
  const terminalOutcomes =
    exclusion.outcomeUnavailable +
    exclusion.outcomeIdentityConflict +
    exclusion.outcomeProviderContractConflict;
  const identityAuditedCorpus =
    manifest.transformVersion === "thedogs-normalized-harvest/v2";
  const saturated =
    identityAuditedCorpus &&
    queuedCandidates.length === 0 &&
    successfulOutcomesAwaitingCorpusRefresh === 0;
  const report = {
    schemaVersion: 2,
    queueVersion: QUEUE_VERSION,
    provider: "thedogs",
    parentQueueGeneration,
    priorGenerationManifestSha256: priorGeneration.sha256,
    source: {
      normalizedManifestSha256: manifestSha256,
      sourceCutoff: manifest.source.sourceCutoff,
      transformVersion: manifest.transformVersion,
      fullCorpus: true,
      profileRows,
      pedigreeEdgeRows: edgeRows,
      orphanRows,
      additionalIdentityRows: additionalIdentity.rows,
      additionalIdentitySha256: additionalIdentity.sha256,
      outcomeLedgerRows: outcomeLedger.rows,
      outcomeLedgerSha256: outcomeLedger.sha256,
    },
    discovery: {
      exactCandidateIds: allCandidates.length,
      queuedExactIds: queuedCandidates.length,
      terminalOutcomeIds: terminalOutcomes,
      successfulOutcomesAwaitingCorpusRefresh,
      exclusions: exclusion,
    },
    queue: {
      file: basename(output),
      rows: queuedCandidates.length,
      bytes: queueBytes,
      sha256: queueSha256,
    },
    classification: classificationCounts,
    saturation: {
      completeFullCorpusPass: true,
      identityAuditedCorpus,
      zeroNewExactIds: queuedCandidates.length === 0,
      corpusRefreshRequired: successfulOutcomesAwaitingCorpusRefresh > 0,
      terminalUnavailableOrConflictOutcomesLedgered: terminalOutcomes,
      saturated,
    },
    policy: {
      databaseWrites: 0,
      networkRequests: 0,
      canonicalPromotionEligible: 0,
      identityProof:
        "requested path binds exact provider id and returned page blackbook identity matches; self-link is diagnostic",
      nameMatchingAllowed: false,
      closureRule:
        "saturated only on identity-audited transform v2 when a complete latest-corpus generation queues zero exact ids and no archived outcomes await corpus refresh",
    },
  };
  const temporaryReport = `${reportPath}.tmp-${process.pid}`;
  writeFileSync(temporaryReport, `${JSON.stringify(report, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  renameSync(temporaryReport, reportPath);
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

main().catch((error) => {
  console.error(
    `[authoritative-pedigree-retrieval-queue] ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exitCode = 1;
});
