variable "green_project_id" {
  description = "Explicit isolated Google Cloud project ID for the unapplied green staging stack. No project is selected by default."
  type        = string
  nullable    = false

  validation {
    condition     = can(regex("^[a-z][a-z0-9-]{4,28}[a-z0-9]$", var.green_project_id)) && !strcontains(lower(var.green_project_id), "replace-me")
    error_message = "green_project_id must be an explicit valid non-placeholder Google Cloud project ID."
  }
}

variable "blue_project_id" {
  description = "Existing blue/live project ID used only by the fail-closed separation precondition. Terraform never reads, imports, or manages that project."
  type        = string
  nullable    = false

  validation {
    condition     = can(regex("^[a-z][a-z0-9-]{4,28}[a-z0-9]$", var.blue_project_id)) && !strcontains(lower(var.blue_project_id), "replace-me")
    error_message = "blue_project_id must identify the existing blue boundary explicitly."
  }
}

variable "image_digest_uri" {
  description = "OCI image URI pinned to an immutable sha256 digest."
  type        = string
  nullable    = false

  validation {
    condition     = can(regex("@sha256:[0-9a-f]{64}$", lower(var.image_digest_uri)))
    error_message = "image_digest_uri must end in @sha256 followed by exactly 64 hexadecimal characters."
  }
}

variable "source_repository_label" {
  description = "Stable lowercase repository label written to Cloud Run service and revision provenance labels."
  type        = string
  nullable    = false

  validation {
    condition     = can(regex("^[a-z][a-z0-9_-]{0,62}$", var.source_repository_label))
    error_message = "source_repository_label must be a valid lowercase Google Cloud label value."
  }
}

variable "source_revision" {
  description = "Immutable full 40-character Git commit SHA written to Cloud Run service and revision provenance labels."
  type        = string
  nullable    = false

  validation {
    condition     = can(regex("^[0-9a-f]{40}$", var.source_revision))
    error_message = "source_revision must be a full lowercase 40-character Git commit SHA."
  }
}

variable "domain" {
  description = "Public staging DNS name for the global HTTPS load balancer."
  type        = string
  nullable    = false

  validation {
    condition     = length(trim(trimspace(var.domain), ".")) >= 4 && strcontains(trim(var.domain, "."), ".")
    error_message = "domain must be an explicit fully qualified DNS name."
  }
}

variable "dns_managed_zone_name" {
  description = "Existing Cloud DNS managed-zone name. Leave null when DNS is managed outside Google Cloud."
  type        = string
  default     = null
  nullable    = true
}

variable "dns_record_ttl_seconds" {
  description = "TTL for the optional Cloud DNS A record."
  type        = number
  default     = 300

  validation {
    condition     = var.dns_record_ttl_seconds >= 30 && var.dns_record_ttl_seconds <= 3600
    error_message = "dns_record_ttl_seconds must stay between 30 and 3600 seconds."
  }
}

variable "deletion_protection" {
  description = "Protect both regional Cloud Run services from accidental deletion."
  type        = bool
  default     = true
}

variable "wif_deployer_principal_set" {
  description = "Approved GitHub repository-scoped Workload Identity Federation principalSet allowed to impersonate only the green deployer identity."
  type        = string
  nullable    = false

  validation {
    condition = can(regex(
      "^principalSet://iam\\.googleapis\\.com/projects/[0-9]+/locations/global/workloadIdentityPools/[a-z0-9-]{4,32}/attribute\\.repository/[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$",
      var.wif_deployer_principal_set,
    ))
    error_message = "wif_deployer_principal_set must be an approved repository-scoped principalSet URI."
  }
}

variable "runtime_config" {
  description = "Non-secret Cloud Run environment configuration. Secret-like names are rejected because values are stored in Terraform state."
  type        = map(string)
  default     = {}
  nullable    = false

  validation {
    condition = alltrue([
      for name, value in var.runtime_config :
      can(regex("^[A-Z][A-Z0-9_]{0,62}$", name)) &&
      length(value) <= 4096 &&
      length(regexall("(SECRET|PASSWORD|TOKEN|PRIVATE_KEY|CREDENTIAL|DATABASE_URL|DSN)", upper(name))) == 0
    ])
    error_message = "runtime_config keys must be bounded uppercase non-secret names; secret-like values must use runtime_secret_references."
  }
}

variable "runtime_secret_references" {
  description = "Cloud Run environment names mapped to existing green-project Secret Manager IDs and immutable numeric versions. No secret values enter Terraform."
  type = map(object({
    secret_id = string
    version   = string
  }))
  default  = {}
  nullable = false

  validation {
    condition = alltrue([
      for name, reference in var.runtime_secret_references :
      can(regex("^[A-Z][A-Z0-9_]{0,62}$", name)) &&
      can(regex("^[A-Za-z][A-Za-z0-9_-]{0,254}$", reference.secret_id)) &&
      can(regex("^[1-9][0-9]*$", reference.version))
    ])
    error_message = "runtime_secret_references require uppercase environment names, valid secret IDs, and immutable numeric versions (never latest)."
  }
}
