import { Router, type IRouter } from "express";
import { z } from "zod";
import http from "http";
import { requireAdmin } from "../middleware/requireAuth";

const router: IRouter = Router();

const HealthCheckResponse = z.object({
  status: z.string(),
});

router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

interface HeaderSpec {
  name: string;
  description: string;
  validate: (value: string) => boolean;
}

const SECURITY_HEADERS: HeaderSpec[] = [
  {
    name: "Strict-Transport-Security",
    description: "Enforces HTTPS connections; max-age must be ≥ 180 days",
    validate: (v) => {
      const match = v.match(/max-age=(\d+)/i);
      return !!match && parseInt(match[1]) >= 15552000;
    },
  },
  {
    name: "X-Content-Type-Options",
    description: "Prevents MIME-type sniffing; must be 'nosniff'",
    validate: (v) => v.trim().toLowerCase() === "nosniff",
  },
  {
    name: "X-Frame-Options",
    description: "Blocks clickjacking; must be DENY or SAMEORIGIN",
    validate: (v) => ["deny", "sameorigin"].includes(v.trim().toLowerCase()),
  },
  {
    name: "Content-Security-Policy",
    description: "Restricts resource loading; must include default-src",
    validate: (v) => v.includes("default-src"),
  },
  {
    name: "Referrer-Policy",
    description: "Controls referrer information sent with requests",
    validate: (v) => v.trim().length > 0,
  },
  {
    name: "Permissions-Policy",
    description: "Restricts access to browser features (camera, mic, geolocation…)",
    validate: (v) => v.trim().length > 0,
  },
];

router.get("/health/security", requireAdmin, async (_req, res) => {
  const port = process.env.PORT || "8080";

  let responseHeaders: Record<string, string>;
  try {
    responseHeaders = await new Promise<Record<string, string>>((resolve, reject) => {
      const req = http.get(`http://localhost:${port}/health`, (response) => {
        resolve(response.headers as Record<string, string>);
        response.resume();
      });
      req.on("error", reject);
      req.setTimeout(5000, () => {
        req.destroy();
        reject(new Error("Timed out fetching own security headers"));
      });
    });
  } catch (err: any) {
    res.status(500).json({ error: `Header probe failed: ${err?.message ?? "unknown error"}` });
    return;
  }

  const results = SECURITY_HEADERS.map(({ name, description, validate }) => {
    const value = responseHeaders[name.toLowerCase()] ?? null;
    const status: "PASS" | "FAIL" = value !== null && validate(value) ? "PASS" : "FAIL";
    return { header: name, value, status, description };
  });

  const passed = results.filter((r) => r.status === "PASS").length;

  res.json({
    score: { passed, total: SECURITY_HEADERS.length },
    results,
    checkedAt: new Date().toISOString(),
  });
});

export default router;
