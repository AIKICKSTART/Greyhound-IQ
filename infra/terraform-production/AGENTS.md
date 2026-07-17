# Purpose

- Owns the source-only Terraform foundation for the GreyhoundIQ Google Cloud production project.

# Safety contract

- Repository configuration is selected intent, never evidence of deployed infrastructure.
- Never run `terraform plan` against live Google Cloud, `terraform apply`, import, destroy, state mutation, billing attachment, API activation, DNS mutation, or resource creation without Daniel's explicit approval for that exact action.
- Require explicit production project, domain, repository name and immutable repository/owner IDs, full source revision and immutable image digest. The dedicated production WIF provider must accept only that repository's protected `prod` environment; repository-wide trust without the provider condition is prohibited. Never add a default project ID, mutable image tag, credential, service-account key, secret value, database URL or local credential path.
- Keep production regions fixed to Sydney (`australia-southeast1`) and Melbourne (`australia-southeast2`).
- Keep build, deploy and runtime identities distinct, single-purpose and keyless. Runtime secret references may name only existing secrets pinned to numeric versions; Terraform must never accept secret values.
- This foundation may declare required APIs and least-privilege identity bindings only. AlloyDB, Cloud Run, LiveKit compute, networking, storage, Redis, queues, observability, DNS and all other paid or traffic-bearing resources require separately reviewed modules and plans.

# Verification

- Run `node infra/terraform-production/contract.test.mjs` after every change.
- If Terraform is available, formatting and provider-schema validation may use `init -backend=false`; never plan or refresh against Google Cloud from this source-only wave.
