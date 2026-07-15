import type { ProductMasterRequirementStatus } from "./product-master-requirements";

export const PRODUCT_SOURCE_INTERACTION_EVIDENCE_FILE =
  "src/components/product-source-interaction-evidence.ts" as const;
export const PRODUCT_SOURCE_INTERACTION_TEST_FILE =
  "src/components/product-source-interaction-evidence.test.ts" as const;

export const PRODUCT_SOURCE_INTERACTION_EVIDENCE_SCOPE =
  "Deterministic source-static inspection of production-reachable TypeScript and TSX only. A tested record means the present-or-absent inventory ran; it does not establish rendered visibility, clickability, accessibility behaviour, runtime redirects, server-side role or tier enforcement, provider delivery, production parity, or invitation recovery/system-state coverage.";

export const PRODUCT_SOURCE_INTERACTION_REQUIREMENT_IDS = [
  "DISC.SRC.desktop-navigation",
  "DISC.SRC.footer-navigation",
  "DISC.SRC.account-navigation",
  "DISC.SRC.admin-navigation",
  "DISC.SRC.context-menus",
  "DISC.SRC.dropdown-menus",
  "DISC.SRC.tabs",
  "DISC.SRC.sub-tabs",
  "DISC.SRC.navigation-cards",
  "DISC.SRC.search-result-links",
  "DISC.SRC.breadcrumbs",
  "DISC.SRC.pagination-links",
  "DISC.SRC.modals",
  "DISC.SRC.dialogs",
  "DISC.SRC.drawers",
  "DISC.SRC.popovers",
  "DISC.SRC.tooltips",
  "DISC.SRC.command-palettes",
  "DISC.SRC.empty-state-actions",
  "DISC.SRC.error-state-actions",
  "DISC.SRC.invitation-links",
  "DISC.SRC.email-links",
  "DISC.SRC.notification-links",
  "DISC.SRC.deep-links",
  "DISC.SRC.role-gated-routes",
  "DISC.SRC.tier-gated-routes",
] as const;

export const PRODUCT_SOURCE_INTERACTION_COMPLETION_REQUIREMENT_IDS = [
  "COMPLETE.EVIDENCE.navigation-inspected",
] as const;

export type ProductSourceInteractionRequirementId =
  (typeof PRODUCT_SOURCE_INTERACTION_REQUIREMENT_IDS)[number];

export type ProductSourceInteractionInventorySnapshot = {
  state: "present" | "absent";
  count: number;
  sha256: string;
};

const EMPTY_SHA256 =
  "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";

export const PRODUCT_SOURCE_INTERACTION_INVENTORY_SNAPSHOTS =
  {
    "DISC.SRC.desktop-navigation": {
      state: "present",
      count: 1,
      sha256: "e9638ac2306fdcff24bf418986de14097832c5e55fb79fc76560ca5d27468bda",
    },
    "DISC.SRC.footer-navigation": {
      state: "present",
      count: 1,
      sha256: "236dd55d570139264b2b3b75a405e281aabda6d7e8f46b8ce6feb39fdf73a708",
    },
    "DISC.SRC.account-navigation": {
      state: "present",
      count: 8,
      sha256: "3fb5ccb8d34cff43aaabe9f8c792c26331813175b9ec708fb71b24b231a42c08",
    },
    "DISC.SRC.admin-navigation": {
      state: "present",
      count: 34,
      sha256: "4c2eb699ba85f2583a89a91ea08a6bbdcab41b005c697fe68464874fdbef03d8",
    },
    "DISC.SRC.context-menus": {
      state: "present",
      count: 1,
      sha256: "96bbb0a790f7a4d5ec4d2c14c405c062da330a1b6b61fb98aeec01eeb08d4387",
    },
    "DISC.SRC.dropdown-menus": {
      state: "present",
      count: 3,
      sha256: "61cf1b6341632d1a736e638d66e347d4ff026a0dec7657449b948ac530238491",
    },
    "DISC.SRC.tabs": {
      state: "present",
      count: 1,
      sha256: "af3e7a486fc4d0b87dd1a84a1667834c8a07699c54a6e2f8df0454d7c3fe5905",
    },
    "DISC.SRC.sub-tabs": {
      state: "absent",
      count: 0,
      sha256: EMPTY_SHA256,
    },
    "DISC.SRC.navigation-cards": {
      state: "present",
      count: 5,
      sha256: "31bd379cba2786b46baf134496e9824b6c5d5fd6ea3c4f523e891564110b7f6b",
    },
    "DISC.SRC.search-result-links": {
      state: "present",
      count: 6,
      sha256: "4e48881cd0dbdf662aa17a211b8a4ecbb23fddfa605108a5d7938139b2650ebf",
    },
    "DISC.SRC.breadcrumbs": {
      state: "present",
      count: 3,
      sha256: "fd152435799499a05867cf0a3ed898400f28cb6ff3e2d4d60cd7ed482d07cb56",
    },
    "DISC.SRC.pagination-links": {
      state: "present",
      count: 3,
      sha256: "f7024a48cd16ddd89ae82ec850c46c61c6af2ba3ff6ac1f47cac45cd2219e2a7",
    },
    "DISC.SRC.modals": {
      state: "absent",
      count: 0,
      sha256: EMPTY_SHA256,
    },
    "DISC.SRC.dialogs": {
      state: "present",
      count: 1,
      sha256: "48665101cc83e0b7a67a368c2098d809aab0e983fe0a0001027028efa6d84823",
    },
    "DISC.SRC.drawers": {
      state: "present",
      count: 11,
      sha256: "a9ab7734a713bd7942a72171209bdf8bf0e31421c264939362fc7c901843eb63",
    },
    "DISC.SRC.popovers": {
      state: "absent",
      count: 0,
      sha256: EMPTY_SHA256,
    },
    "DISC.SRC.tooltips": {
      state: "present",
      count: 4,
      sha256: "e64cb93e0de0e9ae0f123d73496c6ba88b763240d10899ec3d41bffa1e8adf2c",
    },
    "DISC.SRC.command-palettes": {
      state: "absent",
      count: 0,
      sha256: EMPTY_SHA256,
    },
    "DISC.SRC.empty-state-actions": {
      state: "present",
      count: 47,
      sha256: "16cb156f86654d91bb05ce1357aad87242c2db8b864712411ffc5095c04aebef",
    },
    "DISC.SRC.error-state-actions": {
      state: "present",
      count: 40,
      sha256: "7e3eaff234d1adf2a44e5eda8902a429398f80c555e25b260f197e5dcc13c632",
    },
    "DISC.SRC.invitation-links": {
      state: "present",
      count: 3,
      sha256: "77776d586b91025154dc0ade67c77fce392f6177385b0fb8608b867bdd70f416",
    },
    "DISC.SRC.email-links": {
      state: "present",
      count: 1,
      sha256: "81090dd62a570ad8e0e4ae93ccd315055c8d5d6441f0970b28c1947dff0382b3",
    },
    "DISC.SRC.notification-links": {
      state: "present",
      count: 6,
      sha256: "ca6a1486f9bf071053ac4e04656206762d3d5c73b9413c3a25c84182706341b0",
    },
    "DISC.SRC.deep-links": {
      state: "present",
      count: 101,
      sha256: "eb18e951083fda434379d73a0073ec5dc9c98d88b00222a3199614ce1edfdcdb",
    },
    "DISC.SRC.role-gated-routes": {
      state: "present",
      count: 81,
      sha256: "ea9d7253961ad4f1158b872fb9f3fed3a190d44ce23d10c8e8d4653dbedf903d",
    },
    "DISC.SRC.tier-gated-routes": {
      state: "present",
      count: 20,
      sha256: "9f956025dec87520399a513363f22d6cfbb8c15e6427143d1236f663941e9195",
    },
  } as const satisfies Readonly<
    Record<
      ProductSourceInteractionRequirementId,
      ProductSourceInteractionInventorySnapshot
    >
  >;

export type ProductSourceInteractionEvidenceRecord = {
  status: ProductMasterRequirementStatus;
  evidence: readonly string[];
};

const SHARED_EVIDENCE = [
  PRODUCT_SOURCE_INTERACTION_EVIDENCE_FILE,
  PRODUCT_SOURCE_INTERACTION_TEST_FILE,
] as const;

export const PRODUCT_SOURCE_INTERACTION_MASTER_EVIDENCE = Object.fromEntries(
  [
    ...PRODUCT_SOURCE_INTERACTION_REQUIREMENT_IDS,
    ...PRODUCT_SOURCE_INTERACTION_COMPLETION_REQUIREMENT_IDS,
  ].map((requirementId) => [
    requirementId,
    { status: "tested" as const, evidence: SHARED_EVIDENCE },
  ]),
) as Readonly<Record<string, ProductSourceInteractionEvidenceRecord>>;
