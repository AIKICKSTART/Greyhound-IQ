# GreyhoundIQ form and field registry

Status: 90/90 screen form cells contract-complete; field and runtime evidence incomplete  
Snapshot: 2026-07-14 AEST  
Owner: Product engineering

## Safe observation boundary

The production crawl inspected rendered form metadata only. It did not submit contact, authentication, billing, search or mutation forms. Submission destinations below are DOM contracts, not proof of endpoint behavior or authorization.

Focused public, account, Marketplace, community and administration entries have verified source contracts for their inventoried forms, field sets and destinations. The administration proof follows only the form-control symbols actually used by each page, expanding 21 page callsite sets into exactly 39 semantic forms rather than counting all 16 shared declarations on every importing route. Hydrated browser submission and production deployment remain unclaimed.

The managed registry block below is checked by `npm run docs:check`. Complete claims require strict verified, tested or route-specific exclusion evidence.

<!-- design-lab-forms-counter:start -->
| Registry state | Count |
| --- | ---: |
| Complete | 97 |
| Captured only | 0 |
| Explicitly blocked | 0 |
| Open | 0 |
| Total | 97 |
<!-- design-lab-forms-counter:end -->

## Observed forms

| Form ID | Route/surface | Method and destination | Purpose | Authentication | Update strategy | Result evidence |
| --- | --- | --- | --- | --- | --- | --- |
| `public-header-race-search` | Global header | GET `/races` | Search races, tracks and runners | Public | Navigation | Not submitted |
| `race-search` | `/races` | GET `/races` | Search schedule while preserving active date/state/status/sort | Public | Navigation | Verified source contract; browser submission not claimed |
| `race-date-filter` | `/races` | GET `/races` | Select schedule date while preserving q/state/status/sort | Public | Navigation | Verified source contract; browser submission not claimed |
| `race-sort-filter` | `/races` | GET `/races` | Preserve date/state/status and sort | Public | Auto-submit with button fallback | Verified source contract; browser submission not claimed |
| `result-filter` | `/results` | GET `/results` | Filter result order, date and track | Public | Auto-submit with button fallback | Verified source contract; browser submission not claimed |
| `track-filter` | `/tracks` | GET `/tracks` | Filter active tracks by state | Public | Auto-submit with button fallback | Verified source contract; browser submission not claimed |
| `discover-search` | `/discover` | GET `/discover` | Search visible people, pages, businesses and dogs | Public, visibility policy applies | Navigation | Verified source contract; permissions remain separately open |
| `marketplace-filter` | `/marketplace` | GET `/marketplace` | Search/filter public inventory | Public | Navigation | Not submitted |
| `pricing-monthly-checkout` | `/pricing` | POST `/api/billing/checkout` | Start Pro monthly checkout | Authentication/billing | Server redirect expected | Deliberately not submitted |
| `pricing-yearly-checkout` | `/pricing` | POST `/api/billing/checkout` | Start Pro yearly checkout | Authentication/billing | Server redirect expected | Deliberately not submitted |

## Observed fields

| Form ID | Field | Label or accessible name | Type | Required | Default/placeholder | Observed values or rules | Privacy class |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `public-header-race-search` | `q` | Search races, tracks, runners | search/string | No | Search races, tracks, runners | No production submission | Public query |
| `public-header-race-search` | `sort` | Hidden | hidden/string | No | `relevance` | Fixed DOM value | Public query |
| `race-search` | `q` | Search track, runner, R4, 520m | search/string | No | Search track, runner, R4, 520m | No production submission | Public query |
| `race-date-filter` | `date` | Choose race date | date/string | No | Current schedule | Links exposed 2026-07-07 through 2026-07-16 during crawl | Public query |
| `race-sort-filter` | `state` | State filters | hidden/query string | No | All | NSW, NT, QLD, SA, TAS, VIC, WA observed | Public query |
| `race-sort-filter` | `status` | Status filters | hidden/query string | No | All | upcoming, live, resulted, replay observed | Public query |
| `race-sort-filter` | `sort` | Sort races | select/string | No | Race time | Race time and relevance displayed | Public query |
| `result-filter` | `sort` | Results order | select/string | No | Newest first | Newest, oldest and track ordering displayed | Public query |
| `result-filter` | `date` | Results date | select/string | No | Latest results | Date options rendered | Public query |
| `result-filter` | `trackId` | Results track | select/identifier | No | All tracks | Track identifiers not catalogued by crawl | Public query |
| `track-filter` | `state` | Filter tracks by state | select/string | No | All states | Australian state values displayed | Public query |
| `discover-search` | `q` | Search people, pages, businesses, or dogs | search/string | No | Same as label | UI asks for at least two characters | Potential personal-data query |
| `marketplace-filter` | `q` | Title or description | text/string | No | Title or description | No production submission | Public query |
| `marketplace-filter` | `category` | Category | select/string | No | All categories | Pups, Dogs, Stud services, Wanted, Shares, Floats & Trailers, Caravans, Supplies & Pet Food, Equipment, Other | Public query |
| `pricing-monthly-checkout` | `plan` | Hidden | hidden/string | Yes by server contract, not HTML | DOM value present | Server allowlist not proven by UI | Billing intent |
| `pricing-monthly-checkout` | `interval` | Hidden | hidden/string | Yes by server contract, not HTML | DOM value present | Server allowlist not proven by UI | Billing intent |
| `pricing-yearly-checkout` | `plan` | Hidden | hidden/string | Yes by server contract, not HTML | DOM value present | Server allowlist not proven by UI | Billing intent |
| `pricing-yearly-checkout` | `interval` | Hidden | hidden/string | Yes by server contract, not HTML | DOM value present | Server allowlist not proven by UI | Billing intent |

## Trust boundaries and trace links

| Boundary | Required contract | Current trace status |
| --- | --- | --- |
| Search and filter query parameters | Parse/allowlist server-side; safe empty/no-result feedback | Source verified for `/races`, `/results`, and `/tracks`; product-wide proof remains open |
| Discover query | Visibility policy must filter private/blocked actors before response | `FRIEND-01` partial in dated ledger |
| Checkout intent | Server owns plan, interval and price; query/hidden values are not payment proof | `BILL-01` and `BILL-02` pending |
| Authentication return | Validate internal return path; reject external redirect | `AUTH-01` partial/blocked |
| Media fields | Type/size/signature/ownership/quarantine validation | `MEDIA-01` partial/blocked |

## Explicit gaps

| Gap ID | Status | Owner | Reason | Acceptance evidence needed |
| --- | --- | --- | --- | --- |
| FORM-01 | Gap | Product engineering | All 90 screen form cells have strict source/test/exclusion evidence, but the screen registry does not prove hydrated submission outcomes or complete field-level persistence/privacy behavior | Authenticated staging submissions with pending, success, safe validation failure and authorization-denial evidence linked to the authoritative form contracts |
| FORM-02 | Gap | Product engineering | Only the public production subset was observed | Authenticated account, team, community, marketplace, admin, AI and media forms captured from code and staging |
| FORM-03 | Gap | Product engineering | Field validation, sanitisation, persistence, privacy and feedback are not mapped | Per-field schema with labels, types, limits, validation messages, persistence and privacy classification plus tests |
| FORM-04 | Gap | Product engineering | Billing DOM values do not prove secure checkout handling | Server tests for allowlists, server-owned price, duplicate prevention, webhook truth and safe return; staging checkout evidence |
