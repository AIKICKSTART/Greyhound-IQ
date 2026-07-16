import ts from "typescript";

export const COMMAND_INJECTION_CONTROL_REQUIREMENT_ID =
  "security.injection-prevention.prevent-command";

export type CommandExecutionSource = {
  readonly path: string;
  readonly source: string;
};

const REVIEWED_COMMAND_SOURCE = "src/lib/media-service.ts";
const EXPECTED_EXECFILE_COMMANDS = new Map([
  ["ffprobeBinary()", 1],
  ["ffmpegBinary()", 1],
  ["clamScanBinary()", 2],
  ["freshClamBinary()", 1],
]);
const EXPECTED_EXECFILE_CALLS = 5;
const EXPECTED_FFMPEG_CALLS = 5;

export function auditCommandExecutionSources(
  sources: readonly CommandExecutionSource[],
) {
  const issues: string[] = [];
  const commandCounts = new Map<string, number>();
  let execFileCalls = 0;
  let ffmpegCalls = 0;
  let reviewedSourceSeen = false;

  for (const item of sources) {
    const sourceFile = ts.createSourceFile(
      item.path,
      item.source,
      ts.ScriptTarget.Latest,
      true,
      item.path.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    );

    let importsChildProcess = false;
    for (const statement of sourceFile.statements) {
      if (
        !ts.isImportDeclaration(statement) ||
        !ts.isStringLiteral(statement.moduleSpecifier) ||
        !isChildProcessModule(statement.moduleSpecifier.text)
      ) {
        continue;
      }

      importsChildProcess = true;
      const imported = statement.importClause?.namedBindings;
      const importNames =
        imported && ts.isNamedImports(imported)
          ? imported.elements.map((element) =>
              (element.propertyName ?? element.name).text,
            )
          : [];
      if (
        item.path !== REVIEWED_COMMAND_SOURCE ||
        importNames.length !== 1 ||
        importNames[0] !== "execFile"
      ) {
        issues.push(`UNREVIEWED_CHILD_PROCESS_IMPORT:${item.path}`);
      }
    }

    if (item.path === REVIEWED_COMMAND_SOURCE) {
      reviewedSourceSeen = true;
      if (!importsChildProcess) {
        issues.push(`REVIEWED_IMPORT_MISSING:${item.path}`);
      }
      if (!item.source.includes("const execFileAsync = promisify(execFile);")) {
        issues.push(`EXECFILE_PROMISIFY_MISSING:${item.path}`);
      }
    }

    const visit = (node: ts.Node) => {
      if (ts.isCallExpression(node)) {
        const expression = node.expression;
        const expressionText = expression.getText(sourceFile);
        const firstArgument = node.arguments[0];

        if (
          (expression.kind === ts.SyntaxKind.ImportKeyword ||
            (ts.isIdentifier(expression) && expression.text === "require")) &&
          firstArgument &&
          ts.isStringLiteral(firstArgument) &&
          isChildProcessModule(firstArgument.text)
        ) {
          issues.push(`DYNAMIC_CHILD_PROCESS_IMPORT:${item.path}`);
        }

        if (expressionText === "execFileAsync") {
          execFileCalls += 1;
          if (item.path !== REVIEWED_COMMAND_SOURCE) {
            issues.push(`UNREVIEWED_EXECFILE_CALL:${item.path}`);
          }
          validateExecFileCall(node, sourceFile, item.path, issues, commandCounts);
        }

        if (expressionText === "runFfmpeg") {
          ffmpegCalls += 1;
          if (
            item.path !== REVIEWED_COMMAND_SOURCE ||
            !firstArgument ||
            !ts.isArrayLiteralExpression(firstArgument)
          ) {
            issues.push(`UNREVIEWED_FFMPEG_ARGUMENTS:${item.path}`);
          }
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(sourceFile);
  }

  if (!reviewedSourceSeen) issues.push(`REVIEWED_SOURCE_MISSING:${REVIEWED_COMMAND_SOURCE}`);
  if (execFileCalls !== EXPECTED_EXECFILE_CALLS) {
    issues.push(`EXECFILE_CALL_COUNT:${execFileCalls}:${EXPECTED_EXECFILE_CALLS}`);
  }
  if (ffmpegCalls !== EXPECTED_FFMPEG_CALLS) {
    issues.push(`FFMPEG_CALL_COUNT:${ffmpegCalls}:${EXPECTED_FFMPEG_CALLS}`);
  }
  for (const [command, expectedCount] of EXPECTED_EXECFILE_COMMANDS) {
    const actualCount = commandCounts.get(command) ?? 0;
    if (actualCount !== expectedCount) {
      issues.push(`COMMAND_COUNT:${command}:${actualCount}:${expectedCount}`);
    }
  }
  for (const command of commandCounts.keys()) {
    if (!EXPECTED_EXECFILE_COMMANDS.has(command)) {
      issues.push(`COMMAND_NOT_ALLOWLISTED:${command}`);
    }
  }

  return [...new Set(issues)].toSorted();
}

function validateExecFileCall(
  node: ts.CallExpression,
  sourceFile: ts.SourceFile,
  sourcePath: string,
  issues: string[],
  commandCounts: Map<string, number>,
) {
  const command = node.arguments[0]?.getText(sourceFile) ?? "<missing>";
  commandCounts.set(command, (commandCounts.get(command) ?? 0) + 1);

  const args = node.arguments[1];
  if (!args || (!ts.isArrayLiteralExpression(args) && args.getText(sourceFile) !== "args" && !/^(?:clamScanArgs|freshClamArgs)\(\)$/.test(args.getText(sourceFile)))) {
    issues.push(`COMMAND_ARGUMENTS_UNREVIEWED:${sourcePath}:${command}`);
  }

  const options = node.arguments[2];
  if (!options || !ts.isObjectLiteralExpression(options)) {
    issues.push(`COMMAND_OPTIONS_MISSING:${sourcePath}:${command}`);
    return;
  }
  const optionNames = options.properties.flatMap((property) => {
    if (!ts.isPropertyAssignment(property) && !ts.isShorthandPropertyAssignment(property)) {
      return [];
    }
    return [property.name.getText(sourceFile).replaceAll(/["']/g, "")];
  });
  if (optionNames.includes("shell")) {
    issues.push(`COMMAND_SHELL_OPTION:${sourcePath}:${command}`);
  }
  if (!optionNames.includes("timeout") || !optionNames.includes("maxBuffer")) {
    issues.push(`COMMAND_BOUNDS_MISSING:${sourcePath}:${command}`);
  }
}

function isChildProcessModule(moduleName: string) {
  return moduleName === "node:child_process" || moduleName === "child_process";
}

const COMMAND_INJECTION_CONTROL_EVIDENCE = [
  "security/command-injection-control-evidence.ts",
  "security/command-injection-control-evidence.test.ts",
  "src/lib/media-service.ts",
  "src/lib/media-service.test.ts",
  "package.json",
] as const;

export const COMMAND_INJECTION_CONTROL_MASTER_EVIDENCE = {
  [COMMAND_INJECTION_CONTROL_REQUIREMENT_ID]: {
    status: "verified" as const,
    evidence: COMMAND_INJECTION_CONTROL_EVIDENCE,
  },
};
