import "server-only";

import { getLagoEnv } from "@/lib/billing/lago-env";

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
  });

  if (!response.ok) {
    throw new Error(`billing.lago_usage_event_failed:${response.status}`);
  }

  return response.json();
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
