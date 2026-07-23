import type { ProductMasterRequirementStatus } from "./product-master-requirements";

export const PRODUCT_MESSAGE_EDIT_EXCLUSION_EVIDENCE_FILE =
  "src/components/product-message-edit-exclusion-evidence.ts" as const;
export const PRODUCT_MESSAGE_EDIT_EXCLUSION_TEST_FILE =
  "src/components/product-message-edit-exclusion-evidence.test.ts" as const;

export const PRODUCT_MESSAGE_EDIT_EXCLUSION_REQUIREMENT_ID =
  "ROUTE.COMMUNITY.message-edit" as const;

export const PRODUCT_MESSAGE_EDIT_EXCLUSION = {
  owner: "AI Kick Start product owner",
  rationale:
    "GreyhoundIQ does not currently support editing a sent private message. Supported message mutations are send, participant-specific soft delete, reaction, report, and receipt updates. The requirement is conditional ('where supported'), so the unsupported edit capability is explicitly excluded until a separately designed ownership, edit-history, moderation, notification, and user-interface contract is approved.",
} as const;

export const PRODUCT_MESSAGE_EDIT_EXCLUSION_SCOPE =
  "Deterministic source-static exclusion review of the private-message item route, complete Message schema field list, all message-related production interaction contracts, and every reachable runtime source file for the canonical Pulse and legacy message routes. The exclusion fails closed if a mutating item-route method, edit-history schema field, message-edit action contract, or runtime edit signal appears. It proves only that sent-message editing is not a currently supported product capability; it does not prove message send/delete/reaction/report runtime behavior, deployed authorization, production data, or future product policy.";

export type ProductMessageEditActionContract = {
  route: string;
  id: string;
  result: string;
  enforcement: string;
};

export type ProductMessageEditRuntimeSignal = {
  path: string;
  signal: string;
};

export type ProductMessageEditSupportInventory = {
  itemRouteMethods: readonly string[];
  messageSchemaFields: readonly string[];
  messageActionContracts: readonly ProductMessageEditActionContract[];
  runtimeEditSignals: readonly ProductMessageEditRuntimeSignal[];
};

export type ProductMessageEditExclusionIssue = {
  code:
    | "EDIT_ACTION_DECLARED"
    | "EDIT_HISTORY_FIELD_DECLARED"
    | "EDIT_ITEM_METHOD_DECLARED"
    | "EDIT_RUNTIME_SIGNAL_DECLARED"
    | "MESSAGE_BASELINE_INCOMPLETE";
  detail: string;
};

const EDIT_ACTION_PATTERN =
  /(?:\bedit(?:ed|ing)?\b[^\n]{0,60}\bmessage\b|\bmessage\b[^\n]{0,60}\bedit(?:ed|ing)?\b|(?:^|[.\-_:])EDIT(?:$|[.\-_:]))/iu;

export function findMessageEditExclusionIssues(
  inventory: ProductMessageEditSupportInventory,
): ProductMessageEditExclusionIssue[] {
  const issues: ProductMessageEditExclusionIssue[] = [];
  const methods = new Set(
    inventory.itemRouteMethods.map((method) => method.toUpperCase()),
  );
  const fields = new Set(inventory.messageSchemaFields);
  const actionText = inventory.messageActionContracts.map(
    ({ id, result, enforcement }) => `${id}\n${result}\n${enforcement}`,
  );

  const baselineCapabilities = [
    methods.has("DELETE"),
    ["body", "createdAt", "deletedBySenderAt", "deletedByRecipientAt"].every(
      (field) => fields.has(field),
    ),
    actionText.some((value) => /MESSAGE[.\-_:]SEND/iu.test(value)),
    actionText.some((value) => /MESSAGE[.\-_:]DELETE/iu.test(value)),
    actionText.some((value) => /REACTION[.\-_:]TOGGLE/iu.test(value)),
    actionText.some((value) => /MESSAGE[.\-_:]REPORT/iu.test(value)),
  ];
  if (!baselineCapabilities.every(Boolean)) {
    issues.push({
      code: "MESSAGE_BASELINE_INCOMPLETE",
      detail:
        "the exclusion requires non-vacuous send, delete, reaction, report, and message-schema evidence",
    });
  }

  const editMethods = [...methods].filter((method) =>
    ["PATCH", "POST", "PUT"].includes(method),
  );
  if (editMethods.length > 0) {
    issues.push({
      code: "EDIT_ITEM_METHOD_DECLARED",
      detail: `message item route declares: ${editMethods.join(", ")}`,
    });
  }

  const editFields = inventory.messageSchemaFields.filter((field) =>
    /^(?:editedAt|editCount|originalBody|updatedAt)$/u.test(field),
  );
  if (editFields.length > 0) {
    issues.push({
      code: "EDIT_HISTORY_FIELD_DECLARED",
      detail: `Message declares edit-history fields: ${editFields.join(", ")}`,
    });
  }

  const editActions = inventory.messageActionContracts.filter(
    ({ id, result, enforcement }) =>
      EDIT_ACTION_PATTERN.test(`${id}\n${result}\n${enforcement}`),
  );
  if (editActions.length > 0) {
    issues.push({
      code: "EDIT_ACTION_DECLARED",
      detail: `message-edit actions declared: ${editActions.map(({ id }) => id).join(", ")}`,
    });
  }

  if (inventory.runtimeEditSignals.length > 0) {
    issues.push({
      code: "EDIT_RUNTIME_SIGNAL_DECLARED",
      detail: inventory.runtimeEditSignals
        .map(({ path, signal }) => `${path}:${signal}`)
        .join(", "),
    });
  }

  return issues;
}

type ProductMessageEditExclusionEvidenceRecord = {
  status: ProductMasterRequirementStatus;
  evidence: readonly string[];
  owner: string;
};

export const PRODUCT_MESSAGE_EDIT_EXCLUSION_MASTER_EVIDENCE = {
  [PRODUCT_MESSAGE_EDIT_EXCLUSION_REQUIREMENT_ID]: {
    status: "excluded",
    owner: PRODUCT_MESSAGE_EDIT_EXCLUSION.owner,
    evidence: [
      PRODUCT_MESSAGE_EDIT_EXCLUSION_EVIDENCE_FILE,
      PRODUCT_MESSAGE_EDIT_EXCLUSION_TEST_FILE,
      "src/app/api/conversations/[id]/messages/[msgId]/route.ts",
      "src/lib/conversation-service.ts",
      "prisma/schema.prisma",
      "src/components/screen-contracts/production-screen-coverage.ts",
    ],
  },
} as const satisfies Readonly<
  Record<string, ProductMessageEditExclusionEvidenceRecord>
>;
