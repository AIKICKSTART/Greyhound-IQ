locals {
  environment     = "staging"
  deployment_slot = "green"
  name_prefix     = "greyhoundiq-staging-green"
  identity_prefix = "giq-stg-green"
  state_prefix    = "greyhoundiq/staging/green"

  regions = toset([
    "australia-southeast1",
    "australia-southeast2",
  ])

  required_services = toset([
    "artifactregistry.googleapis.com",
    "cloudresourcemanager.googleapis.com",
    "compute.googleapis.com",
    "dns.googleapis.com",
    "iam.googleapis.com",
    "iamcredentials.googleapis.com",
    "logging.googleapis.com",
    "monitoring.googleapis.com",
    "run.googleapis.com",
    "secretmanager.googleapis.com",
    "serviceusage.googleapis.com",
    "sts.googleapis.com",
  ])

  deployer_project_roles = toset([
    "roles/compute.loadBalancerAdmin",
    "roles/compute.securityAdmin",
    "roles/run.admin",
    "roles/serviceusage.serviceUsageConsumer",
  ])

  labels = {
    application       = "greyhoundiq"
    deployment_slot   = local.deployment_slot
    environment       = local.environment
    managed_by        = "terraform"
    source_repository = var.source_repository_label
    source_revision   = var.source_revision
  }

  app_capacity = {
    cpu                     = "2"
    memory                  = "4Gi"
    concurrency             = 20
    min_instances           = 3
    max_instances           = 10
    request_timeout_seconds = 900
  }

  timeout_budget = {
    aggregate_application_seconds = 780
    scheduler_attempt_seconds     = 840
    cloud_run_request_seconds     = local.app_capacity.request_timeout_seconds
  }

  health_probes = {
    port = 3000
    startup = {
      path                  = "/api/health/ready"
      timeout_seconds       = 2
      period_seconds        = 5
      failure_threshold     = 24
      initial_delay_seconds = 0
    }
    liveness = {
      path                  = "/api/health"
      timeout_seconds       = 2
      period_seconds        = 30
      failure_threshold     = 3
      initial_delay_seconds = 5
    }
  }

  reserved_runtime_config_names = toset([
    "DEPLOYMENT_ENVIRONMENT",
    "GCP_REGION",
  ])

  runtime_secret_ids = toset([
    for reference in values(var.runtime_secret_references) : reference.secret_id
  ])
}

resource "google_project_service" "required" {
  for_each = local.required_services

  project            = var.green_project_id
  service            = each.value
  disable_on_destroy = false

  lifecycle {
    precondition {
      condition     = var.green_project_id != var.blue_project_id
      error_message = "green_project_id must be different from blue_project_id; this state must never manage the existing blue project."
    }
  }
}

resource "google_service_account" "runtime" {
  project      = var.green_project_id
  account_id   = "${local.identity_prefix}-runtime"
  display_name = "GreyhoundIQ green-staging Cloud Run runtime"
  description  = "Keyless green runtime identity. Resource permissions are added only with reviewed workload evidence."

  depends_on = [google_project_service.required]
}

resource "google_service_account" "deployer" {
  project      = var.green_project_id
  account_id   = "${local.identity_prefix}-deployer"
  display_name = "GreyhoundIQ green-staging platform deployer"
  description  = "Keyless deployment identity for reviewed green-staging Cloud Run and edge changes."

  depends_on = [google_project_service.required]
}

resource "google_project_iam_member" "deployer_project_roles" {
  for_each = local.deployer_project_roles

  project = var.green_project_id
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

resource "google_dns_managed_zone_iam_member" "deployer" {
  count = var.dns_managed_zone_name == null ? 0 : 1

  project      = var.green_project_id
  managed_zone = var.dns_managed_zone_name
  role         = "roles/dns.admin"
  member       = "serviceAccount:${google_service_account.deployer.email}"
}

resource "google_secret_manager_secret_iam_member" "runtime" {
  for_each = local.runtime_secret_ids

  project   = var.green_project_id
  secret_id = each.value
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.runtime.email}"
}

resource "google_cloud_run_v2_service" "app" {
  provider = google-beta
  for_each = local.regions

  project              = var.green_project_id
  name                 = "${local.name_prefix}-app"
  location             = each.key
  deletion_protection  = var.deletion_protection
  ingress              = "INGRESS_TRAFFIC_INTERNAL_LOAD_BALANCER"
  invoker_iam_disabled = true
  default_uri_disabled = true
  launch_stage         = "BETA"
  labels               = local.labels

  scaling {
    min_instance_count = local.app_capacity.min_instances
    max_instance_count = local.app_capacity.max_instances
    scaling_mode       = "AUTOMATIC"
  }

  template {
    labels                           = local.labels
    service_account                  = google_service_account.runtime.email
    execution_environment            = "EXECUTION_ENVIRONMENT_GEN2"
    timeout                          = "${local.app_capacity.request_timeout_seconds}s"
    max_instance_request_concurrency = local.app_capacity.concurrency

    containers {
      image = var.image_digest_uri

      ports {
        name           = "http1"
        container_port = local.health_probes.port
      }

      resources {
        limits = {
          cpu    = local.app_capacity.cpu
          memory = local.app_capacity.memory
        }
        cpu_idle          = true
        startup_cpu_boost = true
      }

      env {
        name  = "DEPLOYMENT_ENVIRONMENT"
        value = local.environment
      }

      env {
        name  = "GCP_REGION"
        value = each.key
      }

      dynamic "env" {
        for_each = var.runtime_config

        content {
          name  = env.key
          value = env.value
        }
      }

      dynamic "env" {
        for_each = var.runtime_secret_references
        iterator = runtime_secret

        content {
          name = runtime_secret.key

          value_source {
            secret_key_ref {
              secret  = runtime_secret.value.secret_id
              version = runtime_secret.value.version
            }
          }
        }
      }

      startup_probe {
        initial_delay_seconds = local.health_probes.startup.initial_delay_seconds
        timeout_seconds       = local.health_probes.startup.timeout_seconds
        period_seconds        = local.health_probes.startup.period_seconds
        failure_threshold     = local.health_probes.startup.failure_threshold

        http_get {
          path = local.health_probes.startup.path
          port = local.health_probes.port
        }
      }

      liveness_probe {
        initial_delay_seconds = local.health_probes.liveness.initial_delay_seconds
        timeout_seconds       = local.health_probes.liveness.timeout_seconds
        period_seconds        = local.health_probes.liveness.period_seconds
        failure_threshold     = local.health_probes.liveness.failure_threshold

        http_get {
          path = local.health_probes.liveness.path
          port = local.health_probes.port
        }
      }
    }
  }

  traffic {
    type    = "TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST"
    percent = 100
  }

  lifecycle {
    precondition {
      condition = (
        local.timeout_budget.aggregate_application_seconds < local.timeout_budget.scheduler_attempt_seconds &&
        local.timeout_budget.scheduler_attempt_seconds < local.timeout_budget.cloud_run_request_seconds
      )
      error_message = "Timeouts must preserve aggregate application < Scheduler attempt < Cloud Run request ordering."
    }

    precondition {
      condition = length(setintersection(
        local.reserved_runtime_config_names,
        setunion(toset(keys(var.runtime_config)), toset(keys(var.runtime_secret_references))),
      )) == 0
      error_message = "Runtime inputs must not override DEPLOYMENT_ENVIRONMENT or GCP_REGION."
    }

    precondition {
      condition     = length(setintersection(toset(keys(var.runtime_config)), toset(keys(var.runtime_secret_references)))) == 0
      error_message = "A runtime environment name cannot be both plain configuration and a Secret Manager reference."
    }
  }

  depends_on = [
    google_project_service.required,
    google_secret_manager_secret_iam_member.runtime,
  ]
}
