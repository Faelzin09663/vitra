export type ImageMimeType = 'image/jpeg' | 'image/png' | 'image/webp';
export type AIPart = { text: string } | { mimeType: ImageMimeType; base64: string };
export type StructuredRequest = { system: string; parts: AIPart[]; schema: Record<string, unknown>; timeoutMs?: number };
export interface AIProvider {
  readonly model: string;
  generateStructured(request: StructuredRequest): Promise<string>;
}
export type AIErrorCode = 'not_configured' | 'rate_limit' | 'unavailable' | 'blocked' | 'timeout' | 'invalid_response';
/** Fixed messages only: never retain provider bodies, URL or key. */
export class AIProviderError extends Error {
  constructor(readonly code: AIErrorCode) {
    const messages: Record<AIErrorCode, string> = {
      not_configured: 'A IA ainda não foi ativada. Configure GEMINI_API_KEY no .env do servidor Vitra.',
      rate_limit: 'Limite do provedor atingido. Tente novamente em instantes.',
      unavailable: 'O serviço de análise está indisponível. Tente novamente em instantes.',
      blocked: 'Não foi possível analisar este conteúdo pelas regras de segurança. Envie uma foto da refeição ou uma descrição dos alimentos.',
      timeout: 'A análise demorou demais. Tente novamente.',
      invalid_response: 'A IA não retornou uma estimativa válida. Descreva os alimentos e as porções.',
    };
    super(messages[code]); this.name = 'AIProviderError';
  }
}
