const DEEPSEEK_URL = 'https://api.deepseek.com/chat/completions';
const MODEL = 'deepseek-v4-flash';
const MAX_OUTPUT_TOKENS = 500;
const REQUEST_TIMEOUT_MS = 15_000;

function asRecommendation(value) {
  if (!value || typeof value !== 'object') return null;
  const type = ['warning', 'info', 'suggestion'].includes(value.type) ? value.type : 'suggestion';
  const message = typeof value.message === 'string' ? value.message.trim().slice(0, 280) : '';
  const action = typeof value.action === 'string' ? value.action.trim().slice(0, 180) : '';
  return message && action ? { type, message, action } : null;
}

/**
 * Produces recommendation copy from aggregate crawl data only. The caller can
 * safely fall back to deterministic rules when no key is configured or the
 * provider is unavailable.
 */
export async function getDeepSeekRecommendations({ categoryCounts, topPatterns }) {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) return null;

  const payload = {
    categoryCounts,
    topPatterns: topPatterns.slice(0, 10).map(({ pattern, count }) => ({
      pattern: String(pattern).slice(0, 160),
      count: Number(count) || 0,
    })),
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(DEEPSEEK_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        // Recommendations are a short formatting task. Disabling reasoning keeps
        // the 500-token cap for the JSON response instead of hidden reasoning.
        thinking: { type: 'disabled' },
        temperature: 0.2,
        max_tokens: MAX_OUTPUT_TOKENS,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content:
              'You are a website-crawl analyst. Return JSON only: {"recommendations":[{"type":"warning|info|suggestion","message":"plain-language finding","action":"specific next action"}]}. Give 0 to 5 recommendations. Use only the aggregate counts and URL patterns supplied as data; do not invent facts, mention URLs, or give security advice.',
          },
          {
            role: 'user',
            content: JSON.stringify(payload),
          },
        ],
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      console.warn(`DeepSeek recommendations unavailable (${response.status})`);
      return null;
    }

    const body = await response.json();
    const content = body.choices?.[0]?.message?.content;
    if (typeof content !== 'string') return null;

    const parsed = JSON.parse(content);
    const recommendations = Array.isArray(parsed.recommendations)
      ? parsed.recommendations.map(asRecommendation).filter(Boolean).slice(0, 5)
      : [];
    if (!recommendations.length) return null;

    return {
      recommendations,
      model: body.model || MODEL,
      usage: {
        inputTokens: body.usage?.prompt_tokens ?? null,
        outputTokens: body.usage?.completion_tokens ?? null,
        cacheHitTokens: body.usage?.prompt_cache_hit_tokens ?? null,
      },
    };
  } catch (error) {
    const reason = error?.name === 'AbortError' ? 'timed out' : 'failed';
    console.warn(`DeepSeek recommendations ${reason}; using deterministic rules`);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
