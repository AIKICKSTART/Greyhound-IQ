import { readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";

import { SCREEN_CONTRACTS } from "./demo-experience-registry";
import { getLocalSourceClosure } from "./screen-contracts/screen-contract-source-audit";

export const PRODUCT_FIELD_CONTROL_TAGS = [
  "input",
  "select",
  "textarea",
  "AutoSubmitSelect",
  "MediaAttachmentFields",
] as const;

export type ProductFieldContractSourceRecord = {
  id: string;
  route: string;
  sourceFile: string;
  sourceLine: number;
  sourceColumn: number;
  controlTag: (typeof PRODUCT_FIELD_CONTROL_TAGS)[number];
  name: string;
  submittedName: string | null;
  visibleLabel: string | null;
  accessibleLabel: string | null;
  inputType: string;
  dataType: "boolean" | "date" | "file" | "number" | "string";
  required: string;
  defaultValue: string;
  placeholder: string | null;
  helpText: string | null;
  characterLimits: { minLength: string | null; maxLength: string | null };
  numericLimits: {
    min: string | null;
    max: string | null;
    step: string | null;
  };
  acceptedFileTypes: string | null;
  acceptedFileSizePolicy: string | null;
  validationRules: readonly string[];
  sanitisation: "not-source-proven";
  userFacingError: "not-source-proven";
  dataSource: "browser-user-input" | "source-provided-value";
  persistenceDestination: "not-source-proven";
  privacyClassification: "unclassified";
  onboarding: string;
  mobileInput: { inputMode: string | null; enterKeyHint: string | null };
  autofill: string;
  readOnly: string;
  disabled: string;
  conditionalVisibility: string | null;
  hidden: boolean;
  generatedIdentifier: boolean;
  consentField: boolean;
  mediaMetadataField: boolean;
  disclosureField: boolean;
  billingIntentField: boolean;
  dependentField: boolean;
};

export type ProductFieldContractSourceRegistry = {
  records: readonly ProductFieldContractSourceRecord[];
  discoveredRecordIds: readonly string[];
  auditedRoutes: readonly string[];
  auditedSourceFiles: readonly string[];
};

export function buildProductFieldContractSourceRegistry(): ProductFieldContractSourceRegistry {
  const records = new Map<string, ProductFieldContractSourceRecord>();
  const discoveredRecordIds = new Set<string>();
  const auditedSourceFiles = new Set<string>();

  for (const screen of SCREEN_CONTRACTS) {
    for (const entryPath of screen.sourceFiles) {
      for (const sourceFile of getLocalSourceClosure(entryPath)) {
        if (!sourceFile.startsWith("src/") || /\.test\.[cm]?[jt]sx?$/.test(sourceFile)) {
          continue;
        }
        auditedSourceFiles.add(sourceFile);
        for (const field of extractSourceFields(sourceFile)) {
          const id = `${screen.route}:${field.sourceFile}:${field.sourceLine}:${field.sourceColumn}:${field.name}`;
          discoveredRecordIds.add(id);
          records.set(id, {
            ...field,
            id,
            route: screen.route,
            onboarding: field.onboarding === "field-specific"
              ? field.onboarding
              : screen.onboardingTourId
                ? `route:${screen.onboardingTourId}`
                : "none",
          });
        }
      }
    }
  }

  return {
    records: [...records.values()].toSorted((left, right) =>
      left.id.localeCompare(right.id),
    ),
    discoveredRecordIds: [...discoveredRecordIds].toSorted((left, right) =>
      left.localeCompare(right),
    ),
    auditedRoutes: SCREEN_CONTRACTS.map(({ route }) => route).toSorted(),
    auditedSourceFiles: [...auditedSourceFiles].toSorted(),
  };
}

type ExtractedField = Omit<
  ProductFieldContractSourceRecord,
  "id" | "route"
>;

function extractSourceFields(sourceFile: string): ExtractedField[] {
  const absolutePath = path.resolve(sourceFile);
  const source = readFileSync(absolutePath, "utf8");
  const ast = ts.createSourceFile(
    absolutePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    sourceFile.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const labelsByFor = collectLabelsByFor(ast);
  const fields: ExtractedField[] = [];

  visit(ast, (node) => {
    if (!ts.isJsxOpeningElement(node) && !ts.isJsxSelfClosingElement(node)) {
      return;
    }
    const controlTag = node.tagName.getText(ast);
    if (!isProductFieldControlTag(controlTag)) return;

    const attributes = collectAttributes(node, ast);
    const type = resolveInputType(controlTag, attributes);
    const hidden = type === "hidden" || attributes.has("hidden");
    const submittedName =
      attributes.get(controlTag === "MediaAttachmentFields" ? "fieldName" : "name") ??
      null;
    const sourcePosition = ast.getLineAndCharacterOfPosition(node.getStart(ast));
    const sourceLine = sourcePosition.line + 1;
    const sourceColumn = sourcePosition.character + 1;
    const registryName =
      submittedName ??
      attributes.get("id") ??
      attributes.get("aria-label") ??
      `${controlTag}@${sourceLine}`;
    const wrappingLabel = findWrappingLabel(node, ast);
    const id = staticAttributeValue(attributes.get("id"));
    const associatedLabel = id ? labelsByFor.get(id) ?? null : null;
    const visibleLabel = hidden ? null : wrappingLabel ?? associatedLabel;
    const accessibleLabel = hidden
      ? null
      : attributes.get("aria-label") ??
        attributes.get("aria-labelledby") ??
        visibleLabel;
    const conditionalVisibility = findConditionalVisibility(node, ast);
    const validationRules = [
      "required",
      "minLength",
      "maxLength",
      "min",
      "max",
      "step",
      "pattern",
      "accept",
      "multiple",
    ].flatMap((name) => {
      const value = attributes.get(name);
      return value === undefined ? [] : [`${name}=${value}`];
    });
    const normalizedName = registryName
      .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
      .toLowerCase();

    fields.push({
      sourceFile,
      sourceLine,
      sourceColumn,
      controlTag,
      name: registryName,
      submittedName,
      visibleLabel,
      accessibleLabel,
      inputType: type,
      dataType: resolveDataType(type),
      required: attributes.get("required") ?? "false",
      defaultValue:
        attributes.get("defaultValue") ??
        attributes.get("value") ??
        attributes.get("defaultChecked") ??
        attributes.get("checked") ??
        "browser-default",
      placeholder: attributes.get("placeholder") ?? null,
      helpText: attributes.get("aria-describedby") ?? null,
      characterLimits: {
        minLength: attributes.get("minLength") ?? null,
        maxLength: attributes.get("maxLength") ?? null,
      },
      numericLimits: {
        min: attributes.get("min") ?? null,
        max: attributes.get("max") ?? null,
        step: attributes.get("step") ?? null,
      },
      acceptedFileTypes:
        attributes.get("accept") ??
        (type === "media-upload"
          ? "src/components/media-attachment-fields.tsx:acceptedMediaTypes"
          : null),
      acceptedFileSizePolicy:
        type === "file" || type === "media-upload"
          ? "src/lib/billing/entitlements.ts:upload_file_size_bytes"
          : null,
      validationRules,
      sanitisation: "not-source-proven",
      userFacingError: "not-source-proven",
      dataSource:
        attributes.has("value") || attributes.has("defaultValue")
          ? "source-provided-value"
          : "browser-user-input",
      persistenceDestination: "not-source-proven",
      privacyClassification: "unclassified",
      onboarding: attributes.has("data-onboarding-target")
        ? "field-specific"
        : "none",
      mobileInput: {
        inputMode: attributes.get("inputMode") ?? null,
        enterKeyHint: attributes.get("enterKeyHint") ?? null,
      },
      autofill: attributes.get("autoComplete") ?? "browser-default",
      readOnly: attributes.get("readOnly") ?? "false",
      disabled: attributes.get("disabled") ?? "false",
      conditionalVisibility,
      hidden,
      generatedIdentifier:
        /(?:^|[^a-z])(id|ids)(?:$|[^a-z])/.test(normalizedName) &&
        (hidden || attributes.has("value")),
      consentField: /consent|marketing|privacy|terms|opt[-_]?in/.test(
        normalizedName,
      ),
      mediaMetadataField:
        /media|caption|alt(?:text)?|focal|crop|rotation|zoom/.test(
          normalizedName,
        ),
      disclosureField: /disclosure|visibility|contact/.test(normalizedName),
      billingIntentField:
        /plan|interval|price|amount|currency|tier|feature[-_]?key/.test(
          normalizedName,
        ),
      dependentField: conditionalVisibility !== null,
    });
  });

  return fields;
}

function isProductFieldControlTag(
  value: string,
): value is (typeof PRODUCT_FIELD_CONTROL_TAGS)[number] {
  return (PRODUCT_FIELD_CONTROL_TAGS as readonly string[]).includes(value);
}

function collectAttributes(
  node: ts.JsxOpeningLikeElement,
  sourceFile: ts.SourceFile,
) {
  const attributes = new Map<string, string>();
  for (const property of node.attributes.properties) {
    if (!ts.isJsxAttribute(property)) continue;
    const name = property.name.getText(sourceFile);
    attributes.set(name, attributeValue(property, sourceFile));
  }
  return attributes;
}

function attributeValue(
  attribute: ts.JsxAttribute,
  sourceFile: ts.SourceFile,
) {
  if (!attribute.initializer) return "true";
  if (ts.isStringLiteral(attribute.initializer)) return attribute.initializer.text;
  if (ts.isJsxExpression(attribute.initializer)) {
    return attribute.initializer.expression
      ? `{${attribute.initializer.expression.getText(sourceFile)}}`
      : "true";
  }
  return attribute.initializer.getText(sourceFile);
}

function resolveInputType(
  tagName: (typeof PRODUCT_FIELD_CONTROL_TAGS)[number],
  attributes: ReadonlyMap<string, string>,
) {
  if (tagName === "select" || tagName === "AutoSubmitSelect") {
    return attributes.has("multiple") ? "select-multiple" : "select-one";
  }
  if (tagName === "textarea") return "textarea";
  if (tagName === "MediaAttachmentFields") return "media-upload";
  return staticAttributeValue(attributes.get("type")) ?? "text";
}

function resolveDataType(
  inputType: string,
): ProductFieldContractSourceRecord["dataType"] {
  if (inputType === "checkbox" || inputType === "radio") return "boolean";
  if (inputType === "number" || inputType === "range") return "number";
  if (inputType === "date" || inputType === "datetime-local") return "date";
  if (inputType === "file" || inputType === "media-upload") return "file";
  return "string";
}

function collectLabelsByFor(sourceFile: ts.SourceFile) {
  const labels = new Map<string, string>();
  visit(sourceFile, (node) => {
    if (!ts.isJsxElement(node)) return;
    if (node.openingElement.tagName.getText(sourceFile) !== "label") return;
    const attributes = collectAttributes(node.openingElement, sourceFile);
    const htmlFor = staticAttributeValue(attributes.get("htmlFor"));
    if (!htmlFor) return;
    const label = jsxText(node, sourceFile);
    if (label) labels.set(htmlFor, label);
  });
  return labels;
}

function findWrappingLabel(node: ts.Node, sourceFile: ts.SourceFile) {
  let current = node.parent;
  while (current) {
    if (
      ts.isJsxElement(current) &&
      current.openingElement.tagName.getText(sourceFile) === "label"
    ) {
      return jsxText(current, sourceFile);
    }
    if (ts.isJsxElement(current) || ts.isJsxFragment(current)) {
      current = current.parent;
      continue;
    }
    break;
  }
  return null;
}

function jsxText(node: ts.JsxElement, sourceFile: ts.SourceFile) {
  const fragments: string[] = [];
  for (const child of node.children) {
    if (ts.isJsxText(child)) {
      const value = child.text.replace(/\s+/g, " ").trim();
      if (value) fragments.push(value);
    } else if (ts.isJsxExpression(child) && child.expression) {
      fragments.push(`{${child.expression.getText(sourceFile)}}`);
    } else if (ts.isJsxElement(child)) {
      const value = jsxText(child, sourceFile);
      if (value) fragments.push(value);
    }
  }
  return fragments.join(" ").trim() || null;
}

function findConditionalVisibility(node: ts.Node, sourceFile: ts.SourceFile) {
  let current = node.parent;
  while (current) {
    if (ts.isConditionalExpression(current)) {
      return `{${current.condition.getText(sourceFile)}}`;
    }
    if (
      ts.isBinaryExpression(current) &&
      current.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken
    ) {
      return `{${current.left.getText(sourceFile)}}`;
    }
    if (ts.isSourceFile(current)) break;
    current = current.parent;
  }
  return null;
}

function staticAttributeValue(value: string | undefined) {
  if (!value || value.startsWith("{")) return null;
  return value;
}

function visit(sourceFile: ts.SourceFile, inspect: (node: ts.Node) => void) {
  function visitNode(node: ts.Node) {
    inspect(node);
    ts.forEachChild(node, visitNode);
  }
  visitNode(sourceFile);
}
