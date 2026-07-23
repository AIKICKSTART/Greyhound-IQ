import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { hardenOpenApiContract } from "./harden-openapi-contract.mjs";

const METHODS = new Set(["delete", "get", "head", "options", "patch", "post", "put", "trace"]);

function operationInventory(document) {
  return Object.entries(document.paths).flatMap(([path, item]) =>
    Object.entries(item)
      .filter(([method]) => METHODS.has(method))
      .map(([method, operation]) => `${method} ${path}:${operation.operationId}`)
  );
}

function assertInputsAreBound(document) {
  for (const item of Object.values(document.paths)) {
    for (const [method, operation] of Object.entries(item)) {
      if (!METHODS.has(method)) continue;
      for (const parameter of operation.parameters ?? []) {
        if (parameter.schema?.type === "string" && parameter.schema.enum == null) {
          assert.ok(parameter.schema.maxLength > 0, `${method} ${parameter.name} is unbounded`);
        }
      }
      for (const media of Object.values(operation.requestBody?.content ?? {})) {
        if (media.schema?.type === "string") assert.ok(media.schema.maxLength > 0);
      }
    }
  }
}

function assertMediaResponsesAreBound(document) {
  for (const path of ["/api/media/{id}/blob", "/api/replay/stream"]) {
    for (const response of Object.values(document.paths[path].get.responses)) {
      for (const media of Object.values(response.content ?? {})) {
        if (media.schema?.type === "string") {
          assert.ok(media.schema.maxLength > 0, `${path} response is unbounded`);
        }
      }
    }
  }
}

function assertAuthRedirectResponsesAreBound(document) {
  for (const path of ["/callback", "/sign-in"]) {
    let redirectResponses = 0;
    for (const response of Object.values(document.paths[path].get.responses)) {
      if (!response.headers?.Location) continue;
      redirectResponses += 1;
      assert.ok(response.headers.Location.schema.maxLength > 0);
      assert.deepEqual(
        response.headers["Access-Control-Allow-Origin"].schema.enum,
        ["https://greyhoundsiq.com.au"],
      );
    }
    assert.ok(redirectResponses > 0, `${path} has no redirect response`);
  }
}

function assertRateLimitResponse(document) {
  const response = document.components.responses.RateLimitExceeded;
  assert.deepEqual(Object.keys(response.headers).sort(), [
    "Access-Control-Allow-Origin",
    "Cache-Control",
    "RateLimit-Limit",
    "RateLimit-Remaining",
    "RateLimit-Reset",
    "Retry-After",
  ]);
  assert.deepEqual(response.headers["Cache-Control"].schema.enum, [
    "private, no-store",
  ]);
  assert.deepEqual(
    response.headers["Access-Control-Allow-Origin"].schema.enum,
    ["https://greyhoundsiq.com.au"],
  );
  for (const name of [
    "RateLimit-Limit",
    "RateLimit-Remaining",
    "RateLimit-Reset",
    "Retry-After",
  ]) {
    assert.equal(response.headers[name].schema.type, "integer");
    assert.equal(response.headers[name].schema.format, "int32");
    assert.equal(response.headers[name].schema.maximum, 2_147_483_647);
  }
  assert.deepEqual(
    response.content["application/json"].schema.required,
    ["error"],
  );
  assert.deepEqual(
    response.content["application/json"].schema.properties.error.required,
    ["code", "message"],
  );
}

test("hardening is bounded, structural, and idempotent", () => {
  const source = JSON.parse(readFileSync(new URL("../openapi.json", import.meta.url), "utf8"));
  const hardened = hardenOpenApiContract(source);

  assert.equal(Object.keys(source.paths).length, 85);
  assert.equal(operationInventory(source).length, 106);
  assert.equal(Object.keys(source.components.schemas).length, 7);
  assert.equal(
    source.paths["/api/media/{id}/local-upload"],
    undefined,
    "the permanently retired local-upload path must remain absent"
  );
  assert.deepEqual(Object.keys(hardened.paths), Object.keys(source.paths));
  assert.deepEqual(operationInventory(hardened), operationInventory(source));
  assert.deepEqual(hardened.components.schemas, source.components.schemas);
  assert.deepEqual(hardened.servers, [
    {
      url: "https://greyhoundsiq.com.au",
      description: "GreyhoundIQ production edge",
      "x-internal": false,
    },
  ]);
  assert.deepEqual(hardened.info.contact, {
    name: "GreyhoundIQ Support",
    url: "https://greyhoundsiq.com.au/contact",
    email: "support@greyhoundsiq.com.au",
  });
  assert.deepEqual(
    hardened.paths["/api/billing/checkout"].post.responses["400"],
    {
      description: "The request failed source Zod validation in checkoutRequestSchema.",
      content: {
        "application/json": {
          schema: { $ref: "#/components/schemas/UnspecifiedJsonObject" },
        },
      },
    },
  );
  for (const [path, method, schema] of [
    ["/api/calls/{roomId}/end", "post", "callRoomIdSchema"],
    ["/api/calls/{roomId}/token", "post", "callRoomIdSchema"],
    ["/api/conversations/{id}/messages", "get", "messagesQuerySchema"],
  ]) {
    assert.equal(
      hardened.paths[path][method].responses["400"].description,
      `The request failed source Zod validation in ${schema}.`,
    );
  }
  assert.deepEqual(
    hardened.paths["/api/media/{id}/blob"].get.parameters.map(
      (parameter) => parameter.name,
    ),
    ["id", "variant", "range"],
  );
  const replayOperation = hardened.paths["/api/replay/stream"].get;
  assert.deepEqual(
    replayOperation.parameters.map((parameter) => [
      parameter.name,
      parameter.in,
      parameter.required,
    ]),
    [
      ["t", "query", true],
      ["range", "header", false],
    ],
  );
  assert.deepEqual(replayOperation.parameters[0].schema, {
    type: "string",
    minLength: 40,
    maxLength: 8_192,
    pattern: "^[A-Za-z0-9_-]+$",
  });
  assert.deepEqual(replayOperation.parameters[1].schema, {
    type: "string",
    maxLength: 128,
    pattern: "^[Bb][Yy][Tt][Ee][Ss]=(?:[0-9]+-[0-9]*|-[0-9]+)$",
  });
  for (const legacyParameter of ["s", "e", "u", "content-type"]) {
    assert.equal(
      replayOperation.parameters.some(
        (parameter) => parameter.name === legacyParameter,
      ),
      false,
      `legacy replay parameter ${legacyParameter} must not be documented`,
    );
  }
  assert.equal(hardened.components.securitySchemes.ReplaySignature.name, "t");
  assert.deepEqual(
    hardened.components.securitySchemes.OnboardingAnalyticsConsent,
    {
      type: "apiKey",
      in: "header",
      name: "x-greyhoundiq-analytics-consent",
      description:
        "Required fixed consent assertion for the privacy-minimised public analytics write. This is a request guard, not a user credential or authorization grant.",
    },
  );
  assert.equal(
    hardened.components.securitySchemes.ReplaySignature["x-token-ttl-seconds"],
    600,
  );
  assert.equal(
    hardened.components.securitySchemes.ReplaySignature["x-clock-skew-seconds"],
    30,
  );
  assert.match(
    hardened.components.securitySchemes.ReplaySignature["x-residual-risk"],
    /replayable until expiry/,
  );
  assert.equal(
    replayOperation.responses["416"].content["application/json"].schema.$ref,
    "#/components/schemas/UnspecifiedJsonObject",
  );
  assert.deepEqual(
    replayOperation.responses["503"].headers["Retry-After"].schema.enum,
    ["1"],
  );
  assert.equal(
    replayOperation.responses["503"]["x-same-origin-cors-exception"],
    "REPLAY-STREAM-503-SAME-ORIGIN-001",
  );
  assert.equal(
    replayOperation.responses["503"]["x-exception-scope"],
    "GET /api/replay/stream response 503 only",
  );
  assert.equal(
    replayOperation.responses["503"]["x-exception-owner"],
    "API Security",
  );
  assert.ok(
    Date.parse(replayOperation.responses["503"]["x-exception-review-by"]) >
      Date.now(),
    "the replay 503 same-origin exception review date has expired",
  );
  assert.match(
    replayOperation.responses["503"]["x-exception-rationale"],
    /same-origin/,
  );
  assert.match(
    replayOperation.responses["503"]["x-residual-risk"],
    /Cross-origin scripts cannot read Retry-After/,
  );
  assert.deepEqual(
    Object.entries(hardened.components.securitySchemes)
      .filter(([, scheme]) => scheme["x-signed-url-exception"] != null)
      .map(([name]) => name),
    ["ReplaySignature"],
  );
  assert.deepEqual(
    Object.entries(hardened.paths).flatMap(([path, item]) =>
      Object.entries(item)
        .filter(
          ([method, operation]) =>
            METHODS.has(method) &&
            (operation.security ?? []).some((entry) =>
              Object.hasOwn(entry, "ReplaySignature"),
            ),
        )
        .map(([method]) => `${method} ${path}`),
    ),
    ["get /api/replay/stream"],
  );
  assert.ok(
    Date.parse(
      hardened.components.securitySchemes.ReplaySignature["x-exception-review-by"],
    ) > Date.now(),
    "the signed-media URL exception review date has expired",
  );
  assertInputsAreBound(hardened);
  assertMediaResponsesAreBound(hardened);
  assertAuthRedirectResponsesAreBound(hardened);
  assertRateLimitResponse(hardened);
  assert.deepEqual(hardenOpenApiContract(hardened), hardened);
});

test("non-loopback HTTPS servers are preserved", () => {
  const document = { openapi: "3.0.3", paths: {}, servers: [{ url: "https://api.example.test" }] };
  assert.deepEqual(hardenOpenApiContract(document).servers, [
    { url: "https://api.example.test", "x-internal": false },
  ]);
});
