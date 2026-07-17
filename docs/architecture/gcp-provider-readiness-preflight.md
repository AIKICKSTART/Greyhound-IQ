# GCP provider-readiness preflight

Status: source control implemented; current green environment remains blocked.

`scripts/check-gcp-provider-readiness.ts` is the read-only discovery boundary for
comparing GreyhoundIQ's existing blue services with a future isolated green
project. It never creates, updates, deploys, enables, disables, links, deletes or
promotes a cloud or GitHub resource.

## Run it

Current blue inventory with no green project configured:

```powershell
npx tsx scripts/check-gcp-provider-readiness.ts
```

Future isolated green inventory, after an operator supplies the project ID:

```powershell
npx tsx scripts/check-gcp-provider-readiness.ts --green-project=<isolated-green-project-id>
```

Use `--no-write` for console-only discovery. Use `--require-ready` only when a
blocked result should return a non-zero exit code. The default blocked run exits
successfully after recording evidence so an operator can inspect every gap.

Focused source test:

```powershell
npx tsx scripts/gcp-provider-readiness.test.ts
```

Generated evidence is written to:

- `output/gcp-provider-readiness/latest.json`
- `output/gcp-provider-readiness/latest.md`

## Safety contract

The command runner accepts only explicit discovery operations:

- GCP project, billing, enabled-service, Cloud Run, IAM, WIF and quota reads
- GitHub environment, secret-name and variable-name reads
- Local Git source SHA, status and remote reads

Mutation-capable verbs and GitHub state-changing request flags are rejected
before a child process starts. The runner does not use an interactive shell,
does not request access tokens, does not access Secret Manager versions, does
not send application traffic and does not persist raw provider errors.

Identity email addresses are redacted. Secret names may be compared because
GitHub never returns their values; secret values are never requested or read.
Service-account key discovery runs only for an explicitly configured green
target. Existing blue services remain untouched.

## What the preflight proves

- The discovery code used an allowlisted read-only command surface.
- Existing blue Cloud Run services are inventoried without traffic probes.
- Billing, enabled API, regional/global quota-discovery, project IAM, WIF and
  GitHub environment gaps are recorded as structured findings.
- The intended target retains Sydney and Melbourne, protected load-balancer
  ingress and disabled default Cloud Run URLs from the architecture contract.
- Missing evidence remains missing instead of receiving completion credit.

## What it does not prove

This preflight never completes these release gates by itself:

- `PREPROD.GCP.MANAGED_SERVICE_PARITY`
- `PREPROD.ARCHITECTURE.RESILIENCE_EVIDENCE`
- `PREPROD.CAPACITY.50000_DAU`
- `PREPROD.PROMOTION.EVIDENCE_MANIFEST`

Those gates still require an authorised isolated green deployment, measured
capacity model, immutable candidate binding, managed-service tests and
independent evidence review. Repository configuration and a successful
read-only preflight are prerequisites, not deployed proof.

## Blue/green operating boundary

The current project remains the blue environment. A green project must use a
different project ID and independent workload identities, GitHub environment
configuration and provider-test credentials. The preflight does not enable
billing or create that project. Existing services remain online until a later
authorised cutover has passed every production gate and retains a rollback
window.
