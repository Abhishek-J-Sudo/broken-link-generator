const DEEPSEEK_URL = 'https://api.deepseek.com/chat/completions';
const MODEL = 'deepseek-v4-flash';
const MAX_OUTPUT_TOKENS = 1000;
const REQUEST_TIMEOUT_MS = 20_000;

const SYSTEM_PROMPT =
  'You are a website link-health analyst writing for a non-technical site owner. ' +
  'Return JSON only: ' +
  '{"headline":"one-sentence executive summary using concrete numbers from the data",' +
  '"findings":[{"finding":"specific observation","why":"why it matters to the site and its visitors","action":"specific next step with enough detail to act on"}],' +
  '"priorityActions":["action 1","action 2","action 3"]}. ' +
  'Give 2–4 findings ordered by impact. Use only the data supplied — no invented facts, no SEO ranking claims. ' +
  'When issues are zero, say so positively and suggest a re-audit cadence.';

function asString(v, max) {
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
}

function asFinding(v) {
  if (!v || typeof v !== 'object') return null;
  const finding = asString(v.finding, 300);
  const why = asString(v.why, 300);
  const action = asString(v.action, 200);
  return finding && why && action ? { finding, why, action } : null;
}

function asAction(v) {
  const s = asString(v, 200);
  return s || null;
}

/**
 * Generates a plain-English narrative from a condensed audit summary.
 * Returns null when the API key is absent or the call fails — callers fall
 * back to the static rule-based verdict/takeaways.
 *
 * @param {object} condensed  Output of buildCondensed() in the narrative route
 * @returns {Promise<{headline,findings,priorityActions,model,usage}|null>}
 */
export async function getDeepSeekNarrative(condensed) {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) return null;

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
        thinking: { type: 'disabled' },
        temperature: 0.3,
        max_tokens: MAX_OUTPUT_TOKENS,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: JSON.stringify(condensed) },
        ],
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      console.warn(`DeepSeek narrative unavailable (${response.status})`);
      return null;
    }

    const body = await response.json();
    const content = body.choices?.[0]?.message?.content;
    if (typeof content !== 'string') return null;

    const parsed = JSON.parse(content);

    const headline = asString(parsed.headline, 400);
    const findings = Array.isArray(parsed.findings)
      ? parsed.findings.map(asFinding).filter(Boolean).slice(0, 4)
      : [];
    const priorityActions = Array.isArray(parsed.priorityActions)
      ? parsed.priorityActions.map(asAction).filter(Boolean).slice(0, 5)
      : [];

    if (!headline || !findings.length) return null;

    return {
      headline,
      findings,
      priorityActions,
      model: body.model || MODEL,
      usage: {
        inputTokens: body.usage?.prompt_tokens ?? null,
        outputTokens: body.usage?.completion_tokens ?? null,
        cacheHitTokens: body.usage?.prompt_cache_hit_tokens ?? null,
      },
    };
  } catch (error) {
    const reason = error?.name === 'AbortError' ? 'timed out' : 'failed';
    console.warn(`DeepSeek narrative ${reason}; using static report`);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
