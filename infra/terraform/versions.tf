terraform {
  required_version = ">= 1.7.0, < 2.0.0"

  backend "gcs" {
    prefix = "greyhoundiq/staging/green"
  }

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "= 7.24.0"
    }
    google-beta = {
      source  = "hashicorp/google-beta"
      version = "= 7.24.0"
    }
  }
}

provider "google" {
  project = var.green_project_id
}

provider "google-beta" {
  project = var.green_project_id
}
