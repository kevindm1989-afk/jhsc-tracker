import { useEffect, useRef, useState, useCallback } from "react";
import type Ably from "ably";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export interface ChatMessage {
  id: number;
  channel: string;
  userId: number;
  userName: string;
  message: string;
  createdAt: string | null;
}

export function useChat(channel: "general" | "jhsc") {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ablyRef = useRef<Ably.Realtime | null>(null);
  const channelRef = useRef<Ably.RealtimeChannel | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const histResp = await fetch(`${BASE}/api/chat/history/${channel}`, {
          credentials: "include",
        });
        if (histResp.ok) {
          const hist = await histResp.json();
          if (!cancelled) setMessages(hist);
        }

        const tokenResp = await fetch(`${BASE}/api/chat/token`, { credentials: "include" });
        if (tokenResp.status === 401) throw new Error("Session expired — please log in again");
        if (tokenResp.status === 403) throw new Error("Chat is not available for your role");
        if (!tokenResp.ok) {
          const body = await tokenResp.json().catch(() => ({}));
          throw new Error(body?.error ?? `Server error (${tokenResp.status})`);
        }
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
        client.connection.on("failed", (stateChange) => {
          if (!cancelled) setError(`Connection failed: ${stateChange.reason?.message ?? "unknown"}`);
        });

        const ch = client.channels.get(`chat:${channel}`);
        channelRef.current = ch;
        await ch.subscribe("message", (msg) => {
          if (!cancelled) {
            setMessages((prev) => {
              const exists = prev.find((m) => m.id === msg.data.id);
              return exists ? prev : [...prev, msg.data as ChatMessage];
            });
          }
        });
      } catch (err: any) {
        if (!cancelled) setError(err?.message ?? "Failed to connect to chat");
      }
    }

    init();

    return () => {
      cancelled = true;
      channelRef.current?.unsubscribe();
      ablyRef.current?.close();
    };
  }, [channel]);

  const send = useCallback(
    async (message: string) => {
      await fetch(`${BASE}/api/chat/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ channel, message }),
      });
    },
    [channel],
  );

  return { messages, send, connected, error };
}
