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

resource "google_service_account" "runtime" {
  project      = var.production_project_id
  account_id   = "giq-prod-runtime"
  display_name = "GreyhoundIQ production runtime"
  description  = "Keyless production runtime identity; workload permissions are resource-scoped."

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

resource "google_service_account_iam_member" "wif_can_impersonate_deployer" {
  service_account_id = google_service_account.deployer.name
  role               = "roles/iam.workloadIdentityUser"
  member             = var.wif_deployer_principal_set
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

check "wif_repository_scope_matches_source" {
  assert {
    condition     = endswith(var.wif_deployer_principal_set, "/attribute.repository/${var.source_repository}")
    error_message = "The WIF repository scope must exactly match source_repository."
  }
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
    source_revision   = var.source_revision
    image_digest_uri  = var.image_digest_uri
  }
}
