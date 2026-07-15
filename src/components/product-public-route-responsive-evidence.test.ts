import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, realpath, rm } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";

import { SCREEN_CONTRACTS } from "./demo-experience-registry";
import { PRODUCT_MASTER_REQUIREMENTS } from "./product-master-requirements";
import {
  findPublicRouteResponsiveFailures,
  PRODUCT_PUBLIC_ROUTE_RESPONSIVE_EVIDENCE_FILE,
  PRODUCT_PUBLIC_ROUTE_RESPONSIVE_EXPECTED_GAIN,
  PRODUCT_PUBLIC_ROUTE_RESPONSIVE_MASTER_EVIDENCE,
  PRODUCT_PUBLIC_ROUTE_RESPONSIVE_REQUIREMENT_IDS,
  PRODUCT_PUBLIC_ROUTE_RESPONSIVE_SCOPE,
  PRODUCT_PUBLIC_ROUTE_RESPONSIVE_TEST_FILE,
  PRODUCT_PUBLIC_ROUTE_RESPONSIVE_WIDTHS,
  type PublicRouteResponsiveMeasurement,
} from "./product-public-route-responsive-evidence";

// screen-evidence-test-id: PRODUCT-PUBLIC-ROUTE-RESPONSIVE-EVIDENCE

const PUBLIC_ROUTES = SCREEN_CONTRACTS.filter(
  (screen) => screen.productionEnabled && screen.authentication === "public",
).map(({ route }) => route);

assert.deepEqual(PRODUCT_PUBLIC_ROUTE_RESPONSIVE_REQUIREMENT_IDS, [
  "ROUTE.PUBLIC.responsive",
]);
assert.equal(PRODUCT_PUBLIC_ROUTE_RESPONSIVE_EXPECTED_GAIN, 1);
assert.deepEqual(PUBLIC_ROUTES, [
  "/",
  "/about",
  "/auth/error",
  "/contact",
  "/pricing",
  "/privacy",
  "/responsible-use",
  "/terms",
]);
assert.deepEqual(PRODUCT_PUBLIC_ROUTE_RESPONSIVE_WIDTHS, [
  390, 820, 1024, 1280,
]);
assert.match(PRODUCT_PUBLIC_ROUTE_RESPONSIVE_SCOPE, /fresh isolated loopback Chrome/i);
assert.match(PRODUCT_PUBLIC_ROUTE_RESPONSIVE_SCOPE, /every production-enabled public screen/i);
assert.match(PRODUCT_PUBLIC_ROUTE_RESPONSIVE_SCOPE, /current local browser evidence only/i);
assert.match(PRODUCT_PUBLIC_ROUTE_RESPONSIVE_SCOPE, /does not prove deployed-image parity/i);
assert.deepEqual(
  PRODUCT_PUBLIC_ROUTE_RESPONSIVE_MASTER_EVIDENCE[
    "ROUTE.PUBLIC.responsive"
  ].evidence.slice(0, 2),
  [
    PRODUCT_PUBLIC_ROUTE_RESPONSIVE_EVIDENCE_FILE,
    PRODUCT_PUBLIC_ROUTE_RESPONSIVE_TEST_FILE,
  ],
);
for (const evidencePath of PRODUCT_PUBLIC_ROUTE_RESPONSIVE_MASTER_EVIDENCE[
  "ROUTE.PUBLIC.responsive"
].evidence) {
  assert.equal(existsSync(evidencePath), true, evidencePath);
}
assert.equal(
  PRODUCT_MASTER_REQUIREMENTS.some(
    ({ id }) => id === "ROUTE.PUBLIC.responsive",
  ),
  true,
);

const validFixture: PublicRouteResponsiveMeasurement = {
  route: "/about",
  width: 390,
  httpStatus: 200,
  finalPath: "/about",
  documentClientWidth: 390,
  documentScrollWidth: 390,
  bodyClientWidth: 390,
  bodyScrollWidth: 390,
  overflowingRegions: [],
};
assert.deepEqual(findPublicRouteResponsiveFailures(validFixture), []);
assert.deepEqual(
  findPublicRouteResponsiveFailures({
    ...validFixture,
    httpStatus: 500,
    finalPath: "/error",
    documentScrollWidth: 420,
    bodyScrollWidth: 410,
    overflowingRegions: ["table:nth-of-type(1)"],
  }),
  [
    "/about@390: HTTP 500, expected 200",
    "/about@390: final path /error, expected /about",
    "/about@390: document overflows 420px > 390px",
    "/about@390: body overflows 410px > 390px",
    "/about@390: table:nth-of-type(1) exceeds the viewport",
  ],
);

async function main() {
  const baseUrl = loopbackOrigin(
    process.env.PUBLIC_RESPONSIVE_BASE_URL ?? "http://localhost:3000",
  );
  const profileDirectory = await mkdtemp(
    path.join(tmpdir(), "greyhoundiq-public-responsive-"),
  );
  const port = await reservePort();
  const chrome = spawnChrome(resolveChromeExecutable(), profileDirectory, port);
  let client: CdpClient | undefined;

  try {
    await waitForChrome(port, chrome);
    const target = await createTarget(port);
    client = await CdpClient.connect(target.webSocketDebuggerUrl);
    await client.send("Page.enable");
    await client.send("Runtime.enable");
    await client.send("Network.enable");

    const measurements: PublicRouteResponsiveMeasurement[] = [];
    for (const route of PUBLIC_ROUTES) {
      for (const width of PRODUCT_PUBLIC_ROUTE_RESPONSIVE_WIDTHS) {
        measurements.push(await measureRoute(client, baseUrl, route, width));
      }
    }

    assert.equal(measurements.length, 32);
    const failures = measurements.flatMap(findPublicRouteResponsiveFailures);
    assert.deepEqual(failures, []);
    console.log(
      `Public route responsive evidence passed: ${PUBLIC_ROUTES.length} routes x ${PRODUCT_PUBLIC_ROUTE_RESPONSIVE_WIDTHS.length} widths = ${measurements.length} current loopback Chrome cases.`,
    );
  } finally {
    client?.close();
    await stopChrome(chrome);
    await removeProfile(profileDirectory);
  }
}

type CdpResult = Record<string, unknown>;
type PendingCommand = {
  resolve: (value: CdpResult) => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
};

class CdpClient {
  private nextId = 1;
  private pending = new Map<number, PendingCommand>();

  private constructor(private readonly socket: WebSocket) {
    socket.addEventListener("message", (event) => void this.handleMessage(event.data));
    socket.addEventListener("close", () => {
      for (const command of this.pending.values()) {
        clearTimeout(command.timeout);
        command.reject(new Error("Chrome DevTools connection closed."));
      }
      this.pending.clear();
    });
  }

  static async connect(url: string) {
    const socket = new WebSocket(url);
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error("Chrome DevTools connection timed out.")),
        15_000,
      );
      socket.addEventListener("open", () => {
        clearTimeout(timeout);
        resolve();
      });
      socket.addEventListener("error", () => {
        clearTimeout(timeout);
        reject(new Error("Chrome DevTools connection failed."));
      });
    });
    return new CdpClient(socket);
  }

  send(method: string, params: Record<string, unknown> = {}) {
    const id = this.nextId++;
    return new Promise<CdpResult>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Chrome DevTools command timed out: ${method}`));
      }, 30_000);
      this.pending.set(id, { resolve, reject, timeout });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  close() {
    this.socket.close();
  }

  private async handleMessage(data: string | ArrayBuffer | Blob) {
    const raw =
      typeof data === "string"
        ? data
        : data instanceof ArrayBuffer
          ? Buffer.from(data).toString("utf8")
          : await data.text();
    const message = JSON.parse(raw) as {
      id?: number;
      result?: CdpResult;
      error?: { message?: string };
    };
    if (message.id === undefined) return;
    const command = this.pending.get(message.id);
    if (!command) return;
    clearTimeout(command.timeout);
    this.pending.delete(message.id);
    if (message.error) {
      command.reject(
        new Error(message.error.message ?? "Chrome DevTools command failed."),
      );
    } else {
      command.resolve(message.result ?? {});
    }
  }
}

async function measureRoute(
  cdp: CdpClient,
  origin: string,
  route: string,
  width: number,
) {
  const response = await fetch(`${origin}${route}`, {
    redirect: "manual",
    signal: AbortSignal.timeout(15_000),
  });
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width,
    height: width < 700 ? 844 : 1000,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await cdp.send("Page.navigate", { url: `${origin}${route}` });
  await waitForReady(cdp);
  return evaluate<PublicRouteResponsiveMeasurement>(
    cdp,
    `(() => {
      const route = ${JSON.stringify(route)};
      const width = ${width};
      const httpStatus = ${response.status};
      const selectors = "main,header,footer,nav,section,article,form,table,[role=main],[role=navigation]";
      const visible = (element) => {
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
      };
      const selectorFor = (element) => {
        if (element.id) return "#" + CSS.escape(element.id);
        const tag = element.tagName.toLowerCase();
        const siblings = element.parentElement
          ? [...element.parentElement.children].filter((sibling) => sibling.tagName === element.tagName)
          : [];
        return siblings.length > 1 ? tag + ":nth-of-type(" + (siblings.indexOf(element) + 1) + ")" : tag;
      };
      const overflowingRegions = [...document.querySelectorAll(selectors)]
        .filter(visible)
        .filter((element) => {
          const rect = element.getBoundingClientRect();
          return rect.left < -1 || rect.right > document.documentElement.clientWidth + 1 || element.scrollWidth > element.clientWidth + 1;
        })
        .map(selectorFor);
      return {
        route,
        width,
        httpStatus,
        finalPath: location.pathname,
        documentClientWidth: document.documentElement.clientWidth,
        documentScrollWidth: document.documentElement.scrollWidth,
        bodyClientWidth: document.body.clientWidth,
        bodyScrollWidth: document.body.scrollWidth,
        overflowingRegions: [...new Set(overflowingRegions)],
      };
    })()`,
  );
}

async function waitForReady(cdp: CdpClient) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    const ready = await evaluate<boolean>(
      cdp,
      'document.readyState === "complete" && Boolean(document.body)',
    );
    if (ready) return;
    await delay(100);
  }
  throw new Error("Public route browser readiness timed out.");
}

async function evaluate<T>(cdp: CdpClient, expression: string) {
  const response = await cdp.send("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (response.exceptionDetails) throw new Error("Browser evaluation failed.");
  const result = response.result as { value?: T } | undefined;
  return result?.value as T;
}

function loopbackOrigin(value: string) {
  const url = new URL(value);
  assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(url.hostname));
  assert.ok(["http:", "https:"].includes(url.protocol));
  assert.equal(url.username, "");
  assert.equal(url.password, "");
  assert.equal(url.pathname, "/");
  assert.equal(url.search, "");
  assert.equal(url.hash, "");
  return url.origin;
}

function resolveChromeExecutable() {
  const candidates = [
    process.env.PROGRAMFILES &&
      path.join(process.env.PROGRAMFILES, "Google/Chrome/Application/chrome.exe"),
    process.env["PROGRAMFILES(X86)"] &&
      path.join(
        process.env["PROGRAMFILES(X86)"],
        "Google/Chrome/Application/chrome.exe",
      ),
    process.env.LOCALAPPDATA &&
      path.join(process.env.LOCALAPPDATA, "Google/Chrome/Application/chrome.exe"),
  ].filter((candidate): candidate is string => Boolean(candidate));
  const executable = candidates.find(existsSync);
  if (!executable) throw new Error("Google Chrome was not found.");
  return executable;
}

function spawnChrome(executable: string, profile: string, port: number) {
  return spawn(
    executable,
    [
      "--headless=new",
      "--disable-background-networking",
      "--disable-default-apps",
      "--disable-extensions",
      "--disable-sync",
      "--no-default-browser-check",
      "--no-first-run",
      `--remote-debugging-port=${port}`,
      "--remote-debugging-address=127.0.0.1",
      `--user-data-dir=${profile}`,
      "about:blank",
    ],
    { stdio: "ignore", windowsHide: true },
  );
}

function reservePort() {
  return new Promise<number>((resolve, reject) => {
    const server = createServer();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close();
        reject(new Error("Unable to reserve a Chrome DevTools port."));
        return;
      }
      server.close((error) => (error ? reject(error) : resolve(address.port)));
    });
  });
}

async function waitForChrome(port: number, chromeProcess: ChildProcess) {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    if (chromeProcess.exitCode !== null) throw new Error("Chrome exited early.");
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/version`, {
        signal: AbortSignal.timeout(1_000),
      });
      if (response.ok) return;
    } catch {
      // Chrome has not opened its loopback debugger yet.
    }
    await delay(100);
  }
  throw new Error("Chrome DevTools did not become ready.");
}

async function createTarget(port: number) {
  const response = await fetch(
    `http://127.0.0.1:${port}/json/new?about%3Ablank`,
    { method: "PUT", signal: AbortSignal.timeout(5_000) },
  );
  assert.equal(response.ok, true);
  const target = (await response.json()) as { webSocketDebuggerUrl?: string };
  assert.ok(target.webSocketDebuggerUrl);
  return { webSocketDebuggerUrl: target.webSocketDebuggerUrl };
}

async function stopChrome(chromeProcess: ChildProcess) {
  if (chromeProcess.exitCode !== null) return;
  chromeProcess.kill();
  await Promise.race([
    new Promise<void>((resolve) => chromeProcess.once("exit", () => resolve())),
    delay(5_000),
  ]);
}

async function removeProfile(profile: string) {
  const [tempRoot, canonicalProfile] = await Promise.all([
    realpath(tmpdir()),
    realpath(profile),
  ]);
  const relativeProfile = path.relative(tempRoot, canonicalProfile);
  assert.equal(path.dirname(relativeProfile), ".");
  assert.match(path.basename(relativeProfile), /^greyhoundiq-public-responsive-/);
  await rm(canonicalProfile, { recursive: true, force: true, maxRetries: 3 });
}

function delay(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
