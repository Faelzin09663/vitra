export type VitResponse = { answer: string; memorySuggestions: string[] };
export const VIT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["answer", "memorySuggestions"],
  properties: {
    answer: { type: "string", minLength: 1, maxLength: 7000 },
    memorySuggestions: {
      type: "array",
      maxItems: 3,
      items: { type: "string", minLength: 1, maxLength: 500 },
    },
  },
};
export function parseVitResponse(raw: string): VitResponse {
  const data = JSON.parse(raw);
  if (
    !data || Array.isArray(data) ||
    Object.keys(data).sort().join(",") !== "answer,memorySuggestions" ||
    typeof data.answer !== "string" || !data.answer.trim() ||
    data.answer.length > 7000 || !Array.isArray(data.memorySuggestions) ||
    data.memorySuggestions.length > 3 ||
    data.memorySuggestions.some((s: unknown) =>
      typeof s !== "string" || !s.trim() || s.length > 500
    )
  ) throw new Error("Invalid response");
  // Disallow explicit dangerous treatment/restriction claims in structured replies.
  if (
    /\b(?:diagnostico voc[eê]|voc[eê] tem (?:diabetes|anorexia)|tome \d+\s*mg|coma (?:apenas|s[oó]) \d{1,3}\s*(?:kcal|calorias)|gordura corporal.{0,20}\d+\s*%)/i
      .test(data.answer)
  ) throw new Error("Unsafe response");
  return data;
}
