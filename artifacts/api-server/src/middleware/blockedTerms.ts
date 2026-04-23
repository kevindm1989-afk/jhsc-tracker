import type { Request, Response, NextFunction } from "express";

const BLOCKED_TERMS = [
  "saputo",
  "unifor",
  "georgetown",
  "halton hills",
];

function containsBlockedTerm(value: unknown): string | null {
  if (typeof value === "string") {
    const lower = value.toLowerCase();
    for (const term of BLOCKED_TERMS) {
      if (lower.includes(term)) return term;
    }
  } else if (Array.isArray(value)) {
    for (const item of value) {
      const found = containsBlockedTerm(item);
      if (found) return found;
    }
  } else if (value !== null && typeof value === "object") {
    for (const v of Object.values(value)) {
      const found = containsBlockedTerm(v);
      if (found) return found;
    }
  }
  return null;
}

export function blockedTerms(req: Request, res: Response, next: NextFunction) {
  const found = containsBlockedTerm(req.body);
  if (found) {
    return res.status(400).json({
      error: `The term "${found}" is not permitted in this application.`,
    });
  }
  next();
}
