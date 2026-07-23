locals {
  provider_webhook_paths = {
    "100" = "/api/webhooks/stripe"
    "110" = "/api/webhooks/lago"
    "120" = "/api/livekit/webhook"
  }

  armor_rate_limit = {
    requests     = 300
    interval_sec = 60
  }
}

resource "google_compute_security_policy" "edge" {
  provider = google-beta
  project  = var.green_project_id
  name     = "${local.name_prefix}-edge-preview"
  type     = "CLOUD_ARMOR_EDGE"

  description = "Preview-only Australian consumer edge policy with exact provider webhook exceptions."

  dynamic "rule" {
    for_each = local.provider_webhook_paths

    content {
      action      = "allow"
      priority    = tonumber(rule.key)
      preview     = true
      description = "Preview POST provider exception: ${rule.value}"

      match {
        expr {
          expression = "request.path == '${rule.value}' && request.method == 'POST'"
        }
      }
    }
  }

  rule {
    action      = "deny(403)"
    priority    = 1000
    preview     = true
    description = "Preview deny for consumer traffic outside Australia."

    match {
      expr {
        expression = "origin.region_code != 'AU'"
      }
    }
  }

  rule {
    action      = "allow"
    priority    = 2147483647
    description = "Default allow; edge candidates remain in preview."

    match {
      versioned_expr = "SRC_IPS_V1"

      config {
        src_ip_ranges = ["*"]
      }
    }
  }

  depends_on = [google_project_service.required]
}

resource "google_compute_security_policy" "backend" {
  provider = google-beta
  project  = var.green_project_id
  name     = "${local.name_prefix}-backend-preview"
  type     = "CLOUD_ARMOR"

  description = "Preview-only backend WAF and bounded per-IP throttle policy."

  rule {
    action      = "deny(403)"
    priority    = 1000
    preview     = true
    description = "Preview the current stable SQL injection WAF signatures."

    match {
      expr {
        expression = "evaluatePreconfiguredWaf('sqli-v422-stable')"
      }
    }
  }

  rule {
    action      = "deny(403)"
    priority    = 1010
    preview     = true
    description = "Preview the current stable cross-site scripting WAF signatures."

    match {
      expr {
        expression = "evaluatePreconfiguredWaf('xss-v422-stable')"
      }
    }
  }

  rule {
    action      = "throttle"
    priority    = 2000
    preview     = true
    description = "Preview global per-IP throttle; tune before enforcement."

    match {
      versioned_expr = "SRC_IPS_V1"

      config {
        src_ip_ranges = ["*"]
      }
    }

    rate_limit_options {
      conform_action = "allow"
      exceed_action  = "deny(429)"
      enforce_on_key = "IP"

      rate_limit_threshold {
        count        = local.armor_rate_limit.requests
        interval_sec = local.armor_rate_limit.interval_sec
      }
    }
  }

  rule {
    action      = "allow"
    priority    = 2147483647
    description = "Default allow; backend candidates remain in preview."

    match {
      versioned_expr = "SRC_IPS_V1"

      config {
        src_ip_ranges = ["*"]
      }
    }
  }

  depends_on = [google_project_service.required]
}

resource "google_compute_region_network_endpoint_group" "app" {
  provider = google-beta
  for_each = google_cloud_run_v2_service.app

  project               = var.green_project_id
  name                  = "${local.name_prefix}-app-neg"
  region                = each.key
  network_endpoint_type = "SERVERLESS"

  cloud_run {
    service = each.value.name
  }
}

resource "google_compute_backend_service" "app" {
  provider = google-beta
  project  = var.green_project_id
  name     = "${local.name_prefix}-app-backend"

  load_balancing_scheme = "EXTERNAL_MANAGED"
  protocol              = "HTTP"
  enable_cdn            = false
  security_policy       = google_compute_security_policy.backend.id
  edge_security_policy  = google_compute_security_policy.edge.id

  dynamic "backend" {
    for_each = google_compute_region_network_endpoint_group.app

    content {
      group = backend.value.id
    }
  }

  outlier_detection {
    consecutive_errors           = 5
    enforcing_consecutive_errors = 100
    max_ejection_percent         = 50

    interval {
      seconds = 10
    }

    base_ejection_time {
      seconds = 30
    }
  }

  log_config {
    enable      = true
    sample_rate = 1
  }
}

resource "google_compute_global_address" "frontend" {
  provider = google-beta
  project  = var.green_project_id
  name     = "${local.name_prefix}-frontend-ipv4"

  address_type = "EXTERNAL"
  ip_version   = "IPV4"

  depends_on = [google_project_service.required]
}

resource "google_compute_managed_ssl_certificate" "frontend" {
  provider = google-beta
  project  = var.green_project_id
  name     = "${local.name_prefix}-managed-cert"

  managed {
    domains = [trim(var.domain, ".")]
  }

  depends_on = [google_project_service.required]
}

resource "google_compute_ssl_policy" "frontend" {
  provider        = google-beta
  project         = var.green_project_id
  name            = "${local.name_prefix}-tls"
  profile         = "MODERN"
  min_tls_version = "TLS_1_2"

  depends_on = [google_project_service.required]
}

resource "google_compute_url_map" "app" {
  provider        = google-beta
  project         = var.green_project_id
  name            = "${local.name_prefix}-https-map"
  default_service = google_compute_backend_service.app.id
}

resource "google_compute_target_https_proxy" "app" {
  provider = google-beta
  project  = var.green_project_id
  name     = "${local.name_prefix}-https-proxy"
  url_map  = google_compute_url_map.app.id

  ssl_certificates = [google_compute_managed_ssl_certificate.frontend.id]
  ssl_policy       = google_compute_ssl_policy.frontend.id
}

resource "google_compute_global_forwarding_rule" "https" {
  provider = google-beta
  project  = var.green_project_id
  name     = "${local.name_prefix}-https"

  ip_address            = google_compute_global_address.frontend.id
  target                = google_compute_target_https_proxy.app.id
  port_range            = "443"
  load_balancing_scheme = "EXTERNAL_MANAGED"
  network_tier          = "PREMIUM"
}

resource "google_dns_record_set" "frontend" {
  count = var.dns_managed_zone_name == null ? 0 : 1

  project      = var.green_project_id
  managed_zone = var.dns_managed_zone_name
  name         = "${trim(var.domain, ".")}."
  type         = "A"
  ttl          = var.dns_record_ttl_seconds
  rrdatas      = [google_compute_global_address.frontend.address]
}
