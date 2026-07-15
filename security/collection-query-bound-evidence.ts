import ts from "typescript";

export const COLLECTION_QUERY_BOUND_REQUIREMENT_ID =
  "security.ci.13.collection-unbounded";
export const COLLECTION_QUERY_BOUND_RESOURCE_REQUIREMENT_ID =
  "security.resource-control.pagination-limit";

export const MAX_COLLECTION_QUERY_ROWS = 5_000;

export type CollectionQuerySource = {
  readonly path: string;
  readonly source: string;
};

export type CollectionQueryRecord = {
  readonly path: string;
  readonly line: number;
  readonly method: "findMany" | "groupBy";
  readonly take: string;
  readonly maximumRows: number;
};

export type CollectionQueryAudit = {
  readonly records: readonly CollectionQueryRecord[];
  readonly issues: readonly string[];
};

const COLLECTION_METHODS = new Set(["findMany", "groupBy"] as const);

type PartialRange = {
  readonly minimum?: number;
  readonly maximum?: number;
};

export function auditCollectionQueryBounds(
  sources: readonly CollectionQuerySource[],
): CollectionQueryAudit {
  const issues: string[] = [];
  const records: CollectionQueryRecord[] = [];
  const parsedSources = sources.map((item) => {
    const sourceFile = ts.createSourceFile(
      item.path,
      item.source,
      ts.ScriptTarget.Latest,
      true,
      item.path.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    );
    return { item, sourceFile, declarations: collectVariableInitializers(sourceFile) };
  });

  for (const { item, sourceFile, declarations: localDeclarations } of parsedSources) {
    const visit = (node: ts.Node) => {
      if (ts.isBindingElement(node) && ts.isIdentifier(node.name)) {
        if (COLLECTION_METHODS.has(node.name.text as "findMany" | "groupBy")) {
          issues.push(issue(item.path, sourceFile, node, "COLLECTION_METHOD_DESTRUCTURE"));
        }
      }

      if (ts.isPropertyAccessExpression(node) && isCollectionMethod(node.name.text)) {
        if (!ts.isCallExpression(node.parent) || node.parent.expression !== node) {
          issues.push(issue(item.path, sourceFile, node, "COLLECTION_METHOD_REFERENCE"));
        }
      }

      if (
        ts.isElementAccessExpression(node) &&
        node.argumentExpression &&
        ts.isStringLiteralLike(node.argumentExpression) &&
        isCollectionMethod(node.argumentExpression.text)
      ) {
        issues.push(issue(item.path, sourceFile, node, "COLLECTION_ELEMENT_ACCESS"));
      }

      if (
        ts.isCallExpression(node) &&
        ts.isPropertyAccessExpression(node.expression) &&
        isCollectionMethod(node.expression.name.text)
      ) {
        inspectCollectionCall(
          node,
          node.expression.name.text,
          item.path,
          sourceFile,
          localDeclarations,
          records,
          issues,
        );
      }

      ts.forEachChild(node, visit);
    };
    visit(sourceFile);
  }

  if (records.length === 0) issues.push("COLLECTION_QUERY_SCAN_VACUOUS");

  return {
    records: records.toSorted((left, right) =>
      left.path.localeCompare(right.path) || left.line - right.line,
    ),
    issues: [...new Set(issues)].toSorted(),
  };
}

function inspectCollectionCall(
  node: ts.CallExpression,
  method: "findMany" | "groupBy",
  sourcePath: string,
  sourceFile: ts.SourceFile,
  declarations: ReadonlyMap<string, ts.Expression>,
  records: CollectionQueryRecord[],
  issues: string[],
) {
  const location = issueLocation(sourcePath, sourceFile, node);
  const argument = node.arguments[0];
  if (!argument || !ts.isObjectLiteralExpression(argument)) {
    issues.push(`${location}:COLLECTION_ARGUMENT_NOT_LITERAL`);
    return;
  }
  if (argument.properties.some(ts.isSpreadAssignment)) {
    issues.push(`${location}:COLLECTION_ARGUMENT_SPREAD`);
  }

  const takeProperties = argument.properties.filter(
    (property): property is ts.PropertyAssignment | ts.ShorthandPropertyAssignment =>
      (ts.isPropertyAssignment(property) ||
        ts.isShorthandPropertyAssignment(property)) &&
      propertyName(property.name) === "take",
  );
  if (takeProperties.length !== 1) {
    issues.push(`${location}:COLLECTION_TAKE_COUNT:${takeProperties.length}`);
    return;
  }

  const takeProperty = takeProperties[0];
  const takeExpression = ts.isPropertyAssignment(takeProperty)
    ? takeProperty.initializer
    : takeProperty.name;
  const range = evaluateRange(takeExpression, declarations, new Set());
  if (
    range.minimum === undefined ||
    range.minimum < 1 ||
    range.maximum === undefined ||
    range.maximum > MAX_COLLECTION_QUERY_ROWS
  ) {
    issues.push(
      `${location}:COLLECTION_TAKE_NOT_ENFORCED:${takeExpression.getText(sourceFile)}`,
    );
    return;
  }

  records.push({
    path: sourcePath,
    line: sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1,
    method,
    take: takeExpression.getText(sourceFile),
    maximumRows: range.maximum,
  });
}

function collectVariableInitializers(sourceFile: ts.SourceFile) {
  const bindingCounts = new Map<string, number>();
  const candidates = new Map<string, ts.Expression[]>();
  const recordBindings = (name: ts.BindingName) => {
    if (ts.isIdentifier(name)) {
      bindingCounts.set(name.text, (bindingCounts.get(name.text) ?? 0) + 1);
      return;
    }
    for (const element of name.elements) {
      if (!ts.isOmittedExpression(element)) recordBindings(element.name);
    }
  };
  const visit = (node: ts.Node) => {
    if (ts.isVariableDeclaration(node)) {
      recordBindings(node.name);
      const declarationList = node.parent;
      const statement = declarationList.parent;
      if (
        ts.isIdentifier(node.name) &&
        node.initializer &&
        ts.isVariableDeclarationList(declarationList) &&
        (declarationList.flags & ts.NodeFlags.Const) !== 0 &&
        ts.isVariableStatement(statement) &&
        statement.parent === sourceFile
      ) {
        const initializers = candidates.get(node.name.text) ?? [];
        initializers.push(node.initializer);
        candidates.set(node.name.text, initializers);
      }
    } else if (ts.isParameter(node)) {
      recordBindings(node.name);
    } else if (ts.isImportSpecifier(node)) {
      recordBindings(node.name);
    } else if (ts.isImportClause(node) && node.name) {
      recordBindings(node.name);
    } else if (ts.isNamespaceImport(node)) {
      recordBindings(node.name);
    } else if (ts.isCatchClause(node) && node.variableDeclaration) {
      recordBindings(node.variableDeclaration.name);
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return new Map(
    [...candidates]
      .filter(
        ([name, initializers]) =>
          initializers.length === 1 && bindingCounts.get(name) === 1,
      )
      .map(([name, initializers]) => [name, initializers[0]] as const),
  );
}

function evaluateRange(
  expression: ts.Expression,
  declarations: ReadonlyMap<string, ts.Expression>,
  resolving: Set<string>,
): PartialRange {
  const node = unwrapExpression(expression);

  if (ts.isNumericLiteral(node)) {
    const value = Number(node.text.replaceAll("_", ""));
    return Number.isFinite(value) ? { minimum: value, maximum: value } : {};
  }
  if (
    ts.isPrefixUnaryExpression(node) &&
    (node.operator === ts.SyntaxKind.PlusToken ||
      node.operator === ts.SyntaxKind.MinusToken)
  ) {
    const operand = evaluateRange(node.operand, declarations, resolving);
    if (node.operator === ts.SyntaxKind.PlusToken) return operand;
    return {
      minimum: operand.maximum === undefined ? undefined : -operand.maximum,
      maximum: operand.minimum === undefined ? undefined : -operand.minimum,
    };
  }
  if (ts.isIdentifier(node)) {
    if (resolving.has(node.text)) return {};
    const initializer = declarations.get(node.text);
    if (!initializer) return {};
    const nextResolving = new Set(resolving).add(node.text);
    return evaluateRange(initializer, declarations, nextResolving);
  }
  if (ts.isConditionalExpression(node)) {
    return unionRanges(
      evaluateRange(node.whenTrue, declarations, resolving),
      evaluateRange(node.whenFalse, declarations, resolving),
    );
  }
  if (ts.isBinaryExpression(node)) {
    const left = evaluateRange(node.left, declarations, resolving);
    const right = evaluateRange(node.right, declarations, resolving);
    if (
      node.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken ||
      node.operatorToken.kind === ts.SyntaxKind.BarBarToken
    ) {
      return unionRanges(left, right);
    }
    if (node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
      return combineRanges(left, right, (a, b) => a + b);
    }
    if (node.operatorToken.kind === ts.SyntaxKind.MinusToken) {
      return combineRanges(left, right, (a, b) => a - b);
    }
    if (node.operatorToken.kind === ts.SyntaxKind.AsteriskToken) {
      if (
        left.minimum === undefined ||
        left.maximum === undefined ||
        right.minimum === undefined ||
        right.maximum === undefined
      ) {
        return {};
      }
      const candidates = [
        left.minimum * right.minimum,
        left.minimum * right.maximum,
        left.maximum * right.minimum,
        left.maximum * right.maximum,
      ];
      return { minimum: Math.min(...candidates), maximum: Math.max(...candidates) };
    }
  }
  if (
    ts.isCallExpression(node) &&
    ts.isPropertyAccessExpression(node.expression) &&
    ts.isIdentifier(node.expression.expression) &&
    node.expression.expression.text === "Math" &&
    (node.expression.name.text === "min" || node.expression.name.text === "max")
  ) {
    const ranges = node.arguments.map((argument) =>
      evaluateRange(argument, declarations, resolving),
    );
    if (ranges.length === 0) return {};
    if (node.expression.name.text === "min") {
      const maxima = ranges.flatMap((range) =>
        range.maximum === undefined ? [] : [range.maximum],
      );
      return {
        minimum: ranges.every((range) => range.minimum !== undefined)
          ? Math.min(...ranges.map((range) => range.minimum as number))
          : undefined,
        maximum: maxima.length > 0 ? Math.min(...maxima) : undefined,
      };
    }
    const minima = ranges.flatMap((range) =>
      range.minimum === undefined ? [] : [range.minimum],
    );
    return {
      minimum: minima.length > 0 ? Math.max(...minima) : undefined,
      maximum: ranges.every((range) => range.maximum !== undefined)
        ? Math.max(...ranges.map((range) => range.maximum as number))
        : undefined,
    };
  }

  return {};
}

function unwrapExpression(expression: ts.Expression): ts.Expression {
  if (
    ts.isParenthesizedExpression(expression) ||
    ts.isAsExpression(expression) ||
    ts.isSatisfiesExpression(expression) ||
    ts.isNonNullExpression(expression) ||
    ts.isTypeAssertionExpression(expression)
  ) {
    return unwrapExpression(expression.expression);
  }
  return expression;
}

function combineRanges(
  left: PartialRange,
  right: PartialRange,
  operation: (left: number, right: number) => number,
): PartialRange {
  return {
    minimum:
      left.minimum === undefined || right.minimum === undefined
        ? undefined
        : operation(left.minimum, right.minimum),
    maximum:
      left.maximum === undefined || right.maximum === undefined
        ? undefined
        : operation(left.maximum, right.maximum),
  };
}

function unionRanges(left: PartialRange, right: PartialRange): PartialRange {
  return {
    minimum:
      left.minimum === undefined || right.minimum === undefined
        ? undefined
        : Math.min(left.minimum, right.minimum),
    maximum:
      left.maximum === undefined || right.maximum === undefined
        ? undefined
        : Math.max(left.maximum, right.maximum),
  };
}

function propertyName(name: ts.PropertyName) {
  return ts.isIdentifier(name) || ts.isStringLiteralLike(name)
    ? name.text
    : undefined;
}

function isCollectionMethod(value: string): value is "findMany" | "groupBy" {
  return COLLECTION_METHODS.has(value as "findMany" | "groupBy");
}

function issue(
  sourcePath: string,
  sourceFile: ts.SourceFile,
  node: ts.Node,
  code: string,
) {
  return `${issueLocation(sourcePath, sourceFile, node)}:${code}`;
}

function issueLocation(
  sourcePath: string,
  sourceFile: ts.SourceFile,
  node: ts.Node,
) {
  const position = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
  return `${sourcePath}:${position.line + 1}`;
}

const COLLECTION_QUERY_BOUND_EVIDENCE = [
  "security/collection-query-bound-evidence.ts",
  "security/collection-query-bound-evidence.test.ts",
  "scripts/run-unit-tests.ts",
] as const;

export const COLLECTION_QUERY_BOUND_MASTER_EVIDENCE = {
  [COLLECTION_QUERY_BOUND_REQUIREMENT_ID]: {
    status: "verified" as const,
    evidence: COLLECTION_QUERY_BOUND_EVIDENCE,
  },
  [COLLECTION_QUERY_BOUND_RESOURCE_REQUIREMENT_ID]: {
    status: "verified" as const,
    evidence: COLLECTION_QUERY_BOUND_EVIDENCE,
  },
};
