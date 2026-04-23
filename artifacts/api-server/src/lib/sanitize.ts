/**
 * Strips company-identifying terms that must not appear in any imported
 * or exported document. Replacements are applied case-insensitively.
 * Order matters: longer/more-specific patterns must come first.
 */
const REDACTIONS: Array<[RegExp, string]> = [
  [/unifor\s*,?\s*local\s*(?:no\.?\s*)?1285/gi, ""],
  [/unifor/gi, ""],
  [/saputo/gi, ""],
];

export function sanitizeText(text: string): string {
  if (!text) return text;
  let result = text;
  for (const [pattern, replacement] of REDACTIONS) {
    result = result.replace(pattern, replacement);
  }
  return result.replace(/\s{2,}/g, " ").trim();
}

/**
 * Recursively sanitizes all string values in a plain JS object / array.
 * Used to scrub backup exports.
 */
export function sanitizeDeep(value: unknown): unknown {
  if (typeof value === "string") return sanitizeText(value);
  if (Array.isArray(value)) return value.map(sanitizeDeep);
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = sanitizeDeep(v);
    }
    return out;
  }
  return value;
}
