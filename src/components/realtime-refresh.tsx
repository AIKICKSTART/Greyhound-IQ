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
}

let browserRealtimeClient: SupabaseClient | null = null;

export function RealtimeRefresh({ channels }: RealtimeRefreshProps) {
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
    [channels]
  );

  useEffect(() => {
    const client = getBrowserRealtimeClient();
    if (!client || stableChannels.length === 0) return;

    let refreshTimer: ReturnType<typeof setTimeout> | null = null;
    let typingHideTimer: ReturnType<typeof setTimeout> | null = null;
    const windowCleanups: (() => void)[] = [];
    const subscribedChannels = stableChannels.map((config) => {
      const channel = client.channel(config.name);

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
            TYPING_VISIBLE_MS
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
          window.removeEventListener("giq:typing", handleLocalTyping)
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
                  presence.profileId === config.presence?.otherProfileId
              )
              .map((presence) => presence.label ?? config.presence!.otherLabel);
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
                  presence.profileId === config.presence?.otherProfileId
              )
              .map((presence) => presence.label ?? config.presence!.otherLabel);
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

    return () => {
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
