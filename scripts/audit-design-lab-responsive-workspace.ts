import { spawn, type ChildProcess } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import {
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { DESIGN_LAB_AREAS } from "../src/components/design-lab-workspace";
import {
  getDesignLabSourceFingerprint,
  getRepositoryHeadSha,
} from "./design-lab-source-fingerprint";

export const DESIGN_LAB_RESPONSIVE_WORKSPACE_AUDIT_PATH =
  "output/design-lab-responsive-workspace/latest.json";
export const DESIGN_LAB_RESPONSIVE_ARCHITECTURE_REPORT_PATH =
  "public/greyhoundiq-production-architecture.html";
export const DESIGN_LAB_RESPONSIVE_ARCHITECTURE_SOURCE_PATH =
  "docs/architecture/greyhoundiq-production-architecture-report.html";
export const DESIGN_LAB_RESPONSIVE_ARCHITECTURE_BUILD_PATH =
  "scripts/build-architecture-report.mjs";
export const DESIGN_LAB_RESPONSIVE_EVIDENCE_BOUNDARY =
  "Isolated loopback Chrome viewport evidence for local source and the hashed architecture report; not deployed-image or production evidence.";
export const DESIGN_LAB_RESPONSIVE_TABLE_COMPACT_MAX_WIDTH = 1200;
export const DESIGN_LAB_RESPONSIVE_DESKTOP_TABLE_TEXT_FLOOR_PX = 10;
export const DESIGN_LAB_RESPONSIVE_DIAGRAM_COMPACT_MAX_WIDTH = 820;
export const DESIGN_LAB_RESPONSIVE_DESKTOP_DIAGRAM_TEXT_FLOOR_PX = 12;
export const DESIGN_LAB_RESPONSIVE_EMBEDDED_REPORT_MIN_WIDTH = 1024;
export const DESIGN_LAB_RESPONSIVE_VIEWPORTS = [
  { width: 320, height: 800 },
  { width: 360, height: 800 },
  { width: 375, height: 812 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
  { width: 768, height: 1024 },
  { width: 820, height: 1000 },
  { width: 821, height: 1000 },
  { width: 1024, height: 768 },
  { width: 1152, height: 900 },
  { width: 1279, height: 900 },
  { width: 1280, height: 900 },
  { width: 1440, height: 900 },
  { width: 1535, height: 960 },
  { width: 1536, height: 960 },
  { width: 1680, height: 1050 },
  { width: 1920, height: 1080 },
] as const;

type ResponsiveSurface = {
  id: string;
  kind: "workspace-area" | "architecture-report";
  requestPath: string;
  area: string | null;
  requiresTables: boolean;
  requiresDiagrams: boolean;
};

export const DESIGN_LAB_RESPONSIVE_SURFACES: readonly ResponsiveSurface[] = [
  ...DESIGN_LAB_AREAS.map((area) => ({
    id: `workspace-${area.id}`,
    kind: "workspace-area" as const,
    requestPath: `/design-lab?area=${area.id}`,
    area: area.id,
    requiresTables: false,
    requiresDiagrams: false,
  })),
  {
    id: "architecture-report",
    kind: "architecture-report",
    requestPath: "/greyhoundiq-production-architecture.html",
    area: null,
    requiresTables: true,
    requiresDiagrams: true,
  },
];

type TableMeasurement = {
  index: number;
  selector: string;
  visible: boolean;
  tableWidth: number;
  containerWidth: number;
  widerThanContainer: boolean;
  mobileCardsPresent: boolean;
  mobileCardsVisible: boolean;
  mobileCardsWidth: number;
  mobileCardsOverflow: boolean;
  minimumMobileTextPx: number;
  minimumDesktopTextPx: number;
  bodyRowCount: number;
  mobileRecordCount: number;
  mobileSemanticParity: boolean;
  horizontalScrollAvailable: boolean;
  keyboardScrollable: boolean;
};

type DiagramMeasurement = {
  index: number;
  selector: string;
  label: string;
  visible: boolean;
  clientWidth: number;
  scrollWidth: number;
  clipped: boolean;
  diagramViewportVisible: boolean;
  mobileFlowPresent: boolean;
  mobileFlowVisible: boolean;
  mobileFlowStepCount: number;
  mobileFlowWidth: number;
  mobileFlowOverflow: boolean;
  minimumMobileTextPx: number;
  minimumDesktopLabelTextPx: number;
  viewportClientWidth: number;
  viewportScrollWidth: number;
  horizontalScrollAvailable: boolean;
  keyboardScrollable: boolean;
};

export type ResponsiveSnapshot = {
  locationUrl: string;
  title: string;
  activeArea: string | null;
  declaredDiagramCount: number | null;
  document: {
    clientWidth: number;
    scrollWidth: number;
    bodyClientWidth: number;
    bodyScrollWidth: number;
    horizontalOverflow: boolean;
  };
  architectureEmbed: {
    framePresent: boolean;
    frameVisible: boolean;
    frameClientWidth: number;
    mobileLinkPresent: boolean;
    mobileLinkVisible: boolean;
    contentClientWidth: number;
    contentScrollWidth: number;
    contentHorizontalOverflow: boolean;
  };
  tables: TableMeasurement[];
  diagrams: DiagramMeasurement[];
};

export type ResponsiveCaseResult = {
  id: string;
  surfaceId: string;
  kind: ResponsiveSurface["kind"];
  area: string | null;
  requestPath: string;
  width: number;
  height: number;
  httpStatus: number;
  finalUrl: string;
  durationMs: number;
  snapshot: ResponsiveSnapshot;
  runtimeExceptions: string[];
  mutatingRequests: Array<{ method: string; url: string }>;
  failures: string[];
  passed: boolean;
};

export type ResponsiveAuditReport = {
  schemaVersion: 1;
  auditKind: "design-lab-responsive-workspace";
  evidenceBoundary: string;
  generatedAt: string;
  baseUrl: string;
  browser: { product: string; protocolVersion: string };
  testedCommitSha: string;
  sourceSha256: string;
  sourceFileCount: number;
  auditScriptSha256: string;
  architectureReportSha256: string;
  architectureSourceSha256: string;
  architectureBuildSha256: string;
  viewportWidths: number[];
  expectedCases: number;
  passedCases: number;
  results: ResponsiveCaseResult[];
};

type AuditBinding = {
  headSha: string;
  sourceSha256: string;
  sourceFileCount: number;
  auditScriptSha256: string;
  architectureReportSha256: string;
  architectureSourceSha256: string;
  architectureBuildSha256: string;
  now?: number;
};

type CdpResult = Record<string, unknown>;
type CdpEvent = { method: string; params?: Record<string, unknown> };
type PendingCommand = {
  resolve: (value: CdpResult) => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
};

class CdpClient {
  private nextId = 1;
  private pending = new Map<number, PendingCommand>();
  private listeners = new Set<(event: CdpEvent) => void>();

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

  onEvent(listener: (event: CdpEvent) => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  waitForEvent(method: string, timeoutMs = 30_000) {
    return new Promise<CdpEvent>((resolve, reject) => {
      const timeout = setTimeout(() => {
        unsubscribe();
        reject(new Error(`Chrome DevTools event timed out: ${method}`));
      }, timeoutMs);
      const unsubscribe = this.onEvent((event) => {
        if (event.method !== method) return;
        clearTimeout(timeout);
        unsubscribe();
        resolve(event);
      });
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
      method?: string;
      params?: Record<string, unknown>;
    };
    if (message.id !== undefined) {
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
      return;
    }
    if (!message.method) return;
    const event = { method: message.method, params: message.params };
    for (const listener of this.listeners) listener(event);
  }
}

export function findResponsiveCaseFailures(
  result: Omit<ResponsiveCaseResult, "failures" | "passed">,
) {
  const failures: string[] = [];
  const surface = DESIGN_LAB_RESPONSIVE_SURFACES.find(
    (candidate) => candidate.id === result.surfaceId,
  );
  if (!surface) return [`Unknown responsive audit surface: ${result.surfaceId}`];
  if (result.httpStatus !== 200) failures.push(`HTTP ${result.httpStatus}, expected 200`);
  if (pathAndSearch(result.finalUrl) !== surface.requestPath) {
    failures.push(`final path ${pathAndSearch(result.finalUrl)} does not match ${surface.requestPath}`);
  }
  if (result.snapshot.document.horizontalOverflow) {
    failures.push(
      `document horizontal overflow ${result.snapshot.document.scrollWidth}px > ${result.snapshot.document.clientWidth}px`,
    );
  }
  const architectureWorkspace = surface.id === "workspace-architecture";
  const embeddedReportRequired =
    architectureWorkspace &&
    result.width >= DESIGN_LAB_RESPONSIVE_EMBEDDED_REPORT_MIN_WIDTH;
  const requiresTables = surface.requiresTables || embeddedReportRequired;
  const requiresDiagrams = surface.requiresDiagrams || embeddedReportRequired;
  const reportViewportWidth = embeddedReportRequired
    ? result.snapshot.architectureEmbed.contentClientWidth
    : result.width;
  if (architectureWorkspace && embeddedReportRequired) {
    if (!result.snapshot.architectureEmbed.framePresent) {
      failures.push("Design Lab architecture report iframe is missing");
    } else if (!result.snapshot.architectureEmbed.frameVisible) {
      failures.push(`Design Lab architecture report iframe is hidden at ${result.width}px`);
    }
    if (result.snapshot.architectureEmbed.mobileLinkVisible) {
      failures.push(`Design Lab mobile architecture handoff remains visible at ${result.width}px`);
    }
    if (result.snapshot.architectureEmbed.contentHorizontalOverflow) {
      failures.push(
        `embedded architecture report overflows ${result.snapshot.architectureEmbed.contentScrollWidth}px > ${result.snapshot.architectureEmbed.contentClientWidth}px`,
      );
    }
  } else if (architectureWorkspace) {
    if (result.snapshot.architectureEmbed.frameVisible) {
      failures.push(`Design Lab architecture report iframe is visible at ${result.width}px`);
    }
    if (!result.snapshot.architectureEmbed.mobileLinkPresent) {
      failures.push("Design Lab mobile architecture handoff is missing");
    } else if (!result.snapshot.architectureEmbed.mobileLinkVisible) {
      failures.push(`Design Lab mobile architecture handoff is hidden at ${result.width}px`);
    }
  }
  const compactTables =
    requiresTables &&
    reportViewportWidth <= DESIGN_LAB_RESPONSIVE_TABLE_COMPACT_MAX_WIDTH;
  const compactDiagrams =
    requiresDiagrams &&
    reportViewportWidth <= DESIGN_LAB_RESPONSIVE_DIAGRAM_COMPACT_MAX_WIDTH;
  for (const table of result.snapshot.tables) {
    if (table.visible && table.widerThanContainer) {
      if (!table.horizontalScrollAvailable) {
        failures.push(
          `table ${table.selector} is ${table.tableWidth}px wide inside a ${table.containerWidth}px container without contained scrolling`,
        );
      } else if (!table.keyboardScrollable) {
        failures.push(`table ${table.selector} scroll region is not keyboard focusable`);
      }
    }
    if (requiresTables && !table.mobileCardsPresent) {
      failures.push(`table ${table.selector} has no responsive mobile record collection`);
    } else if (requiresTables && !table.mobileSemanticParity) {
      failures.push(
        `table ${table.selector} mobile records do not preserve ${table.bodyRowCount} rows and their header labels`,
      );
    } else if (compactTables && table.visible) {
      failures.push(`desktop table ${table.selector} remains visible at ${reportViewportWidth}px`);
    } else if (compactTables && !table.mobileCardsVisible) {
      failures.push(`table ${table.selector} mobile record collection is not visible`);
    } else if (compactTables && table.mobileCardsOverflow) {
      failures.push(
        `table ${table.selector} mobile records are ${table.mobileCardsWidth}px wide inside a ${table.containerWidth}px container`,
      );
    } else if (compactTables && table.minimumMobileTextPx < 11) {
      failures.push(
        `table ${table.selector} mobile labels are ${table.minimumMobileTextPx}px; expected at least 11px`,
      );
    } else if (requiresTables && !compactTables && !table.visible) {
      failures.push(`desktop table ${table.selector} is hidden at ${reportViewportWidth}px`);
    } else if (requiresTables && !compactTables && table.mobileCardsVisible) {
      failures.push(`table ${table.selector} mobile records remain visible at ${reportViewportWidth}px`);
    } else if (
      requiresTables &&
      !compactTables &&
      table.minimumDesktopTextPx <
        DESIGN_LAB_RESPONSIVE_DESKTOP_TABLE_TEXT_FLOOR_PX
    ) {
      failures.push(
        `table ${table.selector} desktop text renders at ${table.minimumDesktopTextPx}px; expected at least ${DESIGN_LAB_RESPONSIVE_DESKTOP_TABLE_TEXT_FLOOR_PX}px`,
      );
    }
  }
  for (const diagram of result.snapshot.diagrams) {
    if (diagram.visible && diagram.clipped) {
      failures.push(
        `diagram ${diagram.selector} is clipped; every diagram must fit the viewport in full`,
      );
    }
    if (compactDiagrams) {
      if (!diagram.mobileFlowPresent) {
        failures.push(`diagram ${diagram.selector} has no semantic mobile flow`);
      } else if (!diagram.mobileFlowVisible) {
        failures.push(`diagram ${diagram.selector} semantic mobile flow is not visible`);
      } else if (diagram.mobileFlowStepCount === 0) {
        failures.push(`diagram ${diagram.selector} semantic mobile flow has no steps`);
      } else if (diagram.mobileFlowOverflow) {
        failures.push(
          `diagram ${diagram.selector} semantic mobile flow is ${diagram.mobileFlowWidth}px wide inside a ${diagram.clientWidth}px diagram`,
        );
      } else if (diagram.minimumMobileTextPx < 12) {
        failures.push(
          `diagram ${diagram.selector} mobile text is ${diagram.minimumMobileTextPx}px; expected at least 12px`,
        );
      }
      if (diagram.diagramViewportVisible) {
        failures.push(`diagram ${diagram.selector} exposes the dense desktop SVG at ${reportViewportWidth}px`);
      }
    } else if (requiresDiagrams) {
      if (!diagram.diagramViewportVisible) {
        failures.push(`diagram ${diagram.selector} desktop visual viewport is not visible`);
      } else if (diagram.mobileFlowVisible) {
        failures.push(`diagram ${diagram.selector} compact flow remains visible at ${reportViewportWidth}px`);
      } else if (
        diagram.minimumDesktopLabelTextPx <
        DESIGN_LAB_RESPONSIVE_DESKTOP_DIAGRAM_TEXT_FLOOR_PX
      ) {
        failures.push(
          `diagram ${diagram.selector} desktop label text renders at ${diagram.minimumDesktopLabelTextPx}px; expected at least ${DESIGN_LAB_RESPONSIVE_DESKTOP_DIAGRAM_TEXT_FLOOR_PX}px`,
        );
      } else if (
        diagram.viewportScrollWidth > diagram.viewportClientWidth + 1 &&
        !diagram.horizontalScrollAvailable
      ) {
        failures.push(`diagram ${diagram.selector} has wide visual content without a contained scroll region`);
      } else if (
        diagram.viewportScrollWidth > diagram.viewportClientWidth + 1 &&
        !diagram.keyboardScrollable
      ) {
        failures.push(`diagram ${diagram.selector} scroll region is not keyboard focusable`);
      }
    }
  }
  if (surface.kind === "workspace-area" && result.snapshot.activeArea !== surface.area) {
    failures.push(
      `active workspace area ${result.snapshot.activeArea ?? "missing"} does not match ${surface.area}`,
    );
  }
  if (requiresTables && result.snapshot.tables.length === 0) {
    failures.push("architecture report exposed no tables to audit");
  }
  if (requiresDiagrams && result.snapshot.diagrams.length === 0) {
    failures.push("architecture report exposed no diagrams to audit");
  }
  if (
    requiresDiagrams &&
    result.snapshot.declaredDiagramCount !== result.snapshot.diagrams.length
  ) {
    failures.push(
      `architecture report declared ${result.snapshot.declaredDiagramCount ?? "no"} diagrams but exposed ${result.snapshot.diagrams.length}`,
    );
  }
  failures.push(
    ...result.runtimeExceptions.map((exception) => `browser exception: ${exception}`),
  );
  failures.push(
    ...result.mutatingRequests.map(
      (request) => `read-only boundary violated by ${request.method} ${request.url}`,
    ),
  );
  return failures;
}

export function findDesignLabResponsiveWorkspaceAuditIssues(
  value: unknown,
  binding?: AuditBinding,
) {
  const issues: string[] = [];
  if (!isRecord(value)) return ["Responsive workspace audit must be a JSON object."];
  if (value.schemaVersion !== 1) issues.push("Responsive workspace audit schemaVersion must be 1.");
  if (value.auditKind !== "design-lab-responsive-workspace") {
    issues.push("Responsive workspace audit kind is invalid.");
  }
  if (value.evidenceBoundary !== DESIGN_LAB_RESPONSIVE_EVIDENCE_BOUNDARY) {
    issues.push("Responsive workspace audit evidence boundary is invalid.");
  }
  if (!isLoopbackBaseUrl(value.baseUrl)) {
    issues.push("Responsive workspace audit baseUrl must be a loopback origin.");
  }
  const browser = isRecord(value.browser) ? value.browser : undefined;
  if (typeof browser?.product !== "string" || !/^Chrome\//.test(browser.product)) {
    issues.push("Responsive workspace audit browser must be Google Chrome.");
  }
  if (typeof browser?.protocolVersion !== "string" || !browser.protocolVersion) {
    issues.push("Responsive workspace audit browser protocol is missing.");
  }
  if (!Array.isArray(value.viewportWidths)) {
    issues.push("Responsive workspace audit viewport widths are missing.");
  } else if (
    JSON.stringify(value.viewportWidths) !==
    JSON.stringify(DESIGN_LAB_RESPONSIVE_VIEWPORTS.map((viewport) => viewport.width))
  ) {
    issues.push("Responsive workspace audit viewport inventory does not match the exact configured widths.");
  }

  const expectedCases = expectedResponsiveCases();
  const results = Array.isArray(value.results) ? value.results : [];
  if (results.length !== expectedCases.length) {
    issues.push("Responsive workspace audit does not contain the exact case inventory.");
  }
  const resultIds = results
    .filter(isRecord)
    .map((result) => result.id)
    .filter((id): id is string => typeof id === "string");
  if (
    new Set(resultIds).size !== expectedCases.length ||
    JSON.stringify([...resultIds].sort()) !==
      JSON.stringify(expectedCases.map((item) => item.id).sort())
  ) {
    issues.push("Responsive workspace audit case IDs do not match the exact inventory.");
  }
  for (const expected of expectedCases) {
    const raw = results.find(
      (candidate) => isRecord(candidate) && candidate.id === expected.id,
    );
    if (!isResponsiveCaseResult(raw)) {
      issues.push(`Responsive case ${expected.id} is missing or malformed.`);
      continue;
    }
    if (
      raw.surfaceId !== expected.surface.id ||
      raw.kind !== expected.surface.kind ||
      raw.area !== expected.surface.area ||
      raw.requestPath !== expected.surface.requestPath ||
      raw.width !== expected.viewport.width ||
      raw.height !== expected.viewport.height
    ) {
      issues.push(`Responsive case ${expected.id} metadata does not match its contract.`);
      continue;
    }
    const computedFailures = findResponsiveCaseFailures(caseInput(raw));
    if (
      computedFailures.length > 0 ||
      raw.failures.length > 0 ||
      !raw.passed
    ) {
      issues.push(`Responsive case ${expected.id} did not pass its fail-closed checks.`);
    }
  }
  if (
    value.expectedCases !== expectedCases.length ||
    value.passedCases !== expectedCases.length
  ) {
    issues.push("Responsive workspace audit summary does not match the required inventory.");
  }

  if (binding) {
    if (value.testedCommitSha !== binding.headSha) {
      issues.push("Responsive workspace audit is not bound to the current Git HEAD.");
    }
    if (value.sourceSha256 !== binding.sourceSha256) {
      issues.push("Responsive workspace audit source digest does not match.");
    }
    if (value.sourceFileCount !== binding.sourceFileCount) {
      issues.push("Responsive workspace audit source-file count does not match.");
    }
    if (value.auditScriptSha256 !== binding.auditScriptSha256) {
      issues.push("Responsive workspace audit implementation digest does not match.");
    }
    if (value.architectureReportSha256 !== binding.architectureReportSha256) {
      issues.push("Responsive workspace audit architecture-report digest does not match.");
    }
    if (value.architectureSourceSha256 !== binding.architectureSourceSha256) {
      issues.push("Responsive workspace audit architecture-source digest does not match.");
    }
    if (value.architectureBuildSha256 !== binding.architectureBuildSha256) {
      issues.push("Responsive workspace audit architecture-builder digest does not match.");
    }
    const generatedAt =
      typeof value.generatedAt === "string" ? Date.parse(value.generatedAt) : Number.NaN;
    const now = binding.now ?? Date.now();
    if (!Number.isFinite(generatedAt)) {
      issues.push("Responsive workspace audit generatedAt is invalid.");
    } else if (generatedAt > now + 5 * 60_000) {
      issues.push("Responsive workspace audit generatedAt is in the future.");
    } else if (now - generatedAt > 24 * 60 * 60_000) {
      issues.push("Responsive workspace audit evidence is older than 24 hours.");
    }
  }
  return issues;
}

async function runCase(
  client: CdpClient,
  baseUrl: string,
  surface: ResponsiveSurface,
  viewport: (typeof DESIGN_LAB_RESPONSIVE_VIEWPORTS)[number],
) {
  const startedAt = performance.now();
  const requestUrl = new URL(surface.requestPath, baseUrl).href;
  const runtimeExceptions: string[] = [];
  const mutatingRequests: Array<{ method: string; url: string }> = [];
  let documentStatus = 0;
  let caseStarted = false;
  const unsubscribe = client.onEvent((event) => {
    if (!caseStarted) return;
    if (event.method === "Runtime.exceptionThrown") {
      const details = isRecord(event.params?.exceptionDetails)
        ? event.params.exceptionDetails
        : undefined;
      const exception = isRecord(details?.exception) ? details.exception : undefined;
      runtimeExceptions.push(
        typeof exception?.description === "string"
          ? exception.description
          : typeof details?.text === "string"
            ? details.text
            : "Unhandled browser exception",
      );
    }
    if (event.method === "Network.requestWillBeSent") {
      const request = isRecord(event.params?.request) ? event.params.request : undefined;
      const method = typeof request?.method === "string" ? request.method : "";
      const url = typeof request?.url === "string" ? request.url : "";
      if (method && !["GET", "HEAD", "OPTIONS"].includes(method)) {
        mutatingRequests.push({ method, url });
      }
    }
    if (event.method === "Network.responseReceived" && event.params?.type === "Document") {
      const response = isRecord(event.params.response) ? event.params.response : undefined;
      if (typeof response?.status === "number") documentStatus = response.status;
    }
  });

  try {
    await client.send("Emulation.setDeviceMetricsOverride", {
      width: viewport.width,
      height: viewport.height,
      deviceScaleFactor: 1,
      mobile: false,
      screenWidth: viewport.width,
      screenHeight: viewport.height,
    });
    caseStarted = true;
    const loaded = client.waitForEvent("Page.loadEventFired");
    const navigation = await client.send("Page.navigate", { url: requestUrl });
    if (typeof navigation.errorText === "string" && navigation.errorText) {
      throw new Error(`Navigation failed: ${navigation.errorText}`);
    }
    await loaded;
    await waitForExpression(client, readyExpression(surface, viewport.width));
    await delay(300);
    const snapshot = await evaluate<ResponsiveSnapshot>(
      client,
      responsiveSnapshotExpression(),
    );
    const baseResult = {
      id: responsiveCaseId(surface.id, viewport.width),
      surfaceId: surface.id,
      kind: surface.kind,
      area: surface.area,
      requestPath: surface.requestPath,
      width: viewport.width,
      height: viewport.height,
      httpStatus: documentStatus,
      finalUrl: snapshot.locationUrl,
      durationMs: Math.round(performance.now() - startedAt),
      snapshot,
      runtimeExceptions,
      mutatingRequests,
    } satisfies Omit<ResponsiveCaseResult, "failures" | "passed">;
    const failures = findResponsiveCaseFailures(baseResult);
    return { ...baseResult, failures, passed: failures.length === 0 };
  } finally {
    unsubscribe();
  }
}

async function main() {
  const repositoryRoot = path.resolve(".");
  const baseUrl = resolveLoopbackBaseUrl(readFlag("--base-url"));
  const outputPath = path.resolve(
    readFlag("--output") ?? DESIGN_LAB_RESPONSIVE_WORKSPACE_AUDIT_PATH,
  );
  const scriptPath = fileURLToPath(import.meta.url);
  const architectureReportPath = path.join(
    repositoryRoot,
    DESIGN_LAB_RESPONSIVE_ARCHITECTURE_REPORT_PATH,
  );
  const architectureSourcePath = path.join(
    repositoryRoot,
    DESIGN_LAB_RESPONSIVE_ARCHITECTURE_SOURCE_PATH,
  );
  const architectureBuildPath = path.join(
    repositoryRoot,
    DESIGN_LAB_RESPONSIVE_ARCHITECTURE_BUILD_PATH,
  );
  const [
    sourceBefore,
    testedCommitSha,
    auditScriptBefore,
    architectureReportBefore,
    architectureSourceBefore,
    architectureBuildBefore,
  ] =
    await Promise.all([
      Promise.resolve(getDesignLabSourceFingerprint(repositoryRoot)),
      Promise.resolve(getRepositoryHeadSha(repositoryRoot)),
      readFile(scriptPath),
      readFile(architectureReportPath),
      readFile(architectureSourcePath),
      readFile(architectureBuildPath),
    ]);
  const auditScriptSha256 = sha256(auditScriptBefore);
  const architectureReportSha256 = sha256(architectureReportBefore);
  const architectureSourceSha256 = sha256(architectureSourceBefore);
  const architectureBuildSha256 = sha256(architectureBuildBefore);
  const chromeExecutable = resolveChromeExecutable();
  const profileDirectory = await mkdtemp(
    path.join(tmpdir(), "greyhoundiq-responsive-cdp-"),
  );
  const port = await reservePort();
  const chrome = spawnChrome(chromeExecutable, profileDirectory, port);

  try {
    const version = await waitForChrome(port, chrome);
    const target = await createTarget(port);
    const client = await CdpClient.connect(target.webSocketDebuggerUrl);
    try {
      await Promise.all([
        client.send("Page.enable"),
        client.send("Runtime.enable"),
        client.send("Network.enable"),
      ]);
      const results: ResponsiveCaseResult[] = [];
      for (const viewport of DESIGN_LAB_RESPONSIVE_VIEWPORTS) {
        for (const surface of DESIGN_LAB_RESPONSIVE_SURFACES) {
          results.push(await runCase(client, baseUrl, surface, viewport));
        }
      }

      const [
        sourceAfter,
        auditScriptAfter,
        architectureReportAfter,
        architectureSourceAfter,
        architectureBuildAfter,
      ] = await Promise.all([
        Promise.resolve(getDesignLabSourceFingerprint(repositoryRoot)),
        readFile(scriptPath),
        readFile(architectureReportPath),
        readFile(architectureSourcePath),
        readFile(architectureBuildPath),
      ]);
      if (
        sourceAfter.sha256 !== sourceBefore.sha256 ||
        sourceAfter.fileCount !== sourceBefore.fileCount ||
        sha256(auditScriptAfter) !== auditScriptSha256 ||
        sha256(architectureReportAfter) !== architectureReportSha256 ||
        sha256(architectureSourceAfter) !== architectureSourceSha256 ||
        sha256(architectureBuildAfter) !== architectureBuildSha256
      ) {
        throw new Error(
          "Design Lab source or responsive audit inputs changed during the run; discard the evidence.",
        );
      }

      const report: ResponsiveAuditReport = {
        schemaVersion: 1,
        auditKind: "design-lab-responsive-workspace",
        evidenceBoundary: DESIGN_LAB_RESPONSIVE_EVIDENCE_BOUNDARY,
        generatedAt: new Date().toISOString(),
        baseUrl,
        browser: {
          product: version.Browser,
          protocolVersion: version["Protocol-Version"],
        },
        testedCommitSha,
        sourceSha256: sourceBefore.sha256,
        sourceFileCount: sourceBefore.fileCount,
        auditScriptSha256,
        architectureReportSha256,
        architectureSourceSha256,
        architectureBuildSha256,
        viewportWidths: DESIGN_LAB_RESPONSIVE_VIEWPORTS.map(
          (viewport) => viewport.width,
        ),
        expectedCases: expectedResponsiveCases().length,
        passedCases: results.filter((result) => result.passed).length,
        results,
      };
      const issues = findDesignLabResponsiveWorkspaceAuditIssues(report, {
        headSha: testedCommitSha,
        sourceSha256: sourceBefore.sha256,
        sourceFileCount: sourceBefore.fileCount,
        auditScriptSha256,
        architectureReportSha256,
        architectureSourceSha256,
        architectureBuildSha256,
      });
      if (issues.length > 0) {
        const failures = results
          .filter((result) => !result.passed)
          .map((result) => `${result.id}: ${result.failures.join("; ")}`);
        throw new Error([...issues, ...failures].join("\n"));
      }

      await mkdir(path.dirname(outputPath), { recursive: true });
      const reportJson = `${JSON.stringify(report, null, 2)}\n`;
      await writeResponsiveReport(outputPath, reportJson);
      console.log(
        `Design Lab responsive workspace: ${report.passedCases}/${report.expectedCases} cases.`,
      );
      console.log(`Evidence SHA-256: ${sha256(reportJson)}`);
      console.log(`Report: ${outputPath}`);
    } finally {
      client.close();
    }
  } finally {
    await stopChrome(chrome);
    await removeChromeProfile(profileDirectory);
  }
}

function responsiveSnapshotExpression() {
  return `(() => {
    const tolerance = 1;
    const isVisible = (element) => {
      const rect = element.getBoundingClientRect();
      const style = element.ownerDocument.defaultView.getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
    };
    const permitsHorizontalScroll = (element) => {
      const overflowX = element.ownerDocument.defaultView.getComputedStyle(element).overflowX;
      return overflowX === "auto" || overflowX === "scroll";
    };
    const describe = (element, index) => {
      if (element.id) return element.tagName.toLowerCase() + "#" + element.id;
      const classes = [...element.classList].slice(0, 3).join(".");
      return element.tagName.toLowerCase() + (classes ? "." + classes : "") + ":nth(" + (index + 1) + ")";
    };
    const accessibleName = (element) => {
      const direct = element.getAttribute("aria-label") || element.getAttribute("title");
      if (direct && direct.trim()) return direct.trim();
      const labelledBy = element.getAttribute("aria-labelledby");
      if (labelledBy) {
        const value = labelledBy.split(/\\s+/).map((id) => element.ownerDocument.getElementById(id)?.textContent || "").join(" ").trim();
        if (value) return value;
      }
      return "";
    };
    const architectureFrame = document.querySelector("[data-architecture-report-frame]");
    const architectureFrameVisible = Boolean(architectureFrame && isVisible(architectureFrame));
    const architectureFrameDocument = architectureFrameVisible
      ? architectureFrame.contentDocument
      : null;
    const measurementDocument = architectureFrameDocument || document;
    const measurementDocumentElement = measurementDocument.documentElement;
    const documentElement = document.documentElement;
    const body = document.body;
    const documentScrollWidth = Math.max(documentElement.scrollWidth, body?.scrollWidth || 0);
    const mobileArchitectureLink = document.querySelector("[data-architecture-mobile-report]");
    const tables = [...measurementDocument.querySelectorAll("table")].map((table, index) => {
      const container = table.closest(".table") || table.parentElement || measurementDocumentElement;
      const mobileCards = container.querySelector(".mobile-table-cards");
      const mobileCardsVisible = Boolean(mobileCards && isVisible(mobileCards));
      const records = mobileCards ? [...mobileCards.querySelectorAll("details.mobile-table-record")] : [];
      const normaliseText = (value) => (value || "").replace(/\s+/g, " ").trim();
      const headers = [...table.querySelectorAll("thead th")].map((header) => normaliseText(header.textContent));
      const bodyRows = [...table.querySelectorAll("tbody tr")];
      const mobileSemanticParity = Boolean(mobileCards) &&
        records.length === bodyRows.length &&
        records.every((record) => {
          const recordLabels = [
            record.querySelector(".mobile-table-key small"),
            ...record.querySelectorAll(".mobile-table-field dt"),
          ].map((label) => normaliseText(label?.textContent));
          return recordLabels.length === headers.length &&
            recordLabels.every((label, labelIndex) => label === headers[labelIndex]);
        });
      const priorOpen = records.map((record) => record.open);
      if (mobileCardsVisible) records.forEach((record) => { record.open = true; });
      const tableRect = table.getBoundingClientRect();
      const tableWidth = Math.max(table.scrollWidth, Math.ceil(tableRect.width));
      const containerWidth = container.clientWidth;
      const visible = isVisible(table);
      const mobileCardsRect = mobileCards?.getBoundingClientRect();
      const mobileCardsWidth = mobileCards
        ? Math.max(mobileCards.scrollWidth, Math.ceil(mobileCardsRect?.width || 0))
        : 0;
      const mobileCardsOverflow = mobileCardsVisible && (
        mobileCardsWidth > containerWidth + tolerance ||
        [...mobileCards.querySelectorAll("*")].some((element) => {
          if (!isVisible(element) || !mobileCardsRect) return false;
          const rect = element.getBoundingClientRect();
          return rect.left < mobileCardsRect.left - tolerance || rect.right > mobileCardsRect.right + tolerance;
        })
      );
      const mobileTextSizes = mobileCardsVisible
        ? [...mobileCards.querySelectorAll(".mobile-table-key small,.mobile-table-field dt,.mobile-table-toggle")]
            .filter(isVisible)
            .map((element) => Number.parseFloat(element.ownerDocument.defaultView.getComputedStyle(element).fontSize))
            .filter(Number.isFinite)
        : [];
      const desktopTextSizes = visible
        ? [...table.querySelectorAll("th,td")]
            .filter(isVisible)
            .map((element) => Number.parseFloat(element.ownerDocument.defaultView.getComputedStyle(element).fontSize))
            .filter(Number.isFinite)
        : [];
      records.forEach((record, recordIndex) => { record.open = priorOpen[recordIndex]; });
      return {
        index: index + 1,
        selector: describe(table, index),
        visible,
        tableWidth,
        containerWidth,
        widerThanContainer: visible && tableWidth > containerWidth + tolerance,
        mobileCardsPresent: Boolean(mobileCards),
        mobileCardsVisible,
        mobileCardsWidth,
        mobileCardsOverflow,
        minimumMobileTextPx: mobileTextSizes.length > 0 ? Math.min(...mobileTextSizes) : 0,
        minimumDesktopTextPx: desktopTextSizes.length > 0 ? Math.min(...desktopTextSizes) : 0,
        bodyRowCount: bodyRows.length,
        mobileRecordCount: records.length,
        mobileSemanticParity,
        horizontalScrollAvailable: permitsHorizontalScroll(container),
        keyboardScrollable: container.tabIndex >= 0,
      };
    });
    const diagramRoots = [...new Set([
      ...measurementDocument.querySelectorAll("article.diagram"),
      ...measurementDocument.querySelectorAll("figure[data-diagram]"),
      ...measurementDocument.querySelectorAll("[data-diagram-container]"),
      ...measurementDocument.querySelectorAll("[data-architecture-diagram]"),
    ])];
    const diagrams = diagramRoots.map((diagram, index) => {
      const visible = isVisible(diagram);
      const candidates = [...new Set([
        diagram,
        ...diagram.querySelectorAll(".diagram-viewport, [data-diagram-viewport], [role=region]"),
      ])].filter((candidate) => isVisible(candidate));
      const overflowCandidates = candidates.filter(
        (candidate) =>
          candidate.scrollWidth > candidate.clientWidth + tolerance &&
          !permitsHorizontalScroll(candidate),
      );
      const content = [...diagram.querySelectorAll(".mermaid, svg, canvas, img")].find((candidate) => isVisible(candidate));
      const contentRect = content?.getBoundingClientRect();
      const contentScrollOwner = content?.closest(".diagram-viewport, [data-diagram-viewport]");
      const clipped = visible && (
        overflowCandidates.length > 0 ||
        Boolean(
          contentRect &&
          contentRect.width > diagram.clientWidth + tolerance &&
          !(contentScrollOwner && permitsHorizontalScroll(contentScrollOwner))
        )
      );
      const diagramViewport = diagram.querySelector(".diagram-viewport, [data-diagram-viewport]");
      const mobileFlow = diagram.querySelector(".diagram-mobile-flow");
      const mobileFlowPresent = Boolean(mobileFlow);
      const mobileFlowVisible = Boolean(mobileFlow && isVisible(mobileFlow));
      const mobileFlowRect = mobileFlow?.getBoundingClientRect();
      const mobileFlowWidth = mobileFlow
        ? Math.max(mobileFlow.scrollWidth, Math.ceil(mobileFlowRect?.width || 0))
        : 0;
      const mobileFlowOverflow = mobileFlowVisible && Boolean(mobileFlowRect) && (
        mobileFlowWidth > diagram.clientWidth + tolerance ||
        [...mobileFlow.querySelectorAll("*")].some((element) => {
          if (!isVisible(element) || !mobileFlowRect) return false;
          const rect = element.getBoundingClientRect();
          return rect.left < mobileFlowRect.left - tolerance || rect.right > mobileFlowRect.right + tolerance;
        })
      );
      const mobileTextSizes = mobileFlow
        ? [...mobileFlow.querySelectorAll(".diagram-mobile-step-number, .diagram-mobile-route strong, .diagram-mobile-action")]
            .filter((element) => isVisible(element))
            .map((element) => Number.parseFloat(element.ownerDocument.defaultView.getComputedStyle(element).fontSize))
            .filter((value) => Number.isFinite(value))
        : [];
      const svg = diagram.querySelector("svg");
      const svgRect = svg?.getBoundingClientRect();
      const intrinsicSvgWidth = svg?.viewBox?.baseVal?.width ||
        Number.parseFloat(svg?.getAttribute("width") || "0") || 0;
      const svgScale = svgRect && intrinsicSvgWidth > 0
        ? svgRect.width / intrinsicSvgWidth
        : 0;
      const desktopLabelTextSizes = diagramViewport && isVisible(diagramViewport) && svgScale > 0
        ? [...svg.querySelectorAll("text, tspan, .nodeLabel, .nodeLabel *, .edgeLabel, .edgeLabel *, foreignObject *")]
            .filter((element) => isVisible(element) && element.textContent?.trim())
            .map((element) => Number.parseFloat(element.ownerDocument.defaultView.getComputedStyle(element).fontSize) * svgScale)
            .filter((value) => Number.isFinite(value) && value > 0)
        : [];
      const rect = diagram.getBoundingClientRect();
      return {
        index: index + 1,
        selector: describe(diagram, index),
        label: diagram.querySelector("h1, h2, h3, figcaption")?.textContent?.trim() || accessibleName(diagram) || "Diagram " + (index + 1),
        visible,
        clientWidth: diagram.clientWidth,
        scrollWidth: Math.max(diagram.scrollWidth, Math.ceil(rect.width)),
        clipped,
        diagramViewportVisible: Boolean(diagramViewport && isVisible(diagramViewport)),
        mobileFlowPresent,
        mobileFlowVisible,
        mobileFlowStepCount: mobileFlow?.querySelectorAll(".diagram-mobile-step").length || 0,
        mobileFlowWidth,
        mobileFlowOverflow,
        minimumMobileTextPx: mobileTextSizes.length > 0 ? Math.min(...mobileTextSizes) : 0,
        minimumDesktopLabelTextPx: desktopLabelTextSizes.length > 0
          ? Math.min(...desktopLabelTextSizes)
          : 0,
        viewportClientWidth: diagramViewport?.clientWidth || 0,
        viewportScrollWidth: diagramViewport?.scrollWidth || 0,
        horizontalScrollAvailable: Boolean(
          diagramViewport && permitsHorizontalScroll(diagramViewport)
        ),
        keyboardScrollable: Boolean(
          diagramViewport && diagramViewport.tabIndex >= 0
        ),
      };
    });
    const declared = measurementDocumentElement.getAttribute("data-architecture-diagrams-ready");
    const architectureContentScrollWidth = architectureFrameDocument
      ? Math.max(
          architectureFrameDocument.documentElement.scrollWidth,
          architectureFrameDocument.body?.scrollWidth || 0,
        )
      : 0;
    const architectureContentClientWidth = architectureFrameDocument?.documentElement.clientWidth || 0;
    return {
      locationUrl: location.href,
      title: document.title,
      activeArea: document.querySelector("[data-design-lab-active-area]")?.getAttribute("data-design-lab-active-area") || null,
      declaredDiagramCount: declared !== null && /^\\d+$/.test(declared) ? Number(declared) : null,
      document: {
        clientWidth: documentElement.clientWidth,
        scrollWidth: documentScrollWidth,
        bodyClientWidth: body?.clientWidth || 0,
        bodyScrollWidth: body?.scrollWidth || 0,
        horizontalOverflow: documentScrollWidth > documentElement.clientWidth + tolerance,
      },
      architectureEmbed: {
        framePresent: Boolean(architectureFrame),
        frameVisible: architectureFrameVisible,
        frameClientWidth: architectureFrame?.clientWidth || 0,
        mobileLinkPresent: Boolean(mobileArchitectureLink),
        mobileLinkVisible: Boolean(mobileArchitectureLink && isVisible(mobileArchitectureLink)),
        contentClientWidth: architectureContentClientWidth,
        contentScrollWidth: architectureContentScrollWidth,
        contentHorizontalOverflow:
          architectureContentScrollWidth > architectureContentClientWidth + tolerance,
      },
      tables,
      diagrams,
    };
  })()`;
}

function readyExpression(surface: ResponsiveSurface, viewportWidth: number) {
  if (surface.kind === "workspace-area") {
    if (
      surface.id === "workspace-architecture" &&
      viewportWidth >= DESIGN_LAB_RESPONSIVE_EMBEDDED_REPORT_MIN_WIDTH
    ) {
      return `document.querySelector('[data-design-lab-active-area="architecture"]') !== null && Number(document.querySelector('[data-architecture-report-frame]')?.contentDocument?.documentElement?.getAttribute('data-architecture-diagrams-ready')) > 0`;
    }
    return `document.querySelector('[data-design-lab-active-area="${surface.area}"]') !== null`;
  }
  return `Number(document.documentElement.getAttribute('data-architecture-diagrams-ready')) > 0 && document.querySelectorAll('article.diagram').length > 0`;
}

async function evaluate<T>(client: CdpClient, expression: string) {
  const response = await client.send("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (response.exceptionDetails) {
    throw new Error("Browser evaluation raised an exception.");
  }
  const result = isRecord(response.result) ? response.result : undefined;
  return result?.value as T;
}

async function waitForExpression(client: CdpClient, expression: string) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (await evaluate<boolean>(client, `Boolean(${expression})`)) return;
    await delay(100);
  }
  throw new Error(`Responsive browser condition timed out: ${expression}`);
}

function expectedResponsiveCases() {
  return DESIGN_LAB_RESPONSIVE_VIEWPORTS.flatMap((viewport) =>
    DESIGN_LAB_RESPONSIVE_SURFACES.map((surface) => ({
      id: responsiveCaseId(surface.id, viewport.width),
      surface,
      viewport,
    })),
  );
}

function responsiveCaseId(surfaceId: string, width: number) {
  return `${surfaceId}@${width}`;
}

function resolveLoopbackBaseUrl(raw = "http://localhost:3000") {
  if (!isLoopbackBaseUrl(raw)) {
    throw new Error(
      "--base-url must be an HTTP(S) loopback origin without credentials, path, query or hash.",
    );
  }
  return new URL(raw).origin;
}

export function isLoopbackBaseUrl(value: unknown) {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return (
      ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) &&
      ["http:", "https:"].includes(url.protocol) &&
      !url.username &&
      !url.password &&
      url.pathname === "/" &&
      !url.search &&
      !url.hash
    );
  } catch {
    return false;
  }
}

function pathAndSearch(value: string) {
  try {
    const url = new URL(value);
    return `${url.pathname}${url.search}`;
  } catch {
    return "invalid-url";
  }
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
  if (!executable) {
    throw new Error("Google Chrome was not found in a standard Windows installation path.");
  }
  return executable;
}

function spawnChrome(executable: string, profileDirectory: string, port: number) {
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
      `--user-data-dir=${profileDirectory}`,
      "about:blank",
    ],
    { stdio: "ignore", windowsHide: true },
  );
}

async function reservePort() {
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

async function waitForChrome(port: number, chrome: ChildProcess) {
  const endpoint = `http://127.0.0.1:${port}/json/version`;
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    if (chrome.exitCode !== null) {
      throw new Error("Google Chrome exited before DevTools became ready.");
    }
    try {
      const response = await fetch(endpoint, {
        signal: AbortSignal.timeout(1_000),
      });
      if (response.ok) return (await response.json()) as Record<string, string>;
    } catch {
      // Chrome has not opened the loopback debugger yet.
    }
    await delay(100);
  }
  throw new Error("Google Chrome DevTools endpoint did not become ready.");
}

async function createTarget(port: number) {
  const response = await fetch(
    `http://127.0.0.1:${port}/json/new?about%3Ablank`,
    { method: "PUT", signal: AbortSignal.timeout(5_000) },
  );
  if (!response.ok) {
    throw new Error(`Unable to create Chrome target: HTTP ${response.status}.`);
  }
  const value = (await response.json()) as Record<string, unknown>;
  if (typeof value.webSocketDebuggerUrl !== "string") {
    throw new Error("Chrome target did not provide a DevTools WebSocket URL.");
  }
  return { webSocketDebuggerUrl: value.webSocketDebuggerUrl };
}

async function stopChrome(chrome: ChildProcess) {
  if (chrome.exitCode !== null) return;
  chrome.kill();
  await Promise.race([
    new Promise<void>((resolve) => chrome.once("exit", () => resolve())),
    delay(5_000),
  ]);
}

async function removeChromeProfile(profileDirectory: string) {
  const [canonicalTempRoot, canonicalProfile] = await Promise.all([
    realpath(tmpdir()),
    realpath(profileDirectory),
  ]);
  const relativeProfile = path.relative(canonicalTempRoot, canonicalProfile);
  if (
    path.dirname(relativeProfile) !== "." ||
    !/^greyhoundiq-responsive-cdp-[a-z0-9_-]+$/i.test(
      path.basename(relativeProfile),
    )
  ) {
    throw new Error("Refusing to recursively remove an unexpected Chrome profile path.");
  }
  await rm(canonicalProfile, {
    recursive: true,
    force: true,
    maxRetries: 3,
    retryDelay: 100,
  });
}

export async function writeResponsiveReport(
  outputPath: string,
  reportJson: string,
) {
  const outputDirectory = path.dirname(outputPath);
  const temporaryPath = path.join(
    outputDirectory,
    `.${path.basename(outputPath)}.${process.pid}.${randomUUID()}.tmp`,
  );
  try {
    await writeFile(temporaryPath, reportJson, { encoding: "utf8", flag: "wx" });
    await rename(temporaryPath, outputPath);
  } finally {
    await rm(temporaryPath, { force: true });
  }
}

function isResponsiveCaseResult(value: unknown): value is ResponsiveCaseResult {
  if (!isRecord(value) || !isRecord(value.snapshot)) return false;
  const snapshot = value.snapshot;
  const documentMetrics = isRecord(snapshot.document)
    ? snapshot.document
    : undefined;
  const architectureEmbed = isRecord(snapshot.architectureEmbed)
    ? snapshot.architectureEmbed
    : undefined;
  return (
    typeof value.id === "string" &&
    typeof value.surfaceId === "string" &&
    ["workspace-area", "architecture-report"].includes(String(value.kind)) &&
    (typeof value.area === "string" || value.area === null) &&
    typeof value.requestPath === "string" &&
    typeof value.width === "number" &&
    typeof value.height === "number" &&
    typeof value.httpStatus === "number" &&
    typeof value.finalUrl === "string" &&
    typeof value.durationMs === "number" &&
    typeof snapshot.locationUrl === "string" &&
    typeof snapshot.title === "string" &&
    (typeof snapshot.activeArea === "string" || snapshot.activeArea === null) &&
    (typeof snapshot.declaredDiagramCount === "number" ||
      snapshot.declaredDiagramCount === null) &&
    typeof documentMetrics?.clientWidth === "number" &&
    typeof documentMetrics.scrollWidth === "number" &&
    typeof documentMetrics.bodyClientWidth === "number" &&
    typeof documentMetrics.bodyScrollWidth === "number" &&
    typeof documentMetrics.horizontalOverflow === "boolean" &&
    typeof architectureEmbed?.framePresent === "boolean" &&
    typeof architectureEmbed.frameVisible === "boolean" &&
    typeof architectureEmbed.frameClientWidth === "number" &&
    typeof architectureEmbed.mobileLinkPresent === "boolean" &&
    typeof architectureEmbed.mobileLinkVisible === "boolean" &&
    typeof architectureEmbed.contentClientWidth === "number" &&
    typeof architectureEmbed.contentScrollWidth === "number" &&
    typeof architectureEmbed.contentHorizontalOverflow === "boolean" &&
    Array.isArray(snapshot.tables) &&
    snapshot.tables.every(isTableMeasurement) &&
    Array.isArray(snapshot.diagrams) &&
    snapshot.diagrams.every(isDiagramMeasurement) &&
    Array.isArray(value.runtimeExceptions) &&
    value.runtimeExceptions.every((item) => typeof item === "string") &&
    Array.isArray(value.mutatingRequests) &&
    value.mutatingRequests.every(isRequestMeasurement) &&
    Array.isArray(value.failures) &&
    value.failures.every((item) => typeof item === "string") &&
    typeof value.passed === "boolean"
  );
}

function isTableMeasurement(value: unknown): value is TableMeasurement {
  return (
    isRecord(value) &&
    typeof value.index === "number" &&
    typeof value.selector === "string" &&
    typeof value.visible === "boolean" &&
    typeof value.tableWidth === "number" &&
    typeof value.containerWidth === "number" &&
    typeof value.widerThanContainer === "boolean" &&
    typeof value.mobileCardsPresent === "boolean" &&
    typeof value.mobileCardsVisible === "boolean" &&
    typeof value.mobileCardsWidth === "number" &&
    typeof value.mobileCardsOverflow === "boolean" &&
    typeof value.minimumMobileTextPx === "number" &&
    typeof value.minimumDesktopTextPx === "number" &&
    typeof value.bodyRowCount === "number" &&
    typeof value.mobileRecordCount === "number" &&
    typeof value.mobileSemanticParity === "boolean" &&
    typeof value.horizontalScrollAvailable === "boolean" &&
    typeof value.keyboardScrollable === "boolean"
  );
}

function isDiagramMeasurement(value: unknown): value is DiagramMeasurement {
  return (
    isRecord(value) &&
    typeof value.index === "number" &&
    typeof value.selector === "string" &&
    typeof value.label === "string" &&
    typeof value.visible === "boolean" &&
    typeof value.clientWidth === "number" &&
    typeof value.scrollWidth === "number" &&
    typeof value.clipped === "boolean" &&
    typeof value.diagramViewportVisible === "boolean" &&
    typeof value.mobileFlowPresent === "boolean" &&
    typeof value.mobileFlowVisible === "boolean" &&
    typeof value.mobileFlowStepCount === "number" &&
    typeof value.mobileFlowWidth === "number" &&
    typeof value.mobileFlowOverflow === "boolean" &&
    typeof value.minimumMobileTextPx === "number" &&
    typeof value.minimumDesktopLabelTextPx === "number" &&
    typeof value.viewportClientWidth === "number" &&
    typeof value.viewportScrollWidth === "number" &&
    typeof value.horizontalScrollAvailable === "boolean" &&
    typeof value.keyboardScrollable === "boolean"
  );
}

function isRequestMeasurement(
  value: unknown,
): value is { method: string; url: string } {
  return (
    isRecord(value) &&
    typeof value.method === "string" &&
    typeof value.url === "string"
  );
}

function caseInput(
  value: ResponsiveCaseResult,
): Omit<ResponsiveCaseResult, "failures" | "passed"> {
  return {
    id: value.id,
    surfaceId: value.surfaceId,
    kind: value.kind,
    area: value.area,
    requestPath: value.requestPath,
    width: value.width,
    height: value.height,
    httpStatus: value.httpStatus,
    finalUrl: value.finalUrl,
    durationMs: value.durationMs,
    snapshot: value.snapshot,
    runtimeExceptions: value.runtimeExceptions,
    mutatingRequests: value.mutatingRequests,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sha256(value: string | Uint8Array) {
  return createHash("sha256").update(value).digest("hex");
}

function readFlag(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function delay(milliseconds: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
