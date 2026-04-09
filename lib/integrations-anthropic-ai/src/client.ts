import Anthropic from "@anthropic-ai/sdk";

const ownApiKey = process.env.ANTHROPIC_API_KEY;
const replitApiKey = process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY;
const replitBaseUrl = process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL;

if (!ownApiKey && !replitApiKey) {
  throw new Error(
    "ANTHROPIC_API_KEY must be set. Add your Anthropic API key as a secret.",
  );
}

export const anthropic = ownApiKey
  ? new Anthropic({ apiKey: ownApiKey })
  : new Anthropic({
      apiKey: replitApiKey!,
      baseURL: replitBaseUrl,
    });
