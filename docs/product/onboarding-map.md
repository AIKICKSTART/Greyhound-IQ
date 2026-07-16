# GreyhoundIQ onboarding map

Status: route coverage complete; deployed-browser recapture remains a release evidence task  
Snapshot: 2026-07-15 AEST  
Owner: Product engineering

## Current evidence

All 91 registered screens now have an explicit onboarding disposition: 82 canonical routes have versioned, audience-aware five-step tours and nine permanent legacy redirects are excluded because their canonical destinations own onboarding. There are zero unstarted route cells. This is source- and test-backed coverage; it does not by itself prove the final deployed candidate or every browser/assistive-technology combination.

This managed block is checked against the live screen registry by `npm run docs:check`.

<!-- design-lab-onboarding-counter:start -->
| Registry state | Count |
| --- | ---: |
| Complete | 97 |
| Captured only | 0 |
| Explicitly blocked | 0 |
| Open | 0 |
| Total | 97 |
<!-- design-lab-onboarding-counter:end -->

## Implemented tour inventory

| Tour ID | Canonical routes | Actors | Product area | Evidence status |
| --- | ---: | --- | --- | --- |
| `tour:administrator:v1` / `tour:moderator:v1` | 32 | administrator; moderator only where permitted; support-operator guidance on the three existing support routes | Administration | Tested source contract |
| `tour:account:v1` | 13 | authenticated member, moderator, administrator | Account and managed pages | Tested source contract |
| `tour:racing-intelligence:v1` | 10 | visitor, authenticated member and real trainer-profile guidance | Meetings, racing, results, dogs, tracks and statistics | Tested source contract |
| `tour:community-pulse:v1` | 9 | visitor and authenticated member | Feed, groups, forum and discovery | Tested source contract |
| `tour:public-foundations:v1` | 8 | visitor, member, moderator and administrator | Public product and policy pages | Tested source contract |
| `tour:marketplace:v1` | 4 | visitor/member/operator on production routes; administrator on isolated Design Lab | Marketplace | Tested source contract |
| `tour:agents:v1` | 1 | authenticated member, moderator and administrator | AI agents | Tested source contract |
| `tour:design-lab:v1` | 5 | authenticated administrator | Founder Design Lab and device preview | Tested source contract |

The focused onboarding suites prove 410 route-bound steps, 1,360 allowlisted base Design Lab scenario states, a separate 16,720-state role/route/step/device/target matrix and 1,040 explicit trainer/support-operator preview states. The help area now lets a signed-in user select and persist a help focus, provides timestamped history for the five most recently completed tours, ten searchable help topics, a role-filtered list of available tours, profile-scoped browser reset and direct support navigation. Route progress uses explicit product-area, server-resolved role and subscription-tier dimensions in addition to profile, tour, version and route. Trainer guidance requires the existing authenticated `trainer` profile role. The support-operator guidance persona requires the existing moderator or administrator authorization on `/admin/support`, `/admin/feedback` or `/admin/bug-reports`; it creates no new role or privilege. Authentication, role and entitlement enforcement remain owned by the server-side page/action/service contracts; rendering a tour, selecting an intent or changing local browser storage never grants access.

## Required behavior

| Capability | Current status | Evidence boundary / next proof |
| --- | --- | --- |
| Start, next, back, skip step, dismiss, resume, restart, reset all browser-profile tours, complete and disable | Implemented and unit-tested | Final candidate needs keyboard/pointer browser recapture |
| Progress keyed by profile/browser, product area, server-resolved role, subscription tier, tour, version and route | Implemented in local browser storage with a versioned context key | The dimensions isolate guidance only; cross-device/server synchronisation is not claimed |
| Legacy progress-key migration | Implemented: the current contextual key reads and copies an existing legacy profile/tour/version/route snapshot before removing the old key | Final candidate needs one browser upgrade-path check with a seeded legacy snapshot |
| Recently completed tours | Implemented with a profile-scoped completion timestamp and five-item newest-first history | Legacy progress without a timestamp is not presented as recent; final candidate needs a browser interaction check |
| Versioned re-introduction | Implemented key separation | Material tour changes increment only that tour version; unrelated tour keys remain unchanged |
| Manual contextual help | Implemented | Route registry and semantic target tests pass |
| Help-focus intent selection | Implemented with a profile-scoped allowlisted preference and a direct guidance link | The preference changes help discovery only and never grants route access |
| Support-form field help and inline example | Implemented with labelled descriptions, category guidance, a safe problem-report example and a warning not to submit secrets | Focused source contract passes; exhaustive per-form guidance remains normal product work |
| Empty support history | Implemented with a clear explanation and direct Create ticket recovery action | Source contract distinguishes an empty history from a temporarily unavailable query |
| Missing, hidden or delayed target fallback | Implemented with safe fallback, mutation-driven attachment and one-shot activation only for an exact enabled `<button type="button">` controller declaring the allowlisted `tab` or `modal` kind and semantic target token | The protected Design Lab supplies real non-mutating tab and Sheet targets; final candidate still needs responsive keyboard/pointer browser recapture |
| Required device widths | Implemented as eight runtime classes spanning small/large phones, foldables, portrait/landscape tablets, laptops, desktops and wide desktops | Deterministic geometry tests cover 320 through 1920px; final rendered-browser recapture remains separate evidence |
| Mobile target visibility | Implemented with target-side detection, opposite-side popup clearance and restored temporary scroll margins | Focused geometry/source test passes; final touch-device interaction recapture remains separate evidence |
| Mobile navigation access | Implemented with a non-modal sheet, pointer-transparent backdrop and reserved dock clearance | Persistent navigation remains operable while help is open; final candidate needs a touch/keyboard browser check |
| Mobile keyboard safety | Implemented from Visual Viewport resize/scroll state and keyboard-aware popup bounds | Focused 390px keyboard geometry passes; final iOS and Android keyboard recapture remains separate evidence |
| Auth/role/feature denial | Source-tested fail closed | Deployed-role browser checks remain separate evidence |
| Help search, topic index, available-tour list and support navigation | Implemented and source-tested | Ten topics and role-filtered tours have explicit no-result recovery; content expansion remains normal product work |
| Contrast-safe guidance and controls | Implemented with actual design-token measurement, opaque secondary-control states and a bounded dark primary-control gradient | Current source test proves a 5.42:1 minimum text pair and 9.48:1 primary control; final rendered-browser regression remains separate evidence |
| Privacy-safe onboarding analytics | Implemented and source-tested | Nine categorical events require accepted browser analytics consent and same-origin delivery; the strict 512-byte schema rejects identity, route, role, tier, arbitrary tour/step and free-form values. Deployed gateway metrics and log-sink retention remain release evidence |

## Targeting and responsive contract

Stable semantic target identifiers are registered separately from CSS selectors, and the overlay resolves visible token-aware targets with a declared fallback instead of trapping the user. When a registered target is hidden inside a tab or dialog, only an exact visible, enabled button controller with `type="button"`, a matching semantic target token and the allowlisted `tab` or `modal` reveal kind may be activated. The controller is attempted once per tour step; arbitrary links, submit buttons, disabled controls and mismatched tokens fail closed. A successful reveal is detected through the same mutation observer; if it does not materialise, the step anchors to the safe controller or declared fallback. The tab and non-modal Sheet fixtures are presentation-only inside the administrator-protected Design Lab. Role and authentication resolution occurs before a contextual tour is exposed.

Phone guidance uses a bottom sheet where a popover would clip. The runtime classifies 320/360px as small phone, 375–430px as large phone, 431–767px as foldable, 768–819px as portrait tablet, 820–1023px as landscape tablet, 1024–1279px as laptop, 1280–1599px as desktop and 1600px or wider as wide desktop. On compact widths it scrolls the target to the upper or lower safe strip and moves the popup to the opposite region. Visual Viewport changes bound the popup above a mobile keyboard, while the non-modal pointer-transparent backdrop leaves persistent navigation available. The source-level contrast contract measures every onboarding text token against the dark sheet, raised panel and opaque control surfaces at 4.5:1 or better, with focus/target indicators at 3:1 or better. Final browser evidence still covers 320, 360, 375, 390, 430, 540/717 foldable layouts, 768, 820, 1024, 1280, 1440 and 1920 widths, portrait/landscape where applicable, reduced motion, keyboard, focus restoration and screen-reader semantics.

## Design Lab contract

Every implemented family exposes allowlisted Design Lab fixtures for its supported route, actor, step and unavailable-target fallback. URL state preserves `tour`, `tourStep`, `route`, authentication, permissions and fallback state. The permission selector includes the real trainer role and labels the existing moderator profile's support-operator use without inventing a support authorization role. Dedicated `onboardingDevice` and `onboardingTarget` controls cover eight canonical widths and both primary-target and unavailable-target fallback modes. The protected hidden-target safety lab supplies real tab and dialog disclosures with no mutation path. The base scenario contract proves 1,360 deterministic states, the focused onboarding preview contract proves exactly 16,720 supported audience/route/step/device/target combinations and an additional exact 1,040 trainer/support-operator states without submitting represented product forms, writing completion or promoting production.

## Analytics contract and data flow

`InteractiveHelp` emits exactly nine allowlisted lifecycle categories: `tour-started`, `step-viewed`, `step-skipped`, `tour-dismissed`, `tour-completed`, `tour-restarted`, `help-opened`, `upgrade-viewed` and `support-selected`. The browser client reads `greyhoundiq.cookie-consent.v1` and sends nothing unless its value is `accepted`. Delivery is best effort, same origin, no-referrer, no-store and never retried; analytics availability cannot block onboarding UI.

`POST /api/analytics/onboarding` accepts only schema version, event, a registered tour ID and—only for the two step events—a registered step ID belonging to that tour. Additional properties and identity, profile, route, role, tier, email, message and form-value dimensions are rejected. The route verifies Origin/fetch metadata and the fixed consent assertion, rejects compressed bodies, applies both declared and streamed 512-byte bounds, checks the 6,000-attempt global minute limiter before reading the body with fail-closed behaviour, and returns an empty private/no-store 204. The structured success event derives only the product area and records the allowlisted event/tour/step categories; it performs no application-data query and stores no browser identifier. The endpoint, rate policy, database counter operation, trace and OpenAPI contract are registered under `ONBOARDING.ANALYTICS.RECORD`.

Cloud log retention and deletion are deployment-owned policies and are not invented here. Before production acceptance, the deployed log sink must prove its approved retention, access control, redaction, cost alert and deletion behaviour, and edge dashboards must prove 4xx/429 volume without logging rejected attacker-controlled payloads.

## Explicit gaps

| Gap ID | Status | Owner | Reason | Acceptance evidence needed |
| --- | --- | --- | --- | --- |
| ONBOARD-01 | Conditional | Release engineering | Source has changed since the last route/browser evidence capture | Recapture the frozen candidate and bind exact source/browser hashes |
| ONBOARD-02 | Gap | Product engineering | Progress is browser-local and is not synchronised across devices | Decide whether cross-device persistence is a launch requirement; if yes, add an ownership-scoped service and tests |
| ONBOARD-04 | Conditional | Accessibility and QA | Source contracts cover contrast, reduced motion and responsive targets, not the complete assistive-technology matrix | Keyboard, screen-reader, focus-restoration and responsive candidate E2E evidence |
