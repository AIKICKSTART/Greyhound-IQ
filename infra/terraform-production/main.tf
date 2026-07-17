locals {
  environment = "production"

  regions = toset([
    "australia-southeast1",
    "australia-southeast2",
  ])

  required_services = toset([
    "alloydb.googleapis.com",
    "artifactregistry.googleapis.com",
    "cloudbuild.googleapis.com",
    "cloudkms.googleapis.com",
    "cloudresourcemanager.googleapis.com",
    "cloudtasks.googleapis.com",
    "cloudtrace.googleapis.com",
    "compute.googleapis.com",
    "dns.googleapis.com",
    "iam.googleapis.com",
    "iamcredentials.googleapis.com",
    "logging.googleapis.com",
    "monitoring.googleapis.com",
    "pubsub.googleapis.com",
    "redis.googleapis.com",
    "run.googleapis.com",
    "secretmanager.googleapis.com",
    "servicecontrol.googleapis.com",
    "servicemanagement.googleapis.com",
    "servicenetworking.googleapis.com",
    "serviceusage.googleapis.com",
    "sts.googleapis.com",
    "storage.googleapis.com",
    "vpcaccess.googleapis.com",
  ])

  deployer_project_roles = toset([
    "roles/serviceusage.serviceUsageAdmin",
    "roles/serviceusage.serviceUsageConsumer",
  ])

  runtime_secret_ids = toset([
    for reference in values(var.runtime_secret_references) : reference.secret_id
  ])
}

resource "google_project_service" "required" {
  for_each = local.required_services

  project            = var.production_project_id
  service            = each.value
  disable_on_destroy = false
}

resource "google_iam_workload_identity_pool" "github_production" {
  project                   = var.production_project_id
  workload_identity_pool_id = "greyhoundiq-prod"
  display_name              = "GreyhoundIQ production GitHub"
  description               = "Dedicated GitHub Actions pool for the protected production environment."

  depends_on = [google_project_service.required]
}

resource "google_iam_workload_identity_pool_provider" "github_production" {
  project                            = var.production_project_id
  workload_identity_pool_id          = google_iam_workload_identity_pool.github_production.workload_identity_pool_id
  workload_identity_pool_provider_id = "github-prod"
  display_name                       = "GreyhoundIQ protected production"
  description                        = "Accepts only the immutable repository identity running in GitHub's prod environment."

  attribute_mapping = {
    "google.subject"                = "assertion.sub"
    "attribute.repository"          = "assertion.repository"
    "attribute.repository_id"       = "assertion.repository_id"
    "attribute.repository_owner_id" = "assertion.repository_owner_id"
  }
  attribute_condition = "assertion.repository == '${var.source_repository}' && assertion.repository_id == '${var.github_repository_id}' && assertion.repository_owner_id == '${var.github_repository_owner_id}' && assertion.sub.endsWith(':environment:prod')"

  oidc {
    issuer_uri = "https://token.actions.githubusercontent.com"
  }
}

resource "google_service_account" "runtime" {
  project      = var.production_project_id
  account_id   = "giq-prod-runtime"
  display_name = "GreyhoundIQ production runtime"
  description  = "Keyless production runtime identity; workload permissions are resource-scoped."

  depends_on = [google_project_service.required]
}

resource "google_service_account" "build" {
  project      = var.production_project_id
  account_id   = "giq-prod-build"
  display_name = "GreyhoundIQ production build"
  description  = "Keyless production build identity; artifact permissions are resource-scoped."

  depends_on = [google_project_service.required]
}

resource "google_service_account" "deployer" {
  project      = var.production_project_id
  account_id   = "giq-prod-deployer"
  display_name = "GreyhoundIQ production foundation deployer"
  description  = "Keyless deployer limited to API lifecycle and resource-scoped runtime impersonation in this foundation."

  depends_on = [google_project_service.required]
}

resource "google_project_iam_member" "deployer_project_roles" {
  for_each = local.deployer_project_roles

  project = var.production_project_id
  role    = each.value
  member  = "serviceAccount:${google_service_account.deployer.email}"
}

resource "google_service_account_iam_member" "wif_can_impersonate_build" {
  service_account_id = google_service_account.build.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "principalSet://iam.googleapis.com/${google_iam_workload_identity_pool.github_production.name}/attribute.repository_id/${var.github_repository_id}"

  depends_on = [google_iam_workload_identity_pool_provider.github_production]
}

resource "google_service_account_iam_member" "wif_can_impersonate_deployer" {
  service_account_id = google_service_account.deployer.name
  role               = "roles/iam.workloadIdentityUser"

  member = "principalSet://iam.googleapis.com/${google_iam_workload_identity_pool.github_production.name}/attribute.repository_id/${var.github_repository_id}"

  depends_on = [google_iam_workload_identity_pool_provider.github_production]
}

resource "google_service_account_iam_member" "deployer_can_act_as_runtime" {
  service_account_id = google_service_account.runtime.name
  role               = "roles/iam.serviceAccountUser"
  member             = "serviceAccount:${google_service_account.deployer.email}"
}

resource "google_secret_manager_secret_iam_member" "runtime" {
  for_each = local.runtime_secret_ids

  project   = var.production_project_id
  secret_id = each.value
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.runtime.email}"
}

check "image_belongs_to_production_project" {
  assert {
    condition     = strcontains(lower(var.image_digest_uri), ".pkg.dev/${var.production_project_id}/")
    error_message = "The production image must be hosted in production_project_id."
  }
}

output "production_foundation_contract" {
  description = "Immutable production boundary selected for later reviewed modules; this is source intent, not deployment evidence."
  value = {
    project_id        = var.production_project_id
    domain            = trim(var.production_domain, ".")
    regions           = local.regions
    source_repository = var.source_repository
    github_repository = {
      id       = var.github_repository_id
      owner_id = var.github_repository_owner_id
    }
    source_revision  = var.source_revision
    image_digest_uri = var.image_digest_uri
    wif_provider     = google_iam_workload_identity_pool_provider.github_production.name
    service_accounts = {
      build   = google_service_account.build.email
      deploy  = google_service_account.deployer.email
      runtime = google_service_account.runtime.email
    }
  }
}
