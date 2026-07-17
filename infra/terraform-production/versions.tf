terraform {
  required_version = "= 1.14.5"

  backend "gcs" {
    prefix = "greyhoundiq/production"
  }

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "= 7.24.0"
    }
  }
}

provider "google" {
  project = var.production_project_id
}
