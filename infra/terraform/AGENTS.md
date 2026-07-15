# Purpose

- Owns the reviewable Terraform source for GreyhoundIQ's isolated green-staging Google Cloud edge and Cloud Run origin baseline.

# Safety contract

- Repository configuration is selected intent, never evidence of a deployed resource.
- Do not run `terraform apply`, import, destroy, state mutation, Google Cloud CLI mutation, or any live-cloud probe without Daniel's explicit authorization for that exact environment and action.
- Keep this baseline staging-only and green-only. It must require distinct green and existing-blue project IDs, use the fixed `greyhoundiq/staging/green` state prefix, and never import, read, rename, or manage blue/live resources. Production promotion requires a separately reviewed immutable plan and protected approval.
- Require an explicit green project ID, blue boundary ID, domain, immutable container image digest, source repository label, full source revision, and repository-scoped WIF principal. Never add a default project ID, mutable image tag, credential, service-account key, secret value, database URL, or local credential path.
- Keep application compute in `australia-southeast1` and `australia-southeast2`. A global edge is allowed only as the selected defensive entry point.
- Cloud Run origins must use `internal-and-cloud-load-balancing` ingress and disable the default URL where the current platform supports it.
- Runtime and deployment identities are single-purpose and keyless. WIF may bind only the approved repository principal to the green deployer. Runtime secrets must be existing green-project Secret Manager IDs pinned to numeric versions; Terraform must never accept secret values.
- Keep Cloud Armor changes in preview until reviewed request logs and false-positive tests support enforcement.
- Keep Cloud CDN disabled on the mixed application backend until route-level cacheability, origin headers, cache keys, and private-response bypass tests pass.
- The partial GCS backend config owns only the fixed green state prefix; its bucket is external, uncommitted, and separately approved. Do not provision the backend bucket here.
- Do not provision databases, storage, queues, Secret Manager secrets, API gateways, CDN, managed observability resources, or production DNS in this directory unless a later scoped decision adds them. Keep their source contracts explicitly blocked and non-provisioning meanwhile.
- `private-datastore-policy.mjs` owns the CI source guard for Cloud SQL, AlloyDB, Memorystore and datastore-port firewall exposure; keep its negative fixtures non-vacuous when the infrastructure scope changes.

# Verification

- Run `node infra/terraform/contract.test.mjs` after every change.
- If Terraform is installed, also run `terraform -chdir=infra/terraform fmt -check -recursive`, `terraform -chdir=infra/terraform init -backend=false`, and `terraform -chdir=infra/terraform validate`.
- If Terraform is unavailable, report only the static contract result. Never claim formatting, provider-schema validation, planning, or deployment.
