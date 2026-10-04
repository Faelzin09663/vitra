export const AI_CONSENT_VERSION = 1;
export type AIConsent = { version: number; grantedAt: string };
export type AIPreferences = { ai_consent: AIConsent | null };
export function hasAIConsent(value: unknown): value is AIConsent {
  if (!value || typeof value !== 'object') return false;
  const consent = value as Partial<AIConsent>;
  return consent.version === AI_CONSENT_VERSION && typeof consent.grantedAt === 'string'
    && /^\d{4}-\d{2}-\d{2}T/.test(consent.grantedAt) && Number.isFinite(Date.parse(consent.grantedAt));
}
