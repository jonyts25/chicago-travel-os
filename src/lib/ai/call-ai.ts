const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const DEFAULT_HAIKU_MODEL = "claude-3-5-haiku-20241022";

type AnthropicResponse = {
  content?: Array<{
    type?: string;
    text?: string;
  }>;
};

export async function callAI(
  systemPrompt: string,
  userPrompt: string,
): Promise<string | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return null;
  }

  const model = process.env.ANTHROPIC_MODEL ?? DEFAULT_HAIKU_MODEL;

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

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as AnthropicResponse;
    const textBlock = data.content?.find((block) => block.type === "text");
    return textBlock?.text?.trim() ?? null;
  } catch {
    return null;
  }
}
