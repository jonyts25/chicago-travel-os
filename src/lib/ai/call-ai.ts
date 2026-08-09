const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const DEFAULT_HAIKU_MODEL = "claude-haiku-4-5-20251001";

type AnthropicResponse = {
  content?: Array<{
    type?: string;
    text?: string;
  }>;
  error?: {
    type?: string;
    message?: string;
  };
};

export type CallAIResult = {
  text: string | null;
  error: string | null;
};

export function isAnthropicConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
}

export async function callAI(
  systemPrompt: string,
  userPrompt: string,
): Promise<CallAIResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    return {
      text: null,
      error: "ANTHROPIC_API_KEY no está configurada en el servidor.",
    };
  }

  const model = process.env.ANTHROPIC_MODEL?.trim() || DEFAULT_HAIKU_MODEL;

  try {
    const response = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: 2048,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      }),
      signal: AbortSignal.timeout(25_000),
    });

    const rawBody = await response.text();

    if (!response.ok) {
      let detail = rawBody.slice(0, 240);
      try {
        const parsed = JSON.parse(rawBody) as AnthropicResponse;
        detail = parsed.error?.message ?? detail;
      } catch {
        // Keep truncated raw body.
      }

      return {
        text: null,
        error: `Anthropic API ${response.status} (${model}): ${detail}`,
      };
    }

    const data = JSON.parse(rawBody) as AnthropicResponse;
    const textBlock = data.content?.find((block) => block.type === "text");

    if (!textBlock?.text?.trim()) {
      return {
        text: null,
        error: "Anthropic API respondió sin contenido de texto.",
      };
    }

    return { text: textBlock.text.trim(), error: null };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Error desconocido al llamar Anthropic.";
    return { text: null, error: message };
  }
}
