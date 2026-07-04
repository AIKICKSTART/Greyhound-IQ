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
  };
};

interface RealtimeRefreshProps {
  channels: RealtimeRefreshChannel[];
}

let browserRealtimeClient: SupabaseClient | null = null;

export function RealtimeRefresh({ channels }: RealtimeRefreshProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [onlineLabels, setOnlineLabels] = useState<string[]>([]);
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
    const subscribedChannels = stableChannels.map((config) => {
      const channel = client.channel(config.name);

      for (const event of config.events) {
        channel.on("broadcast", { event }, () => {
          if (refreshTimer) clearTimeout(refreshTimer);
          refreshTimer = setTimeout(() => {
            startTransition(() => router.refresh());
          }, 150);
        });
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
      for (const channel of subscribedChannels) {
        void channel.unsubscribe();
      }
    };
  }, [router, stableChannels, startTransition]);

  if (onlineLabels.length === 0) return null;

  return (
    <p className="mt-2 text-[12px] font-medium text-[hsl(var(--primary-bright))]">
      {onlineLabels.join(", ")} online
    </p>
  );
}

function getBrowserRealtimeClient() {
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
