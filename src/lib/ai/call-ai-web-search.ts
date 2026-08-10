const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const DEFAULT_HAIKU_MODEL = "claude-haiku-4-5-20251001";

/** Hard cap on web searches per user-triggered ticket research request. */
export const WEB_SEARCH_MAX_USES_PER_REQUEST = 3;

const WEB_SEARCH_TIMEOUT_MS = 90_000;

type AnthropicContentBlock = {
  type?: string;
  text?: string;
  citations?: Array<{
    type?: string;
    url?: string;
    title?: string;
  }>;
  content?: Array<{
    type?: string;
    url?: string;
    title?: string;
  }>;
};

type AnthropicResponse = {
  content?: AnthropicContentBlock[];
  stop_reason?: string;
  usage?: {
    server_tool_use?: {
      web_search_requests?: number;
    };
  };
  error?: {
    type?: string;
    message?: string;
  };
};

export type WebSearchSource = {
  title: string;
  url: string;
};

export type CallAIWithWebSearchResult = {
  text: string | null;
  sources: WebSearchSource[];
  webSearchCount: number;
  error: string | null;
};

export async function callAIWithWebSearch(
  systemPrompt: string,
  userPrompt: string,
  options: { maxUses?: number } = {},
): Promise<CallAIWithWebSearchResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    return {
      text: null,
      sources: [],
      webSearchCount: 0,
      error: "ANTHROPIC_API_KEY no está configurada en el servidor.",
    };
  }

  const model = process.env.ANTHROPIC_MODEL?.trim() || DEFAULT_HAIKU_MODEL;
  const maxUses = options.maxUses ?? WEB_SEARCH_MAX_USES_PER_REQUEST;

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
        tools: [
          {
            type: "web_search_20250305",
            name: "web_search",
            max_uses: maxUses,
          },
        ],
      }),
      signal: AbortSignal.timeout(WEB_SEARCH_TIMEOUT_MS),
    });

    const rawBody = await response.text();

    if (!response.ok) {
      let detail = rawBody.slice(0, 320);
      try {
        const parsed = JSON.parse(rawBody) as AnthropicResponse;
        detail = parsed.error?.message ?? detail;
      } catch {
        // Keep truncated raw body.
      }

      return {
        text: null,
        sources: [],
        webSearchCount: 0,
        error: `Anthropic API ${response.status} (${model}): ${detail}`,
      };
    }

    const data = JSON.parse(rawBody) as AnthropicResponse;

    if (data.stop_reason === "pause_turn") {
      return {
        text: null,
        sources: [],
        webSearchCount: data.usage?.server_tool_use?.web_search_requests ?? 0,
        error:
          "La búsqueda web quedó incompleta. Intenta de nuevo en unos segundos.",
      };
    }

    const parsed = parseWebSearchResponse(data);
    if (!parsed.text) {
      return {
        text: null,
        sources: parsed.sources,
        webSearchCount: parsed.webSearchCount,
        error: "La IA no devolvió una recomendación de tickets.",
      };
    }

    return {
      text: parsed.text,
      sources: parsed.sources,
      webSearchCount: parsed.webSearchCount,
      error: null,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Error desconocido al llamar Anthropic.";
    return {
      text: null,
      sources: [],
      webSearchCount: 0,
      error: message,
    };
  }
}

function parseWebSearchResponse(data: AnthropicResponse): {
  text: string;
  sources: WebSearchSource[];
  webSearchCount: number;
} {
  const textParts: string[] = [];
  const sources = new Map<string, WebSearchSource>();

  for (const block of data.content ?? []) {
    if (block.type === "text" && block.text?.trim()) {
      textParts.push(block.text.trim());
    }

    for (const citation of block.citations ?? []) {
      addSource(sources, citation.title, citation.url);
    }

    if (block.type === "web_search_tool_result") {
      for (const result of block.content ?? []) {
        if (result.type === "web_search_result") {
          addSource(sources, result.title, result.url);
        }
      }
    }
  }

  return {
    text: textParts.join("\n\n").trim(),
    sources: Array.from(sources.values()),
    webSearchCount: data.usage?.server_tool_use?.web_search_requests ?? 0,
  };
}

function addSource(
  sources: Map<string, WebSearchSource>,
  title: string | undefined,
  url: string | undefined,
): void {
  if (!url?.trim()) {
    return;
  }

  const normalizedUrl = url.trim();
  if (sources.has(normalizedUrl)) {
    return;
  }

  sources.set(normalizedUrl, {
    url: normalizedUrl,
    title: title?.trim() || normalizedUrl,
  });
}
