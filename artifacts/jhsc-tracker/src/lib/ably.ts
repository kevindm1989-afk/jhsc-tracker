import Ably from "ably";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

let realtimeClient: Ably.Realtime | null = null;

export async function getAblyClient(): Promise<Ably.Realtime> {
  if (realtimeClient) return realtimeClient;

  const resp = await fetch(`${BASE}/api/chat/token`, { credentials: "include" });
  if (!resp.ok) throw new Error("Failed to get Ably token");
  const tokenRequest = await resp.json();

  realtimeClient = new Ably.Realtime({ authCallback: (_data, callback) => callback(null, tokenRequest) });
  return realtimeClient;
}

export function disconnectAbly() {
  realtimeClient?.close();
  realtimeClient = null;
}
