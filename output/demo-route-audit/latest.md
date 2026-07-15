# GreyhoundIQ demo route audit

- Generated: 2026-07-15T10:39:41.703Z
- Base URL: http://localhost:3000
- Result: 20/97 passed

| Result | Family | Registry route | Sample/final URL | Status | Time | Render |
|---|---|---|---|---:|---:|---|
| PASS | public | / | / -> http://localhost:3000/ | 200 | 1191ms | main=true; h1=true; header=full-access-read-only; streamError=false |
| PASS | public | /about | /about -> http://localhost:3000/about | 200 | 316ms | main=true; h1=true; header=full-access-read-only; streamError=false |
| PASS | public | /auth/error | /auth/error -> http://localhost:3000/auth/error | 200 | 296ms | main=true; h1=true; header=full-access-read-only; streamError=false |
| FAIL | public | /contact | /contact -> http://localhost:3000/contact | 200 | 451ms | main=true; h1=false; header=full-access-read-only; streamError=true; markers=demo_auth.identity_invalid |
| PASS | public | /pricing | /pricing -> http://localhost:3000/pricing | 200 | 371ms | main=true; h1=true; header=full-access-read-only; streamError=false |
| PASS | public | /privacy | /privacy -> http://localhost:3000/privacy | 200 | 244ms | main=true; h1=true; header=full-access-read-only; streamError=false |
| PASS | public | /responsible-use | /responsible-use -> http://localhost:3000/responsible-use | 200 | 263ms | main=true; h1=true; header=full-access-read-only; streamError=false |
| PASS | public | /terms | /terms -> http://localhost:3000/terms | 200 | 234ms | main=true; h1=true; header=full-access-read-only; streamError=false |
| PASS | racing | /breeding | /breeding -> http://localhost:3000/breeding | 200 | 1143ms | main=true; h1=true; header=full-access-read-only; streamError=false |
| PASS | racing | /dogs | /dogs -> http://localhost:3000/dogs | 200 | 435ms | main=true; h1=true; header=full-access-read-only; streamError=false |
| FAIL | racing | /dogs/[id] | /dogs/cmr0fg5ki00a4ephcaj4sdctc -> http://localhost:3000/dogs/cmr0fg5ki00a4ephcaj4sdctc | 404 | 250ms | main=true; h1=true; header=full-access-read-only; streamError=false; markers=page not found |
| PASS | racing | /races | /races -> http://localhost:3000/races | 200 | 1562ms | main=true; h1=true; header=full-access-read-only; streamError=false |
| PASS | racing | /meetings/[id] | /meetings/d2c28701-919b-429e-828d-c55dc1d80b54 -> http://localhost:3000/meetings/d2c28701-919b-429e-828d-c55dc1d80b54 | 200 | 209ms | main=true; h1=true; header=full-access-read-only; streamError=false |
| FAIL | racing | /races/[id] | /races/c842cd06-5f44-461c-be14-94439ebee1eb -> http://localhost:3000/races/c842cd06-5f44-461c-be14-94439ebee1eb | 404 | 186ms | main=true; h1=true; header=full-access-read-only; streamError=false; markers=page not found |
| PASS | racing | /results | /results -> http://localhost:3000/results | 200 | 685ms | main=true; h1=true; header=full-access-read-only; streamError=false |
| PASS | racing | /statistics | /statistics -> http://localhost:3000/statistics | 200 | 673ms | main=true; h1=true; header=full-access-read-only; streamError=false |
| PASS | racing | /tracks | /tracks -> http://localhost:3000/tracks | 200 | 507ms | main=true; h1=true; header=full-access-read-only; streamError=false |
| FAIL | racing | /tracks/[id] | /tracks/ce9ee26f-b678-4a19-9aa7-58185d2a3719 -> http://localhost:3000/tracks/ce9ee26f-b678-4a19-9aa7-58185d2a3719 | 404 | 235ms | main=true; h1=true; header=full-access-read-only; streamError=false; markers=page not found |
| FAIL | community | /discover | /discover -> http://localhost:3000/discover | 200 | 320ms | main=true; h1=false; header=full-access-read-only; streamError=true; markers=demo_auth.identity_invalid |
| FAIL | community | /feed | /feed -> http://localhost:3000/feed | 200 | 363ms | main=true; h1=false; header=full-access-read-only; streamError=true; markers=demo_auth.identity_invalid |
| FAIL | community | /forum | /forum -> http://localhost:3000/groups | 200 | 226ms | main=true; h1=false; header=full-access-read-only; streamError=true; markers=demo_auth.identity_invalid |
| FAIL | community | /forum/[slug] | /forum/general -> http://localhost:3000/groups/general | 200 | 1107ms | main=true; h1=false; header=full-access-read-only; streamError=true; markers=demo_auth.identity_invalid |
| FAIL | community | /forum/threads/[id] | /forum/threads/80c27107-5f87-493f-93a6-91bf46609af0 -> http://localhost:3000/groups/threads/80c27107-5f87-493f-93a6-91bf46609af0 | 404 | 207ms | main=true; h1=true; header=full-access-read-only; streamError=false; markers=page not found |
| FAIL | community | /groups | /groups -> http://localhost:3000/groups | 200 | 233ms | main=true; h1=false; header=full-access-read-only; streamError=true; markers=demo_auth.identity_invalid |
| FAIL | community | /groups/[slug] | /groups/general -> http://localhost:3000/groups/general | 200 | 221ms | main=true; h1=false; header=full-access-read-only; streamError=true; markers=demo_auth.identity_invalid |
| FAIL | community | /groups/threads/[id] | /groups/threads/80c27107-5f87-493f-93a6-91bf46609af0 -> http://localhost:3000/groups/threads/80c27107-5f87-493f-93a6-91bf46609af0 | 404 | 201ms | main=true; h1=true; header=full-access-read-only; streamError=false; markers=page not found |
| FAIL | community | /messages | /messages -> http://localhost:3000/pulse | 200 | 223ms | main=true; h1=false; header=full-access-read-only; streamError=true; markers=demo_auth.identity_invalid |
| FAIL | community | /messages/[id] | /messages/demo-conversation-admin-pro -> http://localhost:3000/pulse/demo-conversation-admin-pro | 200 | 1137ms | main=true; h1=false; header=full-access-read-only; streamError=true; markers=demo_auth.identity_invalid |
| FAIL | community | /messages/friends | /messages/friends -> http://localhost:3000/pulse/friends | 200 | 234ms | main=true; h1=false; header=full-access-read-only; streamError=true; markers=demo_auth.identity_invalid |
| FAIL | community | /p/[handle] | /p/demo-control-room -> http://localhost:3000/p/demo-control-room | 404 | 244ms | main=true; h1=true; header=full-access-read-only; streamError=false; markers=page not found |
| FAIL | community | /pulse | /pulse -> http://localhost:3000/pulse | 200 | 187ms | main=true; h1=false; header=full-access-read-only; streamError=true; markers=demo_auth.identity_invalid |
| FAIL | community | /pulse/[id] | /pulse/demo-conversation-admin-pro -> http://localhost:3000/pulse/demo-conversation-admin-pro | 200 | 277ms | main=true; h1=false; header=full-access-read-only; streamError=true; markers=demo_auth.identity_invalid |
| FAIL | community | /pulse/friends | /pulse/friends -> http://localhost:3000/pulse/friends | 200 | 182ms | main=true; h1=false; header=full-access-read-only; streamError=true; markers=demo_auth.identity_invalid |
| FAIL | marketplace | /listings | /listings -> http://localhost:3000/marketplace | 200 | 320ms | main=true; h1=false; header=full-access-read-only; streamError=true; markers=demo_auth.identity_invalid |
| FAIL | marketplace | /listings/[id] | /listings/demo-listing-racing-toolkit -> http://localhost:3000/marketplace/demo-listing-racing-toolkit | 404 | 204ms | main=true; h1=true; header=full-access-read-only; streamError=false; markers=page not found |
| FAIL | marketplace | /listings/[id]/edit | /listings/demo-listing-racing-toolkit/edit -> http://localhost:3000/marketplace/demo-listing-racing-toolkit/edit | 200 | 1070ms | main=true; h1=false; header=full-access-read-only; streamError=true; markers=demo_auth.identity_invalid |
| FAIL | marketplace | /listings/new | /listings/new -> http://localhost:3000/marketplace/new | 200 | 253ms | main=true; h1=false; header=full-access-read-only; streamError=true; markers=demo_auth.identity_invalid |
| FAIL | marketplace | /marketplace | /marketplace -> http://localhost:3000/marketplace | 200 | 203ms | main=true; h1=false; header=full-access-read-only; streamError=true; markers=demo_auth.identity_invalid |
| FAIL | marketplace | /marketplace/[id] | /marketplace/demo-listing-racing-toolkit -> http://localhost:3000/marketplace/demo-listing-racing-toolkit | 404 | 196ms | main=true; h1=true; header=full-access-read-only; streamError=false; markers=page not found |
| FAIL | marketplace | /marketplace/[id]/edit | /marketplace/demo-listing-racing-toolkit/edit -> http://localhost:3000/marketplace/demo-listing-racing-toolkit/edit | 200 | 222ms | main=true; h1=false; header=full-access-read-only; streamError=true; markers=demo_auth.identity_invalid |
| FAIL | marketplace | /marketplace/new | /marketplace/new -> http://localhost:3000/marketplace/new | 200 | 193ms | main=true; h1=false; header=full-access-read-only; streamError=true; markers=demo_auth.identity_invalid |
| FAIL | account | /account | /account -> http://localhost:3000/account | 200 | 293ms | main=true; h1=false; header=full-access-read-only; streamError=true; markers=demo_auth.identity_invalid |
| FAIL | account | /account/appearance | /account/appearance -> http://localhost:3000/account/appearance | 200 | 218ms | main=true; h1=false; header=full-access-read-only; streamError=true; markers=demo_auth.identity_invalid |
| FAIL | account | /account/billing | /account/billing -> http://localhost:3000/account/billing | 200 | 265ms | main=true; h1=false; header=full-access-read-only; streamError=true; markers=demo_auth.identity_invalid |
| FAIL | account | /account/listings | /account/listings -> http://localhost:3000/account/listings | 200 | 304ms | main=true; h1=false; header=full-access-read-only; streamError=true; markers=demo_auth.identity_invalid |
| FAIL | account | /account/listings/archived | /account/listings/archived -> http://localhost:3000/account/listings/archived | 200 | 262ms | main=true; h1=false; header=full-access-read-only; streamError=true; markers=demo_auth.identity_invalid |
| FAIL | account | /account/listings/drafts | /account/listings/drafts -> http://localhost:3000/account/listings/drafts | 200 | 260ms | main=true; h1=false; header=full-access-read-only; streamError=true; markers=demo_auth.identity_invalid |
| FAIL | account | /account/notifications | /account/notifications -> http://localhost:3000/account/notifications | 200 | 240ms | main=true; h1=false; header=full-access-read-only; streamError=true; markers=demo_auth.identity_invalid |
| FAIL | account | /account/pages | /account/pages -> http://localhost:3000/account/pages | 200 | 250ms | main=true; h1=false; header=full-access-read-only; streamError=true; markers=demo_auth.identity_invalid |
| FAIL | account | /account/pages/[id] | /account/pages/demo-custom-page-control-room -> http://localhost:3000/account/pages/demo-custom-page-control-room | 200 | 1016ms | main=true; h1=false; header=full-access-read-only; streamError=true; markers=demo_auth.identity_invalid |
| FAIL | account | /account/privacy | /account/privacy -> http://localhost:3000/account/privacy | 200 | 244ms | main=true; h1=false; header=full-access-read-only; streamError=true; markers=demo_auth.identity_invalid |
| FAIL | account | /account/profile | /account/profile -> http://localhost:3000/account/profile | 200 | 241ms | main=true; h1=false; header=full-access-read-only; streamError=true; markers=demo_auth.identity_invalid |
| FAIL | account | /account/saved-listings | /account/saved-listings -> http://localhost:3000/account/saved-listings | 200 | 243ms | main=true; h1=false; header=full-access-read-only; streamError=true; markers=demo_auth.identity_invalid |
| FAIL | account | /account/security | /account/security -> http://localhost:3000/account/security | 200 | 244ms | main=true; h1=false; header=full-access-read-only; streamError=true; markers=demo_auth.identity_invalid |
| FAIL | account | /account/support | /account/support -> http://localhost:3000/account/support | 200 | 302ms | main=true; h1=false; header=full-access-read-only; streamError=true; markers=demo_auth.identity_invalid |
| FAIL | account | /account/support/[id] | /account/support/demo-support-ticket-control-room -> http://localhost:3000/account/support/demo-support-ticket-control-room | 200 | 971ms | main=true; h1=false; header=full-access-read-only; streamError=true; markers=demo_auth.identity_invalid |
| FAIL | account | /account/team | /account/team -> http://localhost:3000/account/team | 200 | 289ms | main=true; h1=false; header=full-access-read-only; streamError=true; markers=demo_auth.identity_invalid |
| FAIL | account | /account/usage | /account/usage -> http://localhost:3000/account/usage | 200 | 247ms | main=true; h1=false; header=full-access-read-only; streamError=true; markers=demo_auth.identity_invalid |
| FAIL | admin | /admin | /admin -> http://localhost:3000/admin | 200 | 447ms | main=true; h1=false; header=full-access-read-only; streamError=true; markers=demo_auth.identity_invalid |
| FAIL | admin | /admin/account-deletion | /admin/account-deletion -> http://localhost:3000/admin/account-deletion | 200 | 415ms | main=true; h1=false; header=full-access-read-only; streamError=true; markers=demo_auth.identity_invalid |
| FAIL | admin | /admin/actions | /admin/actions -> http://localhost:3000/admin/actions | 200 | 296ms | main=true; h1=false; header=full-access-read-only; streamError=true; markers=demo_auth.identity_invalid |
| FAIL | admin | /admin/audit | /admin/audit -> http://localhost:3000/admin/audit | 200 | 295ms | main=true; h1=false; header=full-access-read-only; streamError=true; markers=demo_auth.identity_invalid |
| FAIL | admin | /admin/bespoke | /admin/bespoke -> http://localhost:3000/admin/bespoke | 200 | 287ms | main=true; h1=false; header=full-access-read-only; streamError=true; markers=demo_auth.identity_invalid |
| FAIL | admin | /admin/billing | /admin/billing -> http://localhost:3000/admin/billing | 200 | 289ms | main=true; h1=false; header=full-access-read-only; streamError=true; markers=demo_auth.identity_invalid |
| FAIL | admin | /admin/billing-events | /admin/billing-events -> http://localhost:3000/admin/billing-events | 200 | 389ms | main=true; h1=false; header=full-access-read-only; streamError=true; markers=demo_auth.identity_invalid |
| FAIL | admin | /admin/bug-reports | /admin/bug-reports -> http://localhost:3000/admin/bug-reports | 200 | 286ms | main=true; h1=false; header=full-access-read-only; streamError=true; markers=demo_auth.identity_invalid |
| FAIL | admin | /admin/compliance | /admin/compliance -> http://localhost:3000/admin/compliance | 200 | 288ms | main=true; h1=false; header=full-access-read-only; streamError=true; markers=demo_auth.identity_invalid |
| FAIL | admin | /admin/dog-ownership | /admin/dog-ownership -> http://localhost:3000/admin/dog-ownership | 200 | 276ms | main=true; h1=false; header=full-access-read-only; streamError=true; markers=demo_auth.identity_invalid |
| FAIL | admin | /admin/entitlements | /admin/entitlements -> http://localhost:3000/admin/entitlements | 200 | 275ms | main=true; h1=false; header=full-access-read-only; streamError=true; markers=demo_auth.identity_invalid |
| FAIL | admin | /admin/exports | /admin/exports -> http://localhost:3000/admin/exports | 200 | 301ms | main=true; h1=false; header=full-access-read-only; streamError=true; markers=demo_auth.identity_invalid |
| FAIL | admin | /admin/feed | /admin/feed -> http://localhost:3000/admin/feed | 200 | 264ms | main=true; h1=false; header=full-access-read-only; streamError=true; markers=demo_auth.identity_invalid |
| FAIL | admin | /admin/feedback | /admin/feedback -> http://localhost:3000/admin/feedback | 200 | 290ms | main=true; h1=false; header=full-access-read-only; streamError=true; markers=demo_auth.identity_invalid |
| FAIL | admin | /admin/invitations | /admin/invitations -> http://localhost:3000/admin/invitations | 200 | 267ms | main=true; h1=false; header=full-access-read-only; streamError=true; markers=demo_auth.identity_invalid |
| FAIL | admin | /admin/invoices | /admin/invoices -> http://localhost:3000/admin/invoices | 200 | 311ms | main=true; h1=false; header=full-access-read-only; streamError=true; markers=demo_auth.identity_invalid |
| FAIL | admin | /admin/jobs | /admin/jobs -> http://localhost:3000/admin/jobs | 200 | 323ms | main=true; h1=false; header=full-access-read-only; streamError=true; markers=demo_auth.identity_invalid |
| FAIL | admin | /admin/listings | /admin/listings -> http://localhost:3000/admin/listings | 200 | 310ms | main=true; h1=false; header=full-access-read-only; streamError=true; markers=demo_auth.identity_invalid |
| FAIL | admin | /admin/organizations | /admin/organizations -> http://localhost:3000/admin/organizations | 200 | 304ms | main=true; h1=false; header=full-access-read-only; streamError=true; markers=demo_auth.identity_invalid |
| FAIL | admin | /admin/page-rules | /admin/page-rules -> http://localhost:3000/admin/page-rules | 200 | 295ms | main=true; h1=false; header=full-access-read-only; streamError=true; markers=demo_auth.identity_invalid |
| FAIL | admin | /admin/payments | /admin/payments -> http://localhost:3000/admin/payments | 200 | 307ms | main=true; h1=false; header=full-access-read-only; streamError=true; markers=demo_auth.identity_invalid |
| FAIL | admin | /admin/plans | /admin/plans -> http://localhost:3000/admin/plans | 200 | 322ms | main=true; h1=false; header=full-access-read-only; streamError=true; markers=demo_auth.identity_invalid |
| FAIL | admin | /admin/reports | /admin/reports -> http://localhost:3000/admin/reports | 200 | 296ms | main=true; h1=false; header=full-access-read-only; streamError=true; markers=demo_auth.identity_invalid |
| FAIL | admin | /admin/retention | /admin/retention -> http://localhost:3000/admin/retention | 200 | 309ms | main=true; h1=false; header=full-access-read-only; streamError=true; markers=demo_auth.identity_invalid |
| FAIL | admin | /admin/safety | /admin/safety -> http://localhost:3000/admin/safety | 200 | 314ms | main=true; h1=false; header=full-access-read-only; streamError=true; markers=demo_auth.identity_invalid |
| FAIL | admin | /admin/site-content | /admin/site-content -> http://localhost:3000/admin/site-content | 200 | 342ms | main=true; h1=false; header=full-access-read-only; streamError=true; markers=demo_auth.identity_invalid |
| FAIL | admin | /admin/source-health | /admin/source-health -> http://localhost:3000/admin/source-health | 200 | 348ms | main=true; h1=false; header=full-access-read-only; streamError=true; markers=demo_auth.identity_invalid |
| FAIL | admin | /admin/subscriptions | /admin/subscriptions -> http://localhost:3000/admin/subscriptions | 200 | 296ms | main=true; h1=false; header=full-access-read-only; streamError=true; markers=demo_auth.identity_invalid |
| FAIL | admin | /admin/support | /admin/support -> http://localhost:3000/admin/support | 200 | 291ms | main=true; h1=false; header=full-access-read-only; streamError=true; markers=demo_auth.identity_invalid |
| FAIL | admin | /admin/usage | /admin/usage -> http://localhost:3000/admin/usage | 200 | 281ms | main=true; h1=false; header=full-access-read-only; streamError=true; markers=demo_auth.identity_invalid |
| FAIL | admin | /admin/users | /admin/users -> http://localhost:3000/admin/users | 200 | 329ms | main=true; h1=false; header=full-access-read-only; streamError=true; markers=demo_auth.identity_invalid |
| FAIL | admin | /admin/webhooks | /admin/webhooks -> http://localhost:3000/admin/webhooks | 200 | 265ms | main=true; h1=false; header=full-access-read-only; streamError=true; markers=demo_auth.identity_invalid |
| FAIL | ai | /agents | /agents -> http://localhost:3000/agents | 200 | 334ms | main=true; h1=false; header=full-access-read-only; streamError=true; markers=demo_auth.identity_invalid |
| PASS | design-lab | /design-lab | /design-lab -> http://localhost:3000/design-lab | 200 | 264ms | main=true; h1=true; header=full-access-read-only; streamError=false |
| PASS | design-lab | /design-lab/demo-experience | /design-lab/demo-experience -> http://localhost:3000/design-lab/demo-experience | 200 | 725ms | main=true; h1=true; header=full-access-read-only; streamError=false |
| PASS | design-lab | /design-lab/dock-skins | /design-lab/dock-skins -> http://localhost:3000/design-lab/dock-skins | 200 | 260ms | main=true; h1=true; header=full-access-read-only; streamError=false |
| PASS | design-lab | /design-lab/role-blueprints | /design-lab/role-blueprints -> http://localhost:3000/design-lab/role-blueprints | 200 | 469ms | main=true; h1=true; header=full-access-read-only; streamError=false |
| PASS | design-lab | /feed/device-preview | /feed/device-preview -> http://localhost:3000/feed/device-preview | 200 | 402ms | main=true; h1=true; header=full-access-read-only; streamError=false |
| PASS | design-lab | /marketplace/design-lab | /marketplace/design-lab -> http://localhost:3000/marketplace/design-lab | 200 | 401ms | main=true; h1=true; header=full-access-read-only; streamError=false |
