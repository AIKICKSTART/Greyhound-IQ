# Google Cloud green-staging edge baseline

Status: **source-validated; not planned, applied, or live-verified**

Evidence date: 2026-07-15

This directory is the smallest reviewable Terraform baseline for the selected GreyhoundIQ Australia edge/origin design. It declares an isolated **green** staging project and fixed `greyhoundiq/staging/green` remote-state prefix, equivalent Sydney and Melbourne Cloud Run application origins, and one Premium-tier global external HTTPS Application Load Balancer. It does not import, read, rename, replace, or manage existing blue/live resources. It does not provision production, a database, storage, queues, Secret Manager secret values, an API gateway, CDN, managed observability resources, or the external state bucket.

## Declared resources

- Required APIs: Artifact Registry, Cloud Resource Manager, Compute Engine, Cloud DNS, IAM, IAM Credentials, Cloud Logging, Cloud Monitoring, Cloud Run, Secret Manager, Service Usage, and Security Token Service.
- One keyless runtime service account with no project role grants.
- One keyless green-staging platform deployer with Cloud Run Admin, Compute Load Balancer Admin, Compute Security Admin, Service Usage Consumer, resource-scoped `actAs` on the runtime identity, optional managed-zone-scoped DNS Admin, and one required repository-scoped WIF impersonation binding.
- Optional resource-scoped `secretAccessor` bindings for existing green-project Secret Manager IDs. Runtime inputs contain only secret IDs and immutable numeric versions; secret values never enter Terraform or state.
- Functionally equivalent Cloud Run v2 services in `australia-southeast1` and `australia-southeast2`, both using the same required immutable image digest.
- Cloud Run service and revision labels for `deployment_slot=green`, the immutable Git source revision, repository, environment, application, and Terraform ownership.
- Selected app limits: 2 CPU, 4 GiB, concurrency 20, service-level minimum 3 and maximum 10 instances per region, and a 900-second Cloud Run request ceiling. The ceiling matches the aggregate-maintenance Scheduler contract; interactive routes must keep their own shorter application deadlines. The service-level cap covers overlapping revisions during a deployment.
- HTTP startup and liveness probes on container port 3000. Startup uses the dependency-aware `/api/health/ready`; liveness uses the shallow `/api/health` process check. Serverless NEG load-balancer health checks remain unsupported and are not configured.
- `internal-and-cloud-load-balancing` ingress, disabled Invoker IAM check for the public load-balanced service, and disabled default `run.app` URL. Default URL disabling remains a Cloud Run Preview feature, so the service explicitly declares `launch_stage = "BETA"`.
- One regional serverless NEG per Australian region and one global `EXTERNAL_MANAGED` backend service with outlier detection, full request logging, and no unsupported serverless health check, balancing mode, or backend timeout.
- Separate Cloud Armor edge and backend policies. Overseas provider webhook exceptions, the non-Australian consumer denial, SQLi/XSS WAF candidates, and a 300-request/60-second per-IP throttle are all preview-only.
- Premium global IPv4, URL map, TLS 1.2+ policy, Google-managed certificate, HTTPS proxy, port 443 forwarding rule, and an optional Cloud DNS A record.

Cloud CDN is deliberately disabled. Google supports CDN on serverless-NEG backends, and `USE_ORIGIN_HEADERS` is the safe candidate mode for a reviewed mixed origin. GreyhoundIQ has not yet proven the route allowlist, cache keys, origin headers, private-response bypass, purge, or stale behaviour required by ARCH-106, so this baseline does not enable it.

`deferred-contracts.tf` records fail-closed, non-provisioning review contracts for AlloyDB, ESPv2, CDN, queues, and managed observability. Every contract remains `release_gate = "blocked"` and `provisioned = false`; it is not a switch that can create those services.

## Required inputs

No input selects a real project or endpoint by default.

| Input                         | Requirement                                                                                     |
| ----------------------------- | ----------------------------------------------------------------------------------------------- |
| `green_project_id`            | Explicit isolated green-staging project; never a production default                             |
| `blue_project_id`             | Existing blue/live boundary used only by the distinct-project precondition; never read or managed |
| `image_digest_uri`            | Full OCI image reference ending in `@sha256:<64 hex characters>`                                |
| `source_repository_label`     | Stable lowercase repository provenance label                                                     |
| `source_revision`             | Full immutable lowercase 40-character Git commit SHA                                             |
| `domain`                      | Public green-staging hostname for the managed certificate and load balancer                      |
| `wif_deployer_principal_set`  | Approved GitHub repository-scoped WIF principalSet URI                                           |
| `runtime_config`              | Optional non-secret environment map; secret-like names are rejected                              |
| `runtime_secret_references`   | Optional environment-to-existing-secret-ID/numeric-version map; no secret values                 |
| `dns_managed_zone_name`       | Optional existing green Cloud DNS zone; omit for external DNS                                    |
| `dns_record_ttl_seconds`      | Optional DNS TTL, constrained to 30–3600 seconds; default 300                                   |
| `deletion_protection`         | Cloud Run deletion protection; default `true`                                                   |

Do not put secrets, credentials, credential paths, database URLs, or service-account keys in `.tfvars` files. The committed ignore rules exclude local Terraform variables, plans, and state.

## Project, state, authentication and bootstrap boundary

The required `green_project_id` and `blue_project_id` must differ; a Terraform lifecycle precondition fails before green Google APIs can be managed when they match. All managed resource names include `staging-green`. This source has no import blocks, moved blocks, blue provider alias, blue data source, or blue resource reference.

The partial GCS backend fixes the state prefix to `greyhoundiq/staging/green` and deliberately omits a bucket. The encrypted, versioned, access-logged green state bucket must be created and approved outside this configuration and must not be the blue/live state bucket. Supply it only through protected backend configuration; never commit the bucket name or a backend credential:

```powershell
terraform -chdir=infra/terraform init -reconfigure -backend-config='bucket=<approved-green-state-bucket>'
```

Local source validation continues to use `init -backend=false` and therefore does not contact the remote state backend.

The initial API, identity, and IAM bootstrap requires a separately authorized principal. The deployer created here intentionally cannot grant itself project IAM roles or create service-account keys. The required WIF input binds one approved GitHub `attribute.repository/<owner>/<repository>` principalSet to the green deployer only; the pool/provider remains external and separately reviewed. Local review should use Application Default Credentials with service-account impersonation, never a downloaded key.

The runtime identity starts with no project roles. When `runtime_secret_references` is non-empty, Terraform grants `roles/secretmanager.secretAccessor` only on the named existing green secrets. Versions must be numeric, so `latest` cannot silently rotate a reviewed revision. Plain `runtime_config` is state-visible and rejects secret-like names. Neither input may override `DEPLOYMENT_ENVIRONMENT` or `GCP_REGION`, and the same environment name cannot appear in both maps.

## Source verification

On 15 July 2026 the green source passed canonical formatting, dependency-free policy checks, isolated provider initialization with the backend disabled, and provider-schema validation using the official Terraform 1.14.5 container pinned by image digest. Both Google providers are pinned to 7.24.0 and the committed dependency lock records signed checksums for Linux AMD64 CI and Windows AMD64 review. The protected CI gate repeats these checks from a read-only bind mount. This is source validation only: no backend, project, credentials, refresh, plan, API call, or deployed-resource check was used.

```powershell
node infra/terraform/contract.test.mjs
```

Every Terraform change must also repeat:

```powershell
terraform -chdir=infra/terraform fmt -check -recursive
terraform -chdir=infra/terraform init -backend=false
terraform -chdir=infra/terraform validate
```

Where Terraform is not installed on the host, run the same checks against a disposable copy using the official pinned container. `init -backend=false` downloads the locked providers for validation only. It is not approval to contact or modify a Google Cloud project.

## Plan and apply safeguards

Before any plan:

1. Approve the distinct green and blue project IDs, billing/cost boundary, dedicated encrypted green state bucket, fixed green state prefix, WIF repository subject, domain ownership, immutable image/source revisions, runtime config/secret references, and regional quotas.
2. Independently review all IAM grants and the Cloud Armor preview expressions.
3. Run static tests, `terraform fmt`, `terraform validate`, application tests, typecheck, lint, and build.
4. Use read-only refresh only against the explicitly authorized staging project and capture the environment, commit, provider lock, image digest, command, timestamp, and result.

Create a saved plan only after those conditions are met:

```powershell
terraform -chdir=infra/terraform plan -out=reviewed.tfplan -var='green_project_id=<approved-green-staging-project>' -var='blue_project_id=<existing-blue-project>' -var='image_digest_uri=<registry/repository/image@sha256:digest>' -var='source_repository_label=greyhoundiq' -var='source_revision=<full-commit-sha>' -var='wif_deployer_principal_set=<approved-repository-principalSet>' -var='domain=<approved-green-staging-domain>'
terraform -chdir=infra/terraform show reviewed.tfplan
```

Do not apply from this repository state. A future `terraform apply reviewed.tfplan` requires Daniel's explicit authorization for that exact reviewed staging plan plus protected environment approval. Production requires a separate state, variables, plan, evidence set, and approval; changing the staging project input is not a production process.

## Rollback safeguards

- Roll back application code in green by planning the previously proven immutable image digest and source revision; do not use mutable tags or change the green state/project boundary.
- Treat `terraform destroy` as teardown, never rollback. Cloud Run deletion protection defaults on and API resources are not disabled on destroy.
- Keep the prior DNS target and certificate healthy until certificate status, regional service behaviour, origin restriction, and external staging smoke tests pass.
- Reverse DNS only after confirming the old endpoint remains healthy; account for the configured TTL and public resolver caches.
- Revert Cloud Armor by restoring the last reviewed preview rules. Enforcement is a separate, logged, independently approved change after false-positive review.
- Outlier detection reduces some new traffic to a failing region but is not deterministic failover. Regional rollback/ejection remains unverified until a controlled staging test passes.

## Current platform constraints and deferred work

- This source does not import or manage the existing load balancer, certificate, DNS records, `greyhoundiq-web-{env}` services, blue project, or blue state. Do not point DNS at green resources until an approved migration reconciles ownership without replacing the working path.
- The green runtime interface accepts non-secret config and references to existing green-project Secret Manager numeric versions. It does not create secret values or database resources. An application revision cannot pass `/api/health/ready` until every required reviewed secret reference and a compatible reachable database are supplied.
- The current candidate rollout and smoke checks use tagged `run.app` URLs. Disabling the default URL requires a replacement canary and scheduler path through the protected load balancer before this source can replace that workflow.
- Repository documentation declares one Sydney Supabase/PostgreSQL data plane. Sending active traffic to the Melbourne app origin would add cross-region database latency, transfer and connection pressure; it is not database failover or active-active resilience. Keep Melbourne traffic unproven until the database location, regional routing, read/write semantics, pool budget and failure procedure pass staging tests.

- Disabling the default Cloud Run URL is Preview. It preserves load-balancer ingress but prevents services such as Cloud Scheduler, Cloud Tasks, Eventarc, Pub/Sub, and uptime checks from invoking the service through `run.app`; those integrations need a different reviewed ingress path.
- Serverless NEGs require the backing service and NEG in the same region and project. A global backend can attach only one functionally equivalent serverless NEG per region.
- Serverless-NEG backend services do not support load-balancer health checks, balancing mode, or a configurable backend timeout. Their backend timeout is fixed by the platform; this configuration sets only the Cloud Run request timeout.
- A Cloud Run timeout returns an HTTP 504 but does not guarantee that the container stops work. Aggregate maintenance therefore uses a 780-second application budget, an 840-second Scheduler attempt deadline and a 900-second service ceiling. Each materialized-view call also has a dynamic deadline capped at 120 seconds. The path emits a structured backlog/failure signal and still requires production-like load evidence. Moving maintenance to a separately capped worker or Cloud Run Job remains the preferred boundary once its deployment and private invocation path are implemented.
- Outlier detection is proxy-local and can continue sending some requests to an unhealthy region. No failover result is claimed.
- Cloud Run startup and liveness probes are configured. A distinct readiness probe is still Preview and is not included without provider validation; the startup probe therefore uses `/api/health/ready`.
- Google-managed certificate activation depends on public DNS A/AAAA consistency and can remain `PROVISIONING` until DNS points only to the load balancer.
- Cloud Armor preview records candidate matches but does not enforce them. Thresholds and WAF signatures require staging traffic and false-positive review.
- No state bucket, organization policy, WIF pool/provider, database, Secret Manager secret value, storage, CDN, gateway, worker, queues, managed observability stack, or production DNS is provisioned here. The partial backend and deferred-service maps are contracts only.

## Current first-party sources

Accessed 2026-07-14:

- [Cloud Run ingress and default URL controls](https://docs.cloud.google.com/run/docs/securing/ingress)
- [Cloud Run public access and Invoker IAM check](https://docs.cloud.google.com/run/docs/authenticating/public)
- [Cloud Run locations](https://docs.cloud.google.com/run/docs/locations)
- [Cloud Run health checks](https://docs.cloud.google.com/run/docs/configuring/healthchecks)
- [Cloud Run Secret Manager references](https://docs.cloud.google.com/run/docs/configuring/services/secrets)
- [Cloud Run labels](https://docs.cloud.google.com/run/docs/configuring/labels)
- [Serverless NEG concepts and limitations](https://docs.cloud.google.com/load-balancing/docs/negs/serverless-neg-concepts)
- [Global external HTTPS load balancer with serverless backends](https://docs.cloud.google.com/load-balancing/docs/https/setup-global-ext-https-serverless)
- [Cloud Armor security-policy overview](https://docs.cloud.google.com/armor/docs/security-policy-overview)
- [Cloud Armor rate limiting](https://docs.cloud.google.com/armor/docs/rate-limiting-overview)
- [Cloud CDN with serverless origins](https://docs.cloud.google.com/cdn/docs/setting-up-cdn-with-serverless)
- [Cloud CDN cache modes and private-response exclusions](https://docs.cloud.google.com/cdn/docs/caching)
- [Google-managed load-balancer certificates](https://docs.cloud.google.com/load-balancing/docs/ssl-certificates/google-managed-certs)
- [Cloud DNS records](https://docs.cloud.google.com/dns/docs/records)
- [Service-account security practices](https://docs.cloud.google.com/iam/docs/best-practices-service-accounts)
- [Deployment-pipeline service-account practices](https://docs.cloud.google.com/iam/docs/best-practices-for-using-service-accounts-in-deployment-pipelines)
- [Workload Identity Federation with deployment pipelines](https://docs.cloud.google.com/iam/docs/workload-identity-federation-with-deployment-pipelines)
- [Compute Engine predefined IAM roles](https://docs.cloud.google.com/iam/docs/roles-permissions/compute)
- [Cloud Run predefined IAM roles](https://docs.cloud.google.com/iam/docs/roles-permissions/run)
- [Cloud DNS access control](https://docs.cloud.google.com/dns/docs/access-control)
