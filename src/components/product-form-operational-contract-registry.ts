import { readFileSync } from "node:fs";

import {
  SCREEN_CONTRACTS,
  type ScreenContract,
} from "./demo-experience-registry";
import { getLocalSourceClosure } from "./screen-contracts/screen-contract-source-audit";

export const PRODUCT_FORM_OPERATIONAL_SIGNAL_KINDS = [
  "pending",
  "duplicate-prevention",
  "success",
  "failure",
  "audit",
  "analytics",
] as const;

export type ProductFormOperationalSignalKind =
  (typeof PRODUCT_FORM_OPERATIONAL_SIGNAL_KINDS)[number];

export type ProductFormOperationalSourceSignal = {
  kind: ProductFormOperationalSignalKind;
  sourceFile: string;
  sourceLine: number;
  sourceText: string;
};

export type ProductFormMutationKind =
  | "client-state"
  | "http-mutation"
  | "read-query"
  | "server-action"
  | "unclassified";

export type ProductFormUpdateStrategy =
  | "not-applicable-read-query"
  | "optimistic-client-state"
  | "pessimistic-server-confirmed"
  | "source-unclassified";

export type ProductFormOperationalContractRecord = {
  id: string;
  formId: string;
  route: string;
  story: string;
  actors: readonly string[];
  purpose: string;
  destination: string;
  mutation: {
    kind: ProductFormMutationKind;
    operation: string;
  };
  authentication: ScreenContract["authentication"];
  ownership: ScreenContract["permissionRules"];
  roles: readonly string[];
  tiers: readonly string[];
  updateStrategy: ProductFormUpdateStrategy;
  pending: readonly ProductFormOperationalSourceSignal[];
  duplicatePrevention: readonly ProductFormOperationalSourceSignal[];
  success: readonly ProductFormOperationalSourceSignal[];
  failure: readonly ProductFormOperationalSourceSignal[];
  audit: readonly ProductFormOperationalSourceSignal[];
  analytics: readonly ProductFormOperationalSourceSignal[];
  sourceFiles: readonly string[];
};

export type ProductFormOperationalContractRegistry = {
  records: readonly ProductFormOperationalContractRecord[];
  discoveredRecordIds: readonly string[];
  auditedRoutes: readonly string[];
  auditedSourceFiles: readonly string[];
};

const SIGNAL_PATTERNS = {
  pending:
    /\b(?:isPending|pending|submitting|isSubmitting|useFormStatus|aria-busy)\b/i,
  "duplicate-prevention":
    /\b(?:idempot|duplicate|dedup|isPending|isSubmitting|submitting)\b|disabled\s*=/i,
  success:
    /\b(?:success|succeeded|saved|created|updated|sent|redirect|revalidatePath)\b/i,
  failure:
    /\b(?:error|failed|failure|catch|denied|invalid|not found)\b/i,
  audit: /\b(?:audit|logAdmin|recordAudit)\b/i,
  analytics:
    /\b(?:analytics|trackEvent|emitMetric|telemetry|onboarding event)\b/i,
} as const satisfies Readonly<
  Record<ProductFormOperationalSignalKind, RegExp>
>;

const FORM_DESTINATION_SEPARATOR = " -> ";

export function buildProductFormOperationalContractRegistry(): ProductFormOperationalContractRegistry {
  const records = new Map<string, ProductFormOperationalContractRecord>();
  const discoveredRecordIds = new Set<string>();
  const auditedRoutes = new Set<string>();
  const auditedSourceFiles = new Set<string>();

  for (const screen of SCREEN_CONTRACTS) {
    if (screen.forms.length === 0) continue;

    auditedRoutes.add(screen.route);
    const sourceFiles = screen.sourceFiles
      .flatMap((sourceFile) => [...getLocalSourceClosure(sourceFile)])
      .filter(isAuditableSourceFile)
      .filter((sourceFile, index, files) => files.indexOf(sourceFile) === index)
      .toSorted();
    sourceFiles.forEach((sourceFile) => auditedSourceFiles.add(sourceFile));
    const signals = collectSignals(sourceFiles);

    for (const encodedForm of screen.forms) {
      const { formId, destination } = parseEncodedForm(encodedForm);
      const id = `${screen.route}::${formId}`;
      discoveredRecordIds.add(id);

      const mutation = classifyMutation(destination);
      records.set(id, {
        id,
        formId,
        route: screen.route,
        story: screen.description,
        actors: [...screen.actors],
        purpose: `Support ${screen.description} through ${formId}.`,
        destination,
        mutation,
        authentication: screen.authentication,
        ownership: screen.permissionRules.map((rule) => ({
          ...rule,
          testIds: [...rule.testIds],
        })),
        roles: [...screen.roles],
        tiers: [...screen.tiers],
        updateStrategy: classifyUpdateStrategy(mutation.kind),
        pending: signals.pending,
        duplicatePrevention: signals["duplicate-prevention"],
        success: signals.success,
        failure: signals.failure,
        audit: signals.audit,
        analytics: signals.analytics,
        sourceFiles,
      });
    }
  }

  return {
    records: [...records.values()].toSorted(compareRecords),
    discoveredRecordIds: [...discoveredRecordIds].toSorted((left, right) =>
      left.localeCompare(right),
    ),
    auditedRoutes: [...auditedRoutes].toSorted(),
    auditedSourceFiles: [...auditedSourceFiles].toSorted(),
  };
}

function parseEncodedForm(encodedForm: string) {
  const separatorIndex = encodedForm.indexOf(FORM_DESTINATION_SEPARATOR);
  if (separatorIndex < 1) {
    throw new Error(`Invalid screen form contract: ${encodedForm}`);
  }

  const formId = encodedForm.slice(0, separatorIndex).trim();
  const destination = encodedForm
    .slice(separatorIndex + FORM_DESTINATION_SEPARATOR.length)
    .trim();
  if (!formId || !destination) {
    throw new Error(`Incomplete screen form contract: ${encodedForm}`);
  }
  return { formId, destination };
}

function classifyMutation(
  destination: string,
): ProductFormOperationalContractRecord["mutation"] {
  if (destination.startsWith("GET ")) {
    return { kind: "read-query", operation: destination };
  }
  if (destination.startsWith("SERVER ACTION ")) {
    return {
      kind: "server-action",
      operation: destination.slice("SERVER ACTION ".length),
    };
  }
  if (destination.startsWith("CLIENT STATE ")) {
    return {
      kind: "client-state",
      operation: destination.slice("CLIENT STATE ".length),
    };
  }
  if (/^(?:POST|PUT|PATCH|DELETE)\s+/.test(destination)) {
    return { kind: "http-mutation", operation: destination };
  }
  return { kind: "unclassified", operation: destination };
}

function classifyUpdateStrategy(
  mutationKind: ProductFormMutationKind,
): ProductFormUpdateStrategy {
  if (mutationKind === "read-query") return "not-applicable-read-query";
  if (mutationKind === "client-state") return "optimistic-client-state";
  if (mutationKind === "server-action" || mutationKind === "http-mutation") {
    return "pessimistic-server-confirmed";
  }
  return "source-unclassified";
}

function collectSignals(sourceFiles: readonly string[]) {
  const signals: Record<
    ProductFormOperationalSignalKind,
    ProductFormOperationalSourceSignal[]
  > = {
    pending: [],
    "duplicate-prevention": [],
    success: [],
    failure: [],
    audit: [],
    analytics: [],
  };

  for (const sourceFile of sourceFiles) {
    const lines = readFileSync(sourceFile, "utf8").split(/\r?\n/);
    lines.forEach((sourceText, index) => {
      for (const kind of PRODUCT_FORM_OPERATIONAL_SIGNAL_KINDS) {
        if (!SIGNAL_PATTERNS[kind].test(sourceText)) continue;
        signals[kind].push({
          kind,
          sourceFile,
          sourceLine: index + 1,
          sourceText: sourceText.trim().replace(/\s+/g, " ").slice(0, 180),
        });
      }
    });
  }

  const sortedSignals: Record<
    ProductFormOperationalSignalKind,
    readonly ProductFormOperationalSourceSignal[]
  > = {
    pending: [],
    "duplicate-prevention": [],
    success: [],
    failure: [],
    audit: [],
    analytics: [],
  };
  for (const kind of PRODUCT_FORM_OPERATIONAL_SIGNAL_KINDS) {
    sortedSignals[kind] = signals[kind].toSorted((left, right) =>
      signalKey(left).localeCompare(signalKey(right)),
    );
  }
  return sortedSignals;
}

function isAuditableSourceFile(sourceFile: string) {
  return (
    sourceFile.startsWith("src/") &&
    /\.[cm]?[jt]sx?$/.test(sourceFile) &&
    !/\.test\.[cm]?[jt]sx?$/.test(sourceFile)
  );
}

function compareRecords(
  left: ProductFormOperationalContractRecord,
  right: ProductFormOperationalContractRecord,
) {
  return left.id.localeCompare(right.id);
}

function signalKey(signal: ProductFormOperationalSourceSignal) {
  return `${signal.sourceFile}:${signal.sourceLine}:${signal.kind}`;
}
