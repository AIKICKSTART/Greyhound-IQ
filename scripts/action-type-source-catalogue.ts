import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import ts from "typescript";

import {
  PRODUCT_ACTION_TYPE_CONTROL_CATALOGUE_REQUIREMENT_IDS,
  type ProductActionTypeControlCatalogueRequirementId,
} from "../src/components/product-action-type-control-catalogue-evidence";

export type ActionTypeSourceControl = {
  category: ProductActionTypeControlCatalogueRequirementId;
  controlId: string;
  sourcePath: string;
  symbol: string;
  primitive: string;
  signature: string;
  line: number;
};

export type ProductionActionTypeControlCatalogue = Readonly<
  Record<
    ProductActionTypeControlCatalogueRequirementId,
    readonly ActionTypeSourceControl[]
  >
>;

const NON_PRODUCTION_ROUTE_PREFIXES = [
  "src/app/account/appearance/",
  "src/app/design-lab/",
  "src/app/feed/device-preview/",
  "src/app/marketplace/design-lab/",
] as const;

export function buildProductionActionTypeControlCatalogue(
  repositoryRoot = process.cwd(),
): ProductionActionTypeControlCatalogue {
  const sourceRoot = path.join(repositoryRoot, "src");
  const entryFiles = walkFiles(path.join(sourceRoot, "app"))
    .filter((file) => isProductionEntryFile(repositoryRoot, file))
    .concat(
      [path.join(sourceRoot, "proxy.ts"), path.join(sourceRoot, "instrumentation.ts")]
        .filter(existsSync),
    )
    .toSorted();
  const reachableFiles = collectReachableSourceFiles(
    repositoryRoot,
    sourceRoot,
    entryFiles,
  );
  const controls = reachableFiles
    .filter((file) => file.endsWith(".tsx"))
    .flatMap((file) =>
      inspectSource(
        repositoryPath(repositoryRoot, file),
        readFileSync(file, "utf8"),
      ),
    );

  return Object.fromEntries(
    PRODUCT_ACTION_TYPE_CONTROL_CATALOGUE_REQUIREMENT_IDS.map(
      (requirementId) => [
        requirementId,
        assignStableControlIds(
          controls.filter(({ category }) => category === requirementId),
        ),
      ],
    ),
  ) as unknown as ProductionActionTypeControlCatalogue;
}

export function classifyActionTypeSource(
  relativePath: string,
  sourceText: string,
): ProductionActionTypeControlCatalogue {
  const controls = inspectSource(relativePath.replace(/\\/g, "/"), sourceText);
  return Object.fromEntries(
    PRODUCT_ACTION_TYPE_CONTROL_CATALOGUE_REQUIREMENT_IDS.map(
      (requirementId) => [
        requirementId,
        assignStableControlIds(
          controls.filter(({ category }) => category === requirementId),
        ),
      ],
    ),
  ) as unknown as ProductionActionTypeControlCatalogue;
}

export function collectProductionReachableSourcePaths(
  repositoryRoot = process.cwd(),
) {
  const sourceRoot = path.join(repositoryRoot, "src");
  const entryFiles = walkFiles(path.join(sourceRoot, "app"))
    .filter((file) => isProductionEntryFile(repositoryRoot, file))
    .concat(
      [path.join(sourceRoot, "proxy.ts"), path.join(sourceRoot, "instrumentation.ts")]
        .filter(existsSync),
    )
    .toSorted();
  return collectReachableSourceFiles(repositoryRoot, sourceRoot, entryFiles).map(
    (file) => repositoryPath(repositoryRoot, file),
  );
}

function inspectSource(relativePath: string, sourceText: string) {
  const sourceFile = ts.createSourceFile(
    relativePath,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const lucideIconNames = collectNamedImportNames(sourceFile, "lucide-react");
  const matches: Omit<ActionTypeSourceControl, "controlId">[] = [];

  visitSource(sourceFile, (node) => {
    if (!ts.isJsxElement(node) && !ts.isJsxSelfClosingElement(node)) return;
    const opening = ts.isJsxElement(node) ? node.openingElement : node;
    const primitive = opening.tagName.getText(sourceFile);
    const primitiveLower = primitive.toLowerCase();
    const role = jsxAttributeValue(opening, "role", sourceFile).toLowerCase();
    const inputType = jsxAttributeValue(opening, "type", sourceFile).toLowerCase();
    const name = jsxAttributeValue(opening, "name", sourceFile).toLowerCase();
    const placeholder = jsxAttributeValue(
      opening,
      "placeholder",
      sourceFile,
    ).toLowerCase();
    const ariaLabel = jsxAttributeValue(
      opening,
      "aria-label",
      sourceFile,
    ).toLowerCase();
    const ariaHasPopup = jsxAttributeValue(
      opening,
      "aria-haspopup",
      sourceFile,
    ).toLowerCase();
    const className = jsxAttributeValue(
      opening,
      "className",
      sourceFile,
    ).toLowerCase();
    const symbol = owningSymbol(node, sourceFile);
    const signature = controlSignature(node, opening, sourceFile);
    const categories: ProductActionTypeControlCatalogueRequirementId[] = [];

    if (isButtonControl(primitiveLower, role, inputType)) {
      categories.push("ACTION.TYPE.buttons");
    }
    if (isLinkControl(primitiveLower, role)) {
      categories.push("ACTION.TYPE.links");
    }
    if (
      isInteractiveCardControl(
        node,
        opening,
        primitive,
        primitiveLower,
        role,
        inputType,
        className,
        sourceFile,
      )
    ) {
      categories.push("ACTION.TYPE.cards");
    }
    if (
      isButtonControl(primitiveLower, role, inputType) &&
      isIconOnlyControl(node, sourceFile, lucideIconNames)
    ) {
      categories.push("ACTION.TYPE.icon-buttons");
    }
    if (
      role === "tab" ||
      /^(?:tabs?trigger|tabbutton|tabcontrol)$/i.test(primitive) ||
      (isLinkOrButton(primitiveLower) &&
        hasJsxAttribute(opening, "aria-current") &&
        hasAncestorTabSurface(node, sourceFile))
    ) {
      categories.push("ACTION.TYPE.tabs");
    }
    if (
      primitiveLower === "summary" ||
      /^(?:accordiontrigger|accordionbutton)$/i.test(primitive)
    ) {
      categories.push("ACTION.TYPE.accordions");
    }
    if (
      ((primitiveLower === "input" ||
        primitiveLower === "select" ||
        primitive === "AutoSubmitSelect") &&
        inputType !== "hidden" &&
        /^(?:sort|sortorder)$/.test(name)) ||
      (isLinkOrButton(primitiveLower) && hasAncestorSortSurface(node, sourceFile))
    ) {
      categories.push("ACTION.TYPE.sort");
    }
    if (
      hasJsxAttribute(opening, "aria-pressed") ||
      role === "switch" ||
      /^(?:toggle|togglebutton|switch|switchbutton)$/i.test(primitive)
    ) {
      categories.push("ACTION.TYPE.toggles");
    }
    if (
      isLinkOrButton(primitiveLower) &&
      (hasAncestorPaginationSurface(node, sourceFile) ||
        /\b(?:load more|view all\s+.*comments?)\b/i.test(
          node.getText(sourceFile),
        ))
    ) {
      categories.push("ACTION.TYPE.pagination");
    }
    if (
      role === "menuitem" ||
      ariaHasPopup === "menu" ||
      /^(?:dropdownmenutrigger|contextmenutrigger|menubartrigger|navigationmenutrigger|menubutton|menutrigger)$/i.test(
        primitive,
      ) ||
      (primitiveLower === "summary" &&
        (symbol === "HeaderNav" ||
          /(?:menu|options|choose a reaction)/i.test(
            `${className} ${signature}`,
          ))) ||
      (primitive === "SheetTrigger" &&
        /(?:menu|navigation)/i.test(signature))
    ) {
      categories.push("ACTION.TYPE.menus");
    }
    if (
      isFilterControl(node, opening, primitive, primitiveLower, inputType, sourceFile)
    ) {
      categories.push("ACTION.TYPE.filters");
    }
    if (
      isButtonControl(primitiveLower, role, inputType) &&
      (/(?:^|[^a-z])(?:save|saved|saving|unsave)(?:[^a-z]|$)/i.test(
        node.getText(sourceFile),
      ) || /save.*button/i.test(primitive))
    ) {
      categories.push("ACTION.TYPE.saves");
    }
    if (
      isButtonControl(primitiveLower, role, inputType) &&
      (/(?:reaction|(?:^|[^a-z])(?:like|liked|unlike)(?:[^a-z]|$))/i.test(
        node.getText(sourceFile),
      ) || /reaction.*button/i.test(primitive))
    ) {
      categories.push("ACTION.TYPE.likes");
    }
    if (
      isButtonControl(primitiveLower, role, inputType) &&
      (/(?:^|[^a-z])(?:share|shared|sharing|unshare)(?:[^a-z]|$)/i.test(
        node.getText(sourceFile),
      ) || /share.*(?:button|control)/i.test(primitive))
    ) {
      categories.push("ACTION.TYPE.shares");
    }
    if (
      (relativePath === "src/components/conversation-call-panel.tsx" &&
        (isLinkOrButton(primitiveLower) || primitiveLower === "select")) ||
      (relativePath === "src/components/hub/hub-incoming-call.tsx" &&
        isButtonControl(primitiveLower, role, inputType)) ||
      (isLinkOrButton(primitiveLower) &&
        /(?:^|[^a-z])(?:call|calling|calls)(?:[^a-z]|$)/i.test(
          node.getText(sourceFile),
        )) ||
      /call.*(?:button|control)/i.test(primitive)
    ) {
      categories.push("ACTION.TYPE.calls");
    }
    if (
      ((relativePath.startsWith("src/app/messages/") ||
        relativePath === "src/components/instant-message-composer.tsx" ||
        relativePath === "src/components/hub/hub-conversation-dock.tsx") &&
        isMessageSurfaceControl(primitiveLower, role, inputType)) ||
      ((isLinkOrButton(primitiveLower) ||
        (primitiveLower === "textarea" && name === "message")) &&
        /(?:^|[^a-z])(?:message|messages|messaging|chat|conversation|conversations)(?:[^a-z]|$)/i.test(
          node.getText(sourceFile),
        ) &&
        !/(?:^|[^a-z])(?:success|error|status|validation)\s+message(?:[^a-z]|$)/i.test(
          node.getText(sourceFile),
        )) ||
      /(?:message|chat).*?(?:button|composer|control)/i.test(primitive)
    ) {
      categories.push("ACTION.TYPE.messages");
    }
    if (
      (relativePath === "src/components/feed-comments-panel.tsx" &&
        isCommentSurfaceControl(primitiveLower, role, inputType)) ||
      (symbol === "InstantFeedCommentForm" &&
        isMessageSurfaceControl(primitiveLower, role, inputType)) ||
      (isLinkOrButton(primitiveLower) &&
        (/(?:^|[^a-z])(?:comment|comments|commenting)(?:[^a-z]|$)/i.test(
          node.getText(sourceFile),
        ) ||
          (relativePath.startsWith("src/app/forum/") &&
            /(?:^|[^a-z])(?:reply|replies)(?:[^a-z]|$)/i.test(
              node.getText(sourceFile),
            )))) ||
      /comment.*?(?:button|form|control)/i.test(primitive)
    ) {
      categories.push("ACTION.TYPE.comments");
    }
    if (
      (relativePath.startsWith("src/app/account/notifications/") &&
        isMessageSurfaceControl(primitiveLower, role, inputType)) ||
      (isLinkOrButton(primitiveLower) &&
        /(?:^|[^a-z])(?:notification|notifications|notify)(?:[^a-z]|$)/i.test(
          node.getText(sourceFile),
        )) ||
      /notification.*?(?:button|control|link)/i.test(primitive)
    ) {
      categories.push("ACTION.TYPE.notifications");
    }
    if (
      ((/^src\/app\/(?:pricing\/|account\/billing\/|admin\/(?:billing|billing-events|invoices|payments|subscriptions)\/)/.test(
        relativePath,
      ) || /^(?:AdminPlanForms|PlanSelect|CheckoutButton)$/.test(symbol)) &&
        isCommentSurfaceControl(primitiveLower, role, inputType)) ||
      (isLinkOrButton(primitiveLower) &&
        /(?:^|[^a-z])(?:billing|checkout|subscription|subscriptions|payment|payments|invoice|invoices|pricing|plan|plans)(?:[^a-z]|$)/i.test(
          node.getText(sourceFile),
        )) ||
      /(?:billing|checkout|payment|subscription).*?(?:button|control|link)/i.test(
        primitive,
      )
    ) {
      categories.push("ACTION.TYPE.billing");
    }
    if (
      ((relativePath.startsWith("src/app/admin/") ||
        relativePath.startsWith("src/components/admin/")) &&
        isCommentSurfaceControl(primitiveLower, role, inputType)) ||
      (isLinkOrButton(primitiveLower) &&
        /(?:^|[^a-z])(?:admin|administrator|administration)(?:[^a-z]|$)/i.test(
          node.getText(sourceFile),
        )) ||
      /admin.*?(?:button|control|link)/i.test(primitive)
    ) {
      categories.push("ACTION.TYPE.admin");
    }
    if (
      ((/^src\/components\/(?:media-(?:attachment-fields|focal-point-editor|alignment-upload)|listing-card-media-carousel|race-replay-player|processed-video)\.tsx$/.test(
        relativePath,
      ) || /^(?:MessageAttachment|ListingAttachment|FeedMedia)$/.test(symbol)) &&
        (isCommentSurfaceControl(primitiveLower, role, inputType) ||
          ((primitiveLower === "video" || primitiveLower === "audio") &&
            hasJsxAttribute(opening, "controls")))) ||
      (isLinkOrButton(primitiveLower) &&
        /(?:^|[^a-z])(?:media|image|photo|video|attachment|upload|replay|carousel)(?:[^a-z]|$)/i.test(
          signature,
        )) ||
      (symbol === "EditCustomPage" &&
        isButtonControl(primitiveLower, role, inputType) &&
        /(?:media|image|cardurl)/i.test(node.getText(sourceFile))) ||
      (primitiveLower === "input" && inputType === "file") ||
      /(?:media|image|photo|video|attachment|upload|replay).*?(?:button|control|fields|editor|carousel|player|upload)/i.test(
        primitive,
      ) ||
      /^(?:ProcessedVideo|RaceReplayPlayer)$/i.test(primitive)
    ) {
      categories.push("ACTION.TYPE.media");
    }
    if (
      ((primitiveLower === "input" ||
        primitiveLower === "select" ||
        primitive === "AutoSubmitSelect") &&
        inputType !== "hidden" &&
        (["date", "datetime-local", "month", "week"].includes(inputType) ||
          name === "date" ||
          /\bdate\b/.test(ariaLabel))) ||
      (isLinkOrButton(primitiveLower) && /(?:^|-)date-chip(?:-|$)/.test(className))
    ) {
      categories.push("ACTION.TYPE.dates");
    }
    if (
      ((primitiveLower === "input" || primitive === "Input") &&
        inputType !== "hidden" &&
        (inputType === "search" ||
          name === "q" ||
          role === "searchbox" ||
          (role === "combobox" &&
            /search/.test(`${placeholder} ${ariaLabel}`)) ||
          /search/.test(placeholder) ||
          /search/.test(ariaLabel))) ||
      /^(?:searchinput|searchfield)$/i.test(primitive)
    ) {
      categories.push("ACTION.TYPE.search");
    }
    if (
      (primitiveLower === "input" && inputType === "checkbox") ||
      /^(?:checkbox|checkboxitem|checkboxinput)$/i.test(primitive)
    ) {
      categories.push("ACTION.TYPE.checkboxes");
    }
    if (
      (primitiveLower === "input" && inputType === "radio") ||
      /^(?:radiogroupitem|radiobutton|radioinput)$/i.test(primitive)
    ) {
      categories.push("ACTION.TYPE.radios");
    }
    if (
      primitiveLower === "select" ||
      /^(?:selecttrigger|selectinput|autosubmitselect|planselect)$/i.test(
        primitive,
      )
    ) {
      categories.push("ACTION.TYPE.selects");
    }
    if (
      (primitiveLower === "input" && inputType === "range") ||
      /^(?:slider|rangeslider)$/i.test(primitive)
    ) {
      categories.push("ACTION.TYPE.sliders");
    }
    if (primitiveLower === "input" && inputType === "file") {
      categories.push("ACTION.TYPE.uploads");
    }
    if (
      (primitiveLower === "video" && hasJsxAttribute(opening, "controls")) ||
      /^(?:processedvideo|racereplayplayer|videoplayer)$/i.test(primitive)
    ) {
      categories.push("ACTION.TYPE.video");
    }

    for (const category of categories) {
      const { line } = sourceFile.getLineAndCharacterOfPosition(
        opening.getStart(sourceFile),
      );
      matches.push({
        category,
        sourcePath: relativePath,
        symbol,
        primitive,
        signature,
        line: line + 1,
      });
    }
  });

  return matches;
}

function assignStableControlIds(
  matches: readonly Omit<ActionTypeSourceControl, "controlId">[],
) {
  const sorted = [...matches].toSorted((left, right) =>
    controlSemanticKey(left).localeCompare(controlSemanticKey(right)),
  );
  const totals = new Map<string, number>();
  for (const match of sorted) {
    const key = controlSemanticKey(match);
    totals.set(key, (totals.get(key) ?? 0) + 1);
  }
  const seen = new Map<string, number>();
  return sorted.map((match): ActionTypeSourceControl => {
    const key = controlSemanticKey(match);
    const occurrence = (seen.get(key) ?? 0) + 1;
    seen.set(key, occurrence);
    return {
      ...match,
      controlId: totals.get(key) === 1 ? key : `${key}::instance-${occurrence}`,
    };
  });
}

function controlSemanticKey(
  control: Omit<ActionTypeSourceControl, "controlId" | "line">,
) {
  return [
    control.sourcePath,
    control.symbol,
    control.category,
    control.primitive,
    control.signature,
  ].join("::");
}

function controlSignature(
  node: ts.JsxElement | ts.JsxSelfClosingElement,
  opening: ts.JsxOpeningLikeElement,
  sourceFile: ts.SourceFile,
) {
  const attributes = [
    "id",
    "name",
    "type",
    "role",
    "aria-label",
    "placeholder",
    "accept",
    "src",
  ]
    .map((name) => {
      const value = jsxAttributeValue(opening, name, sourceFile);
      return value ? `${name}=${compact(value)}` : "";
    })
    .filter(Boolean);
  if (hasJsxAttribute(opening, "controls")) attributes.push("controls=true");
  const text = ts.isJsxElement(node)
    ? compact(
        node.children
          .filter(ts.isJsxText)
          .map((child) => child.text)
          .join(" "),
      )
    : "";
  if (text) attributes.push(`text=${text.slice(0, 80)}`);
  return attributes.join("|") || "unlabelled-source-control";
}

function collectReachableSourceFiles(
  repositoryRoot: string,
  sourceRoot: string,
  entryFiles: readonly string[],
) {
  const pending = [...entryFiles].toSorted();
  const visited = new Set<string>();
  while (pending.length > 0) {
    const file = pending.shift();
    if (!file) continue;
    const resolvedFile = path.resolve(file);
    if (
      visited.has(resolvedFile) ||
      isExcludedSourceFile(repositoryRoot, resolvedFile)
    ) {
      continue;
    }
    visited.add(resolvedFile);
    const sourceFile = parseSourceFile(resolvedFile);
    for (const specifier of collectModuleSpecifiers(sourceFile)) {
      const dependency = resolveSourceModule(sourceRoot, resolvedFile, specifier);
      if (
        dependency &&
        !visited.has(dependency) &&
        !isExcludedSourceFile(repositoryRoot, dependency)
      ) {
        pending.push(dependency);
      }
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

function resolveSourceModule(
  sourceRoot: string,
  importer: string,
  specifier: string,
) {
  if (!specifier.startsWith("@/") && !specifier.startsWith(".")) return null;
  let base = specifier.startsWith("@/")
    ? path.join(sourceRoot, specifier.slice(2))
    : path.resolve(path.dirname(importer), specifier);
  base = base.replace(/\.(?:mjs|cjs|js|jsx)$/, "");
  for (const candidate of [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    path.join(base, "index.ts"),
    path.join(base, "index.tsx"),
  ]) {
    if (
      existsSync(candidate) &&
      statSync(candidate).isFile() &&
      isWithinSourceRoot(sourceRoot, candidate)
    ) {
      return path.resolve(candidate);
    }
  }
  return null;
}

function isProductionEntryFile(repositoryRoot: string, file: string) {
  const relativePath = repositoryPath(repositoryRoot, file);
  return (
    /(?:^|\/)(?:page|layout|route|error|loading|not-found|forbidden|global-error|template|default)\.tsx?$/.test(
      relativePath,
    ) &&
    !NON_PRODUCTION_ROUTE_PREFIXES.some((prefix) =>
      relativePath.startsWith(prefix),
    ) &&
    !isExcludedSourceFile(repositoryRoot, file)
  );
}

function isExcludedSourceFile(repositoryRoot: string, file: string) {
  const relativePath = repositoryPath(repositoryRoot, file).toLowerCase();
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

function isWithinSourceRoot(sourceRoot: string, file: string) {
  const relativePath = path.relative(sourceRoot, path.resolve(file));
  return (
    relativePath !== "" &&
    !relativePath.startsWith("..") &&
    !path.isAbsolute(relativePath)
  );
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
  if (
    ts.isJsxExpression(attribute.initializer) &&
    attribute.initializer.expression
  ) {
    return attribute.initializer.expression.getText(sourceFile);
  }
  return attribute.initializer.getText(sourceFile);
}

function hasJsxAttribute(opening: ts.JsxOpeningLikeElement, name: string) {
  return opening.attributes.properties.some(
    (property) =>
      ts.isJsxAttribute(property) && property.name.getText() === name,
  );
}

function isLinkOrButton(primitiveLower: string) {
  return (
    primitiveLower === "a" ||
    primitiveLower === "button" ||
    (primitiveLower !== "externallink" && primitiveLower.endsWith("link")) ||
    primitiveLower.endsWith("button")
  );
}

function isButtonControl(
  primitiveLower: string,
  role: string,
  inputType: string,
) {
  return (
    role === "button" ||
    primitiveLower === "button" ||
    primitiveLower.endsWith("button") ||
    (primitiveLower === "input" &&
      ["button", "image", "reset", "submit"].includes(inputType))
  );
}

function isLinkControl(primitiveLower: string, role: string) {
  return (
    role === "link" ||
    primitiveLower === "a" ||
    primitiveLower === "link" ||
    (primitiveLower !== "externallink" && primitiveLower.endsWith("link"))
  );
}

function isInteractiveCardControl(
  node: ts.JsxElement | ts.JsxSelfClosingElement,
  opening: ts.JsxOpeningLikeElement,
  primitive: string,
  primitiveLower: string,
  role: string,
  inputType: string,
  className: string,
  sourceFile: ts.SourceFile,
) {
  if (/^(?:FeatureCard|MarketplaceDogPlayerCard)$/.test(primitive)) return true;

  const linkControl = isLinkControl(primitiveLower, role);
  const directlyInteractive =
    linkControl ||
    isButtonControl(primitiveLower, role, inputType) ||
    hasJsxAttribute(opening, "onClick") ||
    hasJsxAttribute(opening, "onPointerDown") ||
    hasJsxAttribute(opening, "onPointerUp");
  if (!directlyInteractive) return false;

  const normalizedClassName = className
    .replace(/[^a-z0-9\s-]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  const hasExplicitCardToken = normalizedClassName
    .split(" ")
    .some(
      (token) =>
        /^(?:giq-)?(?:[a-z0-9]+-)*card(?:-[a-z0-9]+)*$/i.test(token) &&
        !/(?:control|button|link|action)$/i.test(token),
    );
  const hasPanelToken =
    /(?:^|\s)giq-(?:glass-panel|subpanel|panel)(?:-hover)?(?=\s|$)/i.test(
      normalizedClassName,
    );
  const hasStructuredCardShape =
    linkControl &&
    !hasAncestorNavigationSurface(node) &&
    /(?:^|\s)group(?=\s|$)/.test(normalizedClassName) &&
    /(?:^|\s)rounded(?:-[a-z0-9[\]./-]+)?(?=\s|$)/.test(
      normalizedClassName,
    ) &&
    /(?:^|\s)border(?:-[a-z0-9[\]./-]+)?(?=\s|$)/.test(
      normalizedClassName,
    ) &&
    /\bbg-/i.test(className) &&
    (/(?:^|\s)min-h-(?:16|20|24|28|32)(?=\s|$)/.test(
      normalizedClassName,
    ) ||
      hasDescendantPrimitive(node, sourceFile, "Image"));

  return hasExplicitCardToken || hasPanelToken || hasStructuredCardShape;
}

function hasAncestorNavigationSurface(node: ts.Node) {
  let current = node.parent;
  for (let depth = 0; current && depth < 6; depth += 1, current = current.parent) {
    if (
      ts.isJsxElement(current) &&
      current.openingElement.tagName.getText().toLowerCase() === "nav"
    ) {
      return true;
    }
  }
  return false;
}

function hasDescendantPrimitive(
  node: ts.JsxElement | ts.JsxSelfClosingElement,
  sourceFile: ts.SourceFile,
  primitiveName: string,
) {
  if (!ts.isJsxElement(node)) return false;
  let found = false;
  const visit = (child: ts.Node) => {
    if (found) return;
    if (ts.isJsxElement(child) || ts.isJsxSelfClosingElement(child)) {
      const opening = ts.isJsxElement(child) ? child.openingElement : child;
      if (opening.tagName.getText(sourceFile) === primitiveName) {
        found = true;
        return;
      }
    }
    ts.forEachChild(child, visit);
  };
  node.children.forEach(visit);
  return found;
}

function collectNamedImportNames(sourceFile: ts.SourceFile, moduleName: string) {
  const names = new Set<string>();
  for (const statement of sourceFile.statements) {
    if (
      !ts.isImportDeclaration(statement) ||
      !ts.isStringLiteral(statement.moduleSpecifier) ||
      statement.moduleSpecifier.text !== moduleName
    ) {
      continue;
    }
    const bindings = statement.importClause?.namedBindings;
    if (!bindings || !ts.isNamedImports(bindings)) continue;
    for (const element of bindings.elements) names.add(element.name.text);
  }
  return names;
}

function isIconOnlyControl(
  node: ts.JsxElement | ts.JsxSelfClosingElement,
  sourceFile: ts.SourceFile,
  lucideIconNames: ReadonlySet<string>,
) {
  if (!ts.isJsxElement(node) || hasVisibleControlText(node, sourceFile)) {
    return false;
  }
  let hasGraphic = false;
  const visit = (child: ts.Node) => {
    if (hasGraphic) return;
    if (ts.isJsxElement(child) || ts.isJsxSelfClosingElement(child)) {
      const opening = ts.isJsxElement(child) ? child.openingElement : child;
      const primitive = opening.tagName.getText(sourceFile);
      const localName = primitive.split(".").at(-1) ?? primitive;
      if (
        primitive.toLowerCase() === "svg" ||
        primitive.toLowerCase().endsWith(".svg") ||
        lucideIconNames.has(localName) ||
        /icon$/i.test(localName)
      ) {
        hasGraphic = true;
        return;
      }
    }
    ts.forEachChild(child, visit);
  };
  node.children.forEach(visit);
  return hasGraphic;
}

function hasVisibleControlText(node: ts.JsxElement, sourceFile: ts.SourceFile) {
  const visit = (child: ts.JsxChild): boolean => {
    if (ts.isJsxText(child)) return compact(child.text).length > 0;
    if (ts.isJsxExpression(child)) {
      return child.expression
        ? expressionCanRenderVisibleText(child.expression, sourceFile)
        : false;
    }
    if (ts.isJsxSelfClosingElement(child)) return false;
    if (ts.isJsxElement(child)) {
      const className = jsxAttributeValue(
        child.openingElement,
        "className",
        sourceFile,
      );
      const ariaHidden = jsxAttributeValue(
        child.openingElement,
        "aria-hidden",
        sourceFile,
      );
      if (
        /(?:^|\s)(?:sr-only|screen-reader-only|visually-hidden)(?:\s|$)/i.test(
          className,
        ) ||
        ariaHidden === "true"
      ) {
        return false;
      }
      return child.children.some(visit);
    }
    return false;
  };
  return node.children.some(visit);
}

function expressionCanRenderVisibleText(
  expression: ts.Expression,
  sourceFile: ts.SourceFile,
): boolean {
  if (
    ts.isStringLiteral(expression) ||
    ts.isNoSubstitutionTemplateLiteral(expression) ||
    ts.isNumericLiteral(expression)
  ) {
    return compact(expression.text).length > 0;
  }
  if (ts.isTemplateExpression(expression)) {
    return (
      compact(expression.head.text).length > 0 ||
      expression.templateSpans.length > 0
    );
  }
  if (ts.isParenthesizedExpression(expression)) {
    return expressionCanRenderVisibleText(expression.expression, sourceFile);
  }
  if (ts.isConditionalExpression(expression)) {
    return (
      expressionCanRenderVisibleText(expression.whenTrue, sourceFile) ||
      expressionCanRenderVisibleText(expression.whenFalse, sourceFile)
    );
  }
  if (
    ts.isBinaryExpression(expression) &&
    (expression.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken ||
      expression.operatorToken.kind === ts.SyntaxKind.BarBarToken ||
      expression.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken)
  ) {
    return expressionCanRenderVisibleText(expression.right, sourceFile);
  }
  if (ts.isJsxElement(expression)) {
    return hasVisibleControlText(expression, sourceFile);
  }
  if (ts.isJsxSelfClosingElement(expression)) return false;
  return (
    ts.isIdentifier(expression) ||
    ts.isPropertyAccessExpression(expression) ||
    ts.isElementAccessExpression(expression) ||
    ts.isCallExpression(expression)
  );
}

function isMessageSurfaceControl(
  primitiveLower: string,
  role: string,
  inputType: string,
) {
  return (
    isButtonControl(primitiveLower, role, inputType) ||
    isLinkControl(primitiveLower, role) ||
    primitiveLower === "textarea" ||
    primitiveLower === "select" ||
    role === "textbox" ||
    (primitiveLower === "input" && inputType !== "hidden")
  );
}

function isCommentSurfaceControl(
  primitiveLower: string,
  role: string,
  inputType: string,
) {
  return (
    isMessageSurfaceControl(primitiveLower, role, inputType) ||
    primitiveLower === "summary"
  );
}

function hasAncestorTabSurface(node: ts.Node, sourceFile: ts.SourceFile) {
  let current = node.parent;
  for (let depth = 0; current && depth < 5; depth += 1, current = current.parent) {
    if (!ts.isJsxElement(current)) continue;
    const opening = current.openingElement;
    const role = jsxAttributeValue(opening, "role", sourceFile);
    const className = jsxAttributeValue(opening, "className", sourceFile);
    if (role === "tablist" || /(?:^|\s|-)tabs?(?:\s|-|$)/i.test(className)) {
      return true;
    }
  }
  return false;
}

function hasAncestorSortSurface(node: ts.Node, sourceFile: ts.SourceFile) {
  let current = node.parent;
  for (let depth = 0; current && depth < 5; depth += 1, current = current.parent) {
    if (!ts.isJsxElement(current)) continue;
    const opening = current.openingElement;
    const ariaLabel = jsxAttributeValue(opening, "aria-label", sourceFile);
    const className = jsxAttributeValue(opening, "className", sourceFile);
    if (
      /\b(?:sort|order)\b/i.test(ariaLabel) ||
      /(?:^|\s)(?:giq-)?sort-(?:form|controls?)(?:\s|$)/i.test(className)
    ) {
      return true;
    }
  }
  return false;
}

function hasAncestorPaginationSurface(node: ts.Node, sourceFile: ts.SourceFile) {
  let current = node.parent;
  for (let depth = 0; current && depth < 5; depth += 1, current = current.parent) {
    if (!ts.isJsxElement(current)) continue;
    const opening = current.openingElement;
    const ariaLabel = jsxAttributeValue(opening, "aria-label", sourceFile);
    if (/\b(?:pagination|pages)\b/i.test(ariaLabel)) return true;
  }
  return false;
}

function isFilterControl(
  node: ts.JsxElement | ts.JsxSelfClosingElement,
  opening: ts.JsxOpeningLikeElement,
  primitive: string,
  primitiveLower: string,
  inputType: string,
  sourceFile: ts.SourceFile,
) {
  const interactive =
    isLinkOrButton(primitiveLower) ||
    ((primitiveLower === "input" || primitiveLower === "select") &&
      inputType !== "hidden") ||
    primitive === "AutoSubmitSelect" ||
    primitive === "FilterChip";
  if (!interactive) return false;

  const ariaLabel = jsxAttributeValue(opening, "aria-label", sourceFile);
  const className = jsxAttributeValue(opening, "className", sourceFile);
  const controlText = node.getText(sourceFile);
  if (
    /\bfilter\b/i.test(ariaLabel) ||
    /(?:^|[\s-])(?:date|filter)-(?:band|chip|control|form|group)(?:[\s-]|$)/i.test(
      className,
    ) ||
    primitive === "FilterChip" ||
    /\bclear(?:\s+search\s+and)?\s+filters?\b/i.test(controlText)
  ) {
    return true;
  }

  const symbol = owningSymbol(node, sourceFile);
  if (/^(?:ListingsToolbar|ResultsFilters)$/.test(symbol)) return true;

  let current = node.parent;
  for (let depth = 0; current && depth < 10; depth += 1, current = current.parent) {
    if (!ts.isJsxElement(current)) continue;
    const ancestorOpening = current.openingElement;
    if (ancestorOpening.tagName.getText(sourceFile).toLowerCase() !== "form") {
      continue;
    }
    const formText = current.getText(sourceFile);
    const formClass = jsxAttributeValue(ancestorOpening, "className", sourceFile);
    const formAriaLabel = jsxAttributeValue(
      ancestorOpening,
      "aria-label",
      sourceFile,
    );
    const formAction = jsxAttributeValue(ancestorOpening, "action", sourceFile);
    return (
      /\bfilters?\b/i.test(`${formText} ${formAriaLabel}`) ||
      (symbol === "RacesPage" && formAction === "/races") ||
      /(?:^|[\s-])filter-(?:band|controls?|form|group)(?:[\s-]|$)/i.test(
        formClass,
      )
    );
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

function compact(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function repositoryPath(repositoryRoot: string, file: string) {
  return path.relative(repositoryRoot, path.resolve(file)).replace(/\\/g, "/");
}
