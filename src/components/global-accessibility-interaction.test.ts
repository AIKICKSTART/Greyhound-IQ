import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";

const workspace = process.cwd();
const sourceRoots = ["src/app", "src/components"];
const nativeInteractiveTags = new Set([
  "a",
  "button",
  "details",
  "input",
  "label",
  "select",
  "summary",
  "textarea",
]);
const activationEvents = new Set(["onClick", "onMouseDown", "onPointerDown"]);

function sourcePath(path: string) {
  return join(workspace, path);
}

function portablePath(path: string) {
  return path.replaceAll("\\", "/");
}

function readSource(path: string) {
  return readFileSync(sourcePath(path), "utf8");
}

function findTsxFiles(directory: string): string[] {
  return readdirSync(sourcePath(directory), { withFileTypes: true }).flatMap(
    (entry) => {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) return findTsxFiles(path);
      return entry.name.endsWith(".tsx") ? [path] : [];
    }
  );
}

function attribute(
  node: ts.JsxAttributes,
  name: string
): ts.JsxAttribute | undefined {
  return node.properties.find(
    (property): property is ts.JsxAttribute =>
      ts.isJsxAttribute(property) &&
      (ts.isIdentifier(property.name)
        ? property.name.text
        : property.name.getText()) === name
  );
}

function attributeText(
  node: ts.JsxAttributes,
  name: string,
  source: ts.SourceFile
) {
  return attribute(node, name)?.initializer?.getText(source) ?? "";
}

function staticAttributeValue(
  node: ts.JsxAttributes,
  name: string
): string | undefined {
  const initializer = attribute(node, name)?.initializer;
  if (initializer && ts.isStringLiteral(initializer)) return initializer.text;
  return undefined;
}

const sourceFiles = sourceRoots.flatMap(findTsxFiles);
const nonNativeActivations: string[] = [];
const positiveTabIndices: string[] = [];
const outlineWithoutFocus: string[] = [];
const colourOnlyStatusPills: string[] = [];

for (const file of sourceFiles) {
  const text = readSource(file);
  const source = ts.createSourceFile(
    file,
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  );

  function inspect(node: ts.Node): void {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tag = node.tagName.getText(source);
      const isComponent = /^[A-Z]/.test(tag);
      const isMotionButton = tag.endsWith(".button");
      const eventNames = node.attributes.properties.flatMap((property) =>
        ts.isJsxAttribute(property) &&
        ts.isIdentifier(property.name) &&
        activationEvents.has(property.name.text)
          ? [property.name.text]
          : []
      );

      if (
        eventNames.length > 0 &&
        !nativeInteractiveTags.has(tag) &&
        !isComponent &&
        !isMotionButton
      ) {
        for (const eventName of eventNames) {
          nonNativeActivations.push(`${portablePath(file)}:${tag}:${eventName}`);
        }
      }

      const tabIndex = attributeText(node.attributes, "tabIndex", source);
      if (/^\{[1-9]\d*\}$/.test(tabIndex) || /^[1-9]\d*$/.test(tabIndex)) {
        positiveTabIndices.push(`${portablePath(file)}:${tag}:${tabIndex}`);
      }

      const className = attributeText(node.attributes, "className", source);
      if (className.includes("outline-none") && !className.includes("focus-visible")) {
        outlineWithoutFocus.push(`${portablePath(file)}:${tag}`);
      }

      if (
        className.includes("giq-status-pill") &&
        ts.isJsxOpeningElement(node)
      ) {
        const hasTextChild = node.parent.children.some((child) => {
          if (ts.isJsxText(child)) return child.text.trim().length > 0;
          if (ts.isJsxExpression(child)) return child.expression !== undefined;
          return false;
        });
        if (!hasTextChild && !staticAttributeValue(node.attributes, "aria-label")) {
          colourOnlyStatusPills.push(`${portablePath(file)}:${tag}`);
        }
      }
    }
    ts.forEachChild(node, inspect);
  }

  inspect(source);
}

assert.deepEqual(
  nonNativeActivations.sort(),
  [
    "src/components/marketplace-dog-player-card.tsx:div:onPointerDown",
    "src/components/media-focal-point-editor.tsx:div:onPointerDown",
    "src/components/recipient-picker.tsx:li:onMouseDown",
  ],
  "all direct activation surfaces must be native controls or one of the reviewed keyboard-equivalent interactions"
);
assert.deepEqual(
  positiveTabIndices,
  [],
  "positive tab indices break visual and keyboard focus order"
);
assert.deepEqual(
  outlineWithoutFocus,
  [],
  "outline removal must include an explicit focus-visible treatment"
);
assert.deepEqual(
  colourOnlyStatusPills,
  [],
  "status pills must retain a textual or programmatic status label"
);

const marketplaceCard = readSource("src/components/marketplace-dog-player-card.tsx");
assert.match(marketplaceCard, /onPointerDown=\{handlePointerDown\}/);
assert.match(marketplaceCard, /aria-pressed=\{flipped\}/);
assert.match(marketplaceCard, /Show front/);
assert.match(marketplaceCard, /Flip details/);
assert.equal(
  (marketplaceCard.match(/className="giq-market-card-control/g) ?? []).length,
  4
);
assert.equal(
  (marketplaceCard.match(/style=\{\{ minHeight: 44 \}\}/g) ?? []).length,
  4
);

const focalPointEditor = readSource("src/components/media-focal-point-editor.tsx");
assert.match(focalPointEditor, /tabIndex=\{0\}/);
assert.match(focalPointEditor, /role="application"/);
assert.match(focalPointEditor, /event\.key === "ArrowLeft"/);
assert.match(focalPointEditor, /event\.key === "ArrowRight"/);
assert.match(focalPointEditor, /event\.key === "ArrowUp"/);
assert.match(focalPointEditor, /event\.key === "ArrowDown"/);

const recipientPicker = readSource("src/components/recipient-picker.tsx");
assert.match(recipientPicker, /onKeyDown=\{handleKeyDown\}/);
assert.match(recipientPicker, /role="listbox"/);
assert.match(recipientPicker, /role="option"/);
assert.match(recipientPicker, /aria-selected=\{index === activeIndex\}/);

const buttonSource = readSource("src/components/ui/button.tsx");
assert.match(buttonSource, /focus-visible:ring-3/);
assert.match(buttonSource, /default:\s*"h-11/);
assert.match(buttonSource, /xs:\s*"h-11/);
assert.match(buttonSource, /sm:\s*"h-11/);
assert.match(buttonSource, /icon:\s*"size-11/);

const globals = readSource("src/app/globals.css");
assert.match(globals, /\.giq-button\s*\{[\s\S]*?min-height:\s*44px/);
assert.match(globals, /\.giq-liquid-purple-button\s*\{[\s\S]*?min-height:\s*46px/);
assert.match(globals, /\.giq-outline-action\s*\{[\s\S]*?min-height:\s*44px/);
assert.match(globals, /\.giq-danger-action\s*\{[\s\S]*?min-height:\s*44px/);
assert.match(globals, /\.giq-mobile-dock-link\s*\{[\s\S]*?min-height:\s*52px/);
assert.match(globals, /\.giq-button:focus-visible/);
assert.match(globals, /\[aria-current="page"\]/);
assert.match(globals, /\[aria-selected="true"\]/);
assert.match(globals, /\[aria-pressed="true"\]/);

const sheetSource = readSource("src/components/ui/sheet.tsx");
assert.match(sheetSource, /@base-ui\/react\/dialog/);
assert.match(sheetSource, /SheetPrimitive\.Root/);
assert.match(sheetSource, /SheetPrimitive\.Trigger/);
assert.match(sheetSource, /SheetPrimitive\.Close/);
assert.match(sheetSource, /SheetPrimitive\.Popup/);

const dialogPopupPath = sourcePath(
  "node_modules/@base-ui/react/dialog/popup/DialogPopup.mjs"
);
assert.ok(existsSync(dialogPopupPath), "installed Base UI dialog runtime is required");
const dialogPopup = readFileSync(dialogPopupPath, "utf8");
assert.match(dialogPopup, /returnFocus:\s*finalFocus/);
assert.match(dialogPopup, /restoreFocus:\s*"popup"/);

const customDialogRoles = sourceFiles.filter((file) =>
  /role=["'](?:alert)?dialog["']/.test(readSource(file))
);
assert.deepEqual(
  customDialogRoles,
  [],
  "dialogs must use the shared Base UI primitive so focus returns to the trigger"
);

console.info(
  `Global interaction accessibility source contract passed for ${sourceFiles.length} TSX files.`
);
