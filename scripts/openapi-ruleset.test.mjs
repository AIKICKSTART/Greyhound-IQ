import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import test from "node:test";

const root = dirname(fileURLToPath(new URL("../package.json", import.meta.url)));
const spectral = join(root, "node_modules", "@stoplight", "spectral-cli", "dist", "index.js");

test("the replay exception is narrow and every other URL credential still fails", () => {
  const directory = mkdtempSync(join(tmpdir(), "greyhoundiq-openapi-ruleset-"));
  const fixture = join(directory, "fixture.json");
  try {
    writeFileSync(
      fixture,
      JSON.stringify({
        openapi: "3.0.3",
        info: { title: "Ruleset fixture", version: "1" },
        paths: {},
        components: {
          securitySchemes: {
            HeaderKey: { type: "apiKey", in: "header", name: "x-key" },
            BadQuery: { type: "apiKey", in: "query", name: "key" },
            FakeException: {
              type: "apiKey",
              in: "query",
              name: "s",
              "x-signed-url-exception": "MEDIA-SIGNED-URL-001",
            },
            ReplaySignature: {
              type: "apiKey",
              in: "query",
              name: "s",
              "x-signed-url-exception": "MEDIA-SIGNED-URL-001",
              "x-token-ttl-seconds": 600,
              "x-clock-skew-seconds": 30,
              "x-exception-owner": "API Security",
              "x-exception-review-by": "2099-01-01",
              "x-residual-risk":
                "A replay capability in request metadata remains usable until its bounded expiry.",
            },
          },
        },
      }),
    );

    const result = spawnSync(
      process.execPath,
      [spectral, "lint", fixture, "--ruleset", join(root, ".spectral.yaml"), "--format", "json"],
      { cwd: root, encoding: "utf8" },
    );
    assert.notEqual(result.status, 0, "the deliberately invalid fixture must fail");
    assert.equal(result.error, undefined);
    const findings = JSON.parse(result.stdout);
    const urlCredentialPaths = findings
      .filter((finding) => finding.code === "greyhoundiq:no-api-keys-in-url")
      .map((finding) => finding.path.join("."))
      .sort();
    assert.deepEqual(urlCredentialPaths, [
      "components.securitySchemes.BadQuery.in",
      "components.securitySchemes.FakeException.in",
    ]);
    assert.ok(
      findings.some(
        (finding) =>
          finding.code === "greyhoundiq:signed-url-exception-contract" &&
          finding.path.join(".") === "components.securitySchemes.ReplaySignature.name",
      ),
      "the legacy replay query credential name must fail its bounded contract",
    );
    assert.equal(
      findings.some((finding) =>
        finding.path.join(".").startsWith("components.securitySchemes.HeaderKey"),
      ),
      false,
      "header API keys must remain allowed",
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("the replay 503 same-origin exception cannot be reused by another response", () => {
  const directory = mkdtempSync(join(tmpdir(), "greyhoundiq-cors-ruleset-"));
  const fixture = join(directory, "fixture.json");
  const replay503 = {
    description: "Replay capacity exhausted",
    headers: {
      "Retry-After": {
        description: "Retry delay",
        schema: { type: "string", enum: ["1"] },
      },
    },
    "x-same-origin-cors-exception": "REPLAY-STREAM-503-SAME-ORIGIN-001",
    "x-exception-scope": "GET /api/replay/stream response 503 only",
    "x-exception-owner": "API Security",
    "x-exception-review-by": "2099-01-01",
    "x-exception-rationale":
      "Replay playback is same-origin and the runtime intentionally emits no Access-Control-Allow-Origin header on its bounded overload response.",
    "x-residual-risk":
      "Cross-origin scripts cannot read Retry-After from this response; same-origin playback clients remain unaffected.",
  };
  const document = {
    openapi: "3.0.3",
    info: { title: "CORS ruleset fixture", version: "1" },
    paths: {
      "/api/replay/stream": {
        get: {
          operationId: "replayStream",
          "x-authentication-status": "public",
          responses: { 503: replay503 },
        },
      },
      "/outside": {
        get: {
          operationId: "outside",
          "x-authentication-status": "public",
          responses: {
            503: {
              ...structuredClone(replay503),
              headers: {
                ...structuredClone(replay503.headers),
                "Access-Control-Allow-Origin": {
                  description: "Exact allowed web origin",
                  schema: {
                    type: "string",
                    enum: ["https://greyhoundsiq.com.au"],
                  },
                },
              },
            },
          },
        },
      },
    },
  };
  const lint = () => {
    const result = spawnSync(
      process.execPath,
      [spectral, "lint", fixture, "--ruleset", join(root, ".spectral.yaml"), "--format", "json"],
      { cwd: root, encoding: "utf8" },
    );
    assert.notEqual(result.status, 0, "the deliberately invalid fixture must fail");
    assert.equal(result.error, undefined);
    return JSON.parse(result.stdout);
  };

  try {
    writeFileSync(fixture, JSON.stringify(document));
    const outsideFindings = lint();
    assert.ok(
      outsideFindings.some(
        (finding) =>
          finding.code === "greyhoundiq:same-origin-cors-exception-scope" &&
          finding.path.join(".") === "paths./outside.get.responses.503",
      ),
      "copying exception metadata must fail even when the outside response has valid CORS",
    );
    assert.equal(
      outsideFindings.some(
        (finding) =>
          finding.code === "greyhoundiq:response-header-cors-contract" &&
          finding.path.join(".").startsWith("paths./outside.get.responses.503"),
      ),
      false,
      "the outside response already satisfies the ordinary CORS contract",
    );

    delete document.paths["/api/replay/stream"].get.responses[503]["x-exception-owner"];
    writeFileSync(fixture, JSON.stringify(document));
    const incompleteFindings = lint();
    assert.ok(
      incompleteFindings.some(
        (finding) =>
          finding.code ===
            "greyhoundiq:replay-503-same-origin-exception-contract" &&
          finding.path.join(".").startsWith("paths./api/replay/stream.get.responses.503"),
      ),
      "an incomplete replay 503 exception must fail closed",
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("rate-limited operations and the shared 429 response fail closed", () => {
  const directory = mkdtempSync(join(tmpdir(), "greyhoundiq-rate-limit-ruleset-"));
  const fixture = join(directory, "fixture.json");
  try {
    writeFileSync(
      fixture,
      JSON.stringify({
        openapi: "3.0.3",
        info: { title: "Rate-limit fixture", version: "1" },
        paths: {
          "/limited": {
            post: {
              operationId: "limitedPost",
              "x-rate-limit-policy": "RATE.TEST.POST",
              responses: { 200: { description: "ok" } },
            },
          },
        },
        components: {
          responses: {
            RateLimitExceeded: {
              description: "Too many requests",
              headers: {
                "RateLimit-Limit": { schema: { type: "integer" } },
              },
              content: { "application/json": {} },
            },
          },
        },
      }),
    );

    const result = spawnSync(
      process.execPath,
      [spectral, "lint", fixture, "--ruleset", join(root, ".spectral.yaml"), "--format", "json"],
      { cwd: root, encoding: "utf8" },
    );
    assert.notEqual(result.status, 0, "the deliberately incomplete rate-limit fixture must fail");
    assert.equal(result.error, undefined);
    const findings = JSON.parse(result.stdout);
    assert.ok(
      findings.some(
        (finding) =>
          finding.code === "greyhoundiq:rate-limit-operation-contract" &&
          finding.path.join(".").startsWith("paths./limited.post"),
      ),
      "a registered operation without the shared 429 response must fail",
    );
    assert.ok(
      findings.some(
        (finding) =>
          finding.code === "greyhoundiq:rate-limit-response-contract" &&
          finding.path.join(".").startsWith("components.responses.RateLimitExceeded"),
      ),
      "an incomplete shared response must fail",
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("authentication warnings are replaced by source-classified fail-closed rules", () => {
  const directory = mkdtempSync(join(tmpdir(), "greyhoundiq-auth-ruleset-"));
  const fixture = join(directory, "fixture.json");
  try {
    writeFileSync(
      fixture,
      JSON.stringify({
        openapi: "3.0.3",
        info: { title: "Authentication fixture", version: "1" },
        paths: {
          "/public": {
            get: {
              operationId: "publicGet",
              "x-authentication-status": "public",
              responses: { 200: { description: "ok" } },
            },
          },
          "/missing-security": {
            get: {
              operationId: "missingSecurityGet",
              "x-authentication-status": "required",
              responses: {
                200: { description: "ok" },
                401: {
                  description: "unauthorized",
                  content: { "application/json": {} },
                },
              },
            },
          },
          "/missing-401": {
            get: {
              operationId: "missing401Get",
              "x-authentication-status": "required",
              security: [{ Session: [] }],
              responses: { 200: { description: "ok" } },
            },
          },
          "/anonymous-only": {
            get: {
              operationId: "anonymousOnlyGet",
              "x-authentication-status": "required",
              security: [{}],
              responses: {
                200: { description: "ok" },
                401: {
                  description: "unauthorized",
                  content: { "application/json": {} },
                },
              },
            },
          },
          "/required-anonymous-alternative": {
            get: {
              operationId: "requiredAnonymousAlternativeGet",
              "x-authentication-status": "required",
              security: [{ Session: [] }, {}],
              responses: {
                200: { description: "ok" },
                401: {
                  description: "unauthorized",
                  content: { "application/json": {} },
                },
              },
            },
          },
          "/optional": {
            get: {
              operationId: "optionalGet",
              "x-authentication-status": "optional",
              security: [{ Session: [] }, {}],
              responses: { 200: { description: "ok" } },
            },
          },
          "/unknown": {
            get: {
              operationId: "unknownGet",
              "x-authentication-status": "unknown",
              security: [{ Session: [] }],
              responses: { 200: { description: "ok" } },
            },
          },
        },
        components: {
          securitySchemes: {
            Session: { type: "http", scheme: "bearer" },
          },
        },
      }),
    );

    const result = spawnSync(
      process.execPath,
      [spectral, "lint", fixture, "--ruleset", join(root, ".spectral.yaml"), "--format", "json"],
      { cwd: root, encoding: "utf8" },
    );
    assert.notEqual(result.status, 0, "the deliberately invalid fixture must fail");
    assert.equal(result.error, undefined);
    const findings = JSON.parse(result.stdout);
    const hasFinding = (code, path) =>
      findings.some(
        (finding) =>
          finding.code === code && finding.path.join(".").startsWith(path),
      );

    assert.ok(
      hasFinding(
        "greyhoundiq:non-public-security-contract",
        "paths./missing-security.get",
      ),
    );
    assert.ok(
      hasFinding(
        "greyhoundiq:required-auth-response-contract",
        "paths./missing-401.get",
      ),
    );
    assert.ok(
      hasFinding(
        "greyhoundiq:authentication-status-contract",
        "paths./unknown.get",
      ),
    );
    assert.ok(
      hasFinding(
        "greyhoundiq:non-public-security-contract",
        "paths./anonymous-only.get",
      ),
    );
    assert.ok(
      hasFinding(
        "greyhoundiq:strict-security-contract",
        "paths./anonymous-only.get",
      ),
    );
    assert.ok(
      hasFinding(
        "greyhoundiq:strict-security-contract",
        "paths./required-anonymous-alternative.get",
      ),
    );
    assert.equal(
      findings.some(
        (finding) =>
          finding.code.startsWith("greyhoundiq:") &&
          finding.path.join(".").startsWith("paths./public.get"),
      ),
      false,
      "an explicitly public read must not be reported as an auth defect",
    );
    assert.equal(
      findings.some(
        (finding) =>
          finding.code.startsWith("greyhoundiq:") &&
          finding.path.join(".").startsWith("paths./optional.get"),
      ),
      false,
      "an optional session may retain one explicit anonymous alternative",
    );
    assert.equal(
      findings.some((finding) =>
        [
          "owasp:api2:2023-read-restricted",
          "owasp:api4:2023-rate-limit-responses-429",
          "owasp:api8:2023-define-error-responses-401",
        ].includes(finding.code),
      ),
      false,
      "broad upstream warnings must stay replaced by the classified rules",
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
