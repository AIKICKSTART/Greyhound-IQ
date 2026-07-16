import ts from "typescript";

export const DESERIALIZATION_CONTROL_REQUIREMENT_ID =
  "security.injection-prevention.prevent-deserialization";

export type DeserializationSource = {
  readonly path: string;
  readonly source: string;
};

const BOUNDED_JSON_VALIDATION_BINDINGS = [
  {
    path: "src/app/api/billing/checkout/route.ts",
    reader: "readBoundedJsonOrFormRequest",
    schema: "checkoutRequestSchema",
  },
  {
    path: "src/app/api/media/[id]/finalize/route.ts",
    reader: "readBoundedJsonRequest",
    schema: "mediaFinalizeSchema",
  },
] as const;

const BOUNDED_JSON_READERS = new Set([
  "readBoundedJsonOrFormRequest",
  "readBoundedJsonRequest",
  "readBoundedOptionalJsonRequest",
]);

const PROHIBITED_DESERIALIZER_MODULES = new Set([
  "node-serialize",
  "serialize-javascript",
  "php-serialize",
  "node:v8",
  "v8",
  "node:vm",
  "vm",
]);

export function auditDeserializationSources(
  sources: readonly DeserializationSource[],
) {
  const issues: string[] = [];
  const boundedValidationBindings = new Set<string>();
  let requestBodyReads = 0;

  for (const item of sources) {
    const sourceFile = ts.createSourceFile(
      item.path,
      item.source,
      ts.ScriptTarget.Latest,
      true,
      item.path.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    );
    const boundedReaderBindings = findBoundedJsonReaderBindings(sourceFile);

    for (const statement of sourceFile.statements) {
      if (
        ts.isImportDeclaration(statement) &&
        ts.isStringLiteral(statement.moduleSpecifier) &&
        PROHIBITED_DESERIALIZER_MODULES.has(statement.moduleSpecifier.text)
      ) {
        issues.push(`PROHIBITED_DESERIALIZER_IMPORT:${item.path}`);
      }
    }

    const visit = (node: ts.Node) => {
      if (
        ts.isNewExpression(node) &&
        ts.isIdentifier(node.expression) &&
        node.expression.text === "Function"
      ) {
        issues.push(`DYNAMIC_FUNCTION:${item.path}`);
      }

      if (ts.isCallExpression(node)) {
        const expression = node.expression;
        const firstArgument = node.arguments[0];
        if (
          (expression.kind === ts.SyntaxKind.ImportKeyword ||
            (ts.isIdentifier(expression) && expression.text === "require")) &&
          firstArgument &&
          ts.isStringLiteral(firstArgument) &&
          PROHIBITED_DESERIALIZER_MODULES.has(firstArgument.text)
        ) {
          issues.push(`PROHIBITED_DYNAMIC_DESERIALIZER_IMPORT:${item.path}`);
        }
        if (ts.isIdentifier(expression) && expression.text === "eval") {
          issues.push(`DYNAMIC_EVAL:${item.path}`);
        }

        const boundedReader = boundedJsonReaderName(
          node,
          boundedReaderBindings,
        );
        if (isRequestJsonCall(node) || boundedReader) {
          requestBodyReads += 1;
          const schema = schemaValidationAncestor(node);
          if (!schema) {
            issues.push(`JSON_BODY_WITHOUT_SCHEMA:${item.path}`);
          } else if (boundedReader) {
            boundedValidationBindings.add(
              boundedValidationBindingKey(item.path, boundedReader, schema),
            );
          }
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(sourceFile);
  }

  if (requestBodyReads === 0) issues.push("JSON_BODY_SCAN_VACUOUS");

  for (const binding of BOUNDED_JSON_VALIDATION_BINDINGS) {
    const item = sources.find((candidate) => candidate.path === binding.path);
    if (!item) {
      issues.push(`BOUNDED_JSON_SOURCE_MISSING:${binding.path}`);
      continue;
    }
    const key = boundedValidationBindingKey(
      binding.path,
      binding.reader,
      binding.schema,
    );
    if (!boundedValidationBindings.has(key)) {
      issues.push(
        `BOUNDED_JSON_BINDING_STALE:${binding.path}:${binding.reader}:${binding.schema}`,
      );
    }
  }

  return [...new Set(issues)].toSorted();
}

function isRequestJsonCall(node: ts.CallExpression) {
  if (!ts.isPropertyAccessExpression(node.expression)) return false;
  if (node.expression.name.text !== "json") return false;
  const receiver = node.expression.expression;
  return (
    ts.isIdentifier(receiver) &&
    (receiver.text === "request" || receiver.text === "req")
  );
}

function findBoundedJsonReaderBindings(sourceFile: ts.SourceFile) {
  const bindings = new Map<string, string>();
  for (const statement of sourceFile.statements) {
    if (
      !ts.isImportDeclaration(statement) ||
      !ts.isStringLiteral(statement.moduleSpecifier) ||
      statement.moduleSpecifier.text !== "@/lib/json-request" ||
      !statement.importClause?.namedBindings ||
      !ts.isNamedImports(statement.importClause.namedBindings)
    ) {
      continue;
    }
    for (const element of statement.importClause.namedBindings.elements) {
      const importedName = element.propertyName?.text ?? element.name.text;
      if (BOUNDED_JSON_READERS.has(importedName)) {
        bindings.set(element.name.text, importedName);
      }
    }
  }
  return bindings;
}

function boundedJsonReaderName(
  node: ts.CallExpression,
  bindings: ReadonlyMap<string, string>,
) {
  return ts.isIdentifier(node.expression)
    ? (bindings.get(node.expression.text) ?? null)
    : null;
}

function schemaValidationAncestor(node: ts.Node) {
  let current: ts.Node | undefined = node.parent;
  for (let depth = 0; current && depth < 8; depth += 1) {
    if (
      ts.isCallExpression(current) &&
      ts.isPropertyAccessExpression(current.expression) &&
      (current.expression.name.text === "parse" ||
        current.expression.name.text === "safeParse")
    ) {
      const schema = current.expression.expression;
      return ts.isIdentifier(schema) ? schema.text : schema.getText();
    }
    if (ts.isVariableDeclaration(current) || ts.isReturnStatement(current)) {
      break;
    }
    current = current.parent;
  }
  return null;
}

function boundedValidationBindingKey(
  path: string,
  reader: string,
  schema: string,
) {
  return `${path}:${reader}:${schema}`;
}

const DESERIALIZATION_CONTROL_EVIDENCE = [
  "security/deserialization-control-evidence.ts",
  "security/deserialization-control-evidence.test.ts",
  "src/app/api/billing/checkout/route.ts",
  "src/app/api/media/[id]/finalize/route.ts",
  "src/lib/json-request.ts",
  "src/lib/listing-validation.ts",
  "src/lib/media-validation.ts",
  "package.json",
] as const;

export const DESERIALIZATION_CONTROL_MASTER_EVIDENCE = {
  [DESERIALIZATION_CONTROL_REQUIREMENT_ID]: {
    status: "verified" as const,
    evidence: DESERIALIZATION_CONTROL_EVIDENCE,
  },
};
