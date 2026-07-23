# Pedigree provenance foundation

## Production boundary

Pedigree population is a reviewed merge, not a bulk name match. The parser may observe source records and produce immutable evidence only. It must not write to a database, call a provider, invent missing parents, or attach an assertion to a canonical `Dog` from a name alone.

Source conflicts are resolved in this order unless a later approved decision records a more specific exception:

1. verified live production data;
2. Greyhound Recorder;
3. FastTrack or another approved FastTrack resource;
4. official GALTD stud-book evidence.

The merge service must retain the losing assertion and record the authority, verification state, reason, winning assertion, and existing/proposed parent in `PedigreeMergeLedger`. `sourceAuthority` is assigned by that reviewed workflow; the GALTD parser does not assign or infer a rank.

## Evidence contract

- `PedigreeImportRun` fingerprints an immutable artifact and parser version and records bounded aggregate outcomes.
- `DogSourceIdentity` stores the provider identity, observed attributes, artifact/page/line provenance, and optional reviewed canonical-dog link.
- `PedigreeAssertion` records one sire or dam assertion and may link to a source identity only after deterministic resolution.
- `PedigreeMergeLedger` is append-only and records every accept, reject, quarantine, and conflict decision.

All four tables force row-level security. Runtime reads of identities and assertions are limited to verified rows linked to canonical dogs. Import-run and merge-decision reads are administrative/system only, and all writes require system context. Evidence rows cannot be deleted; only the narrowly defined review/status fields can be updated.

## Strict GALTD audit

Run the parser without database credentials:

```powershell
$env:PDFTOTEXT_PATH = "C:\Program Files\Git\mingw64\bin\pdftotext.exe"
npm run audit:galtd:studbooks -- --dir .backfill/galtd-studbooks --expected-volumes 66-73 --report .backfill/galtd-studbooks/strict-audit-report.json
npm run check:pedigree-provenance
```

The report contains hashes, counts, and bounded finding locations; it excludes owner text and source lines. Any unparsed pedigree-shaped line, stale parent context, ambiguous parent clause, duplicate volume, or conflicting natural-key observation makes the command fail.

The 2026-07-16 local parse observed 105,374 dog records and 210,734 parent assertions across volumes 66–73; these are source observations, not a unique-dog count. Each volume parsed without syntax, context, or missing-provenance findings, but the combined corpus contains five cross-volume conflicts for the same normalized name and whelp month. Those observations remain quarantined for comparison with higher-authority sources. No pedigree rows were imported and no local, cloud, or production database was changed by this audit.

## Required release proof

Do not claim pedigree completion until a separately reviewed importer has resolved provider identities without name-only linking, written evidence and merge decisions transactionally, passed relationship and cycle checks, reconciled every quarantine, and proven AlloyDB/live-site parity. The migration in `20260716154500_add_pedigree_provenance_foundation` creates the evidence boundary only; deployment and data population remain separate approved operations.
