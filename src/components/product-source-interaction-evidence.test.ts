import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import ts from "typescript";

import { PRODUCT_MASTER_REQUIREMENTS } from "./product-master-requirements";
import {
  PRODUCT_SOURCE_INTERACTION_EVIDENCE_FILE,
  PRODUCT_SOURCE_INTERACTION_EVIDENCE_SCOPE,
  PRODUCT_SOURCE_INTERACTION_COMPLETION_REQUIREMENT_IDS,
  PRODUCT_SOURCE_INTERACTION_INVENTORY_SNAPSHOTS,
  PRODUCT_SOURCE_INTERACTION_MASTER_EVIDENCE,
  PRODUCT_SOURCE_INTERACTION_REQUIREMENT_IDS,
  PRODUCT_SOURCE_INTERACTION_TEST_FILE,
  type ProductSourceInteractionInventorySnapshot,
  type ProductSourceInteractionRequirementId,
} from "./product-source-interaction-evidence";

const repositoryRoot = path.resolve(__dirname, "../..");
const sourceRoot = path.join(repositoryRoot, "src");
const appRoot = path.join(sourceRoot, "app");
const expectedRequirementIds = [
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
const expectedCompletionRequirementIds = [
  "COMPLETE.EVIDENCE.navigation-inspected",
] as const;

type SourceMatch = {
  path: string;
  line: number;
  symbol: string;
  kind: string;
  target: string;
};

type SourceInteractionInventory = Record<
  ProductSourceInteractionRequirementId,
  SourceMatch[]
>;

assert.deepEqual(
  [...PRODUCT_SOURCE_INTERACTION_REQUIREMENT_IDS],
  expectedRequirementIds,
  "The source-interaction registry must close exactly the reviewed 26 IDs",
);
assert.deepEqual(
  [...PRODUCT_SOURCE_INTERACTION_COMPLETION_REQUIREMENT_IDS],
  expectedCompletionRequirementIds,
);
assert.deepEqual(
  Object.keys(PRODUCT_SOURCE_INTERACTION_MASTER_EVIDENCE).toSorted(),
  [...expectedRequirementIds, ...expectedCompletionRequirementIds].toSorted(),
  "The evidence mapping must contain the reviewed inventory and its source-inspection completion claim",
);

const productRequirementIds = new Set(
  PRODUCT_MASTER_REQUIREMENTS.map((requirement) => requirement.id),
);
for (const requirementId of [
  ...expectedRequirementIds,
  ...expectedCompletionRequirementIds,
]) {
  assert.ok(
    productRequirementIds.has(requirementId),
    `${requirementId} must remain a durable product requirement`,
  );
  const evidence = PRODUCT_SOURCE_INTERACTION_MASTER_EVIDENCE[requirementId];
  assert.equal(evidence.status, "tested");
  assert.deepEqual(evidence.evidence, [
    PRODUCT_SOURCE_INTERACTION_EVIDENCE_FILE,
    PRODUCT_SOURCE_INTERACTION_TEST_FILE,
  ]);
  for (const evidencePath of evidence.evidence) {
    assert.ok(existsSync(path.join(repositoryRoot, evidencePath)), evidencePath);
  }
}
for (const deliberatelyOpenId of [
  "DISC.SRC.production-pages",
  "SYSTEM.invitation-expired",
  "SYSTEM.invitation-invalid",
]) {
  assert.equal(
    PRODUCT_SOURCE_INTERACTION_MASTER_EVIDENCE[deliberatelyOpenId],
    undefined,
    `${deliberatelyOpenId} must remain outside this source-inspection batch`,
  );
}
assert.match(PRODUCT_SOURCE_INTERACTION_EVIDENCE_SCOPE, /source-static/i);
assert.match(PRODUCT_SOURCE_INTERACTION_EVIDENCE_SCOPE, /does not establish/i);
assert.doesNotMatch(
  readFileSync(
    path.join(repositoryRoot, PRODUCT_SOURCE_INTERACTION_EVIDENCE_FILE),
    "utf8",
  ),
  /(?:from\s+["']node:|require\(["']node:)/,
  "The client-safe evidence module must not import Node built-ins",
);

assertSyntheticMatcherCoverage();

const productionEntryFiles = walkFiles(appRoot)
  .filter(isProductionEntryFile)
  .concat(
    [path.join(sourceRoot, "proxy.ts"), path.join(sourceRoot, "instrumentation.ts")]
      .filter(existsSync),
  )
  .toSorted();
const reachableFiles = collectReachableSourceFiles(productionEntryFiles);
assert.ok(productionEntryFiles.length > 0);
assert.ok(reachableFiles.length > productionEntryFiles.length);
for (const requiredSource of [
  "src/app/feed/page.tsx",
  "src/app/admin/admin-nav.tsx",
  "src/components/header-nav.tsx",
  "src/components/site-footer.tsx",
  "src/components/site-header.tsx",
  "src/components/ui/sheet.tsx",
]) {
  assert.ok(
    reachableFiles.map(repoPath).includes(requiredSource),
    `${requiredSource} must remain production-reachable`,
  );
}
for (const file of reachableFiles) {
  assert.equal(isExcludedSourceFile(file), false, repoPath(file));
}

const inventory = mergeInventories(
  reachableFiles.map((file) =>
    classifySource(repoPath(file), readFileSync(file, "utf8")),
  ),
  );
  const actualSnapshots = snapshotInventory(inventory);
  if (
  JSON.stringify(actualSnapshots) !==
  JSON.stringify(PRODUCT_SOURCE_INTERACTION_INVENTORY_SNAPSHOTS)
) {
  console.error(
    "Actual PRODUCT_SOURCE_INTERACTION_INVENTORY_SNAPSHOTS:\n" +
      JSON.stringify(actualSnapshots, null, 2),
  );
}
assert.deepEqual(
  actualSnapshots,
  PRODUCT_SOURCE_INTERACTION_INVENTORY_SNAPSHOTS,
  "The reviewed interaction inventory changed; inspect the semantic diff before updating its snapshot",
);

const presentIds = expectedRequirementIds.filter(
  (requirementId) => actualSnapshots[requirementId].state === "present",
);
const absentIds = expectedRequirementIds.filter(
  (requirementId) => actualSnapshots[requirementId].state === "absent",
);
assert.equal(presentIds.length + absentIds.length, expectedRequirementIds.length);

console.log(
  `Product source interaction inventory passed: ${reachableFiles.length} reachable files, ${presentIds.length} present categories, ${absentIds.length} inspected-absent categories, 26 discovery closures and one source-inspection completion claim.`,
);

function emptyInventory(): SourceInteractionInventory {
  const inventory = {} as SourceInteractionInventory;
  for (const requirementId of PRODUCT_SOURCE_INTERACTION_REQUIREMENT_IDS) {
    inventory[requirementId] = [];
  }
  return inventory;
}

function mergeInventories(
  inventories: readonly SourceInteractionInventory[],
): SourceInteractionInventory {
  const merged = emptyInventory();
  for (const requirementId of PRODUCT_SOURCE_INTERACTION_REQUIREMENT_IDS) {
    const bySemanticKey = new Map<string, SourceMatch>();
    for (const match of inventories.flatMap((inventory) => inventory[requirementId])) {
      const key = semanticMatch(match);
      if (!bySemanticKey.has(key)) bySemanticKey.set(key, match);
    }
    merged[requirementId] = [...bySemanticKey.values()].toSorted((left, right) =>
      semanticMatch(left).localeCompare(semanticMatch(right)),
    );
  }
  return merged;
}

function snapshotInventory(
  inventory: SourceInteractionInventory,
): Record<
  ProductSourceInteractionRequirementId,
  ProductSourceInteractionInventorySnapshot
> {
  return Object.fromEntries(
    PRODUCT_SOURCE_INTERACTION_REQUIREMENT_IDS.map((requirementId) => {
      const matches = inventory[requirementId];
      const semanticRows = matches.map(semanticMatch).toSorted();
      return [
        requirementId,
        {
          state: semanticRows.length > 0 ? "present" : "absent",
          count: semanticRows.length,
          sha256: createHash("sha256")
            .update(semanticRows.join("\n"))
            .digest("hex"),
        },
      ];
    }),
  ) as Record<
    ProductSourceInteractionRequirementId,
    ProductSourceInteractionInventorySnapshot
  >;
}

function semanticMatch(match: SourceMatch) {
  return [match.path, match.symbol, match.kind, match.target].join("|");
}

function classifySource(
  relativePath: string,
  sourceText: string,
): SourceInteractionInventory {
  const inventory = emptyInventory();
  const sourceFile = ts.createSourceFile(
    relativePath,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    relativePath.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );

  const add = (
    requirementId: ProductSourceInteractionRequirementId,
    node: ts.Node,
    kind: string,
    target = "",
  ) => {
    const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
    inventory[requirementId].push({
      path: relativePath.replace(/\\/g, "/"),
      line: line + 1,
      symbol: owningSymbol(node, sourceFile),
      kind,
      target: compact(target).slice(0, 180),
    });
  };

  visitSource(sourceFile, (node) => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      const moduleName = node.moduleSpecifier.text.toLowerCase();
      if (moduleName.includes("dialog")) {
        add("DISC.SRC.dialogs", node, "dialog-primitive-import", moduleName);
      }
      if (moduleName.includes("popover")) {
        add("DISC.SRC.popovers", node, "popover-primitive-import", moduleName);
      }
      if (moduleName.includes("tooltip")) {
        add("DISC.SRC.tooltips", node, "tooltip-primitive-import", moduleName);
      }
      if (moduleName === "cmdk" || moduleName.includes("command-palette")) {
        add("DISC.SRC.command-palettes", node, "command-primitive-import", moduleName);
      }
    }

    if (ts.isCallExpression(node)) {
      const callName = calledName(node.expression);
      if (callName === "breadcrumbSchema") {
        add("DISC.SRC.breadcrumbs", node, "structured-breadcrumb", callName);
      }
      if (
        ["push", "replace"].includes(callName) &&
        ts.isPropertyAccessExpression(node.expression) &&
        /router|navigation/i.test(node.expression.expression.getText(sourceFile)) &&
        node.arguments[0]
      ) {
        add(
          "DISC.SRC.deep-links",
          node,
          "router-navigation-target",
          node.arguments[0].getText(sourceFile),
        );
      }
      if (
        /^(?:requireAdminProfile|requireModeratorProfile|isModeratorRole|adminNavForRole)$/.test(
          callName,
        )
      ) {
        add("DISC.SRC.role-gated-routes", node, "role-gate-callsite", callName);
      }
      if (/^(?:hasTier|requirePro[A-Za-z]*|assert[A-Za-z]*Tier)$/.test(callName)) {
        add("DISC.SRC.tier-gated-routes", node, "tier-gate-callsite", callName);
      }
    }

    if (
      ts.isNewExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "URL" &&
      node.arguments?.[0]
    ) {
      const target = node.arguments[0].getText(sourceFile);
      if (/^["'`]\//.test(target)) {
        add("DISC.SRC.deep-links", node, "constructed-url-target", target);
      }
    }

    if (ts.isPropertyAssignment(node)) {
      const propertyName = propertyNameText(node.name);
      const target = node.initializer.getText(sourceFile);
      if (
        propertyName === "href" &&
        /(?:invite|invitation)/i.test(target)
      ) {
        add("DISC.SRC.invitation-links", node, "declared-invitation-target", target);
      }
      if (
        propertyName === "href" &&
        /notification/i.test(target)
      ) {
        add("DISC.SRC.notification-links", node, "declared-notification-target", target);
      }
      if (
        propertyName === "href" &&
        relativePath.includes("admin-nav") &&
        /["'`]\/admin(?:\/|["'`])/.test(target)
      ) {
        add("DISC.SRC.admin-navigation", node, "admin-nav-target", target);
      }
      if (propertyName === "minimumRole") {
        add("DISC.SRC.role-gated-routes", node, "declared-minimum-role", target);
      }
    }

    if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) {
      inspectJsxElement(node, sourceFile, relativePath, add);
    }
  });

  return mergeInventories([inventory]);
}

function inspectJsxElement(
  node: ts.JsxElement | ts.JsxSelfClosingElement,
  sourceFile: ts.SourceFile,
  relativePath: string,
  add: (
    requirementId: ProductSourceInteractionRequirementId,
    node: ts.Node,
    kind: string,
    target?: string,
  ) => void,
) {
  const opening = ts.isJsxElement(node) ? node.openingElement : node;
  const tag = opening.tagName.getText(sourceFile);
  const tagLower = tag.toLowerCase();
  const owner = owningSymbol(node, sourceFile);
  const ownerAndPath = `${owner} ${relativePath}`.toLowerCase();
  const className = jsxAttributeValue(opening, "className", sourceFile);
  const href = jsxAttributeValue(opening, "href", sourceFile);
  const role = jsxAttributeValue(opening, "role", sourceFile).toLowerCase();
  const ariaLabel = jsxAttributeValue(opening, "aria-label", sourceFile);
  const ariaModal = jsxAttributeValue(opening, "aria-modal", sourceFile);
  const title = jsxAttributeValue(opening, "title", sourceFile);
  const attributesText = opening.attributes.getText(sourceFile);
  const isLink = /(?:^a$|link$|anchor$)/i.test(tag);
  const isAction = isLink || tagLower === "button" || tagLower === "form" || /button$/i.test(tag);

  if (
    (tag === "HeaderNav" && /desktop/.test(jsxAttributeValue(opening, "variant", sourceFile))) ||
    (tagLower === "nav" && /desktop/.test(`${className} ${ariaLabel}`))
  ) {
    add("DISC.SRC.desktop-navigation", node, "desktop-navigation", tag);
  }
  if (tagLower === "footer") {
    add("DISC.SRC.footer-navigation", node, "footer-navigation-root", tag);
  }
  if (
    /accountlink/i.test(tag) ||
    (tagLower === "nav" && /account/i.test(ariaLabel)) ||
    (isLink && /^[/"'`{]*account(?:\/|$)/i.test(href.replace(/^\//, "account/")) && /accountmenu/i.test(owner))
  ) {
    add("DISC.SRC.account-navigation", node, "account-navigation-target", href || tag);
  }
  if (
    (tagLower === "nav" && /admin/i.test(ariaLabel)) ||
    /adminnavigation/i.test(tag) ||
    (isLink && /^\/admin(?:\/|$)/.test(href) && /adminnav/i.test(ownerAndPath))
  ) {
    add("DISC.SRC.admin-navigation", node, "admin-navigation-surface", href || ariaLabel || tag);
  }
  if (
    /onContextMenu/.test(attributesText) ||
    /contextmenu/i.test(tag) ||
    /post-menu|context-menu/i.test(className)
  ) {
    add(
      "DISC.SRC.context-menus",
      node,
      /onContextMenu/.test(attributesText) ? "context-event-menu" : "context-action-menu",
      tag,
    );
  }
  if (
    /dropdownmenu/i.test(tag) ||
    (tagLower === "details" && /menu|header-nav/.test(`${className} ${ownerAndPath}`))
  ) {
    add("DISC.SRC.dropdown-menus", node, "dropdown-menu", tag);
  }
  if (
    role === "tab" ||
    role === "tablist" ||
    (tagLower === "nav" && /(?:^|\s|-)tabs?(?:\s|-|$)/i.test(className))
  ) {
    add("DISC.SRC.tabs", node, "tab-surface", role || className);
  }
  if (
    /subtab|sub-tab/i.test(`${tag} ${className} ${ariaLabel} ${attributesText}`) ||
    (role === "tablist" && hasJsxAncestorRole(node, sourceFile, "tabpanel"))
  ) {
    add("DISC.SRC.sub-tabs", node, "nested-tab-surface", tag);
  }
  if (
    isLink &&
    (/card/i.test(className) ||
      (node.getText(sourceFile).length < 5_000 && /<article\b/i.test(node.getText(sourceFile))))
  ) {
    add("DISC.SRC.navigation-cards", node, "navigating-card", href || tag);
  }
  if (isLink && href && /search|recipient|result/i.test(ownerAndPath)) {
    add("DISC.SRC.search-result-links", node, "search-result-target", href);
  }
  if (/breadcrumb/i.test(tag) || /breadcrumb/i.test(ariaLabel)) {
    add("DISC.SRC.breadcrumbs", node, "visible-breadcrumb", tag);
  }
  if (
    (tagLower === "nav" && /page|pagination/i.test(ariaLabel)) ||
    (isLink && /(?:[?&](?:before|after|cursor|page)=)/.test(href))
  ) {
    add("DISC.SRC.pagination-links", node, "pagination-target", href || ariaLabel);
  }
  if (/modal/i.test(tag) || /^(?:true|\{true\})$/i.test(ariaModal)) {
    add("DISC.SRC.modals", node, "modal-surface", tag);
  }
  if (/dialog/i.test(tag) || role === "dialog") {
    add("DISC.SRC.dialogs", node, "dialog-surface", tag);
  }
  if (/^(?:Sheet|SheetContent|Drawer|DrawerContent)$/.test(tag)) {
    add("DISC.SRC.drawers", node, "drawer-surface", tag);
  }
  if (/popover/i.test(tag)) {
    add("DISC.SRC.popovers", node, "popover-surface", tag);
  }
  if (
    /tooltip/i.test(tag) ||
    (/^[a-z]/.test(tag) && title && !["iframe", "img", "source"].includes(tagLower))
  ) {
    add(
      "DISC.SRC.tooltips",
      node,
      /tooltip/i.test(tag) ? "tooltip-surface" : "native-title-hint",
      tag,
    );
  }
  if (/commandpalette|commandmenu/i.test(tag)) {
    add("DISC.SRC.command-palettes", node, "command-palette-surface", tag);
  }
  if (isAction) {
    const emptyContext = nearestStateContext(node, sourceFile, "empty", relativePath);
    if (emptyContext) {
      add("DISC.SRC.empty-state-actions", node, "empty-state-action", href || tag);
    }
    const errorContext = nearestStateContext(node, sourceFile, "error", relativePath);
    if (errorContext) {
      add("DISC.SRC.error-state-actions", node, "error-state-action", href || tag);
    }
  }
  if (
    isLink &&
    (/invite|invitation/i.test(`${href} ${owner}`) || /incomingcall/i.test(owner))
  ) {
    add("DISC.SRC.invitation-links", node, "rendered-invitation-target", href || tag);
  }
  if (isLink && /mailto:/i.test(href)) {
    add("DISC.SRC.email-links", node, "mailto-target", href);
  }
  if (
    isLink &&
    (/notification/i.test(`${href} ${owner}`) || /record\.href/.test(href))
  ) {
    add("DISC.SRC.notification-links", node, "rendered-notification-target", href);
  }
  if (
    isLink &&
    (href.includes("${") || href.includes("?") || /encodeURIComponent/.test(href))
  ) {
    add("DISC.SRC.deep-links", node, "rendered-deep-link", href);
  }
  if (/progate/i.test(tag) || /\bminTier\b/.test(attributesText)) {
    add("DISC.SRC.tier-gated-routes", node, "tier-gate-component", tag);
  }
}

function nearestStateContext(
  node: ts.Node,
  sourceFile: ts.SourceFile,
  kind: "empty" | "error",
  relativePath: string,
) {
  if (kind === "error" && /(?:^|\/)error\.tsx?$/.test(relativePath)) {
    return "route-error-boundary";
  }
  const pattern =
    kind === "empty"
      ? /data-state\s*=\s*["'{`]*empty|empty-state|\.length\s*(?:===?|<=)\s*0|!\w+(?:\.\w+)*\.length|\bNo\s+[A-Za-z][^<]{0,90}(?:found|yet|available|recorded|saved|items?|messages?|results?)/i
      : /data-state\s*=\s*["'{`]*error|error-state|\b(?:error|failed|could not|try again|retry)\b/i;
  let current = node.parent;
  for (let depth = 0; current && depth < 7; depth += 1, current = current.parent) {
    if (
      ts.isJsxElement(current) ||
      ts.isConditionalExpression(current) ||
      ts.isIfStatement(current)
    ) {
      const text = current.getText(sourceFile);
      if (text.length <= 4_000 && pattern.test(text)) return compact(text).slice(0, 120);
    }
  }
  return null;
}

function assertSyntheticMatcherCoverage() {
  const positiveFixture = classifySource(
    "src/fixtures/source-interaction-positive.tsx",
    `
      import { Dialog } from "@base-ui/react/dialog";
      import { Popover } from "@base-ui/react/popover";
      import { Tooltip } from "@base-ui/react/tooltip";
      import { CommandPalette } from "cmdk";
      function SearchResults({ record, id }) {
        requireAdminProfile();
        hasTier("free", "pro");
        return <>
          <HeaderNav variant="desktop" />
          <footer><Link href="/privacy">Privacy</Link></footer>
          <nav aria-label="Account navigation"><AccountLink href="/account" /></nav>
          <nav aria-label="Admin sections"><Link href="/admin/users" /></nav>
          <div onContextMenu={() => undefined} />
          <DropdownMenu />
          <div role="tablist"><button role="tab">One</button><div role="tabpanel"><div role="tablist" data-subtab="true" /></div></div>
          <Link href="/dogs/1" className="result-card">Dog</Link>
          <Breadcrumb />
          <nav aria-label="Pagination"><Link href="/items?page=2">Next</Link></nav>
          <Modal aria-modal="true" />
          <Dialog role="dialog" />
          <Drawer />
          <Popover />
          <Tooltip />
          <CommandPalette />
          <section data-state="empty"><Link href="/create">Create</Link></section>
          <section data-state="error"><button>Try again</button></section>
          <Link href="/invite/accept?token=fixture">Accept invitation</Link>
          <a href="mailto:test@example.com">Email</a>
          <Link href={record.href}>Open notification</Link>
          <Link href={\`/dogs/\${id}?from=notification\`}>Open dog</Link>
          <ProGate minTier="pro" />
        </>;
      }
    `,
  );
  for (const requirementId of PRODUCT_SOURCE_INTERACTION_REQUIREMENT_IDS) {
    assert.ok(
      positiveFixture[requirementId].length > 0,
      `positive matcher fixture missing ${requirementId}`,
    );
  }

  const negativeFixture = classifySource(
    "src/fixtures/source-interaction-negative.tsx",
    `
      const prose = "context menu modal dialog drawer tooltip command palette";
      function NegativeFixture() {
        return <div className="bg-popover"><PageHero title="Modal tooltip" /><button role="option" aria-selected="true">Choose</button></div>;
      }
    `,
  );
  for (const requirementId of PRODUCT_SOURCE_INTERACTION_REQUIREMENT_IDS) {
    assert.equal(
      negativeFixture[requirementId].length,
      0,
      `negative matcher fixture falsely matched ${requirementId}`,
    );
  }

  const moduleSpecifiers = collectModuleSpecifiers(
    ts.createSourceFile(
      "module-fixture.ts",
      `import value from "@/value"; export { item } from "./item"; const lazy = import("./lazy");`,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS,
    ),
  );
  assert.deepEqual(moduleSpecifiers, ["./item", "./lazy", "@/value"]);
}

function collectReachableSourceFiles(entryFiles: readonly string[]) {
  const pending = [...entryFiles].toSorted();
  const visited = new Set<string>();
  while (pending.length > 0) {
    const file = pending.shift();
    assert.ok(file);
    const resolvedFile = path.resolve(file);
    if (visited.has(resolvedFile) || isExcludedSourceFile(resolvedFile)) continue;
    visited.add(resolvedFile);
    const sourceFile = parseSourceFile(resolvedFile);
    for (const specifier of collectModuleSpecifiers(sourceFile)) {
      const dependency = resolveSourceModule(resolvedFile, specifier);
      if (dependency && !visited.has(dependency)) pending.push(dependency);
    }
    pending.sort();
  }
  return [...visited].toSorted();
}

function collectModuleSpecifiers(sourceFile: ts.SourceFile) {
  const specifiers = new Set<string>();
  visitSource(sourceFile, (node) => {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      specifiers.add(node.moduleSpecifier.text);
    }
    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments[0] &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      specifiers.add(node.arguments[0].text);
    }
  });
  return [...specifiers].toSorted();
}

function resolveSourceModule(importer: string, specifier: string) {
  if (!specifier.startsWith("@/") && !specifier.startsWith(".")) return null;
  let base = specifier.startsWith("@/")
    ? path.join(sourceRoot, specifier.slice(2))
    : path.resolve(path.dirname(importer), specifier);
  base = base.replace(/\.(?:mjs|cjs|js|jsx)$/, "");
  const candidates = [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    path.join(base, "index.ts"),
    path.join(base, "index.tsx"),
  ];
  for (const candidate of candidates) {
    if (
      existsSync(candidate) &&
      statSync(candidate).isFile() &&
      isWithinSourceRoot(candidate) &&
      !isExcludedSourceFile(candidate)
    ) {
      return path.resolve(candidate);
    }
  }
  return null;
}

function isProductionEntryFile(file: string) {
  return (
    /(?:^|\/)(?:page|layout|route|error|loading|not-found|forbidden|global-error|template|default)\.tsx?$/.test(
      file.replace(/\\/g, "/"),
    ) && !isExcludedSourceFile(file)
  );
}

function isExcludedSourceFile(file: string) {
  const relativePath = repoPath(file).toLowerCase();
  const basename = path.basename(relativePath);
  return (
    /(?:\.test|\.d)\.tsx?$/.test(basename) ||
    relativePath.includes("/design-lab/") ||
    basename.startsWith("design-lab-") ||
    relativePath.includes("/screen-contracts/") ||
    basename.includes("prototype") ||
    basename === "demo-experience-registry.ts" ||
    basename === "product-master-requirements.ts" ||
    basename === "security-master-requirements.ts" ||
    basename.startsWith("master-audit-") ||
    /(?:^|-)evidence\.(?:ts|tsx)$/.test(basename)
  );
}

function isWithinSourceRoot(file: string) {
  const relative = path.relative(sourceRoot, path.resolve(file));
  return relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative);
}

function parseSourceFile(file: string) {
  return ts.createSourceFile(
    file,
    readFileSync(file, "utf8"),
    ts.ScriptTarget.Latest,
    true,
    file.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
}

function visitSource(sourceFile: ts.SourceFile, inspect: (node: ts.Node) => void) {
  function visit(node: ts.Node) {
    inspect(node);
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
}

function walkFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true })
    .toSorted((left, right) => left.name.localeCompare(right.name))
    .flatMap((entry) => {
      const target = path.join(directory, entry.name);
      return entry.isDirectory() ? walkFiles(target) : [target];
    });
}

function jsxAttributeValue(
  opening: ts.JsxOpeningLikeElement,
  name: string,
  sourceFile: ts.SourceFile,
) {
  const attribute = opening.attributes.properties.find(
    (property): property is ts.JsxAttribute =>
      ts.isJsxAttribute(property) && property.name.getText(sourceFile) === name,
  );
  if (!attribute?.initializer) return "";
  if (ts.isStringLiteral(attribute.initializer)) return attribute.initializer.text;
  if (ts.isJsxExpression(attribute.initializer) && attribute.initializer.expression) {
    return attribute.initializer.expression.getText(sourceFile);
  }
  return attribute.initializer.getText(sourceFile);
}

function hasJsxAncestorRole(
  node: ts.Node,
  sourceFile: ts.SourceFile,
  expectedRole: string,
) {
  let current = node.parent;
  while (current) {
    if (ts.isJsxElement(current)) {
      const role = jsxAttributeValue(current.openingElement, "role", sourceFile);
      if (role === expectedRole) return true;
    }
    current = current.parent;
  }
  return false;
}

function owningSymbol(node: ts.Node, sourceFile: ts.SourceFile) {
  let current: ts.Node | undefined = node;
  while (current) {
    if (
      (ts.isFunctionDeclaration(current) ||
        ts.isFunctionExpression(current) ||
        ts.isMethodDeclaration(current)) &&
      current.name
    ) {
      return current.name.getText(sourceFile);
    }
    if (
      (ts.isArrowFunction(current) || ts.isFunctionExpression(current)) &&
      ts.isVariableDeclaration(current.parent) &&
      ts.isIdentifier(current.parent.name)
    ) {
      return current.parent.name.text;
    }
    current = current.parent;
  }
  return path.basename(sourceFile.fileName);
}

function calledName(expression: ts.LeftHandSideExpression) {
  if (ts.isIdentifier(expression)) return expression.text;
  if (ts.isPropertyAccessExpression(expression)) return expression.name.text;
  return expression.getText();
}

function propertyNameText(name: ts.PropertyName) {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) {
    return name.text;
  }
  return name.getText();
}

function compact(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function repoPath(file: string) {
  return path.relative(repositoryRoot, path.resolve(file)).replace(/\\/g, "/");
}
