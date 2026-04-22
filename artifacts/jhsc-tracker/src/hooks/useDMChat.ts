import { useEffect, useRef, useState, useCallback } from "react";
import type Ably from "ably";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export interface DMMessage {
  id: number;
  channel: string;
  userId: number;
  userName: string;
  message: string;
  createdAt: string | null;
}

export function useDMChat(myId: number | null, otherUserId: number | null) {
  const [messages, setMessages] = useState<DMMessage[]>([]);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ablyRef = useRef<Ably.Realtime | null>(null);
  const channelRef = useRef<Ably.RealtimeChannel | null>(null);

  useEffect(() => {
    if (!myId || !otherUserId) return;

    let cancelled = false;
    const dmChan = `dm:${Math.min(myId, otherUserId)}-${Math.max(myId, otherUserId)}`;

    async function init() {
      try {
        const histResp = await fetch(`${BASE}/api/chat/dm/${otherUserId}/history`, {
          credentials: "include",
        });
        if (histResp.ok && !cancelled) {
          setMessages(await histResp.json());
        }

        const tokenResp = await fetch(`${BASE}/api/chat/token`, { credentials: "include" });
        if (!tokenResp.ok) throw new Error("Auth failed");
        const tokenRequest = await tokenResp.json();

        const { default: Ably } = await import("ably");
        const client = new Ably.Realtime({
          authCallback: (_data, cb) => cb(null, tokenRequest),
        });
        ablyRef.current = client;

        client.connection.on("connected", () => {
          if (!cancelled) setConnected(true);
          client.channels.get("global:presence").presence.enter().catch(() => {});
        });
        client.connection.on("disconnected", () => {
          if (!cancelled) setConnected(false);
        });

        const ch = client.channels.get(`chat:${dmChan}`);
        channelRef.current = ch;
        await ch.subscribe("message", (msg) => {
          if (!cancelled) {
            setMessages((prev) => {
              const exists = prev.find((m) => m.id === msg.data.id);
              return exists ? prev : [...prev, msg.data as DMMessage];
            });
          }
        });
      } catch {
        if (!cancelled) setError("Failed to connect");
      }
    }

    init();

    return () => {
      cancelled = true;
      channelRef.current?.unsubscribe();
      ablyRef.current?.close();
    };
  }, [myId, otherUserId]);

  const send = useCallback(
    async (message: string) => {
      if (!otherUserId) return;
      await fetch(`${BASE}/api/chat/dm/${otherUserId}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ message }),
      });
    },
    [otherUserId],
  );

  return { messages, send, connected, error };
}
