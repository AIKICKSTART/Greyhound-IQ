import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const boundary = resolve("scripts/http-method-boundary.cjs");
const child = spawnSync(
  process.execPath,
  [
    "--require",
    boundary,
    "--eval",
    String.raw`
      const http = require("node:http");
      let applicationCalls = 0;
      const server = http.createServer((request, response) => {
        applicationCalls += 1;
        response.writeHead(204);
        response.end();
      });
      server.listen(0, "127.0.0.1", async () => {
        const port = server.address().port;
        const send = (method) => new Promise((resolve, reject) => {
          const request = http.request({ host: "127.0.0.1", port, method, path: "/api/health/ready" }, (response) => {
            let body = "";
            response.setEncoding("utf8");
            response.on("data", (chunk) => { body += chunk; });
            response.on("end", () => resolve({
              status: response.statusCode,
              headers: response.headers,
              body,
            }));
          });
          request.on("error", reject);
          request.end();
        });
        try {
          const trace = await send("TRACE");
          const extension = await send("PROPFIND");
          const get = await send("GET");
          console.log(JSON.stringify({ trace, extension, get, applicationCalls }));
          server.close();
        } catch (error) {
          console.error(error);
          server.close(() => process.exit(1));
        }
      });
    `,
  ],
  { encoding: "utf8", timeout: 15_000 },
);

assert.equal(child.status, 0, child.stderr);
const result = JSON.parse(child.stdout.trim());
for (const response of [result.trace, result.extension]) {
  assert.equal(response.status, 405);
  assert.equal(response.headers.allow, "GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS");
  assert.equal(response.headers["cache-control"], "no-store");
  assert.equal(response.headers["content-type"], "application/json; charset=utf-8");
  assert.equal(response.headers["x-content-type-options"], "nosniff");
  assert.match(response.headers["x-request-id"], /^[0-9a-f-]{36}$/i);
  assert.deepEqual(JSON.parse(response.body), {
    error: "request.method_not_allowed",
  });
}
assert.equal(result.get.status, 204);
assert.equal(result.applicationCalls, 1);

console.log("HTTP bootstrap method boundary passed");
