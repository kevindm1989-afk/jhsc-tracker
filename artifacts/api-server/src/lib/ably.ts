import Ably from "ably";

let client: Ably.Rest | null = null;

export function getAblyClient(): Ably.Rest | null {
  if (!process.env.ABLY_API_KEY) return null;
  if (!client) {
    client = new Ably.Rest({ key: process.env.ABLY_API_KEY });
  }
  return client;
}

export async function publishToChannel(
  channel: string,
  event: string,
  data: unknown,
) {
  const ably = getAblyClient();
  if (!ably) return;
  await ably.channels.get(channel).publish(event, data);
}
