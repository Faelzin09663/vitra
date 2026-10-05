import { AIProviderError, type AIProvider, type StructuredRequest } from './ai-provider.ts';
export const DEFAULT_GEMINI_MODEL = 'gemini-3.1-flash-lite';
export function geminiConfig(env: (name: string) => string | undefined, kind: 'meal' | 'body' | 'coach' | 'vit') {
  return {
    apiKey: env('GEMINI_API_KEY'),
    model: env(`GEMINI_MODEL_${kind.toUpperCase()}`)?.trim() || env('GEMINI_MODEL')?.trim() || DEFAULT_GEMINI_MODEL,
    endpoint: env('GEMINI_ENDPOINT')?.trim() || 'https://generativelanguage.googleapis.com/v1beta',
  };
}
type Options = { apiKey?: string; model?: string; endpoint?: string; fetcher?: typeof fetch };
type GeminiResponse = { promptFeedback?: { blockReason?: string }; candidates?: { finishReason?: string; content?: { parts?: { text?: string; thought?: boolean }[] } }[] };
const blockedReasons = new Set(['SAFETY', 'RECITATION', 'BLOCKLIST', 'PROHIBITED_CONTENT', 'SPII', 'IMAGE_SAFETY', 'IMAGE_PROHIBITED_CONTENT']);
export function createGeminiProvider(options: Options): AIProvider {
  const model = options.model?.trim() || DEFAULT_GEMINI_MODEL;
  return { model, async generateStructured({ system, parts, schema, timeoutMs = 60000 }: StructuredRequest) {
    if (!options.apiKey) throw new AIProviderError('not_configured');
    let url: URL;
    try {
      url = new URL(options.endpoint || 'https://generativelanguage.googleapis.com/v1beta');
      if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || !/^[a-zA-Z0-9._-]+$/.test(model)) throw new Error();
      url.pathname = `${url.pathname.replace(/\/$/, '')}/models/${model}:generateContent`;
    } catch { throw new AIProviderError('unavailable'); }
    const contentParts = parts.map(part => {
      if ('text' in part) return { text: part.text };
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(part.mimeType) || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(part.base64) || !part.base64) throw new AIProviderError('invalid_response');
      return { inlineData: { mimeType: part.mimeType, data: part.base64 } };
    });
    try {
      const response = await (options.fetcher || fetch)(url.toString(), {
        method: 'POST', redirect: 'error',
        headers: { 'x-goog-api-key': options.apiKey, 'Content-Type': 'application/json', Accept: 'application/json' },
        signal: AbortSignal.timeout(timeoutMs),
        body: JSON.stringify({ systemInstruction: { parts: [{ text: system }] }, contents: [{ role: 'user', parts: contentParts }], generationConfig: { maxOutputTokens: 4096, responseFormat: { text: { mimeType: 'APPLICATION_JSON', schema } } }, store: false }),
      });
      if (response.status === 429) throw new AIProviderError('rate_limit');
      if (!response.ok) throw new AIProviderError('unavailable');
      const result: GeminiResponse = await response.json();
      if (result?.promptFeedback?.blockReason && result.promptFeedback.blockReason !== 'BLOCK_REASON_UNSPECIFIED') throw new AIProviderError('blocked');
      const candidate = result?.candidates?.[0];
      if (candidate?.finishReason && blockedReasons.has(candidate.finishReason)) throw new AIProviderError('blocked');
      if (!candidate || candidate.finishReason !== 'STOP' || !Array.isArray(candidate.content?.parts)) throw new AIProviderError('invalid_response');
      const raw = candidate.content.parts.filter(part => !part.thought && typeof part.text === 'string').map(part => part.text).join('');
      if (!raw || raw.length > 32000) throw new AIProviderError('invalid_response');
      return raw;
    } catch (error) {
      if (error instanceof AIProviderError) throw error;
      if (error && typeof error === 'object' && 'name' in error && typeof error.name === 'string' && /timeout|abort/i.test(error.name)) throw new AIProviderError('timeout');
      throw new AIProviderError('unavailable');
    }
  } };
}
