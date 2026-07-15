# GreyhoundIQ user-story matrix

Status: all 90 story contracts satisfy the screen-coverage evidence rule; exact-candidate runtime artifacts require recapture after source changes  
Snapshot: 2026-07-14 06:25 AEST  
Owner: Product engineering

## Contract boundary

The existing registry remains the sole route and screen-story authority. It contains eight family-level stories, 22 named journeys and route-specific render baselines for all 84 non-Design-Lab registered screens: 83 production-enabled screens plus the explicitly production-disabled `/account/appearance` review preview, comprising all eight Public, all nine Racing, all 15 Community, all six Marketplace, all 13 Account, all 32 Administration and the single AI Agents screen. The remaining six routes are Design Lab review surfaces governed by their existing detailed manifests rather than duplicate inline production stories. The 84 baselines bind an actor, concrete open path, outcome, Given/When/Then acceptance, page source, source assertions, canonical route-audit row and stable test ID.

This managed block is checked against the live screen registry by `npm run docs:check`.

<!-- design-lab-userStories-counter:start -->
| Registry state | Count |
| --- | ---: |
| Complete | 97 |
| Captured only | 0 |
| Explicitly blocked | 0 |
| Open | 0 |
| Total | 97 |
<!-- design-lab-userStories-counter:end -->

All 84 non-Design-Lab baselines have deliberately narrow **render-contract** evidence. This does not make the Appearance preview production-enabled. The canonical single-worker 90-route HTTP audit contains one passing row per route in its captured snapshot, including the intentional Forum-to-Groups, Messages-to-Pulse and Listings-to-Marketplace redirects, and each story also binds source-specific assertions. Current source changes invalidate exact-candidate runtime evidence until the audit is recaptured. Administration role requirements remain only source-bound to the fail-closed authorization inventory: 23 pages declare administrator access and nine declare moderator access. The AI contract binds the registry's `ai-tools-user` role and Pro/Pro+ tiers plus the source-present Pro entry gate and per-agent Pro or Pro+ requirements, without upgrading those declarations to request-level enforcement or successful agent execution. Runtime role/tier denial, submissions, mutations, payment settlement, execution, cancellation, history and memory isolation remain unverified.

## Registered family stories

| Area | Actor | Goal and value | Current evidence | Status |
| --- | --- | --- | --- | --- |
| Public website | Visitor and prospective member | Understand GreyhoundIQ, compare plans, contact the team and read legal terms before account creation | Eight routes and eight route-specific render baselines registered | Tested render contract against current source |
| Racing intelligence | Visitor and racing member | Move from meetings to races, dogs, tracks, results, statistics and breeding context | Nine routes and nine route-specific render baselines registered | Tested render contract against current source |
| Community and messaging | Member, seller and community participant | Discover people, publish and react, join groups and continue private conversations safely | Fifteen routes and 15 route-specific render baselines registered, including canonical redirect bindings | Tested render contract against current source |
| Marketplace | Public buyer and signed-in seller | Browse, filter, save, enquire and create truthful listings | Six routes and six route-specific render baselines registered, including canonical Listings redirects | Tested render contract against current source; mutations remain unverified |
| Account | Authenticated member | Manage identity, profile, privacy, security, billing, notifications, pages, team, usage and support | Thirteen routes and 13 route-specific render baselines registered with sign-in, empty, unavailable and non-authoritative payment-return boundaries | Tested render contract against current source; authenticated behavior remains unverified |
| Administration | Moderator and administrator under least privilege | Process operational queues and inspect only the controls declared for the current role | Thirty-two route-specific render baselines registered and bound to the authorization inventory: 23 administrator-only and nine moderator-capable | Tested render contract against current source; request-level role denial and all mutations remain unverified |
| AI tools | AI-tools user and administrator | Understand and launch supported AI tools without exposing secrets or unsupported automation | One route-specific baseline binds the Agents source, current audit row, registry role/tier metadata, Pro entry gate and per-agent Pro or Pro+ requirements | Tested render contract against the last captured source; request-level role/tier denial, execution, cancellation, history and memory isolation remain unverified |
| Design Lab | Reviewer and administrator | Review every registered screen without production data or mutations | Six routes, 90 contracts and checklist UI | Implemented for route exploration; state/action parity incomplete |

## Non-Design-Lab registered screen baseline stories

Every non-Design-Lab row below is inline on its existing `DEMO_SCREEN_FAMILIES` screen entry; there is no second route or story registry. `PUBLIC-RACING-STORY-CONTRACT`, `COMMUNITY-STORY-CONTRACT`, `MARKETPLACE-ACCOUNT-STORY-CONTRACT`, `ADMIN-STORY-CONTRACT` and `AI-STORY-CONTRACT` prove the 1:1 registry mapping, concrete route, source-file existence, story-specific source assertions and canonical audit-row shape. The Admin contract additionally pins every page to `ADMIN_AUTHORIZATION_INVENTORY`; the AI contract pins the route to its registry role and tier declarations. Neither upgrades source declarations to runtime enforcement proof. The Appearance row remains production-disabled, and the six Design Lab routes remain solely under their separate detailed manifests.

| Story ID | Actor | Route opened | Render outcome and exact acceptance focus | Source evidence | Status |
| --- | --- | --- | --- | --- | --- |
| `PUBLIC.STORY.HOME` | Visitor | `/` | Today’s race context; meeting content or explicit no-meetings fallback | `src/app/page.tsx` | Tested render — `E-STORY-RENDER` |
| `PUBLIC.STORY.ABOUT` | Prospective member | `/about` | Product purpose, guiding beliefs and visible contact section | `src/app/about/page.tsx` | Tested render — `E-STORY-RENDER` |
| `PUBLIC.STORY.AUTH-ERROR` | Visitor with interrupted sign-in | `/auth/error` | Generic recovery state with sign-in and support choices; no internal error exposure | `src/app/auth/error/page.tsx` | Tested render — `E-STORY-RENDER` |
| `PUBLIC.STORY.CONTACT` | Visitor seeking support | `/contact` | Public support email and visible account boundary for ticket creation | `src/app/contact/page.tsx` | Tested render — `E-STORY-RENDER` |
| `PUBLIC.STORY.PRICING` | Prospective member | `/pricing` | Published AUD plan comparison and common questions | `src/app/pricing/page.tsx` | Tested render — `E-STORY-RENDER` |
| `PUBLIC.STORY.PRIVACY` | Visitor reviewing data handling | `/privacy` | Privacy policy, APP context and stated personal-data rights | `src/app/privacy/page.tsx` | Tested render — `E-STORY-RENDER` |
| `PUBLIC.STORY.RESPONSIBLE-USE` | Adult visitor | `/responsible-use` | Information-not-advice boundary and Australian support contact | `src/app/responsible-use/page.tsx` | Tested render — `E-STORY-RENDER` |
| `PUBLIC.STORY.TERMS` | Visitor reviewing conditions | `/terms` | Terms, 18+ responsible-racing boundary and liability limitation | `src/app/terms/page.tsx` | Tested render — `E-STORY-RENDER` |
| `RACING.STORY.BREEDING` | Racing visitor | `/breeding` | Active sire context separated from labelled Phase 2 capability | `src/app/breeding/page.tsx` | Tested render — `E-STORY-RENDER` |
| `RACING.STORY.DOG-SEARCH` | Racing visitor | `/dogs` | Dog-search surface, dataset tallies and initial-query handoff | `src/app/dogs/page.tsx` | Tested render — `E-STORY-RENDER` |
| `RACING.STORY.DOG-DETAIL` | Racing visitor | `/dogs/cmr0fg5ki00a4ephcaj4sdctc` (`/dogs/[id]`) | Found record shows ownership, pedigree and form; missing record binds to not-found | `src/app/dogs/[id]/page.tsx` | Tested render — `E-STORY-RENDER` |
| `RACING.STORY.RACE-EXPLORER` | Racing visitor | `/races` | Race-control and racecard context or explicit no-races state | `src/app/races/page.tsx` | Tested render — `E-STORY-RENDER` |
| `RACING.STORY.RACE-DETAIL` | Racing visitor | `/races/c842cd06-5f44-461c-be14-94439ebee1eb` (`/races/[id]`) | Found record shows runners/results and summary; missing record binds to not-found | `src/app/races/[id]/page.tsx` | Tested render — `E-STORY-RENDER` |
| `RACING.STORY.RESULTS` | Racing visitor | `/results` | Settled-result rows or explicit no-results state | `src/app/results/page.tsx` | Tested render — `E-STORY-RENDER` |
| `RACING.STORY.STATISTICS` | Racing visitor | `/statistics` | Box-win rates, trainer leaderboard and current track records | `src/app/statistics/page.tsx` | Tested render — `E-STORY-RENDER` |
| `RACING.STORY.TRACKS` | Racing visitor | `/tracks` | Active venues or explicit no-tracks state | `src/app/tracks/page.tsx` | Tested render — `E-STORY-RENDER` |
| `RACING.STORY.TRACK-DETAIL` | Racing visitor | `/tracks/ce9ee26f-b678-4a19-9aa7-58185d2a3719` (`/tracks/[id]`) | Found record shows meetings, profile and box wins; missing record binds to not-found | `src/app/tracks/[id]/page.tsx` | Tested render — `E-STORY-RENDER` |
| `COMMUNITY.STORY.DISCOVER` | Community visitor | `/discover` | Public actor and dog search with initial guidance, grouped results and explicit no-match state | `src/app/discover/page.tsx` | Tested render — `E-STORY-RENDER` |
| `COMMUNITY.STORY.FEED` | Community visitor or signed-in member | `/feed` | Non-interactive public feed or signed-in ordering, identity-aware composer and managed-page Pro boundary | `src/app/feed/page.tsx` | Tested render — `E-STORY-RENDER` |
| `COMMUNITY.STORY.FORUM-DIRECTORY` | Community visitor or signed-in member | `/forum` → `/groups` | Public group and recent-thread directory with member/public and no-groups states | `src/app/forum/page.tsx` | Tested render — `E-STORY-RENDER` |
| `COMMUNITY.STORY.FORUM-GROUP` | Community visitor or signed-in member | `/forum/general` → `/groups/general` (`/forum/[slug]`) | Group threads or empty state, missing-group not-found and signed-in creation boundary | `src/app/forum/[slug]/page.tsx` | Tested render — `E-STORY-RENDER` |
| `COMMUNITY.STORY.FORUM-THREAD` | Community visitor or signed-in member | `/forum/threads/demo-route-audit-thread` → `/groups/threads/demo-route-audit-thread` (`/forum/threads/[id]`) | Public posts with missing, locked and signed-out reply boundaries | `src/app/forum/threads/[id]/page.tsx` | Tested render — `E-STORY-RENDER` |
| `COMMUNITY.STORY.GROUPS-DIRECTORY` | Community visitor using the Groups URL | `/groups` | Primary Groups route delegates page and metadata to the shared directory implementation | `src/app/groups/page.tsx` | Tested render — `E-STORY-RENDER` |
| `COMMUNITY.STORY.GROUPS-GROUP` | Community visitor using a Groups detail URL | `/groups/general` (`/groups/[slug]`) | Groups detail delegates rendering and metadata to the shared slug implementation | `src/app/groups/[slug]/page.tsx` | Tested render — `E-STORY-RENDER` |
| `COMMUNITY.STORY.GROUPS-THREAD` | Community visitor using a Groups thread URL | `/groups/threads/demo-route-audit-thread` (`/groups/threads/[id]`) | Groups thread delegates rendering and metadata to the shared thread implementation | `src/app/groups/threads/[id]/page.tsx` | Tested render — `E-STORY-RENDER` |
| `COMMUNITY.STORY.MESSAGES-INBOX` | Pulse visitor or signed-in member | `/messages` → `/pulse` | Signed-out private boundary or signed-in inbox, unread, empty, friends and composer states | `src/app/messages/page.tsx` | Tested render — `E-STORY-RENDER` |
| `COMMUNITY.STORY.MESSAGES-THREAD` | Pulse visitor or conversation participant | `/messages/demo-conversation-admin-pro` → `/pulse/demo-conversation-admin-pro` (`/messages/[id]`) | Sign-in before lookup, inaccessible-thread not-found and explicit private or blocked states | `src/app/messages/[id]/page.tsx` | Tested render — `E-STORY-RENDER` |
| `COMMUNITY.STORY.MESSAGES-FRIENDS` | Pulse visitor or signed-in member | `/messages/friends` → `/pulse/friends` | Sign-in or no-friends guidance and conversation-bound message, voice and video links | `src/app/messages/friends/page.tsx` | Tested render — `E-STORY-RENDER` |
| `COMMUNITY.STORY.PUBLIC-PROFILE` | Community visitor or signed-in member | `/p/demo-control-room` (`/p/[handle]`) | Personal or managed-page view, missing-actor not-found and signed-out connect/follow boundaries | `src/app/p/[handle]/page.tsx` | Tested render — `E-STORY-RENDER` |
| `COMMUNITY.STORY.PULSE-INBOX` | Pulse visitor or signed-in member | `/pulse` | Primary Pulse route delegates page and metadata to the shared inbox implementation | `src/app/pulse/page.tsx` | Tested render — `E-STORY-RENDER` |
| `COMMUNITY.STORY.PULSE-THREAD` | Pulse visitor or conversation participant | `/pulse/demo-conversation-admin-pro` (`/pulse/[id]`) | Primary Pulse detail delegates rendering and metadata to shared private-thread logic | `src/app/pulse/[id]/page.tsx` | Tested render — `E-STORY-RENDER` |
| `COMMUNITY.STORY.PULSE-FRIENDS` | Pulse visitor or signed-in member | `/pulse/friends` | Primary Pulse friends route delegates page and metadata to the shared accepted-friends implementation | `src/app/pulse/friends/page.tsx` | Tested render — `E-STORY-RENDER` |
| `MARKETPLACE.STORY.LISTINGS-DIRECTORY` | Marketplace visitor or signed-in buyer | `/listings` → `/marketplace` | Inventory, filters, empty and review-return states with illustrative-media non-verification disclosure | `src/app/listings/page.tsx` | Tested render — `E-STORY-RENDER` |
| `MARKETPLACE.STORY.LISTING-DETAIL` | Marketplace visitor, buyer or listing owner | `/listings/demo-listing-racing-toolkit` → `/marketplace/demo-listing-racing-toolkit` (`/listings/[id]`) | Missing-item not-found plus seller, enquiry-tier, sign-in and owner-review boundaries | `src/app/listings/[id]/page.tsx` | Tested render — `E-STORY-RENDER` |
| `MARKETPLACE.STORY.LISTING-CREATE` | Prospective or signed-in marketplace seller | `/listings/new` → `/marketplace/new` | Sign-in or Pro eligibility boundary and moderated form with welfare and legal acknowledgements | `src/app/listings/new/page.tsx` | Tested render — `E-STORY-RENDER` |
| `MARKETPLACE.STORY.MARKETPLACE-DIRECTORY` | Marketplace visitor or signed-in buyer | `/marketplace` | Primary Marketplace route delegates page and metadata to the shared listings directory | `src/app/marketplace/page.tsx` | Tested render — `E-STORY-RENDER` |
| `MARKETPLACE.STORY.MARKETPLACE-DETAIL` | Marketplace visitor, buyer or listing owner | `/marketplace/demo-listing-racing-toolkit` (`/marketplace/[id]`) | Primary Marketplace detail delegates rendering and metadata to shared item logic | `src/app/marketplace/[id]/page.tsx` | Tested render — `E-STORY-RENDER` |
| `MARKETPLACE.STORY.MARKETPLACE-CREATE` | Prospective or signed-in marketplace seller | `/marketplace/new` | Primary Marketplace creation route delegates page and metadata to the shared eligibility and form source | `src/app/marketplace/new/page.tsx` | Tested render — `E-STORY-RENDER` |
| `ACCOUNT.STORY.OVERVIEW` | Signed-out visitor or authenticated member | `/account` | Sign-in or member profile, navigation, privacy, deletion and billing-entry context without implicit payment | `src/app/account/page.tsx` | Tested render — `E-STORY-RENDER` |
| `ACCOUNT.STORY.APPEARANCE-PREVIEW` | Design Lab appearance reviewer | `/account/appearance` | Production-disabled, URL-only visual preview that explicitly saves no account, delivery, database or billing setting | `src/app/account/appearance/page.tsx` | Tested render — `E-STORY-RENDER` |
| `ACCOUNT.STORY.BILLING` | Signed-out visitor or authenticated billing member | `/account/billing` | Sign-in or local plan, entitlement and invoice snapshots; only a verified webhook changes payment state | `src/app/account/billing/page.tsx` | Tested render — `E-STORY-RENDER` |
| `ACCOUNT.STORY.NOTIFICATIONS` | Authenticated member reviewing notifications | `/account/notifications` | Signed-out redirect or account-scoped in-app and marketing-preference states | `src/app/account/notifications/page.tsx` | Tested render — `E-STORY-RENDER` |
| `ACCOUNT.STORY.MANAGED-PAGES` | Authenticated member managing public identities | `/account/pages` | Pro boundary or owned-page inventory and empty state; return URL alone does not confirm bespoke payment | `src/app/account/pages/page.tsx` | Tested render — `E-STORY-RENDER` |
| `ACCOUNT.STORY.MANAGED-PAGE-DETAIL` | Authenticated owner of a managed page | `/account/pages/demo-custom-page-control-room` (`/account/pages/[id]`) | Owner-scoped lookup, not-found, contact visibility, combined save and destructive deletion boundaries | `src/app/account/pages/[id]/page.tsx` | Tested render — `E-STORY-RENDER` |
| `ACCOUNT.STORY.PRIVACY` | Authenticated member reviewing privacy records | `/account/privacy` | Signed-out redirect or account-scoped export, terms, consent and marketing records with empty states | `src/app/account/privacy/page.tsx` | Tested render — `E-STORY-RENDER` |
| `ACCOUNT.STORY.PROFILE-STUDIO` | Authenticated member editing profile media | `/account/profile` | Safe return-to sign-in boundary and media studio whose current images remain live during safety processing | `src/app/account/profile/page.tsx` | Tested render — `E-STORY-RENDER` |
| `ACCOUNT.STORY.SAVED-LISTINGS` | Authenticated marketplace buyer | `/account/saved-listings` | Signed-out redirect or account-scoped saved item cards and explicit empty state | `src/app/account/saved-listings/page.tsx` | Tested render — `E-STORY-RENDER` |
| `ACCOUNT.STORY.SECURITY` | Authenticated member reviewing account security | `/account/security` | Safe local account fields and WorkOS handoff without provider identifiers, tokens, cookies or session internals | `src/app/account/security/page.tsx` | Tested render — `E-STORY-RENDER` |
| `ACCOUNT.STORY.SUPPORT` | Authenticated member reviewing support history | `/account/support` | Account-scoped ticket summaries with created, empty and recoverable unavailable states; no message contents | `src/app/account/support/page.tsx` | Tested render — `E-STORY-RENDER` |
| `ACCOUNT.STORY.TEAM` | Authenticated organization member | `/account/team` | Read-only WorkOS-linked membership table with empty and recoverable unavailable states | `src/app/account/team/page.tsx` | Tested render — `E-STORY-RENDER` |
| `ACCOUNT.STORY.USAGE` | Signed-out visitor or authenticated member | `/account/usage` | Sign-in or local entitlement limits and account usage with empty and recoverable unavailable states | `src/app/account/usage/page.tsx` | Tested render — `E-STORY-RENDER` |
| `ADMIN.STORY.DASHBOARD` | Administrator | `/admin` | Live queues, reporting and health command centre; source redirects moderators to Reports | `src/app/admin/page.tsx` | Tested render — `E-STORY-RENDER` |
| `ADMIN.STORY.ACCOUNT-DELETION` | Administrator reviewing deletion operations | `/admin/account-deletion` | Pending requests, jobs and redacted deletion audit rows with bounded status controls | `src/app/admin/account-deletion/page.tsx` | Tested render — `E-STORY-RENDER` |
| `ADMIN.STORY.ACTIONS` | Administrator reviewing privileged actions | `/admin/actions` | Bounded action, target, reason and timestamp ledger with explicit empty state | `src/app/admin/actions/page.tsx` | Tested render — `E-STORY-RENDER` |
| `ADMIN.STORY.AUDIT` | Administrator reviewing audit evidence | `/admin/audit` | Bounded actor-type, action, target and timestamp rows with sensitive metadata excluded | `src/app/admin/audit/page.tsx` | Tested render — `E-STORY-RENDER` |
| `ADMIN.STORY.BESPOKE` | Moderator or administrator handling bespoke work | `/admin/bespoke` | Paid request rows and allowlisted status, notes and reason form; no mutation-success claim | `src/app/admin/bespoke/page.tsx` | Tested render — `E-STORY-RENDER` |
| `ADMIN.STORY.BILLING` | Administrator reconciling billing customers | `/admin/billing` | Local customer lifecycle rows with raw provider payloads and metadata excluded | `src/app/admin/billing/page.tsx` | Tested render — `E-STORY-RENDER` |
| `ADMIN.STORY.BILLING-EVENTS` | Administrator reviewing billing events | `/admin/billing-events` | Local event lifecycle rows and controls without provider event identifiers or raw payloads | `src/app/admin/billing-events/page.tsx` | Tested render — `E-STORY-RENDER` |
| `ADMIN.STORY.BUG-REPORTS` | Moderator reviewer or administrator manager | `/admin/bug-reports` | Bug severity and status rows; moderator read-only label versus administrator controls | `src/app/admin/bug-reports/page.tsx` | Tested render — `E-STORY-RENDER` |
| `ADMIN.STORY.COMPLIANCE` | Administrator reviewing compliance records | `/admin/compliance` | Read-only terms, consent and marketing records with emails, tokens and payloads excluded | `src/app/admin/compliance/page.tsx` | Tested render — `E-STORY-RENDER` |
| `ADMIN.STORY.DOG-OWNERSHIP` | Moderator or administrator reviewing claims | `/admin/dog-ownership` | Pending ownership claims and approve/reject controls with claimant-visible rejection reason | `src/app/admin/dog-ownership/page.tsx` | Tested render — `E-STORY-RENDER` |
| `ADMIN.STORY.ENTITLEMENTS` | Administrator reviewing entitlement snapshots | `/admin/entitlements` | Snapshot identifiers, byte length and key count while raw entitlement JSON stays hidden | `src/app/admin/entitlements/page.tsx` | Tested render — `E-STORY-RENDER` |
| `ADMIN.STORY.EXPORTS` | Administrator managing export artifacts | `/admin/exports` | Artifact creation/status controls and lifecycle rows without paths or object contents | `src/app/admin/exports/page.tsx` | Tested render — `E-STORY-RENDER` |
| `ADMIN.STORY.FEED` | Moderator or administrator reviewing the feed | `/admin/feed` | Community topics and public posts with pinned and visibility moderation controls | `src/app/admin/feed/page.tsx` | Tested render — `E-STORY-RENDER` |
| `ADMIN.STORY.FEEDBACK` | Moderator reviewer or administrator manager | `/admin/feedback` | Feedback status and timestamps; moderator read-only label versus administrator controls | `src/app/admin/feedback/page.tsx` | Tested render — `E-STORY-RENDER` |
| `ADMIN.STORY.INVITATIONS` | Administrator reviewing invitations | `/admin/invitations` | Organization-invitation lifecycle rows with token/email hashes and provider data hidden | `src/app/admin/invitations/page.tsx` | Tested render — `E-STORY-RENDER` |
| `ADMIN.STORY.INVOICES` | Administrator reconciling invoices | `/admin/invoices` | Local invoice rows and operational controls without private provider IDs or raw payloads | `src/app/admin/invoices/page.tsx` | Tested render — `E-STORY-RENDER` |
| `ADMIN.STORY.JOBS` | Administrator monitoring background work | `/admin/jobs` | Read-only usage, webhook, job and agent-run status with raw sensitive fields excluded | `src/app/admin/jobs/page.tsx` | Tested render — `E-STORY-RENDER` |
| `ADMIN.STORY.LISTINGS` | Moderator or administrator reviewing listings | `/admin/listings` | Pending/recent listings, category controls and approve/reject/remove action surfaces | `src/app/admin/listings/page.tsx` | Tested render — `E-STORY-RENDER` |
| `ADMIN.STORY.ORGANIZATIONS` | Administrator managing organizations | `/admin/organizations` | Organization and invitation forms with token hashes and provider secrets undisplayed | `src/app/admin/organizations/page.tsx` | Tested render — `E-STORY-RENDER` |
| `ADMIN.STORY.PAGE-RULES` | Administrator reviewing fraud gates | `/admin/page-rules` | Strict-default custom-page and marketplace fraud-gate toggles with audit warning | `src/app/admin/page-rules/page.tsx` | Tested render — `E-STORY-RENDER` |
| `ADMIN.STORY.PAYMENTS` | Administrator reconciling payment records | `/admin/payments` | Local payment, refund and credit-note tables; no provider-settlement proof | `src/app/admin/payments/page.tsx` | Tested render — `E-STORY-RENDER` |
| `ADMIN.STORY.PLANS` | Administrator managing plan catalog data | `/admin/plans` | Plans, prices and entitlement forms with provider identifiers held read-only | `src/app/admin/plans/page.tsx` | Tested render — `E-STORY-RENDER` |
| `ADMIN.STORY.REPORTS` | Moderator or administrator resolving reports | `/admin/reports` | Report queue totals and dismiss/resolve controls; no content-action or write proof | `src/app/admin/reports/page.tsx` | Tested render — `E-STORY-RENDER` |
| `ADMIN.STORY.RETENTION` | Administrator reviewing retention operations | `/admin/retention` | Policy and deletion-job controls limited to approved identifiers, statuses and times | `src/app/admin/retention/page.tsx` | Tested render — `E-STORY-RENDER` |
| `ADMIN.STORY.SAFETY` | Moderator or administrator handling safety signals | `/admin/safety` | Banned phrases, safety flags, metrics and moderator control surfaces | `src/app/admin/safety/page.tsx` | Tested render — `E-STORY-RENDER` |
| `ADMIN.STORY.SITE-CONTENT` | Administrator editing pricing copy | `/admin/site-content` | Pricing-copy editor that separates marketing text from Stripe-configured charge amounts | `src/app/admin/site-content/page.tsx` | Tested render — `E-STORY-RENDER` |
| `ADMIN.STORY.SOURCE-HEALTH` | Administrator monitoring data sources | `/admin/source-health` | Local live-feed and DataSourceHealth states without triggering provider imports | `src/app/admin/source-health/page.tsx` | Tested render — `E-STORY-RENDER` |
| `ADMIN.STORY.SUBSCRIPTIONS` | Administrator reviewing subscriptions | `/admin/subscriptions` | Local subscription lifecycle rows without private provider IDs or payload snapshots | `src/app/admin/subscriptions/page.tsx` | Tested render — `E-STORY-RENDER` |
| `ADMIN.STORY.SUPPORT` | Moderator reviewer or administrator manager | `/admin/support` | Ticket counts and summaries without message contents; moderator read-only versus admin controls | `src/app/admin/support/page.tsx` | Tested render — `E-STORY-RENDER` |
| `ADMIN.STORY.USAGE` | Administrator reviewing platform usage | `/admin/usage` | Local aggregates, events and outbox rows using approved operational fields | `src/app/admin/usage/page.tsx` | Tested render — `E-STORY-RENDER` |
| `ADMIN.STORY.USERS` | Administrator reviewing member access | `/admin/users` | Search/filter user rows and source-present access controls; no safe-write proof | `src/app/admin/users/page.tsx` | Tested render — `E-STORY-RENDER` |
| `ADMIN.STORY.WEBHOOKS` | Administrator reviewing webhook delivery | `/admin/webhooks` | Recent local event status and timing rows; no upstream-delivery correctness claim | `src/app/admin/webhooks/page.tsx` | Tested render — `E-STORY-RENDER` |
| `AI.STORY.AGENT-CONSOLE` | GreyhoundIQ member evaluating AI-assisted racing tools | `/agents` | Supported agent lineup and limitations, pricing/statistics paths, Pro entry gate, per-agent Pro or Pro+ requirements and bounded recent-run or empty state; no runtime role/tier/execution proof | `src/app/agents/page.tsx` | Source-tested; render recapture required — `E-STORY-RENDER` |

### Evidence and remaining blocker

| Evidence or blocker ID | Exact boundary | Owner | Clear condition |
| --- | --- | --- | --- |
| `E-STORY-RENDER` | The current-source canonical audit proves only successful route rendering plus registered source assertions for the exact 84 non-Design-Lab baselines: 83 production-enabled and one production-disabled preview. | Route-audit evidence lane | Preserve the matching digest and file count; any fingerprinted source change requires another canonical audit before retaining tested render status. |
| `B-STORY-DEEP` | Alternative states, authenticated journeys, Admin request-level role denial, mutations and AI role/tier/execution boundaries are not proved by render evidence. | Product, authorization and AI evidence lanes | Exercise the exact state, actor, role, tier, action and outcome matrices in an isolated or staging environment and bind the resulting evidence to the immutable candidate. |

## Registered journeys

| Journey | Current status | Evidence limit |
| --- | --- | --- |
| Visitor → pricing → sign in → safe return → signed-in home | Partial | Pricing and sign-in entry observed; safe return and signed-in result not exercised |
| New member → clean help popup → toggle help → reopen from Menu | Registered only | No product-wide onboarding registry or journey evidence |
| Race discovery → meeting → race → dog → track → result context | Partial | Links and representative details observed; return context and scroll/filter preservation untested |
| Feed → create post → react/comment/save/share → private chat | Registered only | Public empty state observed; no authenticated mutation evidence |
| Marketplace → verified profile → active item → save/enquire → seller handover | Partial | All six Marketplace render baselines are source-bound; save, enquiry and handover mutations remain untested |
| Account → profile/security/privacy/notifications → billing checkout → verified return | Registered only | All 13 Account render baselines are source-bound; authenticated mutations and verified billing return execution remain untested |
| Seller → create listing → moderation → publish → edit/withdraw | Registered only | Create eligibility, acknowledgement and moderation wording is source-bound; mutations and moderation execution remain untested |
| Moderator/admin → queue → confirm mutation → success/audit → safe error recovery | Registered only | All 32 Administration render baselines are source-bound to exact page-role declarations (23 admin, nine moderator), but request-level denial, mutation success, audit write and recovery remain untested |

## Story-contract completeness

| Contract field | Current coverage |
| --- | --- |
| Actor, goal, value, broad entry point | Route-specific for all 84 non-Design-Lab screens (83 production-enabled plus one production-disabled preview); six Design Lab review routes remain under separate detailed manifests |
| Preconditions, permissions, tier and feature flags | Broad family metadata, exact source-declared page roles for all 32 Administration routes, and AI registry role/tier metadata; request-level enforcement remains unverified |
| Required data | Not registered per screen |
| Happy, alternative, failure and private paths | Render outcome plus explicit empty, unavailable, not-found, redirect, signed-out, tier, non-authoritative payment-return, source-declared Admin role or AI execution-gate alternative where present for all 84 non-Design-Lab screens; full journey paths remain incomplete |
| Actions, forms, fields and validation | Production public subset observed; full local inventory absent |
| Loading, empty, success and recoverable error | Five base state names assigned; fixtures/evidence incomplete |
| Navigation result and context preservation | Not registered per action |
| Analytics and audit events | Not registered per story |
| Onboarding guidance | Not started for all 90 routes |
| Accessibility and mobile behavior | Family acceptance language only; not linked per story |
| Automated coverage | 84 source-bound render contracts plus current-source canonical route rows are tested; Admin also binds the 32-page role inventory and AI binds registry role/tier metadata, while missing runtime enforcement evidence blocks deeper behavior credit |

## Security trace cross-references

The dated execution ledger at [`full-task-status-20260712.md`](../../output/orchestration/full-task-status-20260712.md) remains the source for these trace statuses: `AUTH-01` partial/blocked, `CALL-01` partial/blocked, `MEDIA-01` partial/blocked, `BILL-01` pending, `BILL-02` pending, `OPS-01` pending/blocked and `REL-01` partial. These statuses constrain the associated stories; they are not upgraded by public UI observations.

## Explicit gaps

| Gap ID | Status | Owner | Reason | Acceptance evidence needed |
| --- | --- | --- | --- | --- |
| STORY-01 | Render baseline complete (84/84 non-Design-Lab) | Product engineering | All 83 production-enabled screens and the explicitly production-disabled Appearance preview have a source-checked render baseline and one passing current-source canonical route-audit row; six Design Lab routes retain their separate manifests | Preserve the fingerprint bind and independently review the final artifact; any later source change requires recapture |
| STORY-02 | Gap | Product engineering | The eight registered journeys are labels without linked step evidence | E2E trace for each step, route, action, state, role and expected result |
| STORY-03 | Gap | Product engineering | Authenticated, seller, moderator and administrator stories were not exercised in the production crawl | Staging identities and least-privilege E2E evidence without production mutations |
| STORY-04 | Gap | Product engineering | Analytics and audit-event expectations are not mapped | Privacy-reviewed event registry and tests proving no sensitive values are recorded |
