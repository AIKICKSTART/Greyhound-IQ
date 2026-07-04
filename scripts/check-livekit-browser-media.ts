import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { createServer, type Server } from "node:http";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";

import "./load-env";

type ProbeResult = {
  ok: boolean;
  error?: string;
  data?: {
    text: string;
    participant: string | null;
    topic: string | null;
  };
  media?: Array<{
    kind: string;
    participant: string;
    source: string;
  }>;
};

type CdpCommandResult = {
  result?: {
    result?: {
      value?: string;
    };
  };
};

const liveKitUrl = requiredEnv("LIVEKIT_URL");
const apiKey = requiredEnv("LIVEKIT_API_KEY");
const apiSecret = requiredEnv("LIVEKIT_API_SECRET");

main().catch((err) => {
  console.error("LiveKit browser media check failed:");
  console.error(String(err));
  process.exit(1);
});

async function main() {
  const chromePath = await findBrowserPath();
  const bundle = await readFile(
    join(process.cwd(), "node_modules/livekit-client/dist/livekit-client.umd.js")
  );
  const roomName = `browser-media-probe-${Date.now()}`;
  const nowSeconds = Math.floor(Date.now() / 1000);
  const tokenA = createLiveKitToken(
    "browser-media-a",
    "Browser Media A",
    roomName,
    nowSeconds
  );
  const tokenB = createLiveKitToken(
    "browser-media-b",
    "Browser Media B",
    roomName,
    nowSeconds
  );

  const server = await startProbeServer(bundle, {
    liveKitUrl,
    roomName,
    tokenA,
    tokenB,
  });
  const port = (server.address() as { port: number }).port;
  const userDataDir = await mkdtemp(join(tmpdir(), "ghiq-livekit-browser-"));
  let browser: ChildProcessWithoutNullStreams | null = null;

  try {
    const debugPort = await freePort();
    browser = spawn(chromePath, [
      "--headless=new",
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-background-networking",
      `--remote-debugging-port=${debugPort}`,
      `--user-data-dir=${userDataDir}`,
      `http://127.0.0.1:${port}/`,
    ]);

    const websocketUrl = await waitForPageWebSocket(debugPort, port);
    const result = await waitForProbeResult(websocketUrl);

    assert.equal(result.ok, true, result.error ?? "browser probe failed");
    assert.equal(result.data?.text, "greyhoundiq-livekit-data-probe");
    assert.equal(result.data?.participant, "browser-media-a");
    assert.equal(result.data?.topic, "launch-check");
    assert.ok(result.media?.some((item) => item.kind === "audio"));
    assert.ok(result.media?.some((item) => item.kind === "video"));

    console.log("LiveKit browser media check passed");
  } finally {
    await stopBrowser(browser);
    await closeServer(server);
    await removeDirectoryBestEffort(userDataDir);
  }
}

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function createLiveKitToken(
  profileId: string,
  displayName: string,
  roomName: string,
  nowSeconds: number
) {
  const payload = {
    iss: apiKey,
    sub: profileId,
    name: displayName,
    nbf: nowSeconds - 5,
    exp: nowSeconds + 10 * 60,
    video: {
      room: roomName,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    },
  };
  const unsigned = `${base64UrlJson({ alg: "HS256", typ: "JWT" })}.${base64UrlJson(payload)}`;
  const signature = createHmac("sha256", apiSecret)
    .update(unsigned)
    .digest("base64url");
  return `${unsigned}.${signature}`;
}

function base64UrlJson(value: unknown) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

async function startProbeServer(
  bundle: Buffer,
  config: {
    liveKitUrl: string;
    roomName: string;
    tokenA: string;
    tokenB: string;
  }
) {
  const server = createServer((request, response) => {
    if (request.url === "/livekit-client.umd.js") {
      response.writeHead(200, {
        "cache-control": "no-store",
        "content-type": "text/javascript; charset=utf-8",
      });
      response.end(bundle);
      return;
    }

    if (request.url === "/") {
      response.writeHead(200, {
        "cache-control": "no-store",
        "content-type": "text/html; charset=utf-8",
      });
      response.end(probeHtml(config));
      return;
    }

    response.writeHead(404);
    response.end("not found");
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  return server;
}

function probeHtml(config: {
  liveKitUrl: string;
  roomName: string;
  tokenA: string;
  tokenB: string;
}) {
  return `<!doctype html><html><body><main id="status">running</main><pre id="result"></pre><script src="/livekit-client.umd.js"></script><script>
const resultEl = document.getElementById("result");
const statusEl = document.getElementById("status");
const config = ${JSON.stringify(config)};
const writeResult = (value) => { resultEl.textContent = JSON.stringify(value); };
const waitUntil = (predicate, timeoutMs, label) => new Promise((resolve, reject) => {
  const started = Date.now();
  const tick = () => {
    if (predicate()) return resolve(true);
    if (Date.now() - started > timeoutMs) return reject(new Error(label + " timed out"));
    setTimeout(tick, 100);
  };
  tick();
});

(async () => {
  if (!window.LivekitClient) return writeResult({ ok: false, error: "livekit bundle missing" });
  const {
    Room,
    RoomEvent,
    Track,
    getEmptyAudioStreamTrack,
    getEmptyVideoStreamTrack,
  } = window.LivekitClient;
  const roomA = new Room({ adaptiveStream: true, dynacast: true });
  const roomB = new Room({ adaptiveStream: true, dynacast: true });
  const media = [];
  let data = null;
  let audioTrack = null;
  let videoTrack = null;

  roomB.on(RoomEvent.DataReceived, (payload, participant, _kind, topic) => {
    data = {
      text: new TextDecoder().decode(payload),
      participant: participant?.identity ?? null,
      topic: topic ?? null,
    };
  });
  roomB.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
    media.push({
      kind: track.kind,
      participant: participant.identity,
      source: publication.source,
    });
  });

  try {
    await roomA.connect(config.liveKitUrl, config.tokenA);
    await roomB.connect(config.liveKitUrl, config.tokenB);
    await waitUntil(
      () => roomA.remoteParticipants.size === 1 && roomB.remoteParticipants.size === 1,
      15000,
      "participant visibility"
    );
    await roomA.localParticipant.publishData(
      new TextEncoder().encode("greyhoundiq-livekit-data-probe"),
      { reliable: true, topic: "launch-check" }
    );
    audioTrack = getEmptyAudioStreamTrack();
    videoTrack = getEmptyVideoStreamTrack();
    await roomA.localParticipant.publishTrack(audioTrack, {
      name: "probe-audio",
      source: Track.Source.Microphone,
    });
    await roomA.localParticipant.publishTrack(videoTrack, {
      name: "probe-video",
      simulcast: false,
      source: Track.Source.Camera,
    });
    await waitUntil(
      () =>
        data?.text === "greyhoundiq-livekit-data-probe" &&
        media.some((item) => item.kind === "audio") &&
        media.some((item) => item.kind === "video"),
      20000,
      "data/media receive"
    );
    statusEl.textContent = "ok";
    writeResult({ ok: true, data, media });
  } catch (error) {
    statusEl.textContent = "failed";
    writeResult({ ok: false, error: error?.message ?? String(error), data, media });
  } finally {
    try { if (audioTrack) roomA.localParticipant.unpublishTrack(audioTrack); } catch (_) {}
    try { if (videoTrack) roomA.localParticipant.unpublishTrack(videoTrack); } catch (_) {}
    try { audioTrack?.stop?.(); } catch (_) {}
    try { videoTrack?.stop?.(); } catch (_) {}
    roomA.disconnect();
    roomB.disconnect();
  }
})();
</script></body></html>`;
}

async function findBrowserPath() {
  const configured = process.env.CHROME_PATH?.trim();
  const candidates = [
    configured,
    join(
      process.env.PROGRAMFILES ?? "C:\\Program Files",
      "Google/Chrome/Application/chrome.exe"
    ),
    join(
      process.env["PROGRAMFILES(X86)"] ?? "C:\\Program Files (x86)",
      "Google/Chrome/Application/chrome.exe"
    ),
    join(
      process.env.LOCALAPPDATA ?? "",
      "Google/Chrome/Application/chrome.exe"
    ),
    join(
      process.env.PROGRAMFILES ?? "C:\\Program Files",
      "Microsoft/Edge/Application/msedge.exe"
    ),
  ].filter(Boolean) as string[];

  for (const candidate of candidates) {
    try {
      await readFile(candidate);
      return candidate;
    } catch {
      // keep looking
    }
  }

  throw new Error("Chrome or Edge was not found. Set CHROME_PATH to run this check.");
}

async function freePort() {
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as { port: number }).port;
  await closeServer(server);
  return port;
}

async function waitForPageWebSocket(debugPort: number, pagePort: number) {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    try {
      const tabs = (await fetchJson(
        `http://127.0.0.1:${debugPort}/json/list`
      )) as Array<{ url: string; webSocketDebuggerUrl?: string }>;
      const page = tabs.find((tab) => tab.url === `http://127.0.0.1:${pagePort}/`);
      if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
    } catch {
      // Chrome may still be booting.
    }
    await delay(250);
  }
  throw new Error("Chrome DevTools page was not ready");
}

async function waitForProbeResult(websocketUrl: string): Promise<ProbeResult> {
  const cdp = await connectCdp(websocketUrl);
  try {
    const deadline = Date.now() + 45_000;
    while (Date.now() < deadline) {
      const response = await cdp.send("Runtime.evaluate", {
        expression: 'document.getElementById("result")?.textContent || ""',
        returnByValue: true,
      });
      const raw = response.result?.result?.value?.trim();
      if (raw) return JSON.parse(raw) as ProbeResult;
      await delay(500);
    }
    return { ok: false, error: "probe result timed out" };
  } finally {
    cdp.close();
  }
}

async function connectCdp(websocketUrl: string) {
  const socket = new WebSocket(websocketUrl);
  const pending = new Map<
    number,
    {
      reject: (error: Error) => void;
      resolve: (value: CdpCommandResult) => void;
    }
  >();
  let nextId = 1;

  await new Promise<void>((resolve, reject) => {
    socket.addEventListener("open", () => resolve(), { once: true });
    socket.addEventListener(
      "error",
      () => reject(new Error("Chrome DevTools websocket failed")),
      { once: true }
    );
  });

  socket.addEventListener("message", (event) => {
    const message = JSON.parse(String(event.data)) as {
      error?: { message?: string };
      id?: number;
      result?: CdpCommandResult["result"];
    };
    if (!message.id) return;
    const request = pending.get(message.id);
    if (!request) return;
    pending.delete(message.id);
    if (message.error) {
      request.reject(new Error(message.error.message ?? "CDP command failed"));
    } else {
      request.resolve({ result: message.result });
    }
  });

  return {
    close() {
      socket.close();
    },
    send(method: string, params?: Record<string, unknown>) {
      const id = nextId++;
      socket.send(JSON.stringify({ id, method, params }));
      return new Promise<CdpCommandResult>((resolve, reject) => {
        pending.set(id, { reject, resolve });
      });
    },
  };
}

async function fetchJson(url: string) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`GET ${url} returned ${response.status}`);
  return response.json() as Promise<unknown>;
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function stopBrowser(browser: ChildProcessWithoutNullStreams | null) {
  if (!browser || browser.killed) return;
  browser.kill();
  await new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, 2_000);
    browser.once("exit", () => {
      clearTimeout(timer);
      resolve();
    });
  });
}

async function removeDirectoryBestEffort(path: string) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await rm(path, { force: true, recursive: true });
      return;
    } catch {
      await delay(500);
    }
  }
}

function closeServer(server: Server) {
  return new Promise<void>((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
}
