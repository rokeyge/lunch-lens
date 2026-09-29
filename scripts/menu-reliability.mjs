export function retryDelay(response, body, now = Date.now()) {
  const header = response.headers?.get('retry-after');
  const seconds = Number(header);
  const headerMs = header == null ? 0 : Number.isFinite(seconds)
    ? seconds * 1000 : Math.max(0, Date.parse(header) - now) || 0;
  const details = body.error?.details || [];
  const apiMs = Math.max(0, ...details.map(d => {
    const match = /^([\d.]+)s$/.exec(d.retryDelay || '');
    return match ? Number(match[1]) * 1000 : 0;
  }));
  return Math.max(5000, headerMs, apiMs);
}

export function createModelRequester({ fetchImpl = fetch, sleep = ms => new Promise(r => setTimeout(r, ms)), now = Date.now, spacingMs = 13000 } = {}) {
  const disabled = new Set();
  const nextRequest = new Map();
  return async ({ models, apiKey, body }) => {
    let lastError;
    for (const model of [...new Set(models)]) {
      if (disabled.has(model)) continue;
      for (let attempt = 0; attempt < 2; attempt++) {
        await sleep(Math.max(0, (nextRequest.get(model) || 0) - now()));
        nextRequest.set(model, now() + spacingMs);
        const response = await fetchImpl(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
          method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
          body: JSON.stringify(body), signal: AbortSignal.timeout(90000)
        });
        const result = await response.json();
        if (response.ok) return { model, body: result };
        lastError = new Error(`Gemini ${model} HTTP ${response.status}: ${result.error?.message || 'request failed'}`);
        if (response.status !== 429 && response.status < 500) throw lastError;
        const delay = retryDelay(response, result, now());
        // Long quota windows should move to another model, not occupy the runner.
        if (attempt === 1 || delay > 60000) break;
        nextRequest.set(model, Math.max(nextRequest.get(model), now() + delay));
      }
      disabled.add(model);
    }
    throw lastError || new Error('All configured Gemini models are unavailable for this run.');
  };
}

const folded = text => text.toLowerCase().replace(/\s+/g, ' ').trim();
export function assessReview(verdict, candidate) {
  if (!Array.isArray(verdict?.discrepancies) || typeof verdict.approved !== 'boolean') {
    throw new Error('Malformed review response');
  }
  const discrepancies = verdict.discrepancies.filter(item => {
    // Only dismiss harmless text objections when their evidence identifies an
    // actual candidate field. Missing or invented evidence remains blocking.
    if (!['meal-text', 'daily-note'].includes(item.kind)) return true;
    if (typeof item.candidateValue !== 'string' || typeof item.sourceValue !== 'string') return true;
    const values = item.kind === 'daily-note' ? [candidate.dailyNote]
      : candidate.days.find(d => d.date === item.date)?.choices.map(c => c.name) || [];
    const matches = values.some(value => typeof value === 'string' && folded(value) === folded(item.candidateValue));
    return !(matches && folded(item.candidateValue) === folded(item.sourceValue));
  });
  return {
    ...verdict, discrepancies,
    approved: discrepancies.length === 0 && (verdict.approved || verdict.discrepancies.length > 0)
  };
}
