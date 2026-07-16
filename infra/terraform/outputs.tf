output "load_balancer_ipv4" {
  description = "Reserved Premium-tier global IPv4 address for DNS and pre-cutover checks."
  value       = google_compute_global_address.frontend.address
}

output "required_dns_a_record" {
  description = "DNS A record required for managed-certificate validation."
  value = {
    name  = "${trim(var.domain, ".")}."
    value = google_compute_global_address.frontend.address
    ttl   = var.dns_record_ttl_seconds
  }
}

output "cloud_run_service_names" {
  description = "Equivalent application service name by Australian region."
  value       = { for region, service in google_cloud_run_v2_service.app : region => service.name }
}

output "runtime_service_account" {
  description = "Keyless runtime service identity."
  value       = google_service_account.runtime.email
}

output "deployer_service_account" {
  description = "Keyless staging platform deployment identity; federated impersonation is configured separately."
  value       = google_service_account.deployer.email
}

output "managed_certificate_name" {
  description = "Google-managed certificate resource whose ACTIVE state must be verified after DNS propagation."
  value       = google_compute_managed_ssl_certificate.frontend.name
}

output "green_deployment_boundary" {
  description = "Review identity for the isolated green project/state/source boundary; this is declared intent, not deployed proof."
  value = {
    project_id        = var.green_project_id
    deployment_slot   = local.deployment_slot
    state_prefix      = local.state_prefix
    source_repository = var.source_repository_label
    source_revision   = var.source_revision
  }
}

output "timeout_budget_contract" {
  description = "Ordered application, Scheduler and Cloud Run timeout source contract in seconds."
  value       = local.timeout_budget
}

output "deferred_managed_service_contracts" {
  description = "Fail-closed review contracts for managed services deliberately absent from this green baseline."
  value       = local.deferred_managed_services
}
