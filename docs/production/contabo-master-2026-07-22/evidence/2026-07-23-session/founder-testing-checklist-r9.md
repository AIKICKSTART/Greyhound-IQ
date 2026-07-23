# Founder human-testing checklist — r9 (greyhoundsiq.com.au)

Testers: Daniel + co-founder. Test on BOTH a phone (390-width class) and a
desktop browser. Each row: do the action, expect the result, tick or note.
Anything that fails or feels wrong: screenshot + one line — send in chat.

## 1. Messenger (biggest change — pop chat is now THE messenger)

| # | Action | Expect |
| --- | --- | --- |
| 1 | Open Chat from the bottom dock | Pulse panel opens: Inbox / Unread / Friends / Requests tabs |
| 2 | Tap "Find friends" in the panel footer | Add-friend search opens INSIDE the panel (no page navigation) |
| 3 | Search a member, send request, then open Requests tab | Request visible; accept/decline work in-panel |
| 4 | Open a conversation from Inbox | Phone: chat fills the whole screen, bottom dock hidden. Desktop: pop window (bounded card on the conversation page) |
| 5 | Send a message | Your bubble right-aligned (purple gradient); theirs left neutral; grouped bubbles; auto-scroll to newest |
| 6 | Hover (desktop) / tap (phone) the "…" on a message | Menu with React / Delete (own) / Report (others); action works without leaving the chat |
| 7 | Open an old /messages/<id> link | Redirects into the same consolidated chat surface, conversation open |
| 8 | As a PRO (not Pro+) user | NO voice/video call buttons anywhere (composer, friends list, thread) |
| 9 | As PRO+ (founder account) | Call buttons present; starting a call works; callee can join |
| 10 | Only ever ONE chat surface visible on phone | No overlapping panel + window + page |

## 2. Test Mating (breeding flagship)

| # | Action | Expect |
| --- | --- | --- |
| 1 | /breeding — hub | Test Mating is the gold flagship card; stats row shows ~119k pedigree links, 9 volumes |
| 2 | Open Test Mating as FREE user (incognito) | Upsell panel ("$20/month"), tool hidden; direct API calls also blocked |
| 3 | Pick sire "Cumbria Jack" | ONE result: "Whelped 2023 · BK · 36 starts · 25 wins" (no duplicates) |
| 4 | Pick dam "Ritza Trish" | ONE result with 41 starts; loading shows the scanning animation (beam over two mini pedigrees) |
| 5 | Result page | Future Litter combined tree at top; COI/double coefficient + blood quota table (Fernando Bale ~37.5% w/ side split) + ancestor loss; 13-14 shared ancestors with counts |
| 6 | Family tree on PHONE | 3 generations fill the width, NO sideways scrolling; +N GENS chips drill deeper; breadcrumb walks back |
| 7 | Tap any dog card in the tree | Opens that dog's stats page; the +N GENS chip (not the card) drills |
| 8 | Search inside the pedigree ("Search this pedigree…") | Matches glow, rest dims, match count chip |
| 9 | Kelsos Fusileer in any tree | Dam "Lassinagh Silky" present (was Unknown before) |

## 3. Advertising (new revenue)

| # | Action | Expect |
| --- | --- | --- |
| 1 | /advertise | Rate card with your exact CPM figures; boost packages ($29/$119/$249 incl. GST); policy link; Book-a-campaign CTA |
| 2 | /advertise/policy | Policy doc: viewability rule, frequency caps, creative rules, refunds |
| 3 | /account/listings as Pro+ with an approved listing | Gold "Boost" control with package select |
| 4 | Buy the $29 Starter boost (LIVE money — your own Stripe) | Stripe Checkout (AUD) → success → boost active row recorded; payment visible in Stripe dashboard; refund from dashboard afterwards if desired |
| 5 | Dashboard pre-check (one-time) | Live webhook endpoint /api/webhooks/stripe includes checkout.session.async_payment_succeeded |

## 4. Earlier-today features (spot check)

| # | Action | Expect |
| --- | --- | --- |
| 1 | Home logged-out | Pricing cards + Start Free CTA before the race schedule |
| 2 | /races on phone | State chips wrap (no sideways scroll); "Search" labels |
| 3 | Marketplace | Demo cards carry "DEMO CARD · PREVIEW ONLY" + Pro custom-cards note |
| 4 | Feed | Public / Friends toggle; Friends requires sign-in |
| 5 | Admin on your phone | Tables render as cards ≤640px; every control 44px; submit buttons show pending state |
| 6 | /dogs/<any dog> | Recent Form is collapsible (open by default); pedigree section bridged |

## 5. Payments / rights (the standing final test)

| # | Action | Expect |
| --- | --- | --- |
| 1 | Fresh account → Stripe test/live Pro purchase | subscriptionTier flips to pro; feed posting, marketplace creation, messaging unlock; Test Mating unlocks |
| 2 | Same account: calls | Still NO calls at pro (Pro+ only) |

## Known-open items (do not fail the test for these)
- Boost impression counting deferred (cap stored, feed pipeline later).
- CPM campaigns are contact-to-book (no self-serve checkout yet).
- Pedigree depth beyond mapped data waits on GRV/Topaz approval (request drafted).
- Realtime token 415 fix verification.
