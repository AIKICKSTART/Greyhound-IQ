import { readdirSync, readFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

export type LogCallsiteScope = "background" | "boot" | "mixed" | "request";

export type LogCallsiteRegistryEntry = {
  file: string;
  owner: string;
  event: string;
  api: string;
  scope: LogCallsiteScope;
  count?: number;
};

export const LOG_CALLSITE_REGISTRY: readonly LogCallsiteRegistryEntry[] = [
  entry(
    "src/app/api/health/ready/route.ts",
    "GET",
    "health.ready.database",
    "logCorrelatedError",
    "request",
  ),
  entry(
    "src/app/api/billing/bespoke/checkout/route.ts",
    "POST",
    "billing.bespoke_checkout_start_failed",
    "logRequestError",
    "request",
  ),
  entry(
    "src/app/api/billing/boost/checkout/route.ts",
    "POST",
    "billing.boost_checkout_start_failed",
    "logRequestError",
    "request",
  ),
  entry(
    "src/app/api/billing/checkout/route.ts",
    "POST",
    "billing.checkout_start_failed",
    "logRequestError",
    "request",
  ),
  entry(
    "src/app/api/billing/portal/route.ts",
    "POST",
    "billing.portal_start_failed",
    "logRequestError",
    "request",
  ),
  entry(
    "src/app/api/livekit/webhook/route.ts",
    "POST",
    "livekit.webhook_verify_failed",
    "logRequestWarn",
    "request",
  ),
  entry(
    "src/app/callback/route.ts",
    "onSuccess",
    "auth.callback_sync_failed",
    "logRequestError",
    "request",
  ),
  entry(
    "src/app/callback/route.ts",
    "onError",
    "auth.callback_failed",
    "logCorrelatedError",
    "request",
  ),
  entry(
    "src/instrumentation.ts",
    "register",
    "livekit.not_configured",
    "logBackgroundWarn",
    "boot",
  ),
  entry(
    "src/instrumentation.ts",
    "register",
    "realtime.secret_missing",
    "logBackgroundError",
    "boot",
  ),
  {
    ...entry(
      "src/lib/api-errors.ts",
      "jsonError",
      "api.internal_error",
      "logCorrelatedError",
      "request",
    ),
    count: 2,
  },
  {
    ...entry(
      "src/lib/api-errors.ts",
      "jsonError",
      "api.request_rejected",
      "logCorrelatedWarn",
      "request",
    ),
    count: 2,
  },
  entry(
    "src/lib/billing/usage-delivery-service.ts",
    "runUsageDeliveryMaintenance",
    "usage_delivery.attention",
    "logExecutionWarn",
    "mixed",
  ),
  entry(
    "src/lib/billing/usage-delivery-service.ts",
    "runUsageDeliveryMaintenance",
    "usage_delivery.completed",
    "logExecutionInfo",
    "mixed",
  ),
  entry(
    "src/lib/billing/usage-delivery-service.ts",
    "deliverUsageClaim",
    "usage_delivery.ignored",
    "logExecutionInfo",
    "mixed",
  ),
  entry(
    "src/lib/conversation-service.ts",
    "touchPresence",
    "presence.upsert_failed",
    "logRequestWarn",
    "request",
  ),
  entry(
    "src/lib/db.ts",
    "$allOperations",
    "db.slow_query",
    "logExecutionWarn",
    "mixed",
  ),
  entry(
    "src/lib/db.ts",
    "safeQuery",
    "db.safe_query_failed",
    "logRequestError",
    "request",
  ),
  entry(
    "src/lib/dog-win-notify.ts",
    "notifyDogWinnersFromRecentResults",
    "dog_win_notify.failed",
    "logExecutionError",
    "mixed",
  ),
  entry(
    "src/lib/link-preview-worker.ts",
    "runLinkPreviewMaintenance",
    "feed.link_preview_failed",
    "logRequestError",
    "request",
  ),
  entry(
    "src/lib/live/dog-profile-sync.ts",
    "syncDogProfilesBatch",
    "dog_profile_sync.profile_failed",
    "logRequestError",
    "request",
  ),
  entry(
    "src/lib/live/fasttrack.ts",
    "fetchMeetings",
    "live.fasttrack.meeting_skipped",
    "logExecutionWarn",
    "mixed",
  ),
  entry(
    "src/lib/live/provider.ts",
    "fetch",
    "live.composite.provider_failed",
    "logExecutionWarn",
    "mixed",
  ),
  entry(
    "src/lib/live/sync.ts",
    "logDogIdentitySkip",
    "live.dog_identity.skipped",
    "logCorrelatedWarn",
    "mixed",
  ),
  entry(
    "src/lib/live/sync.ts",
    "logTrainerIdentitySkip",
    "live.trainer_identity.skipped",
    "logCorrelatedWarn",
    "mixed",
  ),
  entry(
    "src/lib/live/sync.ts",
    "syncLiveData",
    "live_sync.provider_not_configured",
    "logCorrelatedInfo",
    "mixed",
  ),
  entry(
    "src/lib/live/sync.ts",
    "syncLiveData",
    "live_sync.started",
    "logCorrelatedInfo",
    "mixed",
  ),
  entry(
    "src/lib/live/sync.ts",
    "syncLiveData",
    "live_sync.replay_reconciliation_incomplete",
    "logCorrelatedWarn",
    "mixed",
  ),
  entry(
    "src/lib/live/sync.ts",
    "syncLiveData",
    "live_sync.completeness_alert",
    "logCorrelatedWarn",
    "mixed",
  ),
  entry(
    "src/lib/live/sync.ts",
    "syncLiveData",
    "live_sync.completed",
    "logCorrelatedInfo",
    "mixed",
  ),
  entry(
    "src/lib/live/sync.ts",
    "refreshAggregateMaterializedViews",
    "aggregate_refresh.rate_limit_prune_completed",
    "logCorrelatedInfo",
    "request",
  ),
  entry(
    "src/lib/live/sync.ts",
    "refreshAggregateMaterializedViews",
    "aggregate_refresh.rate_limit_prune_attention",
    "logCorrelatedWarn",
    "request",
  ),
  entry(
    "src/lib/live/sync.ts",
    "refreshAggregateMaterializedViews",
    "aggregate_refresh.completed",
    "logCorrelatedInfo",
    "request",
  ),
  entry(
    "src/lib/live/sync.ts",
    "refreshAggregateMaterializedViews",
    "aggregate_refresh.run_completed",
    "logCorrelatedInfo",
    "request",
  ),
  entry(
    "src/lib/live/sync.ts",
    "refreshAggregateMaterializedViews",
    "aggregate_refresh.failed",
    "logCorrelatedError",
    "request",
  ),
  entry(
    "src/lib/live/sync.ts",
    "syncDebug",
    "live_sync.debug",
    "logCorrelatedInfo",
    "mixed",
  ),
  entry(
    "src/lib/live/thedogs.ts",
    "fetchMeetings",
    "live.thedogs.meeting_skipped",
    "logExecutionWarn",
    "mixed",
  ),
  entry(
    "src/lib/live/thedogs.ts",
    "hydrateFallbackRaceTimes",
    "live.thedogs.race_time_hydration_failed",
    "logExecutionWarn",
    "mixed",
  ),
  entry(
    "src/lib/live/thedogs.ts",
    "fetchResultMeetings",
    "live.thedogs.result_race_skipped",
    "logExecutionWarn",
    "mixed",
  ),
  entry(
    "src/lib/live/thedogs.ts",
    "fetchResultMeetings",
    "live.thedogs.result_meeting_skipped",
    "logExecutionWarn",
    "mixed",
  ),
  entry(
    "src/lib/live/watchdog.ts",
    "fetchMeetingDetails",
    "live.watchdog.meeting_skipped",
    "logExecutionWarn",
    "mixed",
  ),
  entry(
    "src/lib/livekit-admin.ts",
    "deleteLiveKitRoom",
    "livekit.delete_room_failed",
    "logExecutionError",
    "mixed",
  ),
  entry(
    "src/lib/media-service.ts",
    "finalizeMediaUpload",
    "media.usage_record_failed",
    "logRequestError",
    "request",
  ),
  entry(
    "src/lib/media-service.ts",
    "replaceMediaCaptionForCurrentUser",
    "media.caption_rollback_failed",
    "logRequestError",
    "request",
  ),
  entry(
    "src/lib/media-service.ts",
    "replaceMediaCaptionForCurrentUser",
    "media.caption_replaced_cleanup_failed",
    "logRequestError",
    "request",
  ),
  entry(
    "src/lib/media-service.ts",
    "deleteMediaCaptionForCurrentUser",
    "media.caption_delete_cleanup_failed",
    "logRequestError",
    "request",
  ),
  entry(
    "src/lib/media-service.ts",
    "deleteMediaForCurrentUser",
    "media.delete_derivative_list_failed",
    "logRequestError",
    "request",
  ),
  entry(
    "src/lib/media-service.ts",
    "deleteMediaForCurrentUser",
    "media.delete_storage_failed",
    "logRequestError",
    "request",
  ),
  entry(
    "src/lib/media-service.ts",
    "runMediaMaintenance",
    "media.infected_purge_failed",
    "logRequestError",
    "request",
  ),
  entry(
    "src/lib/media-service.ts",
    "runMediaMaintenance",
    "media.derivative_cleanup_failed",
    "logRequestError",
    "request",
  ),
  entry(
    "src/lib/media-service.ts",
    "runMediaMaintenance",
    "media.processing_failed",
    "logRequestError",
    "request",
  ),
  entry(
    "src/lib/media-service.ts",
    "notifyMediaProcessingVerdict",
    "media.processing_notify_failed",
    "logRequestError",
    "request",
  ),
  entry(
    "src/lib/media-service.ts",
    "assertStoredBytesMatchMimeType",
    "media.invalid_type_purge_failed",
    "logRequestError",
    "request",
  ),
  entry(
    "src/lib/media-service.ts",
    "processMediaDerivatives",
    "media.derivative_cleanup_failed",
    "logRequestError",
    "request",
  ),
  entry(
    "src/lib/media-service.ts",
    "scanStorageObjectWithClamAv",
    "media.scan_failed",
    "logRequestError",
    "request",
  ),
  entry(
    "src/lib/media-service.ts",
    "assertClamAvReady",
    "media.clamav_refresh_failed",
    "logRequestError",
    "request",
  ),
  entry(
    "src/lib/media-service.ts",
    "readClamAvDefinitionDate",
    "media.clamav_readiness_failed",
    "logRequestError",
    "request",
  ),
  entry(
    "src/lib/notification-service.ts",
    "createInAppNotification",
    "notification.create_failed",
    "logExecutionError",
    "mixed",
  ),
  entry(
    "src/lib/rate-limit.ts",
    "checkRateLimit",
    "rate_limit.db_error",
    "logRequestError",
    "request",
  ),
  entry(
    "src/lib/realtime-service.ts",
    "broadcastRealtimeEvent",
    "realtime.broadcast_failed",
    "logExecutionError",
    "mixed",
  ),
  entry(
    "src/lib/scheduled-task-control.ts",
    "executeScheduledTask",
    "scheduled_task.started",
    "logExecutionInfo",
    "mixed",
  ),
  entry(
    "src/lib/scheduled-task-control.ts",
    "executeScheduledTask",
    "scheduled_task.overlap",
    "logExecutionWarn",
    "mixed",
  ),
  entry(
    "src/lib/scheduled-task-control.ts",
    "executeScheduledTask",
    "scheduled_task.completed",
    "logExecutionInfo",
    "mixed",
  ),
  entry(
    "src/lib/scheduled-task-control.ts",
    "executeScheduledTask",
    "scheduled_task.failed",
    "logExecutionError",
    "mixed",
  ),
];

const LOGGER_APIS = new Set([
  "logError",
  "logInfo",
  "logWarn",
  "logBackgroundError",
  "logBackgroundWarn",
  "logCorrelatedError",
  "logCorrelatedInfo",
  "logCorrelatedWarn",
  "logExecutionError",
  "logExecutionInfo",
  "logExecutionWarn",
  "logRequestError",
  "logRequestInfo",
  "logRequestWarn",
]);
const CORRELATED_APIS = new Set([
  "logCorrelatedError",
  "logCorrelatedInfo",
  "logCorrelatedWarn",
]);
const ASYNC_LOGGER_APIS = new Set([
  "logExecutionError",
  "logExecutionInfo",
  "logExecutionWarn",
  "logRequestError",
  "logRequestInfo",
  "logRequestWarn",
]);
const FORBIDDEN_CONTEXT_FIELD =
  /^(?:authorization|body|card(?:number)?|cookie|cvc|cvv|databaseurl|pan|password|payload|provid(?:er)?payload|rawpayload|secret|signature|token|uploadedcontent)$/i;

type DiscoveredCallsite = {
  api: string;
  asyncHandled: boolean;
  column: number;
  event: string;
  file: string;
  forbiddenFields: string[];
  line: number;
  owner: string;
};

export type LogCorrelationPolicyIssue = {
  kind:
    | "count-mismatch"
    | "duplicate-registry-entry"
    | "dynamic-event"
    | "forbidden-context-field"
    | "scope-api-mismatch"
    | "stale-registry-entry"
    | "unawaited-async-call"
    | "unclassified-callsite";
  detail: string;
};

export function auditLogCorrelationPolicy(
  repoRoot = process.cwd(),
  registry: readonly LogCallsiteRegistryEntry[] = LOG_CALLSITE_REGISTRY,
): LogCorrelationPolicyIssue[] {
  const discovered = discoverLogCallsites(repoRoot);
  const issues: LogCorrelationPolicyIssue[] = [];
  const actualCounts = countByKey(discovered.map(discoveredKey));
  const registryCounts = countByKey(registry.map(registryKey));

  for (const [key, count] of registryCounts) {
    if (count > 1) {
      issues.push({
        kind: "duplicate-registry-entry",
        detail: `${key} appears ${count} times in the registry`,
      });
    }
  }

  for (const callsite of discovered) {
    if (callsite.event === "<dynamic>") {
      issues.push({
        kind: "dynamic-event",
        detail: `${location(callsite)} logger events must be string literals`,
      });
    }
    for (const field of callsite.forbiddenFields) {
      issues.push({
        kind: "forbidden-context-field",
        detail: `${location(callsite)} context field ${field} is prohibited`,
      });
    }
    if (!callsite.asyncHandled) {
      issues.push({
        kind: "unawaited-async-call",
        detail: `${location(callsite)} ${callsite.api} must be awaited or returned`,
      });
    }
    if (
      !registry.some((item) => registryKey(item) === discoveredKey(callsite))
    ) {
      issues.push({
        kind: "unclassified-callsite",
        detail: `${location(callsite)} ${callsite.api}(${callsite.event}) is not classified`,
      });
    }
  }

  for (const item of registry) {
    if (!apiSupportsScope(item.api, item.scope)) {
      issues.push({
        kind: "scope-api-mismatch",
        detail: `${registryKey(item)} does not enforce ${item.scope} correlation`,
      });
    }
    const expected = item.count ?? 1;
    const actual = actualCounts.get(registryKey(item)) ?? 0;
    if (actual === 0) {
      issues.push({
        kind: "stale-registry-entry",
        detail: `${registryKey(item)} no longer exists`,
      });
    } else if (actual !== expected) {
      issues.push({
        kind: "count-mismatch",
        detail: `${registryKey(item)} expected ${expected}, found ${actual}`,
      });
    }
  }

  return dedupeIssues(issues);
}

export function discoverLogCallsites(repoRoot = process.cwd()) {
  const sourceRoot = resolve(repoRoot, "src");
  const callsites: DiscoveredCallsite[] = [];
  for (const file of collectSourceFiles(sourceRoot)) {
    const repoPath = relative(repoRoot, file).replace(/\\/g, "/");
    if (repoPath === "src/lib/logger.ts" || isTestFile(repoPath)) continue;
    const sourceFile = ts.createSourceFile(
      file,
      readFileSync(file, "utf8"),
      ts.ScriptTarget.Latest,
      true,
      file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    );
    const loggerBindings = findLoggerBindings(sourceFile);
    visit(sourceFile, (node) => {
      if (!ts.isCallExpression(node)) return;
      const api = loggerApiForCall(node.expression, loggerBindings);
      if (!api) return;
      const eventIndex = CORRELATED_APIS.has(api) ? 1 : 0;
      const contextIndex = CORRELATED_APIS.has(api) ? 2 : 1;
      const eventNode = node.arguments[eventIndex];
      const position = sourceFile.getLineAndCharacterOfPosition(
        node.getStart(sourceFile),
      );
      callsites.push({
        api,
        asyncHandled:
          !ASYNC_LOGGER_APIS.has(api) || isAwaitedOrReturnedLoggerCall(node),
        column: position.character + 1,
        event:
          eventNode && ts.isStringLiteralLike(eventNode)
            ? eventNode.text
            : "<dynamic>",
        file: repoPath,
        forbiddenFields: forbiddenContextFields(node.arguments[contextIndex]),
        line: position.line + 1,
        owner: enclosingOwner(node, sourceFile),
      });
    });
  }
  return callsites;
}

type LoggerBindings = {
  methods: Map<string, string>;
  namespaces: Set<string>;
};

function findLoggerBindings(sourceFile: ts.SourceFile): LoggerBindings {
  const bindings: LoggerBindings = {
    methods: new Map(),
    namespaces: new Set(),
  };

  visit(sourceFile, (node) => {
    if (
      ts.isImportDeclaration(node) &&
      ts.isStringLiteral(node.moduleSpecifier) &&
      isLoggerModule(node.moduleSpecifier.text) &&
      node.importClause &&
      !node.importClause.isTypeOnly &&
      node.importClause.namedBindings
    ) {
      const named = node.importClause.namedBindings;
      if (ts.isNamespaceImport(named)) {
        bindings.namespaces.add(named.name.text);
      } else {
        for (const element of named.elements) {
          if (element.isTypeOnly) continue;
          const imported = element.propertyName?.text ?? element.name.text;
          if (LOGGER_APIS.has(imported)) {
            bindings.methods.set(element.name.text, imported);
          }
        }
      }
    }

  });

  let changed = true;
  while (changed) {
    changed = false;
    visit(sourceFile, (node) => {
      if (ts.isVariableDeclaration(node) && node.initializer) {
        changed =
          registerLoggerAlias(node.name, node.initializer, bindings) || changed;
      }
      if (
        ts.isBinaryExpression(node) &&
        node.operatorToken.kind === ts.SyntaxKind.EqualsToken
      ) {
        changed =
          registerLoggerAssignmentAlias(node.left, node.right, bindings) ||
          changed;
      }
    });
  }

  return bindings;
}

function registerLoggerAlias(
  binding: ts.BindingName,
  initializer: ts.Expression,
  bindings: LoggerBindings,
) {
  if (isLoggerNamespaceReference(initializer, bindings)) {
    const beforeMethods = bindings.methods.size;
    const beforeNamespaces = bindings.namespaces.size;
    registerLoggerBinding(binding, bindings);
    return (
      bindings.methods.size !== beforeMethods ||
      bindings.namespaces.size !== beforeNamespaces
    );
  }

  const api = loggerApiForReference(initializer, bindings);
  if (!api || !ts.isIdentifier(binding)) return false;
  if (bindings.methods.get(binding.text) === api) return false;
  bindings.methods.set(binding.text, api);
  return true;
}

function registerLoggerAssignmentAlias(
  target: ts.Expression,
  initializer: ts.Expression,
  bindings: LoggerBindings,
) {
  const binding = unwrapExpression(target);
  if (!ts.isIdentifier(binding)) return false;

  if (isLoggerNamespaceReference(initializer, bindings)) {
    if (bindings.namespaces.has(binding.text)) return false;
    bindings.namespaces.add(binding.text);
    return true;
  }

  const api = loggerApiForReference(initializer, bindings);
  if (!api || bindings.methods.get(binding.text) === api) return false;
  bindings.methods.set(binding.text, api);
  return true;
}

function registerLoggerBinding(
  binding: ts.BindingName,
  bindings: LoggerBindings,
) {
  if (ts.isIdentifier(binding)) {
    bindings.namespaces.add(binding.text);
    return;
  }
  if (!ts.isObjectBindingPattern(binding)) return;
  for (const element of binding.elements) {
    if (!ts.isIdentifier(element.name)) continue;
    const imported = element.propertyName
      ? propertyName(element.propertyName)
      : element.name.text;
    if (imported && LOGGER_APIS.has(imported)) {
      bindings.methods.set(element.name.text, imported);
    }
  }
}

function loggerApiForCall(
  expression: ts.LeftHandSideExpression,
  bindings: LoggerBindings,
) {
  return loggerApiForReference(expression, bindings);
}

function loggerApiForReference(
  expression: ts.Expression,
  bindings: LoggerBindings,
) {
  const target = unwrapExpression(expression);
  if (ts.isIdentifier(target)) {
    return bindings.methods.get(target.text) ?? null;
  }
  if (
    ts.isPropertyAccessExpression(target) &&
    isLoggerNamespaceReference(target.expression, bindings) &&
    LOGGER_APIS.has(target.name.text)
  ) {
    return target.name.text;
  }
  if (
    ts.isElementAccessExpression(target) &&
    isLoggerNamespaceReference(target.expression, bindings) &&
    target.argumentExpression &&
    ts.isStringLiteralLike(target.argumentExpression) &&
    LOGGER_APIS.has(target.argumentExpression.text)
  ) {
    return target.argumentExpression.text;
  }
  return null;
}

function isLoggerNamespaceReference(
  expression: ts.Expression,
  bindings: LoggerBindings,
) {
  const target = unwrapExpression(expression);
  return (
    (ts.isIdentifier(target) && bindings.namespaces.has(target.text)) ||
    isLoggerDynamicImport(target)
  );
}

function isLoggerDynamicImport(expression: ts.Expression) {
  const target = unwrapExpression(expression);
  const call = ts.isAwaitExpression(target)
    ? unwrapExpression(target.expression)
    : target;
  return (
    ts.isCallExpression(call) &&
    call.expression.kind === ts.SyntaxKind.ImportKeyword &&
    call.arguments.length === 1 &&
    ts.isStringLiteralLike(call.arguments[0]) &&
    isLoggerModule(call.arguments[0].text)
  );
}

function isLoggerModule(specifier: string) {
  return (
    specifier === "@/lib/logger" ||
    (/^\.\.?\//.test(specifier) && /(?:^|\/)logger$/.test(specifier))
  );
}

function unwrapExpression(expression: ts.Expression): ts.Expression {
  let current = expression;
  while (
    ts.isParenthesizedExpression(current) ||
    ts.isAsExpression(current) ||
    ts.isTypeAssertionExpression(current) ||
    ts.isNonNullExpression(current) ||
    ts.isSatisfiesExpression(current)
  ) {
    current = current.expression;
  }
  return current;
}

function isAwaitedOrReturnedLoggerCall(call: ts.CallExpression) {
  return isAwaitedOrReturnedExpression(call);
}

function isAwaitedOrReturnedExpression(expression: ts.Expression): boolean {
  let current: ts.Node = expression;
  while (
    current.parent &&
    ((ts.isParenthesizedExpression(current.parent) &&
      current.parent.expression === current) ||
      (ts.isAsExpression(current.parent) &&
        current.parent.expression === current) ||
      (ts.isTypeAssertionExpression(current.parent) &&
        current.parent.expression === current) ||
      (ts.isNonNullExpression(current.parent) &&
        current.parent.expression === current) ||
      (ts.isSatisfiesExpression(current.parent) &&
        current.parent.expression === current))
  ) {
    current = current.parent;
  }

  const parent = current.parent;
  if (!parent) return false;
  if (ts.isAwaitExpression(parent) && parent.expression === current) return true;
  if (ts.isReturnStatement(parent) && parent.expression === current) return true;
  if (
    ts.isArrowFunction(parent) &&
    parent.body === current &&
    ts.isCallExpression(parent.parent) &&
    parent.parent.arguments.includes(parent)
  ) {
    const callbackConsumer = parent.parent;
    const target = unwrapExpression(callbackConsumer.expression);
    if (
      ts.isPropertyAccessExpression(target) &&
      ["catch", "finally", "then"].includes(target.name.text)
    ) {
      return isAwaitedOrReturnedExpression(callbackConsumer);
    }
  }
  return false;
}

function entry(
  file: string,
  owner: string,
  event: string,
  api: string,
  scope: LogCallsiteScope,
): LogCallsiteRegistryEntry {
  return { file, owner, event, api, scope };
}

function apiSupportsScope(api: string, scope: LogCallsiteScope) {
  if (scope === "boot" || scope === "background") {
    return api.startsWith("logBackground");
  }
  if (scope === "request") {
    return api.startsWith("logRequest") || api.startsWith("logCorrelated");
  }
  return api.startsWith("logExecution") || api.startsWith("logCorrelated");
}

function collectSourceFiles(directory: string): string[] {
  const files: string[] = [];
  for (const item of readdirSync(directory, { withFileTypes: true })) {
    const fullPath = resolve(directory, item.name);
    if (item.isSymbolicLink()) {
      throw new Error(`Unsupported symbolic link under src: ${fullPath}`);
    }
    if (item.isDirectory()) files.push(...collectSourceFiles(fullPath));
    else if (/\.(?:ts|tsx)$/.test(item.name)) files.push(fullPath);
  }
  return files;
}

function isTestFile(path: string) {
  return (
    /(^|\/)__tests__(\/|$)/.test(path) || /\.(?:test|spec)\.[^.]+$/.test(path)
  );
}

function visit(node: ts.Node, inspect: (node: ts.Node) => void) {
  inspect(node);
  node.forEachChild((child) => visit(child, inspect));
}

function enclosingOwner(node: ts.Node, sourceFile: ts.SourceFile) {
  for (let parent = node.parent; parent; parent = parent.parent) {
    if (!isRuntimeFunctionLike(parent)) continue;
    if (parent.name && ts.isIdentifier(parent.name)) return parent.name.text;
    const declaration = parent.parent;
    if (
      ts.isVariableDeclaration(declaration) &&
      ts.isIdentifier(declaration.name)
    ) {
      return declaration.name.text;
    }
    if (ts.isPropertyAssignment(declaration)) {
      return declaration.name.getText(sourceFile);
    }
  }
  return "<module>";
}

function isRuntimeFunctionLike(
  node: ts.Node,
): node is ts.FunctionLikeDeclaration {
  return (
    ts.isFunctionDeclaration(node) ||
    ts.isMethodDeclaration(node) ||
    ts.isGetAccessorDeclaration(node) ||
    ts.isSetAccessorDeclaration(node) ||
    ts.isConstructorDeclaration(node) ||
    ts.isFunctionExpression(node) ||
    ts.isArrowFunction(node)
  );
}

function forbiddenContextFields(expression: ts.Expression | undefined) {
  if (!expression || !ts.isObjectLiteralExpression(expression)) return [];
  const fields: string[] = [];
  visit(expression, (node) => {
    if (
      (ts.isPropertyAssignment(node) ||
        ts.isShorthandPropertyAssignment(node) ||
        ts.isMethodDeclaration(node)) &&
      propertyName(node.name) &&
      FORBIDDEN_CONTEXT_FIELD.test(propertyName(node.name)!)
    ) {
      fields.push(propertyName(node.name)!);
    }
  });
  return [...new Set(fields)];
}

function propertyName(name: ts.PropertyName) {
  return ts.isIdentifier(name) || ts.isStringLiteralLike(name)
    ? name.text
    : null;
}

function registryKey(item: LogCallsiteRegistryEntry) {
  return `${item.file}|${item.owner}|${item.event}|${item.api}`;
}

function discoveredKey(item: DiscoveredCallsite) {
  return `${item.file}|${item.owner}|${item.event}|${item.api}`;
}

function countByKey(keys: string[]) {
  const counts = new Map<string, number>();
  for (const key of keys) counts.set(key, (counts.get(key) ?? 0) + 1);
  return counts;
}

function location(item: DiscoveredCallsite) {
  return `${item.file}:${item.line}:${item.column}`;
}

function dedupeIssues(issues: LogCorrelationPolicyIssue[]) {
  return [
    ...new Map(
      issues.map((issue) => [`${issue.kind}|${issue.detail}`, issue]),
    ).values(),
  ];
}

function isMainModule() {
  return Boolean(
    process.argv[1] &&
    pathToFileURL(resolve(process.argv[1])).href === import.meta.url,
  );
}

if (isMainModule()) {
  const issues = auditLogCorrelationPolicy();
  if (issues.length > 0) {
    for (const issue of issues) console.error(`${issue.kind}: ${issue.detail}`);
    process.exitCode = 1;
  } else {
    console.log(
      `Request correlation policy passed: ${discoverLogCallsites().length} classified production log callsites.`,
    );
  }
}
