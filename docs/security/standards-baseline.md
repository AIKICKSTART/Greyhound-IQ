# GreyhoundIQ security standards baseline

Status: 10 of 11 adoption decisions verified; PCI merchant/SAQ scope remains open  
Primary-source review: 2026-07-14 AEST  
Owner: Security engineering; PCI scope requires business/payment owner approval

This register proves which baselines GreyhoundIQ uses. It does **not** claim that every control in those standards passes. Implementation, runtime, deployment, and residual-risk evidence remains governed by the corresponding security master requirements.

| Baseline | Current decision | Local application |
| --- | --- | --- |
| [OWASP ASVS 5.0.0](https://owasp.org/www-project-application-security-verification-standard/) | Adopted | Application-control verification and versioned requirement references |
| [OWASP Top 10:2025](https://owasp.org/Top10/) | Adopted | Web-risk and secure-design review |
| [OWASP API Security Top 10:2023](https://owasp.org/API-Security/editions/2023/en/0x11-t10/) | Adopted | API inventory, authorization, resource-control, provider-consumption, and OpenAPI audit review |
| [NIST SP 800-218 SSDF 1.1](https://csrc.nist.gov/pubs/sp/800/218/final) | Adopted final baseline | CI, supply-chain, provenance, vulnerability, and secure-development governance |
| [NIST SSDF 1.2](https://csrc.nist.gov/Projects/ssdf/publications) | Tracked as draft | The official NIST publications index still marked SP 800-218 Rev. 1 draft at the review date; it does not replace the final 1.1 baseline yet |
| [Australian Privacy Principles](https://www.oaic.gov.au/privacy/australian-privacy-principles) | Mapped | Personal-information purpose, access, disclosure, quality, security, retention, deletion, and incident handling |
| [OAIC APP 11](https://www.oaic.gov.au/privacy/australian-privacy-principles/australian-privacy-principles-guidelines/chapter-11-app-11-security-of-personal-information) | Mapped | Reasonable technical/organisational protection and destruction or de-identification when no longer required, subject to lawful retention |
| [Notifiable Data Breaches scheme](https://www.oaic.gov.au/privacy/notifiable-data-breaches) | Mapped | Suspected-breach assessment, eligible-breach decision, notification, evidence preservation, and incident communication |
| [PCI DSS 4.0.1](https://www.pcisecuritystandards.org/standards/pci-dss/) | Scope decision open | Apply only to systems that store, process, transmit, or can impact payment account data; exact merchant and SAQ scope still needs qualified owner approval |
| Provider-held card data | Architecture verified | Stripe-hosted Checkout and Billing Portal own card entry; GreyhoundIQ does not model PAN or CVC fields |
| Defensible assurance target | Adopted | Traceable controls, repeatable verification, no known unaccepted Critical/High findings at launch, and explicit residual risk; never “perfect security” |

## Release boundary

The PCI scope requirement remains open because using hosted Stripe surfaces can reduce scope but does not itself constitute a formal merchant-scope determination. Launch approval requires an accountable business/payment owner to record the applicable Stripe integration model, merchant responsibilities, SAQ path, payment-page script exposure, evidence retention, and re-scope triggers.

The NIST 1.2 decision must be reviewed when NIST changes the publication status. A future final release requires an explicit delta review; it must not silently replace SSDF 1.1 in this register.
