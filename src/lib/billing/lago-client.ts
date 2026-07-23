import "server-only";

import { getLagoEnv } from "@/lib/billing/lago-env";
import { readBoundedTextResponse } from "@/lib/remote-response";

const LAGO_REQUEST_TIMEOUT_MS = 10_000;
const LAGO_RESPONSE_POLICY = {
  maxBytes: 512 * 1024,
  allowedContentTypes: ["application/json"],
} as const;

type LagoUsageEventPropertyValue = string | number | boolean | null;

export type LagoUsageEventProperties = Record<
  string,
  LagoUsageEventPropertyValue
>;

export type SendLagoUsageEventInput = {
  transaction_id: string;
  external_subscription_id: string;
  code: string;
  timestamp: number;
  properties: LagoUsageEventProperties;
};

export async function sendLagoUsageEvent(
  event: SendLagoUsageEventInput
): Promise<unknown> {
  const { apiUrl, apiKey } = getLagoEnv();
  const response = await fetch(lagoEventsUrl(apiUrl), {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ event }),
    cache: "no-store",
    redirect: "manual",
    signal: AbortSignal.timeout(LAGO_REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`billing.lago_usage_event_failed:${response.status}`);
  }

  return JSON.parse(await readBoundedTextResponse(response, LAGO_RESPONSE_POLICY)) as unknown;
}

function lagoEventsUrl(apiUrl: string) {
  const url = new URL(apiUrl);
  const pathname = url.pathname.replace(/\/+$/, "");

  if (pathname.endsWith("/api/v1")) {
    url.pathname = `${pathname}/events`;
  } else if (pathname.endsWith("/api")) {
    url.pathname = `${pathname}/v1/events`;
  } else {
    url.pathname = `${pathname}/api/v1/events`;
  }

  url.search = "";
  url.hash = "";

  return url.toString();
}
