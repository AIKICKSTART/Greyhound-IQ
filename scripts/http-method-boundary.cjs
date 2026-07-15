"use strict";

/* eslint-disable @typescript-eslint/no-require-imports -- Node preload runs before the ESM/Next application loader. */

const http = require("node:http");
const { randomUUID } = require("node:crypto");

const INSTALL_MARKER = Symbol.for("greyhoundiq.httpMethodBoundary.installed");
const ALLOWED_METHODS = [
  "GET",
  "HEAD",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "OPTIONS",
];
const ALLOWED_METHOD_SET = new Set(ALLOWED_METHODS);

function isSupportedMethod(method) {
  return ALLOWED_METHOD_SET.has(String(method || "").toUpperCase());
}

function methodNotAllowed(res) {
  const body = JSON.stringify({ error: "request.method_not_allowed" });
  res.writeHead(405, {
    Allow: ALLOWED_METHODS.join(", "),
    "Cache-Control": "no-store",
    "Content-Length": Buffer.byteLength(body),
    "Content-Type": "application/json; charset=utf-8",
    "X-Content-Type-Options": "nosniff",
    "X-Request-ID": randomUUID(),
  });
  res.end(body);
}

function wrapRequestListener(listener) {
  return function greyhoundiqMethodBoundary(req, res) {
    if (!isSupportedMethod(req.method)) {
      methodNotAllowed(res);
      return;
    }
    return listener.call(this, req, res);
  };
}

function install() {
  if (http[INSTALL_MARKER]) return;

  const createServer = http.createServer;
  http.createServer = function createGuardedServer(options, requestListener) {
    if (typeof options === "function") {
      return createServer.call(this, wrapRequestListener(options));
    }
    return createServer.call(
      this,
      options,
      typeof requestListener === "function"
        ? wrapRequestListener(requestListener)
        : requestListener,
    );
  };
  http[INSTALL_MARKER] = true;
}

install();

module.exports = { ALLOWED_METHODS, isSupportedMethod };
