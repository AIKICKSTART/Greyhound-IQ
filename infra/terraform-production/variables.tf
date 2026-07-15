variable "production_project_id" {
  description = "Explicit Google Cloud production project ID. No project is selected by default."
  type        = string
  nullable    = false

  validation {
    condition     = can(regex("^[a-z][a-z0-9-]{4,28}[a-z0-9]$", var.production_project_id)) && !strcontains(lower(var.production_project_id), "replace-me")
    error_message = "production_project_id must be an explicit valid non-placeholder Google Cloud project ID."
  }
}

variable "production_domain" {
  description = "Explicit fully qualified production domain. This foundation does not create or change DNS."
  type        = string
  nullable    = false

  validation {
    condition     = length(trim(var.production_domain, ".")) <= 253 && can(regex("^([A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?\\.)+[A-Za-z]{2,63}\\.?$", var.production_domain))
    error_message = "production_domain must be an explicit fully qualified DNS name."
  }
}

variable "source_repository" {
  description = "GitHub repository in owner/name form used for provenance and WIF scoping."
  type        = string
  nullable    = false

  validation {
    condition     = can(regex("^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$", var.source_repository))
    error_message = "source_repository must use the GitHub owner/name form."
  }
}

variable "source_revision" {
  description = "Immutable full lowercase Git commit SHA for the production release."
  type        = string
  nullable    = false

  validation {
    condition     = can(regex("^[0-9a-f]{40}$", var.source_revision))
    error_message = "source_revision must be a full lowercase 40-character Git commit SHA."
  }
}

variable "image_digest_uri" {
  description = "Immutable OCI image URI for the production release."
  type        = string
  nullable    = false

  validation {
    condition     = can(regex("^[a-z0-9-]+-docker\\.pkg\\.dev/[a-z][a-z0-9-]{4,28}[a-z0-9]/[a-z0-9._-]+/[a-z0-9._-]+@sha256:[0-9a-f]{64}$", lower(var.image_digest_uri)))
    error_message = "image_digest_uri must be a Google Artifact Registry image pinned to an immutable sha256 digest."
  }
}

variable "wif_deployer_principal_set" {
  description = "Existing GitHub repository-scoped WIF principalSet allowed to impersonate only the production deployer identity."
  type        = string
  nullable    = false

  validation {
    condition = can(regex(
      "^principalSet://iam\\.googleapis\\.com/projects/[0-9]+/locations/global/workloadIdentityPools/[a-z0-9-]{4,32}/attribute\\.repository/[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$",
      var.wif_deployer_principal_set,
    ))
    error_message = "wif_deployer_principal_set must be an existing repository-scoped principalSet URI."
  }
}

variable "runtime_secret_references" {
  description = "Runtime environment names mapped to existing Secret Manager IDs and immutable numeric versions. No secret values enter Terraform."
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
    error_message = "runtime_secret_references require uppercase environment names, valid existing secret IDs and immutable numeric versions (never latest)."
  }
}
