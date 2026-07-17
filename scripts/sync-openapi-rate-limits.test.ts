import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  sourceRouteToOpenApiPath,
  synchronizeOpenApiRateLimits,
} from "./sync-openapi-rate-limits";
import type { OpenApiEndpointAuthentication } from "../security/endpoints";

const fixture = {
  openapi: "3.0.3",
  paths: {
    "/api/items/{id}": {
      post: {
        operationId: "postItem",
        "x-endpoint-id": "HTTP.POST.API_ITEMS_PARAM_ID",
        responses: { "200": { description: "ok" } },
      },
      get: {
        operationId: "getItem",
        "x-endpoint-id": "HTTP.GET.API_ITEMS_PARAM_ID",
        "x-rate-limit-policy": "RATE.STALE",
        responses: {
          "200": { description: "ok" },
          "429": { $ref: "#/components/responses/RateLimitExceeded" },
        },
      },
      delete: {
        operationId: "deleteItem",
        "x-endpoint-id": "HTTP.DELETE.API_ITEMS_PARAM_ID",
        responses: {
          "204": { description: "deleted" },
          "429": { description: "custom inline response remains" },
        },
      },
    },
  },
  components: {
    securitySchemes: {
      WorkOSSession: { type: "http", scheme: "bearer" },
    },
    responses: {
      RateLimitExceeded: { description: "shared" },
    },
  },
};

const policy = {
  rateLimitId: "RATE.TEST.POST",
  route: "/api/items/[id]",
  method: "POST",
  operationId: "postItem",
};

const authenticationRegistry = [
  {
    endpointId: "HTTP.POST.API_ITEMS_PARAM_ID",
    route: "/api/items/[id]",
    method: "POST",
    authentication: "required",
    security: [{ WorkOSSession: [] }],
  },
  {
    endpointId: "HTTP.GET.API_ITEMS_PARAM_ID",
    route: "/api/items/[id]",
    method: "GET",
    authentication: "public",
    security: [],
  },
  {
    endpointId: "HTTP.DELETE.API_ITEMS_PARAM_ID",
    route: "/api/items/[id]",
    method: "DELETE",
    authentication: "required",
    security: [{ WorkOSSession: [] }],
  },
] satisfies OpenApiEndpointAuthentication[];

type TestOperation = {
  responses: Record<string, unknown>;
  [key: string]: unknown;
};

assert.equal(
  sourceRouteToOpenApiPath("/api/files/[...parts]/[id]"),
  "/api/files/{parts}/{id}",
);

const synchronized = synchronizeOpenApiRateLimits(
  fixture,
  [policy],
  authenticationRegistry,
);
const synchronizedPaths = synchronized.paths as Record<
  string,
  Record<string, TestOperation>
>;
const post = synchronizedPaths["/api/items/{id}"].post;
const get = synchronizedPaths["/api/items/{id}"].get;
const remove = synchronizedPaths["/api/items/{id}"].delete;
assert.equal(post["x-rate-limit-policy"], "RATE.TEST.POST");
assert.deepEqual(post.responses["429"], {
  $ref: "#/components/responses/RateLimitExceeded",
});
assert.equal(get["x-rate-limit-policy"], undefined);
assert.equal(get.responses["429"], undefined);
assert.deepEqual(remove.responses["429"], {
  description: "custom inline response remains",
});
assert.equal(post["x-authentication-status"], "required");
assert.deepEqual(post.security, [{ WorkOSSession: [] }]);
assert.equal(get["x-authentication-status"], "public");
assert.deepEqual(get.security, []);
assert.equal(remove["x-authentication-status"], "required");
assert.deepEqual(remove.security, [{ WorkOSSession: [] }]);
assert.deepEqual(
  synchronizeOpenApiRateLimits(synchronized, [policy], authenticationRegistry),
  synchronized,
);

const authenticationMutation = structuredClone(synchronized);
const mutatedPost = (
  authenticationMutation.paths as Record<string, Record<string, TestOperation>>
)["/api/items/{id}"].post;
mutatedPost["x-authentication-status"] = "public";
mutatedPost.security = [{}];
assert.notDeepEqual(authenticationMutation, synchronized);
assert.deepEqual(
  synchronizeOpenApiRateLimits(
    authenticationMutation,
    [policy],
    authenticationRegistry,
  ),
  synchronized,
  "source-registry synchronization must repair a required-to-public mutation",
);

const sourceDocument = JSON.parse(
  readFileSync(new URL("../openapi.json", import.meta.url), "utf8"),
);
const sourceMutation = structuredClone(sourceDocument);
const sourceOperation = sourceMutation.paths["/api/actors/{actorId}/mute"].post;
sourceOperation["x-authentication-status"] = "public";
sourceOperation.security = [];
assert.notDeepEqual(sourceMutation, sourceDocument);
assert.deepEqual(
  synchronizeOpenApiRateLimits(sourceMutation),
  sourceDocument,
  "the live source registry must repair a required-to-public OpenAPI mutation",
);

assert.throws(
  () =>
    synchronizeOpenApiRateLimits(
      fixture,
      [policy, { ...policy, operationId: "anotherOperation" }],
      authenticationRegistry,
    ),
  /Duplicate rate-limit policy ID/,
);
assert.throws(
  () =>
    synchronizeOpenApiRateLimits(
      fixture,
      [
        { ...policy, rateLimitId: "RATE.TEST.OTHER" },
        { ...policy, rateLimitId: "RATE.TEST.ANOTHER" },
      ],
      authenticationRegistry,
    ),
  /Duplicate rate-limited operation ID/,
);
assert.throws(
  () =>
    synchronizeOpenApiRateLimits(
      fixture,
      [{ ...policy, route: "/api/missing/[id]" }],
      authenticationRegistry,
    ),
  /Missing OpenAPI path/,
);
assert.throws(
  () =>
    synchronizeOpenApiRateLimits(
      fixture,
      [{ ...policy, operationId: "wrongOperation" }],
      authenticationRegistry,
    ),
  /operationId mismatch/,
);

console.log("OpenAPI registry synchronization tests passed");
