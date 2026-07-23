"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type RealtimeRefreshChannel = {
  name: string;
  events: string[];
  presence?: {
    selfProfileId: string;
    selfLabel: string;
    otherProfileId: string;
    otherLabel: string;
    offlineLabel?: string;
  };
  typing?: {
    selfProfileId: string;
    otherProfileId: string;
    otherLabel: string;
  };
};

const TYPING_SEND_THROTTLE_MS = 2500;
const TYPING_VISIBLE_MS = 4000;

interface RealtimeRefreshProps {
  channels: RealtimeRefreshChannel[];
  pollIntervalMs?: number;
}

let browserRealtimeClient: SupabaseClient | null = null;
let browserRealtimeAuthExpiresAt = 0;
let browserRealtimeAuthPromise: Promise<void> | null = null;
let browserRealtimeGrantedTopics = new Set<string>();
let browserRealtimeRefreshTimer: ReturnType<typeof setTimeout> | null = null;

export function RealtimeRefresh({
  channels,
  pollIntervalMs,
}: RealtimeRefreshProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [onlineLabels, setOnlineLabels] = useState<string[]>([]);
  const [typingLabel, setTypingLabel] = useState<string | null>(null);
  const stableChannels = useMemo(
    () =>
      channels
        .filter((channel) => channel.name && channel.events.length > 0)
        .map((channel) => ({
          ...channel,
          events: [...new Set(channel.events)].sort(),
        })),
    [channels],
  );

  useEffect(() => {
    if (!pollIntervalMs || pollIntervalMs < 1_000) return;
    const pollTimer = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      startTransition(() => router.refresh());
    }, pollIntervalMs);
    return () => window.clearInterval(pollTimer);
  }, [pollIntervalMs, router, startTransition]);

  useEffect(() => {
    const client = getBrowserRealtimeClient();
    if (!client || stableChannels.length === 0) return;

    let cancelled = false;
    let refreshTimer: ReturnType<typeof setTimeout> | null = null;
    let typingHideTimer: ReturnType<typeof setTimeout> | null = null;
    const windowCleanups: (() => void)[] = [];
    let subscribedChannels: ReturnType<typeof client.channel>[] = [];
    const subscribe = async () => {
      if (stableChannels.some((channel) => isPrivateChannel(channel.name))) {
        await ensureBrowserRealtimeAuthorization(
          client,
          stableChannels
            .filter((channel) => isPrivateChannel(channel.name))
            .map((channel) => channel.name),
        );
      }
      if (cancelled) return;
      subscribedChannels = stableChannels.map((config) => {
        const channel = client.channel(config.name, {
          config: { private: isPrivateChannel(config.name) },
        });

        for (const event of config.events) {
          // "typing" is ephemeral UI only; it must never trigger a refresh.
          if (event === "typing") continue;
          channel.on("broadcast", { event }, () => {
            if (refreshTimer) clearTimeout(refreshTimer);
            refreshTimer = setTimeout(() => {
              startTransition(() => router.refresh());
            }, 150);
          });
        }

        if (config.typing) {
          const typing = config.typing;
          channel.on("broadcast", { event: "typing" }, (message) => {
            const payload = (message as { payload?: { profileId?: string } })
              .payload;
            if (payload?.profileId !== typing.otherProfileId) return;
            setTypingLabel(typing.otherLabel);
            if (typingHideTimer) clearTimeout(typingHideTimer);
            typingHideTimer = setTimeout(
              () => setTypingLabel(null),
              TYPING_VISIBLE_MS,
            );
          });

          let lastTypingSentAt = 0;
          const handleLocalTyping = () => {
            const now = Date.now();
            if (now - lastTypingSentAt < TYPING_SEND_THROTTLE_MS) return;
            lastTypingSentAt = now;
            void channel.send({
              type: "broadcast",
              event: "typing",
              payload: { profileId: typing.selfProfileId },
            });
          };
          window.addEventListener("giq:typing", handleLocalTyping);
          windowCleanups.push(() =>
            window.removeEventListener("giq:typing", handleLocalTyping),
          );
        }

        if (config.presence) {
          channel
            .on("presence", { event: "sync" }, () => {
              const state = channel.presenceState<{
                profileId?: string;
                label?: string;
              }>();
              const labels = Object.values(state)
                .flat()
                .filter(
                  (presence) =>
                    presence.profileId === config.presence?.otherProfileId,
                )
                .map(
                  (presence) => presence.label ?? config.presence!.otherLabel,
                );
              setOnlineLabels([...new Set(labels)]);
            })
            .on("presence", { event: "leave" }, () => {
              const state = channel.presenceState<{
                profileId?: string;
                label?: string;
              }>();
              const labels = Object.values(state)
                .flat()
                .filter(
                  (presence) =>
                    presence.profileId === config.presence?.otherProfileId,
                )
                .map(
                  (presence) => presence.label ?? config.presence!.otherLabel,
                );
              setOnlineLabels([...new Set(labels)]);
            });
        }

        channel.subscribe((status) => {
          if (status === "SUBSCRIBED" && config.presence) {
            void channel.track({
              profileId: config.presence.selfProfileId,
              label: config.presence.selfLabel,
              onlineAt: new Date().toISOString(),
            });
          }
        });
        return channel;
      });
    };
    void subscribe().catch(() => null);

    return () => {
      cancelled = true;
      if (refreshTimer) clearTimeout(refreshTimer);
      if (typingHideTimer) clearTimeout(typingHideTimer);
      for (const cleanup of windowCleanups) cleanup();
      for (const channel of subscribedChannels) {
        // removeChannel unsubscribes AND drops it from the singleton client's
        // registry, avoiding stale-topic buildup across repeat navigation.
        void client.removeChannel(channel);
      }
    };
  }, [router, stableChannels, startTransition]);

  const offlineLabel =
    stableChannels.find((channel) => channel.presence?.offlineLabel)?.presence
      ?.offlineLabel ?? null;

  if (typingLabel) {
    return (
      <p
        role="status"
        className="mt-2 text-[12px] font-medium text-[hsl(var(--primary-bright))]"
      >
        {typingLabel} is typing
        <span aria-hidden="true" className="animate-pulse">
          …
        </span>
      </p>
    );
  }

  if (onlineLabels.length > 0) {
    return (
      <p className="mt-2 text-[12px] font-medium text-[hsl(var(--primary-bright))]">
        {onlineLabels.join(", ")} online
      </p>
    );
  }

  if (offlineLabel) {
    return (
      <p className="mt-2 text-[12px] font-medium text-[hsl(var(--muted-foreground))]">
        {offlineLabel}
      </p>
    );
  }

  return null;
}

export function getBrowserRealtimeClient() {
  if (
    typeof document !== "undefined" &&
    document.body.dataset.demoReadOnly === "true"
  ) {
    return null;
  }
  if (browserRealtimeClient) return browserRealtimeClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;

  browserRealtimeClient = createClient(url, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
  return browserRealtimeClient;
}

export async function ensureBrowserRealtimeAuthorization(
  client = getBrowserRealtimeClient(),
  requiredTopics: string[] = [],
) {
  if (!client) throw new Error("realtime.client_not_configured");
  const topics = [...new Set(requiredTopics.filter(Boolean))];
  if (hasBrowserRealtimeAuthorization(topics)) return;

  // A second caller can require a topic that was not requested by the caller
  // which started the in-flight refresh. Wait, then re-check its own contract.
  while (browserRealtimeAuthPromise) await browserRealtimeAuthPromise;
  if (hasBrowserRealtimeAuthorization(topics)) return;

  const authorization = async () => {
    const response = await fetch("/api/realtime/token", {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
    });
    if (!response.ok) throw new Error("realtime.authorization_failed");
    const payload = (await response.json()) as {
      token?: string;
      expiresAt?: string;
      topics?: string[];
    };
    if (!payload.token || !payload.expiresAt) {
      throw new Error("realtime.authorization_failed");
    }
    const expiresAt = new Date(payload.expiresAt).getTime();
    if (!Number.isFinite(expiresAt)) {
      throw new Error("realtime.authorization_failed");
    }
    await client.realtime.setAuth(payload.token);
    browserRealtimeAuthExpiresAt = expiresAt;
    browserRealtimeGrantedTopics = new Set(payload.topics ?? []);
    if (browserRealtimeRefreshTimer) clearTimeout(browserRealtimeRefreshTimer);
    browserRealtimeRefreshTimer = setTimeout(
      () => {
        browserRealtimeAuthExpiresAt = 0;
        void ensureBrowserRealtimeAuthorization(client).catch(() => null);
      },
      Math.max(30_000, browserRealtimeAuthExpiresAt - Date.now() - 30_000),
    );
  };
  browserRealtimeAuthPromise = authorization();
  try {
    await browserRealtimeAuthPromise;
  } finally {
    browserRealtimeAuthPromise = null;
  }
  if (!hasBrowserRealtimeAuthorization(topics)) {
    throw new Error("realtime.topic_not_authorized");
  }
}

export function hasBrowserRealtimeAuthorization(
  requiredTopics: readonly string[],
  now = Date.now(),
) {
  return (
    browserRealtimeAuthExpiresAt > now + 30_000 &&
    requiredTopics.every((topic) => browserRealtimeGrantedTopics.has(topic))
  );
}

function isPrivateChannel(name: string) {
  return name !== "feed:public";
}
