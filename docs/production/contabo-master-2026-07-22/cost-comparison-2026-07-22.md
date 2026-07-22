# Single-region hosting and migration cost comparison

Observation date: **2026-07-23 AEST**. Prices are planning figures before GST. Eligibility for trials or startup programs is not assumed. The hyperscaler compute-and-disk figures below are reproducible published PAYG rates, not rounded marketing bands.

## Workload held constant

- one x86-64 Linux host, no dual region;
- approximately 18 vCPU, 94–96 GiB RAM and a 600 GB nominal root disk (581 GiB usable on the observed Contabo host); cloud comparisons retain 600 GiB/GB provisioned disk as a conservative rounded target;
- Docker-hosted Caddy, Next.js, PostgreSQL 16, PostgREST, Realtime, realtime gateway and LiveKit;
- approximately 20 GiB current PostgreSQL database;
- 730 hours/month and a 1 TiB/month public-egress planning case;
- existing self-hosted PostgreSQL, rather than adding a managed database.

The exchange-rate snapshot is from the [Reserve Bank of Australia](https://www.rba.gov.au/statistics/frequency/exchange-rates.html): 1 AUD = USD 0.6997 and EUR 0.6132 on 2026-07-22.

## Planning comparison

| Provider / shape | Region | Published PAYG compute + disk / month | Budget result | Important caveat |
| --- | --- | ---: | --- | --- |
| Contabo Cloud VPS 18 / former VPS 60 — observed 18 vCPU, 94 GiB usable RAM and 581 GiB usable root volume | **Unverified for this paid instance** | Public base listing observed at **EUR 49 = AUD 79.91** | **Base price is within AUD 100** | The authenticated invoice/renewal amount and selected physical location were not available to this run. Contabo applies a variable Australia/Asia location fee, so EUR 49 is not claimed as Daniel's exact bill. |
| [OCI VM.Standard.E5.Flex](https://www.oracle.com/cloud/iaas-paas/) — 9 OCPU / 18 vCPU, 96 GB plus 600 GB balanced block volume | Sydney | **USD 475.43 = AUD 679.48** | 6.8× over budget | USD 442.01 compute + USD 33.42 storage. Oracle publishes uniform global pricing and 10 TB/month outbound allowance. |
| [GCP n2-highmem-16](https://cloud.google.com/products/compute/pricing/general-purpose) — 16 vCPU, 128 GiB plus 600 GiB balanced disk | Sydney | **USD 825.12 = AUD 1,179.25** | 11.8× over budget | USD 765.12 compute + USD 60.00 disk. This is the closest predefined memory shape and overprovisions RAM while providing two fewer vCPUs. |
| [AWS r7i.4xlarge](https://aws.amazon.com/ec2/instance-types/r7i/) — 16 vCPU, 128 GiB plus 600 GB gp3 | Sydney | **USD 983.53 = AUD 1,405.65** | 14.1× over budget | USD 925.93 compute + USD 57.60 disk from the dated official regional price list. Egress is extra. |
| Azure Standard_E16as_v5 — 16 vCPU, 128 GiB plus 640 GiB Standard SSD LRS | Australia East | **USD 859.52 = AUD 1,228.41** | 12.3× over budget | USD 794.24 compute + USD 65.28 for 512+128 GiB disks from the [Azure Retail Prices API](https://learn.microsoft.com/en-us/rest/api/cost-management/retail-prices/azure-retail-prices). Egress is extra. |

### Reproducible rate evidence

- GCP Sydney `n2-highmem-16`: USD 1.048112/hour; balanced persistent disk: USD 0.000136986/GiB-hour. Calculation: `1.048112 * 730 + 0.000136986 * 600 * 730 = USD 825.12`.
- AWS Sydney `r7i.4xlarge`: USD 1.2684/hour; gp3: USD 0.096/GB-month. These records were read from the dated [official ap-southeast-2 EC2 price list](https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AmazonEC2/current/ap-southeast-2/index.csv). Calculation: `1.2684 * 730 + 0.096 * 600 = USD 983.53`.
- Azure Australia East `Standard_E16as_v5`: USD 1.088/hour; Standard SSD LRS E20 (512 GiB) USD 52.22/month plus E10 (128 GiB) USD 13.06/month. Calculation: `1.088 * 730 + 52.22 + 13.06 = USD 859.52`.
- OCI E5 Flex: USD 0.039318/OCPU-hour plus USD 0.0026212/GB-hour; current published balanced-volume SKUs total USD 0.0557005/GB-month. Calculation: `(9 * 0.039318 + 96 * 0.0026212) * 730 + 600 * 0.0557005 = USD 475.43`.
- Currency conversion retains the dated RBA snapshot above. Taxes, support, backups, public IPv4, load balancers, DNS, monitoring, CDN/WAF, LiveKit/TURN traffic and chargeable egress (including the 1 TiB planning case) are excluded unless explicitly included by the provider. Therefore these totals are compute-and-disk lower bounds, not invoices or complete total-cost estimates.

AWS, Azure, GCP and OCI do not have a published PAYG configuration close to this RAM/disk requirement inside AUD 100/month. Managed PostgreSQL would be an additional charge and would also require a logical role/extension/replication compatibility migration; it is not a cost-saving path for this startup workload.

## Credits and trials

- [AWS Free Tier](https://aws.amazon.com/free/) advertises up to USD 200 for a new account; [AWS Activate](https://aws.amazon.com/startups/credits/) currently advertises USD 1,000 initially and up to USD 5,000 for selected self-funded startups, or up to USD 200,000 with an eligible Activate Provider.
- [Microsoft for Startups](https://learn.microsoft.com/en-us/startups/benefits) currently advertises up to USD 150,000 in startup credits over time, or up to USD 200,000 for eligible Investor Network-backed startups. Approval and the awarded tier are not guaranteed.
- [Google Cloud Free Program](https://cloud.google.com/free/docs/free-cloud-features) advertises USD 300 for 90 days. The [Google for Startups programme](https://cloud.google.com/startup/perks) advertises up to USD 200,000 over two years, or up to USD 350,000 for eligible AI startups; acceptance is not guaranteed.
- [OCI Free Tier](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier.htm) advertises USD 300 for 30 days plus limited Always Free resources.

These offers can fund a time-limited test but do not make a 94–96 GiB continuous production host fit the AUD 100 recurring budget.

## DDoS and security cost boundary

- [AWS Shield Standard](https://docs.aws.amazon.com/pdfs/decision-guides/latest/waf-or-shield/waf-or-shield.pdf) is included; advanced layers cost extra.
- Azure provides automatic infrastructure-level protection; see the [Azure DDoS design guide](https://learn.microsoft.com/en-us/azure/networking/design-guide/ddos).
- GCP network protection and Cloud Armor depend on the chosen front end. [Cloud Armor Enterprise](https://cloud.google.com/armor/docs/armor-enterprise-overview) paid tiers alone exceed the startup budget.
- No official Contabo evidence was found establishing a hyperscaler-equivalent paid DDoS service at the observed VPS price. Keep Caddy hardening, UFW, rate limits, backups, monitoring and an emergency DNS/provider runbook, and obtain Contabo's written mitigation/SLA details.

## Migration compatibility

The current stack is portable to another x86 Linux VM without an application architecture rewrite: move the pinned container images/configuration, restore PostgreSQL, reissue TLS, configure the public IP/firewall and validate LiveKit UDP/TCP paths. Provider-specific differences are disk device/mounts, security-group syntax, public-IP/DNS workflow, snapshot tooling and egress billing.

Moving to a managed database is **not** architecture-identical. It requires PostgreSQL extension/role/RLS/grant validation, Realtime logical-replication compatibility, connection/TLS changes, logical dump/restore, cutover rehearsal and an outage or final change-capture mechanism.

## Decision

Retain the current Contabo single-VPS design for the pre-user launch, subject to confirming its actual invoice and location in the customer panel. It is the only observed full-size continuous option whose public base price is inside AUD 100/month. Do not migrate to AWS, Azure, GCP or OCI under the current recurring budget merely to consume a short trial. Revisit an Australian hyperscaler when measured traffic, revenue, latency or compliance needs justify at least roughly AUD 680/month for OCI or materially more for the other providers.
