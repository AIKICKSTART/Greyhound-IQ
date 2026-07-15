import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import ts from "typescript";

type RawSignal = {
  file: string;
  line: number;
  label: string;
};

export type QueueModelDisposition = {
  model: string;
  clientName: string;
  consumers: readonly {
    sourceFile: string;
    sourceSymbol: string;
    implementationFiles: readonly string[];
  }[];
  consumerGap?: string;
};

const SOURCE_EXTENSIONS = new Set([".ts", ".tsx"]);
const QUEUE_PUBLISH_METHODS = new Set(["create", "createMany", "upsert"]);
const WORKER_NAME = /^(?:run.*(?:Maintenance|Cleanup)|process.*Batch|syncLiveData|syncDogProfilesBatch|refreshAggregateMaterializedViews)$/;

export const QUEUE_MODEL_DISPOSITIONS: readonly QueueModelDisposition[] = [
  {
    model: "DeletionJob",
    clientName: "deletionJob",
    consumers: [
      {
        sourceFile: "src/lib/account-service.ts",
        sourceSymbol: "runAccountDeletionMaintenance",
        implementationFiles: ["src/lib/account-service.ts"],
      },
    ],
  },
  {
    model: "Notification",
    clientName: "notification",
    consumers: [
      {
        sourceFile: "src/lib/notification-service.ts",
        sourceSymbol: "runNotificationDeliveryMaintenance",
        implementationFiles: ["src/lib/notification-service.ts"],
      },
    ],
  },
  {
    model: "SignupOutbox",
    clientName: "signupOutbox",
    consumers: [],
    consumerGap:
      "The worker/store are reusable source units, but no concrete signup side-effect handler or production invoker is bound.",
  },
  {
    model: "UsageEvent",
    clientName: "usageEvent",
    consumers: [
      {
        sourceFile: "src/lib/billing/usage-delivery-worker.ts",
        sourceSymbol: "processUsageDeliveryBatch",
        implementationFiles: [
          "src/lib/billing/usage-delivery-service.ts",
          "src/lib/billing/usage-delivery-policy.ts",
          "src/lib/billing/usage-delivery-worker.ts",
          "src/lib/billing/usage-delivery-worker-store.ts",
        ],
      },
    ],
  },
  {
    model: "UsageOutbox",
    clientName: "usageOutbox",
    consumers: [
      {
        sourceFile: "src/lib/billing/usage-delivery-worker.ts",
        sourceSymbol: "processUsageDeliveryBatch",
        implementationFiles: [
          "src/lib/billing/usage-delivery-service.ts",
          "src/lib/billing/usage-delivery-policy.ts",
          "src/lib/billing/usage-delivery-worker.ts",
          "src/lib/billing/usage-delivery-worker-store.ts",
        ],
      },
    ],
  },
  {
    model: "WebhookEvent",
    clientName: "webhookEvent",
    consumers: [
      {
        sourceFile: "src/lib/billing/lago-reducer.ts",
        sourceSymbol: "reduceLagoWebhook",
        implementationFiles: [
          "src/lib/billing/lago-reducer.ts",
          "src/lib/billing/lago-webhooks.ts",
        ],
      },
      {
        sourceFile: "src/lib/billing/stripe-webhooks.ts",
        sourceSymbol: "reduceStripeWebhook",
        implementationFiles: ["src/lib/billing/stripe-webhooks.ts"],
      },
    ],
  },
] as const;

/**
 * Conservative server-component inventory. Every call rooted in any import is
 * included, even when the imported helper is pure, so datastore, identity,
 * provider, and cache calls cannot be hidden by module or naming conventions.
 * Direct callback clients (tx/db/prisma/provider clients) and fetch are also
 * included. This is a source boundary, not runtime or authorization evidence.
 */
export function discoverServerComponentDataCalls(repoRoot = process.cwd()) {
  const appRoot = path.join(repoRoot, "src", "app");
  const signals: RawSignal[] = [];

  for (const file of collectSourceFiles(appRoot).filter((candidate) =>
    candidate.endsWith(`${path.sep}page.tsx`),
  )) {
    const sourceFile = parseSource(file);
    if (hasDirective(sourceFile, "use client")) continue;

    const repoPath = toRepoPath(repoRoot, file);
    const imports = importBindings(sourceFile);
    const dataRoots = new Set(["prisma"]);

    visit(sourceFile, (node) => {
      if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) {
        const initializer = unwrapExpression(node.initializer);
        if (
          initializer &&
          ts.isCallExpression(initializer) &&
          isImportedRoot(initializer.expression, imports)
        ) {
          dataRoots.add(node.name.text);
        }
      }

      if (!ts.isCallExpression(node)) return;
      const root = rootIdentifier(node.expression);
      const imported = root ? imports.get(root) : undefined;
      const callee = compact(node.expression.getText(sourceFile));

      if (imported) {
        signals.push(signal(repoPath, sourceFile, node, callee));
        for (const argument of node.arguments) {
          if (!ts.isArrowFunction(argument) && !ts.isFunctionExpression(argument)) {
            continue;
          }
          for (const parameter of argument.parameters) {
            if (ts.isIdentifier(parameter.name)) dataRoots.add(parameter.name.text);
          }
        }
        return;
      }

      if (callee === "fetch" || (root && dataRoots.has(root))) {
        signals.push(signal(repoPath, sourceFile, node, callee));
      }
    });
  }

  return occurrenceMembers("SERVER-DATA", signals);
}

/** Background worker entry functions, not every helper they call. */
export function discoverBackgroundWorkers(repoRoot = process.cwd()) {
  const signals: RawSignal[] = [];
  const libRoot = path.join(repoRoot, "src", "lib");

  for (const file of collectSourceFiles(libRoot)) {
    const repoPath = toRepoPath(repoRoot, file);
    if (isTestFile(repoPath)) continue;
    const sourceFile = parseSource(file);

    for (const statement of sourceFile.statements) {
      if (
        !ts.isFunctionDeclaration(statement) ||
        !statement.name ||
        !hasModifier(statement, ts.SyntaxKind.ExportKeyword) ||
        !hasModifier(statement, ts.SyntaxKind.AsyncKeyword)
      ) {
        continue;
      }
      const name = statement.name.text;
      const workerFile = /(?:^|\/)[^/]*worker[^/]*\.ts$/.test(repoPath);
      if (!WORKER_NAME.test(name) && !workerFile) continue;
      signals.push(signal(repoPath, sourceFile, statement, name));
    }
  }

  return occurrenceMembers("WORKER", signals);
}

/** Every durable queue/event-row creation in production application source. */
export function discoverQueuePublishers(repoRoot = process.cwd()) {
  const signals: RawSignal[] = [];
  const modelByClientName = new Map(
    QUEUE_MODEL_DISPOSITIONS.map((entry) => [entry.clientName, entry.model]),
  );

  for (const file of collectSourceFiles(path.join(repoRoot, "src"))) {
    const repoPath = toRepoPath(repoRoot, file);
    if (isTestFile(repoPath)) continue;
    const sourceFile = parseSource(file);

    visit(sourceFile, (node) => {
      if (!ts.isCallExpression(node)) return;
      const chain = propertyChain(node.expression);
      if (chain.length < 3) return;
      const method = chain.at(-1)!;
      const clientName = chain.at(-2)!;
      const model = modelByClientName.get(clientName);
      if (!model || !QUEUE_PUBLISH_METHODS.has(method)) return;
      signals.push(
        signal(repoPath, sourceFile, node, `${model}.${method}`),
      );
    });
  }

  return occurrenceMembers("PUBLISH", signals);
}

/**
 * Queue consumers are explicit semantic boundaries. The test verifies every
 * symbol and implementation file, and requires every queue model to have a
 * consumer or an explicit source gap.
 */
export function discoverQueueConsumers(repoRoot = process.cwd()) {
  const members: string[] = [];

  for (const disposition of QUEUE_MODEL_DISPOSITIONS) {
    for (const consumer of disposition.consumers) {
      const sourcePath = path.join(repoRoot, consumer.sourceFile);
      const sourceFile = parseSource(sourcePath);
      let symbolFound = false;
      visit(sourceFile, (node) => {
        if (
          (ts.isFunctionDeclaration(node) ||
            ts.isMethodDeclaration(node) ||
            ts.isVariableDeclaration(node)) &&
          node.name &&
          ts.isIdentifier(node.name) &&
          node.name.text === consumer.sourceSymbol
        ) {
          symbolFound = true;
        }
      });
      if (!symbolFound) {
        throw new Error(
          `queue_consumer_symbol_missing:${consumer.sourceFile}#${consumer.sourceSymbol}`,
        );
      }
      const implementationSource = consumer.implementationFiles
        .map((file) => readFileSync(path.join(repoRoot, file), "utf8"))
        .join("\n");
      if (!implementationSource.includes(disposition.model)) {
        throw new Error(
          `queue_consumer_model_missing:${disposition.model}:${consumer.sourceSymbol}`,
        );
      }
      members.push(
        `CONSUMER ${disposition.model} ${consumer.sourceFile}#${consumer.sourceSymbol}`,
      );
    }
  }

  return members.toSorted();
}

export function discoverQueueModels(repoRoot = process.cwd()) {
  const schema = readFileSync(path.join(repoRoot, "prisma", "schema.prisma"), "utf8");
  const modelNames = new Set(
    [...schema.matchAll(/^model\s+([A-Za-z_][A-Za-z0-9_]*)\s*\{/gmu)].map(
      (match) => match[1],
    ),
  );
  return QUEUE_MODEL_DISPOSITIONS.map((entry) => {
    if (!modelNames.has(entry.model)) {
      throw new Error(`queue_model_missing:${entry.model}`);
    }
    return entry.model;
  }).toSorted();
}

export function discoverDatabaseFunctions(repoRoot = process.cwd()) {
  const grouped = new Map<
    string,
    { scope: string; kind: string; name: string; definitions: RawSignal[] }
  >();

  for (const source of sqlDefinitionSources(repoRoot)) {
    const stripped = stripSqlCommentsPreservingLines(source.content);
    const routinePattern =
      /\bCREATE\s+(?:OR\s+REPLACE\s+)?(FUNCTION|PROCEDURE)\s+((?:"(?:[^"]|"")+"|[A-Za-z_][A-Za-z0-9_$]*)(?:\s*\.\s*(?:"(?:[^"]|"")+"|[A-Za-z_][A-Za-z0-9_$]*))*)\s*\(/giu;
    for (const match of stripped.matchAll(routinePattern)) {
      const kind = match[1].toUpperCase();
      const name = normalizeSqlIdentifier(match[2]);
      const scope = name.startsWith("pg_temp.") ? "app-migration-temp" : source.scope;
      const key = `${scope}:${kind}:${name}`;
      const definition = {
        file: source.file,
        line: lineAt(stripped, match.index ?? 0),
        label: name,
      };
      const existing = grouped.get(key);
      if (existing) existing.definitions.push(definition);
      else grouped.set(key, { scope, kind, name, definitions: [definition] });
    }
  }

  return [...grouped.values()]
    .map((entry) => {
      const latest = entry.definitions.at(-1)!;
      return `${entry.kind} ${entry.scope} ${entry.name} (${entry.definitions.length} definition${entry.definitions.length === 1 ? "" : "s"}; latest ${latest.file})`;
    })
    .toSorted();
}

/** Active triggers after replaying ordered Prisma migration CREATE/DROP events. */
export function discoverDatabaseTriggers(repoRoot = process.cwd()) {
  const active = new Map<string, { name: string; table: string; file: string }>();
  const migrations = migrationSources(repoRoot);

  for (const migration of migrations) {
    const stripped = stripSqlCommentsPreservingLines(migration.content);
    const statementPattern =
      /\b(?:CREATE\s+(?:CONSTRAINT\s+)?TRIGGER|DROP\s+TRIGGER\s+(?:IF\s+EXISTS\s+)?)\b[^;]*;/giu;
    for (const match of stripped.matchAll(statementPattern)) {
      const statement = match[0];
      const create = statement.match(
        /\bCREATE\s+(?:CONSTRAINT\s+)?TRIGGER\s+((?:"(?:[^"]|"")+"|[A-Za-z_][A-Za-z0-9_$]*))[\s\S]*?\bON\s+((?:"(?:[^"]|"")+"|[A-Za-z_][A-Za-z0-9_$]*)(?:\s*\.\s*(?:"(?:[^"]|"")+"|[A-Za-z_][A-Za-z0-9_$]*))*)/iu,
      );
      const drop = statement.match(
        /\bDROP\s+TRIGGER\s+(?:IF\s+EXISTS\s+)?((?:"(?:[^"]|"")+"|[A-Za-z_][A-Za-z0-9_$]*))\s+ON\s+((?:"(?:[^"]|"")+"|[A-Za-z_][A-Za-z0-9_$]*)(?:\s*\.\s*(?:"(?:[^"]|"")+"|[A-Za-z_][A-Za-z0-9_$]*))*)/iu,
      );
      const event = create ?? drop;
      if (!event) throw new Error(`trigger_statement_unparsed:${migration.file}`);
      const name = normalizeSqlIdentifier(event[1]);
      const table = normalizeSqlIdentifier(event[2]);
      const key = `${table}:${name}`;
      if (create) active.set(key, { name, table, file: migration.file });
      else active.delete(key);
    }
  }

  return [...active.values()]
    .map((entry) => `TRIGGER app-db ${entry.table}.${entry.name} (${entry.file})`)
    .toSorted();
}

/** PostgreSQL search/index use plus aggregate materialized-view refresh paths. */
export function discoverSearchIndexOperations(repoRoot = process.cwd()) {
  const files = [
    ...collectSourceFiles(path.join(repoRoot, "src", "lib")),
    path.join(repoRoot, "src", "app", "api", "internal", "aggregate-refresh", "route.ts"),
    ...[
      "benchmark-marketplace-search.ts",
      "prepare-database-indexes.ts",
      "seed-demo-route-fixtures.ts",
    ].map((file) => path.join(repoRoot, "scripts", file)),
    path.join(repoRoot, "prisma", "schema.prisma"),
    ...migrationSources(repoRoot).map((source) => path.join(repoRoot, source.file)),
  ];
  const patterns = [
    ["listing-search-index", /\bListingSearchIndex\b|\blistingSearchIndex\b/i],
    ["full-text", /\b(?:to_tsvector|(?:websearch_|plain|phrase|)to_tsquery|ts_rank(?:_cd)?)\b/i],
    ["trigram-or-prefix-index", /\b(?:pg_trgm|gin_trgm_ops|gist_trgm_ops|text_pattern_ops)\b/i],
    ["indexed-pattern-search", /\bILIKE\b|\bLIKE\s+lower\s*\(/i],
    ["materialized-index", /\bMATERIALIZED\s+VIEW\b|\brefreshAggregateMaterializedView(?:s)?\b/i],
  ] as const;
  const signals: RawSignal[] = [];

  for (const file of [...new Set(files)]) {
    const repoPath = toRepoPath(repoRoot, file);
    if (isTestFile(repoPath)) continue;
    const lines = readFileSync(file, "utf8").split(/\r?\n/);
    lines.forEach((line, index) => {
      for (const [label, pattern] of patterns) {
        if (pattern.test(line)) {
          signals.push({ file: repoPath, line: index + 1, label });
        }
      }
    });
  }

  return occurrenceMembers("SEARCH-INDEX", signals);
}

/** Process-cache, Next cache, browser/HTTP cache, and route cache directives. */
export function discoverCacheOperations(repoRoot = process.cwd()) {
  const signals: RawSignal[] = [];

  for (const file of collectSourceFiles(path.join(repoRoot, "src"))) {
    const repoPath = toRepoPath(repoRoot, file);
    if (isTestFile(repoPath)) continue;
    const sourceFile = parseSource(file);
    const imports = importBindings(sourceFile);

    visit(sourceFile, (node) => {
      if (ts.isCallExpression(node)) {
        const root = rootIdentifier(node.expression);
        const imported = root ? imports.get(root) : undefined;
        const callee = compact(node.expression.getText(sourceFile));
        if (
          imported?.module === "next/cache" ||
          imported?.module === "@/lib/ttl-cache"
        ) {
          signals.push(signal(repoPath, sourceFile, node, callee));
        }

        const firstArgument = node.arguments[0];
        if (
          firstArgument &&
          ts.isStringLiteralLike(firstArgument) &&
          firstArgument.text.toLowerCase() === "cache-control" &&
          /(?:^|\.)(?:set|setRequestHeader)$/.test(callee)
        ) {
          signals.push(signal(repoPath, sourceFile, node, `${callee}:cache-control`));
        }

        if (
          repoPath === "src/lib/ttl-cache.ts" &&
          /^(?:store|inflight)\.(?:get|set|delete|clear)$/.test(callee)
        ) {
          signals.push(signal(repoPath, sourceFile, node, callee));
        }
      }

      if (ts.isPropertyAssignment(node)) {
        const name = propertyName(node.name);
        if (
          name?.toLowerCase() === "cache-control" ||
          (name === "cache" && isCacheMode(node.initializer)) ||
          (name === "revalidate" && isStaticCacheValue(node.initializer))
        ) {
          signals.push(signal(repoPath, sourceFile, node, `property:${name}`));
        }
      }

      if (
        ts.isVariableStatement(node) &&
        hasModifier(node, ts.SyntaxKind.ExportKeyword)
      ) {
        for (const declaration of node.declarationList.declarations) {
          if (
            ts.isIdentifier(declaration.name) &&
            ["dynamic", "fetchCache", "revalidate"].includes(declaration.name.text) &&
            declaration.initializer &&
            isStaticCacheValue(declaration.initializer)
          ) {
            signals.push(
              signal(
                repoPath,
                sourceFile,
                declaration,
                `route:${declaration.name.text}`,
              ),
            );
          }
        }
      }

      if (
        ts.isExpressionStatement(node) &&
        ts.isStringLiteral(node.expression) &&
        node.expression.text.startsWith("use cache")
      ) {
        signals.push(signal(repoPath, sourceFile, node, node.expression.text));
      }
    });
  }

  return occurrenceMembers("CACHE", signals);
}

/** Outbound Supabase RPC callsites; database routine definitions are separate. */
export function discoverRpcCalls(repoRoot = process.cwd()) {
  const signals: RawSignal[] = [];
  for (const file of collectSourceFiles(path.join(repoRoot, "src"))) {
    const repoPath = toRepoPath(repoRoot, file);
    if (isTestFile(repoPath)) continue;
    const sourceFile = parseSource(file);
    visit(sourceFile, (node) => {
      if (!ts.isCallExpression(node)) return;
      const chain = propertyChain(node.expression);
      if (chain.at(-1) !== "rpc") return;
      const procedure = node.arguments[0];
      const name =
        procedure && ts.isStringLiteralLike(procedure)
          ? procedure.text
          : "dynamic-procedure-name";
      signals.push(signal(repoPath, sourceFile, node, name));
    });
  }
  return occurrenceMembers("RPC", signals);
}

/** Supabase Realtime, direct WebSocket, and LiveKit browser connection sites. */
export function discoverRealtimeConnections(repoRoot = process.cwd()) {
  const signals: RawSignal[] = [];
  for (const file of collectSourceFiles(path.join(repoRoot, "src"))) {
    const repoPath = toRepoPath(repoRoot, file);
    if (isTestFile(repoPath) || isRequirementRegistry(repoPath)) continue;
    const sourceFile = parseSource(file);
    const imports = importBindings(sourceFile);
    const hasLiveKitClient = [...imports.values()].some(
      (binding) => binding.module === "livekit-client",
    );

    visit(sourceFile, (node) => {
      if (ts.isCallExpression(node)) {
        const chain = propertyChain(node.expression);
        const method = chain.at(-1);
        if (method === "channel") {
          signals.push(
            signal(
              repoPath,
              sourceFile,
              node,
              `supabase-channel:${expressionLabel(node.arguments[0], sourceFile)}`,
            ),
          );
        } else if (method === "connect" && hasLiveKitClient) {
          signals.push(signal(repoPath, sourceFile, node, "livekit-room-connect"));
        }
      } else if (ts.isNewExpression(node)) {
        const binding = ts.isIdentifier(node.expression)
          ? imports.get(node.expression.text)
          : undefined;
        if (binding?.module === "livekit-client" && binding.importedName === "Room") {
          signals.push(signal(repoPath, sourceFile, node, "livekit-room"));
        } else if (ts.isIdentifier(node.expression) && node.expression.text === "WebSocket") {
          signals.push(
            signal(
              repoPath,
              sourceFile,
              node,
              `websocket:${expressionLabel(node.arguments?.[0], sourceFile)}`,
            ),
          );
        }
      }
    });
  }
  return occurrenceMembers("REALTIME-CONNECTION", signals);
}

/** Realtime publication names and subscription handlers, including generic configured events. */
export function discoverRealtimeEvents(repoRoot = process.cwd()) {
  const signals: RawSignal[] = [];
  for (const file of collectSourceFiles(path.join(repoRoot, "src"))) {
    const repoPath = toRepoPath(repoRoot, file);
    if (isTestFile(repoPath) || isRequirementRegistry(repoPath)) continue;
    const sourceFile = parseSource(file);
    const imports = importBindings(sourceFile);
    const hasLiveKitServer = [...imports.values()].some(
      (binding) => binding.module === "livekit-server-sdk",
    );
    const configuresRealtimeRefresh = sourceFile.text.includes("RealtimeRefresh");

    visit(sourceFile, (node) => {
      if (ts.isCallExpression(node)) {
        const chain = propertyChain(node.expression);
        const method = chain.at(-1);
        const callee = chain.at(-1) ?? "";

        if (/^broadcast(?:Feed|Conversation|Profile)RealtimeEvent$/.test(callee)) {
          const eventIndex = callee === "broadcastFeedRealtimeEvent" ? 0 : 1;
          signals.push(
            signal(
              repoPath,
              sourceFile,
              node,
              `supabase-publish:${expressionLabel(node.arguments[eventIndex], sourceFile)}`,
            ),
          );
        } else if (method === "httpSend") {
          signals.push(
            signal(
              repoPath,
              sourceFile,
              node,
              `supabase-http-publish:${expressionLabel(node.arguments[0], sourceFile)}`,
            ),
          );
        } else if (method === "send") {
          const event = objectPropertyExpression(node.arguments[0], "event");
          const type = objectPropertyExpression(node.arguments[0], "type");
          if (type && expressionLabel(type, sourceFile) === "broadcast") {
            signals.push(
              signal(
                repoPath,
                sourceFile,
                node,
                `supabase-client-publish:${expressionLabel(event, sourceFile)}`,
              ),
            );
          }
        } else if (method === "on") {
          const transport = expressionLabel(node.arguments[0], sourceFile);
          if (["broadcast", "presence"].includes(transport)) {
            const event = objectPropertyExpression(node.arguments[1], "event");
            signals.push(
              signal(
                repoPath,
                sourceFile,
                node,
                `supabase-handler:${transport}:${expressionLabel(event, sourceFile)}`,
              ),
            );
          } else if (transport.startsWith("RoomEvent.")) {
            signals.push(
              signal(repoPath, sourceFile, node, `livekit-handler:${transport}`),
            );
          }
        }
      }

      if (
        configuresRealtimeRefresh &&
        ts.isPropertyAssignment(node) &&
        propertyName(node.name) === "events" &&
        ts.isArrayLiteralExpression(node.initializer)
      ) {
        for (const event of node.initializer.elements) {
          signals.push(
            signal(
              repoPath,
              sourceFile,
              event,
              `supabase-configured-handler:${expressionLabel(event, sourceFile)}`,
            ),
          );
        }
      }

      if (
        hasLiveKitServer &&
        ts.isBinaryExpression(node) &&
        [ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.EqualsEqualsToken].includes(
          node.operatorToken.kind,
        )
      ) {
        const event = liveKitWebhookEventName(node);
        if (event) {
          signals.push(
            signal(repoPath, sourceFile, node, `livekit-webhook-handler:${event}`),
          );
        }
      }
    });
  }
  return occurrenceMembers("REALTIME-EVENT", signals);
}

/** Package-exposed and directly executable scripts with database/cloud state-change signals. */
export function discoverAdminCliOperations(repoRoot = process.cwd()) {
  const scriptRoot = path.join(repoRoot, "scripts");
  const scriptFiles = readdirSync(scriptRoot, { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isFile() &&
        /\.(?:ts|mjs|js|ps1|sh)$/.test(entry.name) &&
        !/\.test\.[^.]+$/.test(entry.name),
    )
    .map((entry) => `scripts/${entry.name}`);
  const prismaSeed = "prisma/seed.ts";
  const statefulFiles = new Map<string, readonly string[]>();
  for (const file of [...scriptFiles, prismaSeed]) {
    const labels = adminStateChangeLabels(readFileSync(path.join(repoRoot, file), "utf8"));
    if (labels.length > 0) statefulFiles.set(file, labels);
  }

  const packageJson = JSON.parse(readFileSync(path.join(repoRoot, "package.json"), "utf8")) as {
    scripts?: Record<string, string>;
  };
  const members: string[] = [];
  const referenced = new Set<string>();
  for (const [name, command] of Object.entries(packageJson.scripts ?? {})) {
    const targets = [...command.matchAll(/(?:scripts|prisma)[\\/][\w./-]+\.(?:ts|mjs|js|ps1|sh)/g)]
      .map((match) => match[0].replaceAll("\\", "/"));
    const labels = [
      ...new Set([
        ...adminStateChangeLabels(command),
        ...targets.flatMap((target) => statefulFiles.get(target) ?? []),
      ]),
    ].toSorted();
    if (labels.length === 0) continue;
    targets.forEach((target) => referenced.add(target));
    members.push(
      `ADMIN-CLI npm:${name} [${labels.join(",")}]${targets.length ? ` -> ${targets.join(",")}` : ""}`,
    );
  }
  for (const [file, labels] of statefulFiles) {
    if (!referenced.has(file)) {
      members.push(`ADMIN-CLI direct:${file} [${labels.join(",")}]`);
    }
  }
  return [...new Set(members)].toSorted();
}

/** Repository-scoped generated/native client search with explicit absence decisions. */
export function discoverClientSources(repoRoot = process.cwd()) {
  const rootEntries = readdirSync(repoRoot, { withFileTypes: true });
  const names = new Set(rootEntries.map((entry) => entry.name.toLowerCase()));
  const packageSource = readFileSync(path.join(repoRoot, "package.json"), "utf8");
  const generated = [...names].filter((name) =>
    /^(?:clients?|generated|sdk|openapi-client)$/.test(name),
  );
  const ios = [...names].filter((name) => /^(?:ios|ipados)$/.test(name));
  const android = [...names].filter((name) => /^(?:android)$/.test(name));
  const generatorConfigured =
    /(?:openapi-generator|swagger-codegen|openapi-typescript|orval|kubb)/i.test(
      packageSource,
    ) ||
    [...names].some((name) =>
      /^(?:openapi-generator|orval|kubb)(?:\.config)?\./.test(name),
    );

  return [
    "CLIENT-SCOPE repository-workspace-root:. (separate repositories are outside this proof)",
    ...(generated.length || generatorConfigured
      ? [
          `CLIENT-PRESENT generated-api-client:${[
            ...generated,
            ...(generatorConfigured ? ["generator-config"] : []),
          ].join(",")}`,
        ]
      : ["CLIENT-ABSENT generated-api-client:no root or generator configuration"]),
    ...(ios.length
      ? ios.map((name) => `CLIENT-PRESENT apple-native:${name}`)
      : ["CLIENT-ABSENT apple-native:no iOS/iPadOS project root"]),
    ...(android.length
      ? android.map((name) => `CLIENT-PRESENT android-native:${name}`)
      : ["CLIENT-ABSENT android-native:no Android project root"]),
  ].toSorted();
}

/** Source-controlled email links/providers/workers plus explicit absence decisions. */
export function discoverEmailWorkerSurface(repoRoot = process.cwd()) {
  const signals: RawSignal[] = [];
  let providerFound = false;
  let workerFound = false;
  for (const directory of [path.join(repoRoot, "src"), path.join(repoRoot, "scripts")]) {
    for (const file of collectSourceFiles(directory)) {
      const repoPath = toRepoPath(repoRoot, file);
      if (isTestFile(repoPath) || isRequirementRegistry(repoPath)) continue;
      const sourceFile = parseSource(file);
      visit(sourceFile, (node) => {
        if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
          if (/^(?:nodemailer|resend|postmark|@sendgrid|mailgun)/i.test(node.moduleSpecifier.text)) {
            providerFound = true;
            signals.push(signal(repoPath, sourceFile, node, `provider:${node.moduleSpecifier.text}`));
          }
        }
        if (
          ((ts.isStringLiteralLike(node) && node.text.includes("mailto:")) ||
            (ts.isTemplateExpression(node) && node.head.text.includes("mailto:")))
        ) {
          signals.push(signal(repoPath, sourceFile, node, "link:mailto"));
        }
        if (ts.isCallExpression(node)) {
          const callee = propertyChain(node.expression).at(-1) ?? "";
          if (/^(?:send|deliver|queue)(?:Email|Mail)/.test(callee)) {
            workerFound = true;
            signals.push(signal(repoPath, sourceFile, node, `delivery:${callee}`));
          }
        }
        if (
          ts.isFunctionDeclaration(node) &&
          node.name &&
          /(?:Email|Mail)(?:Worker|Delivery|Batch)/.test(node.name.text)
        ) {
          workerFound = true;
          signals.push(signal(repoPath, sourceFile, node, `worker:${node.name.text}`));
        }
      });
    }
  }
  const members = occurrenceMembers("EMAIL-SURFACE", signals);
  if (!providerFound) members.push("EMAIL-ABSENT outbound-provider:no runtime email SDK import");
  if (!workerFound) members.push("EMAIL-ABSENT delivery-worker:no source-controlled email worker or sender call");
  members.push("EMAIL-SCOPE repository-source-only:provider-managed email delivery is outside this proof");
  return members.toSorted();
}

export const SERVER_COMPONENT_DATA_MEMBERS = discoverServerComponentDataCalls();
export const BACKGROUND_WORKER_MEMBERS = discoverBackgroundWorkers();
export const QUEUE_PUBLISHER_MEMBERS = discoverQueuePublishers();
export const QUEUE_CONSUMER_MEMBERS = discoverQueueConsumers();
export const DATABASE_FUNCTION_MEMBERS = discoverDatabaseFunctions();
export const DATABASE_TRIGGER_MEMBERS = discoverDatabaseTriggers();
export const SEARCH_INDEX_OPERATION_MEMBERS = discoverSearchIndexOperations();
export const CACHE_OPERATION_MEMBERS = discoverCacheOperations();
export const RPC_CALL_MEMBERS = discoverRpcCalls();
export const REALTIME_CONNECTION_MEMBERS = discoverRealtimeConnections();
export const REALTIME_EVENT_MEMBERS = discoverRealtimeEvents();
export const ADMIN_CLI_MEMBERS = discoverAdminCliOperations();
export const CLIENT_SEARCH_MEMBERS = discoverClientSources();
export const EMAIL_WORKER_SEARCH_MEMBERS = discoverEmailWorkerSurface();

function collectSourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) {
      throw new Error(`source_inventory_symlink_unsupported:${target}`);
    }
    if (entry.isDirectory()) return collectSourceFiles(target);
    if (!SOURCE_EXTENSIONS.has(path.extname(entry.name))) return [];
    return [target];
  });
}

function parseSource(file: string) {
  return ts.createSourceFile(
    file,
    readFileSync(file, "utf8"),
    ts.ScriptTarget.Latest,
    true,
    file.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
}

function visit(sourceFile: ts.SourceFile, inspect: (node: ts.Node) => void) {
  function walk(node: ts.Node) {
    inspect(node);
    ts.forEachChild(node, walk);
  }
  walk(sourceFile);
}

function importBindings(sourceFile: ts.SourceFile) {
  const imports = new Map<
    string,
    { module: string; importedName: string }
  >();
  for (const statement of sourceFile.statements) {
    if (
      !ts.isImportDeclaration(statement) ||
      !ts.isStringLiteral(statement.moduleSpecifier) ||
      !statement.importClause
    ) {
      continue;
    }
    const moduleSpecifier = statement.moduleSpecifier.text;
    if (statement.importClause.name) {
      imports.set(statement.importClause.name.text, {
        module: moduleSpecifier,
        importedName: "default",
      });
    }
    const bindings = statement.importClause.namedBindings;
    if (bindings && ts.isNamedImports(bindings)) {
      for (const element of bindings.elements) {
        imports.set(element.name.text, {
          module: moduleSpecifier,
          importedName: element.propertyName?.text ?? element.name.text,
        });
      }
    } else if (bindings && ts.isNamespaceImport(bindings)) {
      imports.set(bindings.name.text, {
        module: moduleSpecifier,
        importedName: "*",
      });
    }
  }
  return imports;
}

function isImportedRoot(
  expression: ts.LeftHandSideExpression,
  imports: Map<string, { module: string }>,
) {
  const root = rootIdentifier(expression);
  return Boolean(root && imports.has(root));
}

function rootIdentifier(expression: ts.Expression): string | null {
  let current: ts.Expression = expression;
  while (
    ts.isPropertyAccessExpression(current) ||
    ts.isElementAccessExpression(current) ||
    ts.isParenthesizedExpression(current) ||
    ts.isNonNullExpression(current)
  ) {
    current = current.expression;
  }
  return ts.isIdentifier(current) ? current.text : null;
}

function propertyChain(expression: ts.Expression) {
  const parts: string[] = [];
  let current: ts.Expression = expression;
  while (ts.isPropertyAccessExpression(current)) {
    parts.unshift(current.name.text);
    current = current.expression;
  }
  if (ts.isIdentifier(current)) parts.unshift(current.text);
  return parts;
}

function expressionLabel(
  expression: ts.Expression | ts.SpreadElement | undefined,
  sourceFile: ts.SourceFile,
) {
  if (!expression) return "missing";
  if (ts.isStringLiteralLike(expression)) return expression.text;
  if (ts.isPropertyAccessExpression(expression)) {
    return compact(expression.getText(sourceFile));
  }
  return `dynamic:${compact(expression.getText(sourceFile))}`;
}

function objectPropertyExpression(
  expression: ts.Expression | undefined,
  name: string,
) {
  if (!expression || !ts.isObjectLiteralExpression(expression)) return undefined;
  const property = expression.properties.find(
    (candidate): candidate is ts.PropertyAssignment =>
      ts.isPropertyAssignment(candidate) && propertyName(candidate.name) === name,
  );
  if (property) return property.initializer;
  const shorthand = expression.properties.find(
    (candidate): candidate is ts.ShorthandPropertyAssignment =>
      ts.isShorthandPropertyAssignment(candidate) && candidate.name.text === name,
  );
  return shorthand?.name;
}

function liveKitWebhookEventName(node: ts.BinaryExpression) {
  for (const [candidate, value] of [
    [node.left, node.right],
    [node.right, node.left],
  ] as const) {
    if (
      ts.isPropertyAccessExpression(candidate) &&
      candidate.name.text === "event" &&
      ts.isStringLiteralLike(value)
    ) {
      return value.text;
    }
  }
  return null;
}

function adminStateChangeLabels(source: string) {
  const labels: string[] = [];
  const patterns = [
    [
      "database-write",
      /(?:\b(?:prisma|tx|db|client|cleanupPrisma)\.[A-Za-z_$][\w$]*|\b[A-Za-z_$][\w$]*Prisma\.[A-Za-z_$][\w$]*)\.(?:create|createMany|update|updateMany|upsert|delete|deleteMany)\s*\(|\$(?:executeRaw|executeRawUnsafe)\b|\bprisma\s+(?:migrate|db\s+(?:push|seed))\b/i,
    ],
    [
      "cloud-change",
      /\b(?:gcloud|Invoke-Gcloud)\b[\s\S]{0,160}\b(?:deploy|create|update|delete|add-iam-policy-binding|set-iam-policy|versions\s+add|services\s+enable)\b/i,
    ],
    ["terraform-change", /\bterraform\s+(?:apply|destroy|import|taint)\b/i],
    ["container-change", /\bdocker\s+compose\b[\s\S]{0,80}\b(?:up|down|restart)\b/i],
    [
      "storage-write",
      /\.(?:upload|remove)\s*\(|\b(?:uploadSiteAssets|createSignedUpload)\s*\(/,
    ],
    [
      "worker-mutation",
      /\b(?:run[A-Za-z]*(?:Maintenance|Cleanup)|processSignupAcceptanceBatch|syncLiveData|syncDogProfilesBatch|refreshAggregateMaterializedViews)\s*\(/,
    ],
    [
      "http-mutation",
      /\bfetch\s*\([\s\S]{0,500}\bmethod\s*:\s*["'](?:POST|PUT|PATCH|DELETE)["']/i,
    ],
  ] as const;
  for (const [label, pattern] of patterns) {
    if (pattern.test(source)) labels.push(label);
  }
  return labels.toSorted();
}

function unwrapExpression(expression: ts.Expression | undefined) {
  let current = expression;
  while (
    current &&
    (ts.isAwaitExpression(current) ||
      ts.isParenthesizedExpression(current) ||
      ts.isAsExpression(current) ||
      ts.isSatisfiesExpression(current) ||
      ts.isNonNullExpression(current))
  ) {
    current = current.expression;
  }
  return current;
}

function hasDirective(sourceFile: ts.SourceFile, directive: string) {
  for (const statement of sourceFile.statements) {
    if (
      !ts.isExpressionStatement(statement) ||
      !ts.isStringLiteral(statement.expression)
    ) {
      return false;
    }
    if (statement.expression.text === directive) return true;
  }
  return false;
}

function hasModifier(node: ts.Node, kind: ts.SyntaxKind) {
  return Boolean(ts.canHaveModifiers(node) && ts.getModifiers(node)?.some((modifier) => modifier.kind === kind));
}

function propertyName(name: ts.PropertyName) {
  if (ts.isIdentifier(name) || ts.isStringLiteralLike(name)) return name.text;
  return null;
}

function isCacheMode(node: ts.Expression) {
  return (
    ts.isStringLiteralLike(node) &&
    ["default-cache", "force-cache", "no-cache", "no-store", "only-cache"].includes(
      node.text,
    )
  );
}

function isStaticCacheValue(node: ts.Expression) {
  return (
    ts.isStringLiteralLike(node) ||
    ts.isNumericLiteral(node) ||
    node.kind === ts.SyntaxKind.FalseKeyword ||
    node.kind === ts.SyntaxKind.TrueKeyword
  );
}

function occurrenceMembers(prefix: string, rawSignals: readonly RawSignal[]) {
  const signals = [...rawSignals].sort(
    (left, right) =>
      compareText(left.file, right.file) ||
      left.line - right.line ||
      compareText(left.label, right.label),
  );
  const totals = new Map<string, number>();
  for (const entry of signals) {
    const key = `${entry.file}#${entry.label}`;
    totals.set(key, (totals.get(key) ?? 0) + 1);
  }
  const seen = new Map<string, number>();
  return signals
    .map((entry) => {
      const key = `${entry.file}#${entry.label}`;
      const occurrence = (seen.get(key) ?? 0) + 1;
      seen.set(key, occurrence);
      const total = totals.get(key)!;
      return `${prefix} ${key}${total > 1 ? ` [${occurrence}/${total}]` : ""}`;
    })
    .toSorted();
}

function signal(
  repoPath: string,
  sourceFile: ts.SourceFile,
  node: ts.Node,
  label: string,
): RawSignal {
  return {
    file: repoPath,
    line: sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1,
    label,
  };
}

function sqlDefinitionSources(repoRoot: string) {
  return [
    ...migrationSources(repoRoot).map((source) => ({ ...source, scope: "app-db" })),
    ...readdirSync(path.join(repoRoot, "scripts", "sql"), { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith(".sql"))
      .map((entry) => {
        const file = `scripts/sql/${entry.name}`;
        return {
          file,
          content: readFileSync(path.join(repoRoot, file), "utf8"),
          scope: entry.name.includes("realtime")
            ? "supabase-realtime-db"
            : "supabase-storage-db",
        };
      }),
  ];
}

function migrationSources(repoRoot: string) {
  const migrationRoot = path.join(repoRoot, "prisma", "migrations");
  return readdirSync(migrationRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const file = `prisma/migrations/${entry.name}/migration.sql`;
      return {
        file,
        content: readFileSync(path.join(repoRoot, file), "utf8"),
      };
    })
    .toSorted((left, right) => compareText(left.file, right.file));
}

function stripSqlCommentsPreservingLines(source: string) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (comment) =>
      comment.replace(/[^\n]/g, " "),
    )
    .replace(/--[^\n]*/g, (comment) => " ".repeat(comment.length));
}

function normalizeSqlIdentifier(value: string) {
  return value.replace(/\s+/g, "").replaceAll('"', "").toLowerCase();
}

function lineAt(source: string, index: number) {
  return source.slice(0, index).split("\n").length;
}

function isTestFile(repoPath: string) {
  return /(?:^|\/)(?:__tests__)(?:\/|$)|\.(?:test|spec)\.[^.]+$/.test(repoPath);
}

function isRequirementRegistry(repoPath: string) {
  return /(?:master-requirements|preproduction-requirements)\.tsx?$/.test(repoPath);
}

function toRepoPath(repoRoot: string, file: string) {
  return path.relative(repoRoot, file).replaceAll("\\", "/");
}

function compact(value: string) {
  return value.replace(/\s+/g, "");
}

function compareText(left: string, right: string) {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}
