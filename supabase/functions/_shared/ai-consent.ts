export const AI_CONSENT_VERSION = 2;
export const BODY_CONSENT_VERSION = 1;
export const VIT_CONSENT_VERSION = 1;
export type AIConsent = { version: number; grantedAt: string };
export type AIPreferences = {
  ai_consent: AIConsent | null;
  vit_consent?: AIConsent | null;
  body_consent?: AIConsent | null;
  alertDismissedUntil?: string;
};
export function hasAIConsent(value: unknown): value is AIConsent {
  return hasConsentVersion(value, AI_CONSENT_VERSION);
}
export function hasBodyConsent(value: unknown): value is AIConsent {
  return hasConsentVersion(value, BODY_CONSENT_VERSION);
}
export function hasVitConsent(value: unknown): value is AIConsent { return hasConsentVersion(value, VIT_CONSENT_VERSION); }
function hasConsentVersion(
  value: unknown,
  version: number,
): value is AIConsent {
  if (!value || typeof value !== "object") return false;
  const consent = value as Partial<AIConsent>;
  return (
    consent.version === version &&
    typeof consent.grantedAt === "string" &&
    /^\d{4}-\d{2}-\d{2}T/.test(consent.grantedAt) &&
    Number.isFinite(Date.parse(consent.grantedAt))
  );
}
export function adultConsent(
  data: unknown,
  kind: "ai_consent" | "body_consent" | "vit_consent",
) {
  if (!data || typeof data !== "object") return false;
  const value = data as {
    profile?: { age?: unknown };
    preferences?: Record<string, unknown>;
  };
  const age = value.profile?.age;
  return (
    typeof age === "number" &&
    Number.isInteger(age) &&
    age >= 18 &&
    age <= 100 &&
    (kind === "vit_consent" ? hasVitConsent(value.preferences?.[kind]) : kind === "body_consent"
      ? hasBodyConsent(value.preferences?.[kind])
      : hasAIConsent(value.preferences?.[kind]))
  );
}
