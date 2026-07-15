import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

import {
  OPENAPI_ENDPOINT_AUTHENTICATION,
  type OpenApiEndpointAuthentication,
} from "../security/endpoints";
import { RATE_LIMITS } from "../security/rate-limits";

const HTTP_METHODS = new Set([
  "delete",
  "get",
  "head",
  "options",
  "patch",
  "post",
  "put",
  "trace",
]);
const SHARED_RESPONSE_REF = "#/components/responses/RateLimitExceeded";

type JsonObject = Record<string, unknown>;

type OpenApiRateLimitRecord = {
  rateLimitId: string;
  route: string;
  method: string;
  operationId: string;
};

function asObject(value: unknown, label: string): JsonObject {
  assert.ok(value && typeof value === "object" && !Array.isArray(value), label);
  return value as JsonObject;
}

export function sourceRouteToOpenApiPath(route: string) {
  return route
    .replaceAll(/\[\.\.\.([^\]]+)\]/g, "{$1}")
    .replaceAll(/\[([^\]]+)\]/g, "{$1}");
}

export function synchronizeOpenApiRateLimits(
  input: JsonObject,
  registry: readonly OpenApiRateLimitRecord[] = RATE_LIMITS,
  authenticationRegistry: readonly OpenApiEndpointAuthentication[] =
    OPENAPI_ENDPOINT_AUTHENTICATION,
) {
  const document = structuredClone(input);
  const paths = asObject(document.paths, "OpenAPI document must define paths.");
  const policyIds = new Set<string>();
  const operationIds = new Set<string>();
  const openApiOperations = new Set<string>();

  for (const [path, pathItemValue] of Object.entries(paths)) {
    const pathItem = asObject(pathItemValue, "OpenAPI path item must be an object.");
    for (const [method, operationValue] of Object.entries(pathItem)) {
      if (!HTTP_METHODS.has(method)) continue;
      openApiOperations.add(`${method} ${path}`);
      const operation = asObject(operationValue, `OpenAPI ${method} operation must be an object.`);
      delete operation["x-rate-limit-policy"];
      if (isObject(operation.responses)) {
        const staleResponse = operation.responses["429"];
        if (isObject(staleResponse) && staleResponse.$ref === SHARED_RESPONSE_REF) {
          delete operation.responses["429"];
        }
      }
    }
  }

  for (const policy of registry) {
    assert.match(policy.rateLimitId, /^RATE\.[A-Za-z0-9_.-]+$/);
    assert.ok(!policyIds.has(policy.rateLimitId), `Duplicate rate-limit policy ID: ${policy.rateLimitId}`);
    assert.ok(!operationIds.has(policy.operationId), `Duplicate rate-limited operation ID: ${policy.operationId}`);
    policyIds.add(policy.rateLimitId);
    operationIds.add(policy.operationId);

    const path = sourceRouteToOpenApiPath(policy.route);
    const method = policy.method.toLowerCase();
    assert.ok(HTTP_METHODS.has(method), `Unsupported HTTP method for ${policy.rateLimitId}: ${policy.method}`);
    const pathItem = asObject(paths[path], `Missing OpenAPI path for ${policy.rateLimitId}: ${path}`);
    const operation = asObject(
      pathItem[method],
      `Missing OpenAPI operation for ${policy.rateLimitId}: ${method} ${path}`,
    );
    assert.equal(
      operation.operationId,
      policy.operationId,
      `OpenAPI operationId mismatch for ${method} ${path}`,
    );

    operation["x-rate-limit-policy"] = policy.rateLimitId;
    const responses = asObject(
      operation.responses,
      `OpenAPI operation ${policy.operationId} must define responses.`,
    );
    responses["429"] = { $ref: SHARED_RESPONSE_REF };
  }

  const components = asObject(
    document.components,
    "OpenAPI document must define components.",
  );
  const responses = asObject(
    components.responses,
    "OpenAPI components must define responses.",
  );
  assert.ok(
    responses.RateLimitExceeded,
    "OpenAPI components must define the shared RateLimitExceeded response.",
  );
  const securitySchemes = asObject(
    components.securitySchemes,
    "OpenAPI components must define security schemes.",
  );
  const authenticationIds = new Set<string>();
  const authenticationOperations = new Set<string>();

  for (const endpoint of authenticationRegistry) {
    assert.ok(
      !authenticationIds.has(endpoint.endpointId),
      `Duplicate OpenAPI authentication endpoint ID: ${endpoint.endpointId}`,
    );
    authenticationIds.add(endpoint.endpointId);
    const path = sourceRouteToOpenApiPath(endpoint.route);
    const method = endpoint.method.toLowerCase();
    const operationKey = `${method} ${path}`;
    assert.ok(
      !authenticationOperations.has(operationKey),
      `Duplicate OpenAPI authentication operation: ${operationKey}`,
    );
    authenticationOperations.add(operationKey);
    const pathItem = asObject(
      paths[path],
      `Missing OpenAPI authentication path for ${endpoint.endpointId}: ${path}`,
    );
    const operation = asObject(
      pathItem[method],
      `Missing OpenAPI authentication operation for ${endpoint.endpointId}: ${operationKey}`,
    );
    assert.equal(
      operation["x-endpoint-id"],
      endpoint.endpointId,
      `OpenAPI endpoint ID mismatch for ${operationKey}`,
    );

    operation["x-authentication-status"] = endpoint.authentication;
    if (endpoint.authentication === "public") {
      for (const requirement of endpoint.security) {
        for (const scheme of Object.keys(requirement)) {
          assert.ok(
            Object.hasOwn(securitySchemes, scheme),
            `${endpoint.endpointId} references missing public request guard ${scheme}`,
          );
        }
      }
      operation.security = structuredClone(endpoint.security);
      continue;
    }
    assert.ok(
      endpoint.security.some((requirement) => Object.keys(requirement).length > 0),
      `${endpoint.endpointId} must include a non-empty security requirement`,
    );
    if (endpoint.authentication !== "optional") {
      assert.ok(
        endpoint.security.every((requirement) => Object.keys(requirement).length > 0),
        `${endpoint.endpointId} must not include an anonymous security alternative`,
      );
    }
    for (const requirement of endpoint.security) {
      for (const scheme of Object.keys(requirement)) {
        assert.ok(
          Object.hasOwn(securitySchemes, scheme),
          `${endpoint.endpointId} references missing security scheme ${scheme}`,
        );
      }
    }
    operation.security = structuredClone(endpoint.security);
  }

  assert.equal(
    authenticationOperations.size,
    openApiOperations.size,
    "OpenAPI authentication registry operation count does not match the document.",
  );
  for (const operationKey of openApiOperations) {
    assert.ok(
      authenticationOperations.has(operationKey),
      `OpenAPI operation is missing authentication registry coverage: ${operationKey}`,
    );
  }

  return document;
}

function isObject(value: unknown): value is JsonObject {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function main() {
  const file = new URL("../openapi.json", import.meta.url);
  const current = JSON.parse(readFileSync(file, "utf8")) as JsonObject;
  const synchronized = synchronizeOpenApiRateLimits(current);
  const output = `${JSON.stringify(synchronized, null, 2)}\n`;

  if (process.argv.includes("--check")) {
    assert.equal(
      readFileSync(file, "utf8"),
      output,
      "openapi.json rate-limit annotations need npm run sync:openapi-rate-limits",
    );
    console.log(
      `OpenAPI registry parity passed (${RATE_LIMITS.length} rate-limited, ${OPENAPI_ENDPOINT_AUTHENTICATION.length} authenticated operations).`,
    );
    return;
  }
  if (!process.argv.includes("--write")) throw new Error("Use --check or --write");
  writeFileSync(file, output);
  console.log(
    `OpenAPI registries synchronized (${RATE_LIMITS.length} rate-limited, ${OPENAPI_ENDPOINT_AUTHENTICATION.length} authenticated operations).`,
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
