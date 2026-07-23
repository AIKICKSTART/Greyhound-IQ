export const PRODUCT_ROUTE_MASTER_EVIDENCE_SCOPE =
  "Source-static page registration and one current loopback render only; authentication, authorisation, mutations, actions, forms, states, onboarding, payments and production runtime behaviour remain unverified.";

export const PRODUCT_ROUTE_MASTER_MAPPING_FILE =
  "src/components/product-route-master-evidence.ts" as const;
export const PRODUCT_ROUTE_MASTER_TEST_FILE =
  "src/components/product-route-master-evidence.test.ts" as const;
export const PRODUCT_ROUTE_MASTER_AUDIT_FILE =
  "output/demo-route-audit/latest.json" as const;

export const PRODUCT_ROUTE_STORY_TEST_BY_FAMILY = {
  public: {
    path: "src/components/screen-contracts/public-racing-user-stories.test.ts",
    testId: "PUBLIC-RACING-STORY-CONTRACT",
  },
  racing: {
    path: "src/components/screen-contracts/public-racing-user-stories.test.ts",
    testId: "PUBLIC-RACING-STORY-CONTRACT",
  },
  community: {
    path: "src/components/screen-contracts/community-user-stories.test.ts",
    testId: "COMMUNITY-STORY-CONTRACT",
  },
  marketplace: {
    path:
      "src/components/screen-contracts/marketplace-account-user-stories.test.ts",
    testId: "MARKETPLACE-ACCOUNT-STORY-CONTRACT",
  },
  account: {
    path:
      "src/components/screen-contracts/marketplace-account-user-stories.test.ts",
    testId: "MARKETPLACE-ACCOUNT-STORY-CONTRACT",
  },
  admin: {
    path: "src/components/screen-contracts/admin-user-stories.test.ts",
    testId: "ADMIN-STORY-CONTRACT",
  },
  ai: {
    path: "src/components/screen-contracts/ai-user-stories.test.ts",
    testId: "AI-STORY-CONTRACT",
  },
} as const;

export type ProductRouteMasterFamily =
  keyof typeof PRODUCT_ROUTE_STORY_TEST_BY_FAMILY;

type ProductRouteMasterEvidenceSeed = readonly [
  requirementId: string,
  family: ProductRouteMasterFamily,
  route: string,
  sourcePath: string,
  storyId: string,
  assertionCount: number,
  assertionsSha256: string,
];

const PRODUCT_ROUTE_MASTER_EVIDENCE_SEEDS = [
  ["ROUTE.PUBLIC.home", "public", "/", "src/app/page.tsx", "PUBLIC.STORY.HOME", 3, "c827098e5c24d003c43ca0bd5193a85cba3a7b50a7c4e45d0a4721f5861d93a7"],
  ["ROUTE.PUBLIC.about", "public", "/about", "src/app/about/page.tsx", "PUBLIC.STORY.ABOUT", 3, "5d3f71ee0fa0e2ff3b920c3ca3e6483886ae0557ff38533a243dd0fa1993d148"],
  ["ROUTE.PUBLIC.contact", "public", "/contact", "src/app/contact/page.tsx", "PUBLIC.STORY.CONTACT", 3, "4c7406041359ba305106d057aafa1e377a7fd60f3a9993867810e0369a50e427"],
  ["ROUTE.PUBLIC.pricing", "public", "/pricing", "src/app/pricing/page.tsx", "PUBLIC.STORY.PRICING", 3, "83f22eedd8dd87669c5958b4e9e2f3dc4facf9340cc432fbf89ff9b19623ab88"],
  ["ROUTE.PUBLIC.privacy", "public", "/privacy", "src/app/privacy/page.tsx", "PUBLIC.STORY.PRIVACY", 3, "d1044dda21081e0ccbc2e9ba485d140e006b4102800fbd8d9fae13d2653cdc0b"],
  ["ROUTE.PUBLIC.terms", "public", "/terms", "src/app/terms/page.tsx", "PUBLIC.STORY.TERMS", 3, "a49b79011ba1271924fc6246890ce97a48883e3813b5ed3f49d08d2edd6b0cef"],
  ["ROUTE.PUBLIC.responsible-use", "public", "/responsible-use", "src/app/responsible-use/page.tsx", "PUBLIC.STORY.RESPONSIBLE-USE", 3, "1171a19177548b50d99ef2ad139f615f004335a85235f74a2c746ba822ea658d"],
  ["ROUTE.RACING.breeding", "racing", "/breeding", "src/app/breeding/page.tsx", "RACING.STORY.BREEDING", 3, "e457f4f66a1e340363e0bb3858b7e1f6adac1dd86cf93364ba6bc8875f7e6399"],
  ["ROUTE.RACING.dogs", "racing", "/dogs", "src/app/dogs/page.tsx", "RACING.STORY.DOG-SEARCH", 3, "1ec5b71074f269dc3787e00575c82109f5cf8efe3664cae94b29b51637bba992"],
  ["ROUTE.RACING.dog-detail", "racing", "/dogs/[id]", "src/app/dogs/[id]/page.tsx", "RACING.STORY.DOG-DETAIL", 4, "ca65bb1ae092d7156b584659deb8b36e6e0825eb8f4500aa801ee23860cf6846"],
  ["ROUTE.RACING.races", "racing", "/races", "src/app/races/page.tsx", "RACING.STORY.RACE-EXPLORER", 3, "0bfc7169a6a645078036dcbe33b5ca3d449348e8cfe4f7c595c9dbab01a20fd3"],
  ["ROUTE.RACING.race-detail", "racing", "/races/[id]", "src/app/races/[id]/page.tsx", "RACING.STORY.RACE-DETAIL", 4, "82d1015b5aa893c2aea63374f1a3983be41d993dcd0cb6afa592ae970df13d24"],
  ["ROUTE.RACING.results", "racing", "/results", "src/app/results/page.tsx", "RACING.STORY.RESULTS", 3, "7f7c92c825215f1176d1d7585a1c8734c0377cd2fc07b4d86fceedc567693118"],
  ["ROUTE.RACING.statistics", "racing", "/statistics", "src/app/statistics/page.tsx", "RACING.STORY.STATISTICS", 3, "2539b2d2534931dcc0e2844558e1202ffce42968776f53897b73826babda0948"],
  ["ROUTE.RACING.tracks", "racing", "/tracks", "src/app/tracks/page.tsx", "RACING.STORY.TRACKS", 3, "5df3b1cd21b1a16f775ad81d7d0ff979f5dca156144ee62caf3a151ec23a61af"],
  ["ROUTE.RACING.track-detail", "racing", "/tracks/[id]", "src/app/tracks/[id]/page.tsx", "RACING.STORY.TRACK-DETAIL", 4, "9ceaa17ad204db7f6655054bcd9d4f59c5f6c87cdcd2beff0ca612fb6087673a"],
  ["ROUTE.COMMUNITY.discover", "community", "/discover", "src/app/discover/page.tsx", "COMMUNITY.STORY.DISCOVER", 3, "9267e2ed884d66b211dadafed13f8885990c92e0de75f9ee43a442ec6b085f4f"],
  ["ROUTE.COMMUNITY.feed", "community", "/feed", "src/app/feed/page.tsx", "COMMUNITY.STORY.FEED", 4, "bf4d881b9e406ac5340a2e3355b47760f34719c9f5dbf20eb9e65ad56b084424"],
  ["ROUTE.COMMUNITY.forum", "community", "/forum", "src/app/forum/page.tsx", "COMMUNITY.STORY.FORUM-DIRECTORY", 3, "1c19a4bf783df920cd737f3b5bfa84b3cc46874e2d3f01fba205dea2249527ef"],
  ["ROUTE.COMMUNITY.forum-category", "community", "/forum/[slug]", "src/app/forum/[slug]/page.tsx", "COMMUNITY.STORY.FORUM-GROUP", 3, "929b906fd2a61d2502a34c299367d88b5e3036b8a1ca9de14683871d0c56a1e4"],
  ["ROUTE.COMMUNITY.forum-thread", "community", "/forum/threads/[id]", "src/app/forum/threads/[id]/page.tsx", "COMMUNITY.STORY.FORUM-THREAD", 3, "faacc56a17f5ac9028842062156788289e88d2d54dfcf6f94844d3fcd669d040"],
  ["ROUTE.COMMUNITY.groups", "community", "/groups", "src/app/groups/page.tsx", "COMMUNITY.STORY.GROUPS-DIRECTORY", 3, "cbe753eac8f220729ca1f1b91175a726e84bebb14dcf7b2ec8962fca05542d5d"],
  ["ROUTE.COMMUNITY.group-detail", "community", "/groups/[slug]", "src/app/groups/[slug]/page.tsx", "COMMUNITY.STORY.GROUPS-GROUP", 3, "a573edfd6d239bff43cf08523343800d7d288c9a0adf2b565cf9866663fb7eed"],
  ["ROUTE.COMMUNITY.group-thread", "community", "/groups/threads/[id]", "src/app/groups/threads/[id]/page.tsx", "COMMUNITY.STORY.GROUPS-THREAD", 3, "2b688eae6406347be78179fc6a5ee1d748bb9ae59b223601f1bd4415d1147d92"],
  ["ROUTE.COMMUNITY.messages", "community", "/messages", "src/app/messages/page.tsx", "COMMUNITY.STORY.MESSAGES-INBOX", 4, "5b4e7cd54aebedd85d382aaceffad2cd6d02285a95a89c9d81fd1c95ef378c74"],
  ["ROUTE.COMMUNITY.message-detail", "community", "/messages/[id]", "src/app/messages/[id]/page.tsx", "COMMUNITY.STORY.MESSAGES-THREAD", 4, "8e49a14122ddd75e105d39e1c4ff4d6f2e82e642210cd6da504ddb7ff059f8f3"],
  ["ROUTE.COMMUNITY.message-friends", "community", "/messages/friends", "src/app/messages/friends/page.tsx", "COMMUNITY.STORY.MESSAGES-FRIENDS", 4, "8adfb71b145245c8624838fa626cb3e029276c8b548b5510975fff8d7d4d811d"],
  ["ROUTE.COMMUNITY.profile", "community", "/p/[handle]", "src/app/p/[handle]/page.tsx", "COMMUNITY.STORY.PUBLIC-PROFILE", 5, "f3dee02cbc93bbe372c1e69075926132cad0e7f197218a512fa72b2196433334"],
  ["ROUTE.COMMUNITY.pulse", "community", "/pulse", "src/app/pulse/page.tsx", "COMMUNITY.STORY.PULSE-INBOX", 3, "64d83b2a2676713703b676091cc66762292105fa4959ce9acb1b94b4fef49788"],
  ["ROUTE.COMMUNITY.pulse-detail", "community", "/pulse/[id]", "src/app/pulse/[id]/page.tsx", "COMMUNITY.STORY.PULSE-THREAD", 3, "e6b05d09fbabc0af682e620dcd8dd779c40d43818c0bcb54300f05fb073b9cae"],
  ["ROUTE.COMMUNITY.pulse-friends", "community", "/pulse/friends", "src/app/pulse/friends/page.tsx", "COMMUNITY.STORY.PULSE-FRIENDS", 3, "3c68a36f792da53118e79245055f5e973329bdd8abb8ffb4af9367ff96dac7f0"],
  ["ROUTE.MARKET.listings", "marketplace", "/listings", "src/app/listings/page.tsx", "MARKETPLACE.STORY.LISTINGS-DIRECTORY", 4, "66bbff8e958baffd991227a93678d69e5347f00695214d3153a1166c86acfe71"],
  ["ROUTE.MARKET.listing-detail", "marketplace", "/listings/[id]", "src/app/listings/[id]/page.tsx", "MARKETPLACE.STORY.LISTING-DETAIL", 4, "b876a649de2dc7ba6d5abe43c35c547361bf4fe245d1531b7de7761b37802e66"],
  ["ROUTE.MARKET.listing-new", "marketplace", "/listings/new", "src/app/listings/new/page.tsx", "MARKETPLACE.STORY.LISTING-CREATE", 4, "53777752621b60be1167b575d380d8769c820fa09d3d4b161eb427431b1fb92f"],
  ["ROUTE.MARKET.marketplace", "marketplace", "/marketplace", "src/app/marketplace/page.tsx", "MARKETPLACE.STORY.MARKETPLACE-DIRECTORY", 3, "0e11e2f3acfeee4d4164523e550eadaedb7da8487c14d588b1b2895aca4e1e30"],
  ["ROUTE.MARKET.marketplace-detail", "marketplace", "/marketplace/[id]", "src/app/marketplace/[id]/page.tsx", "MARKETPLACE.STORY.MARKETPLACE-DETAIL", 3, "0682191d9a96942082b85f9eea1952f71224712bef95ffe3640c42e61cada896"],
  ["ROUTE.MARKET.marketplace-new", "marketplace", "/marketplace/new", "src/app/marketplace/new/page.tsx", "MARKETPLACE.STORY.MARKETPLACE-CREATE", 3, "f49de8d463c5aed2283fc30f83783eeba44a6e3fa4aa04583eef528ee1d0e677"],
  ["ROUTE.ACCOUNT.home", "account", "/account", "src/app/account/page.tsx", "ACCOUNT.STORY.OVERVIEW", 4, "2b0175a6afcf1eda6a2667c4760554eb65fa23d787ddd0bc32dc57d398204de0"],
  ["ROUTE.ACCOUNT.billing", "account", "/account/billing", "src/app/account/billing/page.tsx", "ACCOUNT.STORY.BILLING", 4, "82b89d82d648792a5e26a3df2223294a7dacb1b56aeccc867183ca28673ec2ae"],
  ["ROUTE.ACCOUNT.notifications", "account", "/account/notifications", "src/app/account/notifications/page.tsx", "ACCOUNT.STORY.NOTIFICATIONS", 4, "87c1caf0133ff7a30b1695c0edfef036978cf94ca72347a4833d8c70a8de6ca5"],
  ["ROUTE.ACCOUNT.pages", "account", "/account/pages", "src/app/account/pages/page.tsx", "ACCOUNT.STORY.MANAGED-PAGES", 5, "a1fc6835b9a578d447a1a54a1b067b65285877cc7c20e9f848cadf6dfeb09484"],
  ["ROUTE.ACCOUNT.page-detail", "account", "/account/pages/[id]", "src/app/account/pages/[id]/page.tsx", "ACCOUNT.STORY.MANAGED-PAGE-DETAIL", 5, "026f55f807927915d0eee68614244089fa41ab3a09d9a51600bf0a95051293d8"],
  ["ROUTE.ACCOUNT.privacy", "account", "/account/privacy", "src/app/account/privacy/page.tsx", "ACCOUNT.STORY.PRIVACY", 5, "e74ea5800ae6d3eb0324ceefb4037930785b0738170e941b7125c2fa69f9eea9"],
  ["ROUTE.ACCOUNT.profile", "account", "/account/profile", "src/app/account/profile/page.tsx", "ACCOUNT.STORY.PROFILE-STUDIO", 4, "53c41a9851d60d87996c30df80c9f6b5afeb4f5510de36f58e93f00ce6891ac0"],
  ["ROUTE.ACCOUNT.saved-listings", "account", "/account/saved-listings", "src/app/account/saved-listings/page.tsx", "ACCOUNT.STORY.SAVED-LISTINGS", 4, "6f9edba791577b9f70cfef663e1aabd3cf643c33fd26c17ffbf69ce61e523f3c"],
  ["ROUTE.ACCOUNT.security", "account", "/account/security", "src/app/account/security/page.tsx", "ACCOUNT.STORY.SECURITY", 4, "5a008c74d591fe4d0530990aae444df751421cbf7d4366ddbdf2e76961ad6100"],
  ["ROUTE.ACCOUNT.support", "account", "/account/support", "src/app/account/support/page.tsx", "ACCOUNT.STORY.SUPPORT", 5, "d9dd4aeb5b3dd9f870b566a152893fe2a23a770685c666706447588ce595d1b7"],
  ["ROUTE.ACCOUNT.team", "account", "/account/team", "src/app/account/team/page.tsx", "ACCOUNT.STORY.TEAM", 6, "880456fad61f6194ea715d9412398109384f8265283f1052119dd60c6fa373e0"],
  ["ROUTE.ACCOUNT.usage", "account", "/account/usage", "src/app/account/usage/page.tsx", "ACCOUNT.STORY.USAGE", 5, "2d8c4f95c72d84a7bec82d9f17fa007726b086b13b05958aba9285586c606ecd"],
  ["ROUTE.ADMIN.home", "admin", "/admin", "src/app/admin/page.tsx", "ADMIN.STORY.DASHBOARD", 4, "4074068c9d9c222f873f116408b2451800051158141c8610e51576a6bffc22f1"],
  ["ROUTE.ADMIN.account-deletion", "admin", "/admin/account-deletion", "src/app/admin/account-deletion/page.tsx", "ADMIN.STORY.ACCOUNT-DELETION", 4, "ab8793cf8707938bef2d782830ba21ede6b2bc0cdeaaa79dd2e1ddbe095b34c3"],
  ["ROUTE.ADMIN.actions", "admin", "/admin/actions", "src/app/admin/actions/page.tsx", "ADMIN.STORY.ACTIONS", 4, "57bf5a71839d9c52b474647e1d209f6048ef121543c073533939e23c57cca399"],
  ["ROUTE.ADMIN.audit", "admin", "/admin/audit", "src/app/admin/audit/page.tsx", "ADMIN.STORY.AUDIT", 4, "175eb8914add2409adc3df47c7d8ffd5ff544253b0402020988437e316171051"],
  ["ROUTE.ADMIN.bespoke", "admin", "/admin/bespoke", "src/app/admin/bespoke/page.tsx", "ADMIN.STORY.BESPOKE", 4, "0c3f8f93fbd659e382e984bad4a24d83cd0cbe893be522d278ebb1466957c44e"],
  ["ROUTE.ADMIN.billing", "admin", "/admin/billing", "src/app/admin/billing/page.tsx", "ADMIN.STORY.BILLING", 4, "08e22cf6ab2a8f2c73124a64c73cf46bf8fc8ceec1ad837651b3e685c926c19f"],
  ["ROUTE.ADMIN.billing-events", "admin", "/admin/billing-events", "src/app/admin/billing-events/page.tsx", "ADMIN.STORY.BILLING-EVENTS", 4, "216f3c9a0c60bf867303ab997b2b8bc1f8d96a4f759505c56df783e7e64800b1"],
  ["ROUTE.ADMIN.bug-reports", "admin", "/admin/bug-reports", "src/app/admin/bug-reports/page.tsx", "ADMIN.STORY.BUG-REPORTS", 4, "54a35bb8c28596c48d7c06e9895efbf9050c0f17c63c88224b63389fed519ebf"],
  ["ROUTE.ADMIN.compliance", "admin", "/admin/compliance", "src/app/admin/compliance/page.tsx", "ADMIN.STORY.COMPLIANCE", 4, "114f7a51645e2b6778a1855e4f19e9babd34e8e96fb4e73ccc8104e48bcc9150"],
  ["ROUTE.ADMIN.dog-ownership", "admin", "/admin/dog-ownership", "src/app/admin/dog-ownership/page.tsx", "ADMIN.STORY.DOG-OWNERSHIP", 4, "7e00274a50c01f2ca43e519bf69f5fa70ce4cdff42735aef1e1419e0bc1db37f"],
  ["ROUTE.ADMIN.entitlements", "admin", "/admin/entitlements", "src/app/admin/entitlements/page.tsx", "ADMIN.STORY.ENTITLEMENTS", 4, "a4ced97d6382c74262caf1e55b54b2c040ff3693a17ab91dbf864cd017a156e1"],
  ["ROUTE.ADMIN.exports", "admin", "/admin/exports", "src/app/admin/exports/page.tsx", "ADMIN.STORY.EXPORTS", 4, "275844d8e2147d060d268b56b2d7707c37bb42a975ff2ecf8d1b6e95a523f594"],
  ["ROUTE.ADMIN.feed", "admin", "/admin/feed", "src/app/admin/feed/page.tsx", "ADMIN.STORY.FEED", 4, "2d458ed805e6b65f5496454d44f40d667390d4b476f01aebd917594b75480bb7"],
  ["ROUTE.ADMIN.feedback", "admin", "/admin/feedback", "src/app/admin/feedback/page.tsx", "ADMIN.STORY.FEEDBACK", 4, "8ef39cd34491b286706126e0ad2d9966c6d09ad835c70d3c7a8f391a8c28a56c"],
  ["ROUTE.ADMIN.invitations", "admin", "/admin/invitations", "src/app/admin/invitations/page.tsx", "ADMIN.STORY.INVITATIONS", 4, "ddc6b739338388808d7e9962ce3c16db13c25a20e77c40163a71e40b2f2a6684"],
  ["ROUTE.ADMIN.invoices", "admin", "/admin/invoices", "src/app/admin/invoices/page.tsx", "ADMIN.STORY.INVOICES", 4, "166d6f5d4fd8fee45e8fb8f4ec3703057fadfe0fd85acf0ac578b0873d3a5b5b"],
  ["ROUTE.ADMIN.jobs", "admin", "/admin/jobs", "src/app/admin/jobs/page.tsx", "ADMIN.STORY.JOBS", 4, "cde45fa465e9152a170ae6014b2792fbab2244cb032e64f72e8b01273e20103b"],
  ["ROUTE.ADMIN.listings", "admin", "/admin/listings", "src/app/admin/listings/page.tsx", "ADMIN.STORY.LISTINGS", 4, "b6dc94d2bf4e1667621feb85474f4ce6436a79a638b8941caa1ef3e46afc2757"],
  ["ROUTE.ADMIN.organizations", "admin", "/admin/organizations", "src/app/admin/organizations/page.tsx", "ADMIN.STORY.ORGANIZATIONS", 4, "7d9b6e98dfb401b6142371c25068815f65052027c20b4ad2ff5a90218aacf1dd"],
  ["ROUTE.ADMIN.page-rules", "admin", "/admin/page-rules", "src/app/admin/page-rules/page.tsx", "ADMIN.STORY.PAGE-RULES", 4, "bde01c9f12d3caaf0940f0a097d3c5b2150588ccbac4c10d1d476157117c096f"],
  ["ROUTE.ADMIN.payments", "admin", "/admin/payments", "src/app/admin/payments/page.tsx", "ADMIN.STORY.PAYMENTS", 4, "468a3018bd100e28f511d77b85b559fb28a5e908b9bfeb337f3af66a81a4b2dc"],
  ["ROUTE.ADMIN.plans", "admin", "/admin/plans", "src/app/admin/plans/page.tsx", "ADMIN.STORY.PLANS", 4, "f56cfb312a451aeb0f3bbbb33299d011a8e02f48c34898d9c485411f0bb46705"],
  ["ROUTE.ADMIN.reports", "admin", "/admin/reports", "src/app/admin/reports/page.tsx", "ADMIN.STORY.REPORTS", 4, "669f942e8cb4aff6335146a4a43f95d5320966130d190c159bd39cb6b456c77a"],
  ["ROUTE.ADMIN.retention", "admin", "/admin/retention", "src/app/admin/retention/page.tsx", "ADMIN.STORY.RETENTION", 4, "26816a7e5196e20bbd6e13f0ca0c5abfd7aad2b96d112ad4b7ad1a3d93eadf20"],
  ["ROUTE.ADMIN.safety", "admin", "/admin/safety", "src/app/admin/safety/page.tsx", "ADMIN.STORY.SAFETY", 4, "3d1178e351d1840a4767a01dc4b6cd5839e21b75ba149c3f804ca83df90b699c"],
  ["ROUTE.ADMIN.site-content", "admin", "/admin/site-content", "src/app/admin/site-content/page.tsx", "ADMIN.STORY.SITE-CONTENT", 4, "d5f41838cb43a5e5bdcc4cc430a2e2377e85b14e6c37be1544021c9ab92cdcd9"],
  ["ROUTE.ADMIN.source-health", "admin", "/admin/source-health", "src/app/admin/source-health/page.tsx", "ADMIN.STORY.SOURCE-HEALTH", 4, "89c02573f5dfdb8ced88f3c77c6fd603b5d0394c8c0dc6b147282f718a05e5b4"],
  ["ROUTE.ADMIN.subscriptions", "admin", "/admin/subscriptions", "src/app/admin/subscriptions/page.tsx", "ADMIN.STORY.SUBSCRIPTIONS", 4, "ab5d1d3d6f72172e17e02d005f1d886646db45364c497967e782a611faf2b7f5"],
  ["ROUTE.ADMIN.support", "admin", "/admin/support", "src/app/admin/support/page.tsx", "ADMIN.STORY.SUPPORT", 4, "1f9a02cbb42c9e4aa4b051399bcc56d9f111f50bb587a60af1629ee8cf279108"],
  ["ROUTE.ADMIN.usage", "admin", "/admin/usage", "src/app/admin/usage/page.tsx", "ADMIN.STORY.USAGE", 4, "0fadaa356b1844d5450ed247612140ab6e1bd2856fa08aecb99166471e1e4260"],
  ["ROUTE.ADMIN.users", "admin", "/admin/users", "src/app/admin/users/page.tsx", "ADMIN.STORY.USERS", 4, "24efbf98e17e3bd7838500c8751dd3c57691df4e8ae475bcb6043f5f71a14f46"],
  ["ROUTE.ADMIN.webhooks", "admin", "/admin/webhooks", "src/app/admin/webhooks/page.tsx", "ADMIN.STORY.WEBHOOKS", 4, "272884a158129a230ab69f7076682e326b5c6ae0bf2f1ce531d682df5f0d7c49"],
  ["ROUTE.AI.agents", "ai", "/agents", "src/app/agents/page.tsx", "AI.STORY.AGENT-CONSOLE", 4, "dce7eee3e92e6995f72992f1f7e8ae3f75f8c70b8e2047a4cd06f9f6f58a3571"],
] as const satisfies readonly ProductRouteMasterEvidenceSeed[];

export type ProductRouteMasterEvidenceRecord = {
  requirementId: string;
  family: ProductRouteMasterFamily;
  route: string;
  sourcePath: string;
  storyId: string;
  assertionCount: number;
  assertionsSha256: string;
};

export const PRODUCT_ROUTE_MASTER_EVIDENCE_RECORDS: readonly ProductRouteMasterEvidenceRecord[] =
  PRODUCT_ROUTE_MASTER_EVIDENCE_SEEDS.map(
    ([
      requirementId,
      family,
      route,
      sourcePath,
      storyId,
      assertionCount,
      assertionsSha256,
    ]) => ({
      requirementId,
      family,
      route,
      sourcePath,
      storyId,
      assertionCount,
      assertionsSha256,
    }),
  );

export const TESTED_REGISTERED_PAGE_ROUTE_REQUIREMENTS = Object.fromEntries(
  PRODUCT_ROUTE_MASTER_EVIDENCE_RECORDS.map(({ requirementId, route }) => [
    requirementId,
    route,
  ]),
) as Readonly<Record<string, string>>;

export const PRODUCT_ROUTE_MASTER_EVIDENCE = Object.fromEntries(
  PRODUCT_ROUTE_MASTER_EVIDENCE_RECORDS.map((record) => [
    record.requirementId,
    {
      status: "tested" as const,
      evidence: [
        record.sourcePath,
        PRODUCT_ROUTE_MASTER_MAPPING_FILE,
        PRODUCT_ROUTE_MASTER_TEST_FILE,
        PRODUCT_ROUTE_STORY_TEST_BY_FAMILY[record.family].path,
        PRODUCT_ROUTE_MASTER_AUDIT_FILE,
        ...(record.requirementId === "ROUTE.PUBLIC.responsible-use"
          ? ["src/app/responsible-use/responsible-use-contract.test.ts"]
          : []),
      ],
    },
  ]),
) as Readonly<
  Record<string, { status: "tested"; evidence: readonly string[] }>
>;
