import assert from "node:assert/strict";
import {
  mkdirSync,
  mkdtempSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { findStructuredLoggingBypasses } from "./structured-logging-policy";

const fixtureParent = realpathSync(tmpdir());
const fixtureRoot = mkdtempSync(
  join(fixtureParent, "greyhoundiq-logging-policy-"),
);

try {
  writeFixture(
    "src/lib/server.ts",
    [
      'console.error("raw server log");',
      'globalThis.console["warn"]("raw warning");',
      "const objectAlias = console;",
      'objectAlias.info("object alias");',
      "const log = console.error;",
      'log("method alias");',
      "const chainedAlias = log;",
      'chainedAlias?.("chained optional alias");',
      "const { error } = console;",
      'error("destructured shorthand alias");',
      "const { warn: destructuredWarn } = console;",
      'destructuredWarn("destructured alias");',
      "let assignedAlias;",
      "assignedAlias = console.info;",
      'assignedAlias("assigned alias");',
      'console?.debug?.("optional direct call");',
      'globalThis["console"].error("global element access");',
      "let destructuredAssigned;",
      "({ warn: destructuredAssigned } = console);",
      'destructuredAssigned("destructured assignment");',
      'Reflect.apply(console.error, console, ["reflect apply"]);',
      'Reflect.get(console, "warn")("reflect get");',
      '(0, console.info)("comma expression");',
      'console.error.bind(console)("bound call");',
      'console.warn.call(console, "call invocation");',
      'process.stdout.write("raw stdout");',
      'process["stderr"].write("raw stderr");',
      "",
    ].join("\n"),
  );
  writeFixture(
    "src/components/client.tsx",
    [
      '"use client";',
      'import { useEffect as useBrowserEffect } from "react";',
      'console.error("client module top level can run during server generation");',
      "export function ClientComponent() {",
      '  console.warn("client render can run during server generation");',
      "  useBrowserEffect(() => {",
      '    setTimeout(() => console.info("effect is browser-only"), 0);',
      "  }, []);",
      "  return null;",
      "}",
      "",
    ].join("\n"),
  );
  writeFixture(
    "src/components/fake-client-effect.tsx",
    [
      '"use client";',
      "function useEffect(callback: () => void) { callback(); }",
      "export function FakeEffectComponent() {",
      '  useEffect(() => console.error("fake effect runs during render"));',
      "  return null;",
      "}",
      "",
    ].join("\n"),
  );
  writeFixture(
    "src/components/indirect-effect.tsx",
    [
      '"use client";',
      'import { useEffect } from "react";',
      "const indirectEffect = useEffect;",
      "export function IndirectEffectComponent() {",
      '  indirectEffect(() => console.warn("indirect effect fails closed"));',
      "  return null;",
      "}",
      "",
    ].join("\n"),
  );
  writeFixture(
    "src/components/namespace-effect.tsx",
    [
      '"use client";',
      'import * as React from "react";',
      "export function NamespaceEffectComponent() {",
      '  React.useEffect(() => console.error("namespace effect fails closed"));',
      "  return null;",
      "}",
      "",
    ].join("\n"),
  );
  writeFixture(
    "src/components/shadowed-effect.tsx",
    [
      '"use client";',
      'import { useEffect } from "react";',
      "export function ShadowedEffectComponent(useEffect: (callback: () => void) => void) {",
      '  useEffect(() => console.error("shadowed import fails closed"));',
      "  return null;",
      "}",
      "",
    ].join("\n"),
  );
  writeFixture("src/lib/server.test.ts", 'console.error("test-only log");\n');
  writeFixture(
    "src/lib/safe.ts",
    '// console.error("comment");\nconst example = "console.warn(\\"string\\")";\nvoid example;\n',
  );
  writeFixture(
    "src/lib/logger.ts",
    [
      "function emit(severity: string, line: string) {",
      '  if (severity === "ERROR") console.error(line);',
      '  else if (severity === "WARNING") console.warn(line);',
      "  else console.info(line);",
      "  process.stderr.write(`${line}\\n`);",
      "  const aliasedSink = console.error;",
      "  aliasedSink(line);",
      "  const nestedSink = () => console.error(line);",
      "  void nestedSink;",
      "}",
      "function accidentalBypass(line: string) {",
      '  console.log("raw logger log");',
      "  process.stderr.write(`${line}\\n`);",
      "}",
      "void emit;",
      "void accidentalBypass;",
      "",
    ].join("\n"),
  );

  const findings = findStructuredLoggingBypasses(fixtureRoot);
  assert.deepEqual(
    findings.map(({ file, method }) => ({ file, method })),
    [
      { file: "src/components/client.tsx", method: "error" },
      { file: "src/components/client.tsx", method: "warn" },
      { file: "src/components/fake-client-effect.tsx", method: "error" },
      { file: "src/components/indirect-effect.tsx", method: "warn" },
      { file: "src/components/namespace-effect.tsx", method: "error" },
      { file: "src/components/shadowed-effect.tsx", method: "error" },
      { file: "src/lib/logger.ts", method: "error" },
      { file: "src/lib/logger.ts", method: "error" },
      { file: "src/lib/logger.ts", method: "log" },
      { file: "src/lib/logger.ts", method: "stderr.write" },
      { file: "src/lib/server.ts", method: "error" },
      { file: "src/lib/server.ts", method: "warn" },
      { file: "src/lib/server.ts", method: "info" },
      { file: "src/lib/server.ts", method: "error" },
      { file: "src/lib/server.ts", method: "error" },
      { file: "src/lib/server.ts", method: "error" },
      { file: "src/lib/server.ts", method: "warn" },
      { file: "src/lib/server.ts", method: "info" },
      { file: "src/lib/server.ts", method: "debug" },
      { file: "src/lib/server.ts", method: "error" },
      { file: "src/lib/server.ts", method: "warn" },
      { file: "src/lib/server.ts", method: "error" },
      { file: "src/lib/server.ts", method: "warn" },
      { file: "src/lib/server.ts", method: "info" },
      { file: "src/lib/server.ts", method: "error" },
      { file: "src/lib/server.ts", method: "warn" },
      { file: "src/lib/server.ts", method: "stdout.write" },
      { file: "src/lib/server.ts", method: "stderr.write" },
    ],
  );
} finally {
  const resolvedFixtureRoot = realpathSync(fixtureRoot);
  assert.equal(
    dirname(resolvedFixtureRoot),
    fixtureParent,
    "recursive cleanup target must remain a direct child of the temp directory",
  );
  assert.match(
    basename(resolvedFixtureRoot),
    /^greyhoundiq-logging-policy-/,
    "recursive cleanup target must retain the fixture prefix",
  );
  rmSync(resolvedFixtureRoot, { recursive: true, force: true });
}

assert.deepEqual(
  findStructuredLoggingBypasses(process.cwd()),
  [],
  "repository runtime-server code must not bypass the structured logger",
);

console.log("structured logging policy tests passed");

function writeFixture(path: string, source: string) {
  const fullPath = join(fixtureRoot, path);
  mkdirSync(join(fullPath, ".."), { recursive: true });
  writeFileSync(fullPath, source, "utf8");
}
