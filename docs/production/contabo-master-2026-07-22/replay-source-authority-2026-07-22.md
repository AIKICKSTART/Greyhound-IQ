# Replay source and authority register

Observation date: **2026-07-22 AEST**

This register is evidence for `P0-002` and the external authority gate `P0-018`. It distinguishes an official public replay surface from permission to automate, embed, download, retain, republish or rehost its content. No automated replay retrieval, media download or provider probe was performed while compiling it.

## Official-source matrix

| Jurisdiction | Official evidence found | Proven public coverage floor | Rights conclusion for GreyhoundsIQ |
| --- | --- | --- | --- |
| NSW / ACT | [GRNSW privacy policy](https://www.grnsw.com.au/privacy-policy), [GRNSW terms](https://www.grnsw.com.au/terms-of-use) | No official source found proving a continuous public archive to 2006 | GRNSW identifies video/API use, but its terms restrict reproduction, dissemination, framing and third-party republication without permission. Canonical outbound references only until written authority defines commercial embed/API/bulk/storage/rehost scope. |
| VIC | [GRV Vision announcement](https://www.grv.org.au/news/2014/03/18/grv-vision/), [current GRV social/replay hub](https://www.grv.org.au/grv-news/social-hub/) | Official announcement states replays from **2014-01-01** were available; 2006–2013 is not proved | Public availability is proved from 2014. No current public GRV licence was found covering GreyhoundsIQ commercial automation, retention or republication. Written GRV authority remains required. |
| QLD | [Racing Queensland replay search](https://www.racingqueensland.com.au/racing/replays/tab-race-replays), [dated Albion Park player](https://www.racingqueensland.com.au/racing/replays/tab-race-replays/race-player/greyhound/albi/20160214/race/1), [RQ terms](https://www.racingqueensland.com.au/terms-conditions) | A public official player is proved for **2016-02-14**; a 2006 floor is not proved | A watch/download control is not a reuse licence. RQ terms require prior written permission for reproduction, reuse, redistribution and commercial use. Obtain RQ and any underlying media-rightsholder authority. |
| SA | [GRSA privacy policy](https://grsa.blob.core.windows.net/uploads2/GRSA_privacy_policy.pdf) | Official use of YouTube API Services for race replays is proved; earliest continuous archive date is not | Ordinary public viewing does not authorize commercial automation, bulk acquisition, storage or rehosting. Obtain written GRSA/rightsholder authority and comply with YouTube terms. |
| TAS | [Tasracing Formplus replays](https://form.tasracing.com.au/replays/), [Tasracing greyhound hub](https://tasracing.com.au/greyhound), [Tasracing website terms](https://tasracing.com.au/governance/website-terms-of-use) | Current live/on-demand surface is proved; a continuous 2006 archive is not | Tasracing terms allow limited personal use and restrict republication, commercial exploitation and redistribution. Written content/API/archive authority is required. |
| WA | [Greyhounds WA downloadable race replays](https://www.greyhoundswa.com.au/downloadable-race-replays/), [Greyhounds WA contact](https://www.greyhoundswa.com.au/contact/) | Current Vimeo galleries and a documented lookup convention for dates before **2023-11-14** are proved; earliest retained date and 2006 coverage are not | The official page tells end users how to download, but does not grant bulk, automated, commercial, retention or rehosting rights. Obtain written Greyhounds WA/RWWA/rightsholder authority plus archive start/retention and API/rate-limit confirmation. Do not automate its legacy HTTP-form URL. |
| NT | [Darwin Greyhound Association fields and box draw](https://www.darwingreyhounds.org/fields-box-draw) | No official replay archive or API found | Treat as `official archive not located`, not as proof that no legitimate replay exists. Obtain a source specification and rights confirmation from DGA/the footage rightsholder before discovery or linkage. |
| NZ | [GRNZ contacts](https://www.grnz.co.nz/about-nzgra/contact-us.aspx), [GRNZ group and feature races](https://www.grnz.co.nz/catch-the-action/group-and-feature-races.aspx), [official club replay example](https://greyhounds.co.nz/race-replays/), [NZ government racing policy](https://www.dia.govt.nz/Resource-material-Our-Policy-Advice-Areas-Racing-Policy) | Public replay material is proved by a dated club example from **2020-03-15**; no continuous national 2006 archive is proved | Obtain written GRNZ/club/footage-rightsholder authority, archive endpoint and retention confirmation. Reconfirm archive stewardship and rights through the statutory closure transition. |

[YouTube Terms of Service](https://www.youtube.com/t/terms) apply independently to YouTube-hosted material. A standard player surface does not authorize downloading, automated access, redistribution or rehosting.

## Authority required before provider-wide automation or media retention

Canonical links to public official pages and a standard provider-supported YouTube or Vimeo player do not require a new GreyhoundsIQ media copy. They remain permitted only when the stored URL is exact, the race identity is corroborated, and the provider itself permits the player or outbound navigation. The authority gate below applies to provider-wide automated discovery, restricted first-party framing, download, retained storage, redistribution and rehosting.

For each provider, a dated written licence or approved API agreement must explicitly define:

- any canonical outbound linking restrictions beyond ordinary public navigation;
- commercial player embedding where the provider's standard player terms do not already authorize it;
- API and automated access, authentication and rate limits;
- bulk historical discovery;
- download and retained storage;
- rehosting or redistribution;
- commercial use, territory and licence term;
- historical start date, gaps, retention and takedown handling;
- source identity fields and an escalation contact for ambiguous races.

## Clarified delivery scope: official iframe or outbound link only

The user clarified that GreyhoundsIQ should link to the real public source and, where supported, play it through that provider's iframe. Downloading, retaining the media file, proxying it as GreyhoundsIQ-owned media and rehosting are out of scope.

- [YouTube's official player documentation](https://developers.google.com/youtube/player_parameters) supports `https://www.youtube.com/embed/VIDEO_ID` in an iframe. Use only the ordinary player for an exact official video ID; do not download the video or enable API automation unless separately required and permitted.
- [Vimeo's official player documentation](https://help.vimeo.com/hc/en-us/articles/12426260232977-About-Player-Parameters) supports `https://player.vimeo.com/video/VIDEO_ID`. A particular video may still disable third-party embedding, so GreyhoundsIQ must fall back to its canonical official source link when the provider player rejects framing.
- GRNSW, GRV, Racing Queensland and GRNZ first-party pages return same-origin framing controls on the checked endpoints. They must not be put into a GreyhoundsIQ iframe.
- Tasracing's lack of a blocking response header is not permission to frame it, and its terms restrict public/commercial reuse. Use an outbound Formplus/Tasracing link.
- SA has an official YouTube/API relationship but no verified canonical public embed contract in the evidence collected. Use an official outbound link until the exact authority-owned video ID is proved.
- WA points to public Vimeo galleries. Use the official gallery link now; use a Vimeo iframe only for a specific verified public video whose provider player accepts embedding and whose exact race identity is corroborated.

The production presentation rule is therefore:

1. exact canonical race identity and authority-owned source;
2. standard provider iframe only for a verified, explicitly embeddable YouTube/Vimeo video;
3. otherwise a clear **Watch on official source** link;
4. graceful unavailable state when neither exists;
5. never iframe a first-party page blocked by `X-Frame-Options` or CSP.

Until that evidence exists, database rows and public pages are replay **candidates** only. They must not be labelled `verified_playable`, and a race with no stored candidate must not be labelled `no legitimate source found`; the defensible state is `source discovery pending authority` or `official archive not located`.

## External blocker

Written authority or approved provider API scope is absent for provider-wide automated discovery and for commercial framing where the authority's terms prohibit or do not address it. This is an external blocker that the agent team cannot cure by code, scraping or browser automation. It blocks bulk provider probes, download, retained copies, automatic gap filling, rehosting and first-party-page framing. It does not block canonical outbound links, the isolated database inventory, collision analysis, canonical identity work, standard provider players that are explicitly authorized, or preparation of a fail-closed verification schema.
