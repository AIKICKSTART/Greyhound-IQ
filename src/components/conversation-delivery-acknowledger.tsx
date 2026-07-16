"use client";

import { useEffect, useRef } from "react";

export function ConversationDeliveryAcknowledger({
  conversationId,
}: {
  conversationId: string;
}) {
  const sent = useRef(false);

  useEffect(() => {
    if (sent.current) return;
    sent.current = true;

    void fetch(`/api/conversations/${encodeURIComponent(conversationId)}/delivered`, {
      method: "POST",
      credentials: "same-origin",
      keepalive: true,
    }).catch(() => {
      // Delivery acknowledgement is best effort; message rendering must survive it.
    });
  }, [conversationId]);

  return null;
}
