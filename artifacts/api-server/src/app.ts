import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import session from "express-session";
import connectPg from "connect-pg-simple";
import pinoHttp from "pino-http";
import path from "path";
import { existsSync } from "fs";
import { fileURLToPath } from "url";
import router from "./routes";
import { logger } from "./lib/logger";
import { pool } from "@workspace/db";
import { securityLogger, getClientIp } from "./middleware/securityLogger";
import "./sessionTypes";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app: Express = express();

app.set("trust proxy", 1);

// Redirect plain HTTP → HTTPS in production only
app.use((req, res, next) => {
  if (process.env.NODE_ENV === "production") {
    const proto = (req.headers["x-forwarded-proto"] as string) || req.protocol;
    if (proto !== "https") {
      return res.redirect(301, `https://${req.hostname}${req.originalUrl}`);
    }
  }
  next();
});

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

const allowedOrigins = [
  "https://jhsctracker-api.fly.dev",
  "https://jhscadvisor.com",
  "https://www.jhscadvisor.com",
];

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      // Allow any Replit dev/preview domain in non-production environments
      if (process.env.NODE_ENV !== "production" && origin.endsWith(".replit.dev")) {
        return callback(null, true);
      }
      callback(new Error(`CORS: origin ${origin} not allowed`));
    },
    credentials: true,
  }),
);
app.use(express.json({ limit: "50kb" }));
app.use(express.urlencoded({ extended: true, limit: "50kb" }));

const PgSession = connectPg(session);

app.use(
  session({
    store: new PgSession({
      pool,
    }),
    secret: process.env.SESSION_SECRET || "jhsc-tracker-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 7 * 24 * 60 * 60 * 1000,
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    },
  }),
);

app.use(
  helmet({
    hsts: true,
    noSniff: true,
    frameguard: { action: "deny" },
    // contentSecurityPolicy is intentionally disabled.
    // The default helmet CSP blocks SPA module scripts and causes the React
    // app to get stuck on "Loading...". A properly-scoped CSP for this SPA
    // (which uses Vite module bundles, Ably WebSockets, and Google APIs)
    // requires a nonce or hash strategy that must be wired into the Vite
    // build pipeline first. Until that work is done, disabling CSP here is
    // safer than silently breaking the app in production.
    contentSecurityPolicy: false,
  }),
);

app.use(securityLogger);

app.use("/api", router);

app.get("/health", async (_req, res) => {
  const timestamp = new Date().toISOString();
  try {
    await pool.query("SELECT 1");
    return res.status(200).json({ status: "ok", database: "connected", timestamp });
  } catch {
    logger.error("[HEALTH] Database connectivity check failed");
    return res.status(503).json({ status: "error", database: "disconnected", timestamp });
  }
});

// Serve all files from the public folder (privacy policy, assetlinks, etc.)
// dotfiles: 'allow' is required so .well-known/assetlinks.json is not ignored.
// Must come before the SPA catch-all so these files are returned directly.
app.use(express.static(path.join(__dirname, "../public"), { dotfiles: "allow" }));

// Always attempt to serve the JHSC tracker frontend static build.
// In development the dist directory won't exist so express.static is a no-op;
// in production (or after a local build) it serves the SPA correctly.
const staticDir = path.resolve(__dirname, "../../jhsc-tracker/dist/public");
logger.info({ staticDir, exists: existsSync(staticDir), NODE_ENV: process.env.NODE_ENV }, "Static file serving setup");

if (existsSync(staticDir)) {
  // Serve assets with normal caching, but force no-cache on index.html and the
  // service-worker file so browsers always fetch the latest shell and SW.
  app.use(express.static(staticDir, {
    setHeaders(res, filePath) {
      const base = path.basename(filePath);
      if (base === "index.html" || base === "sw.js") {
        res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
        res.setHeader("Pragma", "no-cache");
      }
    },
  }));
  // SPA fallback — all non-API routes return index.html (Express 5 wildcard syntax)
  app.get("/{*splat}", (_req, res) => {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.sendFile(path.join(staticDir, "index.html"));
  });
} else {
  logger.warn({ staticDir }, "Static dir not found — frontend will not be served");
}

// ── 413 oversized-body handler ────────────────────────────────────────────
// Must be a 4-argument Express error handler so it receives errors thrown
// by express.json / express.urlencoded when the 50 kb limit is exceeded.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
  if (err.status === 413 || err.type === "entity.too.large") {
    const ip = getClientIp(req);
    logger.warn(`[SECURITY] Oversized request rejected from IP: ${ip}`);
    return res.status(413).json({ error: "Request body too large" });
  }
  // Pass any other errors along unchanged so existing error handling is unaffected.
  logger.error({ err }, "Unhandled application error");
  return res.status(err.status ?? 500).json({ error: err.message ?? "Internal server error" });
});

export async function ensureSessionTable(): Promise<void> {
  const client = await pool.connect();
  try {
    // ── Core application tables ───────────────────────────────────────────────

    await client.query(`
      CREATE TABLE IF NOT EXISTS "users" (
        "id" serial PRIMARY KEY,
        "username" text NOT NULL UNIQUE,
        "display_name" text NOT NULL,
        "password_hash" text NOT NULL,
        "email" text NOT NULL DEFAULT '',
        "role" text NOT NULL DEFAULT 'member',
        "permissions" json NOT NULL DEFAULT '[]',
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS "registrations" (
        "id" serial PRIMARY KEY,
        "name" text NOT NULL,
        "username" text NOT NULL,
        "password_hash" text NOT NULL,
        "department" text NOT NULL,
        "shift" text NOT NULL,
        "email" text NOT NULL DEFAULT '',
        "status" text NOT NULL DEFAULT 'pending',
        "review_note" text,
        "created_at" timestamp NOT NULL DEFAULT now()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS "action_items" (
        "id" serial PRIMARY KEY,
        "item_code" text NOT NULL UNIQUE,
        "date" date NOT NULL,
        "department" text NOT NULL,
        "description" text NOT NULL,
        "raised_by" text NOT NULL,
        "assigned_to" text NOT NULL,
        "due_date" date,
        "priority" text NOT NULL,
        "status" text NOT NULL DEFAULT 'Open',
        "closed_date" date,
        "verified_at" timestamp,
        "verified_by" text,
        "notes" text,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS "hazard_findings" (
        "id" serial PRIMARY KEY,
        "item_code" text NOT NULL UNIQUE,
        "date" date NOT NULL,
        "department" text NOT NULL,
        "hazard_description" text NOT NULL,
        "ohsa_reference" text,
        "severity" text NOT NULL,
        "recommendation_date" date NOT NULL,
        "response_deadline" date,
        "status" text NOT NULL DEFAULT 'Open',
        "closed_date" date,
        "notes" text,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS "inspection_log" (
        "id" serial PRIMARY KEY,
        "item_code" text NOT NULL UNIQUE,
        "date" date NOT NULL,
        "zone" text NOT NULL,
        "area" text,
        "finding" text NOT NULL,
        "corrective_action" text,
        "inspector" text,
        "priority" text NOT NULL,
        "assigned_to" text,
        "follow_up_date" date,
        "status" text NOT NULL DEFAULT 'Open',
        "closed_date" date,
        "notes" text,
        "verified_at" timestamp,
        "verified_by" text,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS "worker_statements" (
        "id" serial PRIMARY KEY,
        "statement_code" text NOT NULL UNIQUE,
        "date_received" date NOT NULL,
        "shift" text NOT NULL,
        "department" text NOT NULL,
        "hazard_type" text NOT NULL,
        "description" text NOT NULL,
        "linked_item_code" text,
        "status" text NOT NULL DEFAULT 'Received',
        "notes" text,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS "health_safety_reports" (
        "id" serial PRIMARY KEY,
        "report_code" text NOT NULL UNIQUE,
        "employee_name" text NOT NULL,
        "department" text NOT NULL,
        "job_title" text NOT NULL,
        "shift" text NOT NULL,
        "date_reported" date NOT NULL,
        "supervisor_manager" text NOT NULL,
        "concern_types" json NOT NULL DEFAULT '[]',
        "other_concern_type" text,
        "area_location" text NOT NULL,
        "incident_date" date NOT NULL,
        "incident_time" text NOT NULL,
        "equipment_task" text,
        "what_happened" text NOT NULL,
        "reported_to_supervisor" boolean NOT NULL DEFAULT false,
        "who_notified" text,
        "immediate_action_taken" text,
        "witnesses" text,
        "suggested_correction" text,
        "employee_signature" text NOT NULL,
        "signature_date" date NOT NULL,
        "submitted_by_user_id" integer,
        "submitted_by_name" text NOT NULL,
        "created_at" timestamp NOT NULL DEFAULT now()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS "member_actions" (
        "id" serial PRIMARY KEY,
        "action_code" text NOT NULL UNIQUE,
        "title" text NOT NULL,
        "type" text NOT NULL,
        "assigned_to_user_id" integer NOT NULL,
        "assigned_to_name" text NOT NULL,
        "zone" integer,
        "due_date" date,
        "status" text NOT NULL DEFAULT 'pending',
        "notes" text,
        "completed_at" timestamp,
        "related_item_code" text,
        "created_by_user_id" integer NOT NULL,
        "created_by_name" text NOT NULL,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS "closed_items_log" (
        "id" serial PRIMARY KEY,
        "item_code" text NOT NULL UNIQUE,
        "date" date NOT NULL,
        "department" text NOT NULL,
        "description" text NOT NULL,
        "assigned_to" text NOT NULL,
        "closed_date" date,
        "meeting_date" text,
        "assigned_verifier_id" integer,
        "assigned_verifier_name" text,
        "verified_at" timestamp,
        "verified_by" text,
        "notes" text,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS "suggestions" (
        "id" serial PRIMARY KEY,
        "suggestion_code" text NOT NULL UNIQUE,
        "employee_name" text NOT NULL,
        "department" text NOT NULL,
        "shift" text NOT NULL,
        "date_submitted" date NOT NULL,
        "date_observed" date NOT NULL,
        "priority_level" text NOT NULL,
        "location_of_concern" text NOT NULL,
        "description" text NOT NULL,
        "proposed_solution" text NOT NULL,
        "submitted_by_user_id" integer,
        "submitted_by_name" text NOT NULL,
        "created_at" timestamp NOT NULL DEFAULT now()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS "app_settings" (
        "key" text PRIMARY KEY,
        "value" text NOT NULL,
        "updated_at" timestamp NOT NULL DEFAULT now()
      );
    `);

    // ── Session & auth tables ─────────────────────────────────────────────────

    await client.query(`
      CREATE TABLE IF NOT EXISTS "session" (
        "sid" varchar NOT NULL COLLATE "default",
        "sess" json NOT NULL,
        "expire" timestamp(6) NOT NULL,
        CONSTRAINT "session_pkey" PRIMARY KEY ("sid") NOT DEFERRABLE INITIALLY IMMEDIATE
      ) WITH (OIDS=FALSE);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire");
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS "password_reset_tokens" (
        "id" serial PRIMARY KEY,
        "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "token" text NOT NULL UNIQUE,
        "expires_at" timestamp NOT NULL,
        "used_at" timestamp
      );
    `);

    // ── New feature tables ────────────────────────────────────────────────────

    await client.query(`
      CREATE TABLE IF NOT EXISTS "recommendations" (
        "id" serial PRIMARY KEY,
        "rec_code" text NOT NULL UNIQUE,
        "date_issued" date NOT NULL,
        "ohsa_authority" text NOT NULL,
        "description" text NOT NULL,
        "linked_hazard_code" text,
        "response_deadline" date NOT NULL,
        "response_received" text NOT NULL DEFAULT 'No',
        "response_outcome" text NOT NULL DEFAULT 'Pending',
        "escalation_status" text NOT NULL DEFAULT 'None',
        "notes" text,
        "status" text NOT NULL DEFAULT 'Pending',
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS "meeting_minutes" (
        "id" serial PRIMARY KEY,
        "minutes_code" text NOT NULL UNIQUE,
        "meeting_date" date NOT NULL,
        "meeting_type" text NOT NULL DEFAULT 'Regular Monthly',
        "management_attendees" json NOT NULL DEFAULT '[]',
        "worker_attendees" json NOT NULL DEFAULT '[]',
        "agenda_items" json NOT NULL DEFAULT '[]',
        "motions" json NOT NULL DEFAULT '[]',
        "decisions" text,
        "action_items" json NOT NULL DEFAULT '[]',
        "next_meeting_date" date,
        "worker_co_chair_signed" boolean NOT NULL DEFAULT false,
        "management_co_chair_signed" boolean NOT NULL DEFAULT false,
        "emailed_at" timestamp,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS "right_to_refuse" (
        "id" serial PRIMARY KEY,
        "refuse_code" text NOT NULL UNIQUE,
        "worker_name" text NOT NULL,
        "refusal_date" date NOT NULL,
        "refusal_time" text NOT NULL,
        "zone" text NOT NULL,
        "hazard_description" text NOT NULL,
        "supervisor_notified" boolean NOT NULL DEFAULT false,
        "supervisor_name" text,
        "jhsc_rep_notified" boolean NOT NULL DEFAULT false,
        "inspector_called" boolean NOT NULL DEFAULT false,
        "mol_file_number" text,
        "outcome" text NOT NULL DEFAULT 'Ongoing',
        "notes" text,
        "locked_at" timestamp,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS "attachments" (
        "id" serial PRIMARY KEY,
        "parent_type" text NOT NULL,
        "parent_id" integer NOT NULL,
        "file_name" text NOT NULL,
        "file_path" text NOT NULL,
        "mime_type" text NOT NULL,
        "file_size_bytes" integer NOT NULL,
        "uploaded_by" text NOT NULL,
        "created_at" timestamp NOT NULL DEFAULT now()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS "checklist_templates" (
        "id" serial PRIMARY KEY,
        "name" text NOT NULL,
        "category" text NOT NULL,
        "items" json NOT NULL DEFAULT '[]',
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS "completed_checklists" (
        "id" serial PRIMARY KEY,
        "inspection_id" integer,
        "template_id" integer,
        "template_name" text NOT NULL,
        "completed_items" json NOT NULL DEFAULT '[]',
        "completed_by" text NOT NULL,
        "completed_at" timestamp NOT NULL DEFAULT now()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS "inspection_schedule" (
        "key" text PRIMARY KEY,
        "value" text NOT NULL,
        "updated_at" timestamp NOT NULL DEFAULT now()
      );
    `);

    // ── Idempotent column additions for existing databases ────────────────────

    await client.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "email" text NOT NULL DEFAULT '';`);
    await client.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "updated_at" timestamp NOT NULL DEFAULT now();`);
    await client.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "consent_accepted_at" timestamp;`);
    await client.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "consent_version" text;`);
    await client.query(`ALTER TABLE "registrations" ADD COLUMN IF NOT EXISTS "consent_accepted_at" timestamp;`);
    await client.query(`ALTER TABLE "registrations" ADD COLUMN IF NOT EXISTS "consent_version" text;`);

    await client.query(`ALTER TABLE "hazard_findings" ADD COLUMN IF NOT EXISTS "zone" text;`);
    await client.query(`ALTER TABLE "hazard_findings" ADD COLUMN IF NOT EXISTS "risk_likelihood" integer;`);
    await client.query(`ALTER TABLE "hazard_findings" ADD COLUMN IF NOT EXISTS "risk_severity" integer;`);
    await client.query(`ALTER TABLE "hazard_findings" ADD COLUMN IF NOT EXISTS "risk_score" integer;`);
    await client.query(`ALTER TABLE "hazard_findings" ADD COLUMN IF NOT EXISTS "is_anonymous" boolean NOT NULL DEFAULT false;`);
    await client.query(`ALTER TABLE "hazard_findings" ADD COLUMN IF NOT EXISTS "submitter_name" text;`);
    await client.query(`ALTER TABLE "hazard_findings" ADD COLUMN IF NOT EXISTS "response_token" text;`);
    await client.query(`ALTER TABLE "hazard_findings" ADD COLUMN IF NOT EXISTS "response_token_expires_at" timestamp;`);

    await client.query(`ALTER TABLE "action_items" ADD COLUMN IF NOT EXISTS "zone" text;`);

    await client.query(`ALTER TABLE "closed_items_log" ADD COLUMN IF NOT EXISTS "zone" text;`);
    await client.query(`ALTER TABLE "closed_items_log" ADD COLUMN IF NOT EXISTS "corrective_action" text;`);
    await client.query(`ALTER TABLE "closed_items_log" ADD COLUMN IF NOT EXISTS "closing_photo_path" text;`);

    await client.query(`
      CREATE TABLE IF NOT EXISTS "folders" (
        "id" serial PRIMARY KEY,
        "name" text NOT NULL,
        "created_by" text NOT NULL DEFAULT 'Unknown',
        "created_at" timestamp NOT NULL DEFAULT now()
      );
    `);

    await client.query(`ALTER TABLE "folders" ADD COLUMN IF NOT EXISTS "parent_id" integer REFERENCES "folders"("id") ON DELETE CASCADE;`);

    await client.query(`
      CREATE TABLE IF NOT EXISTS "folder_files" (
        "id" serial PRIMARY KEY,
        "folder_id" integer NOT NULL REFERENCES "folders"("id") ON DELETE CASCADE,
        "original_name" text NOT NULL,
        "stored_name" text NOT NULL,
        "mime_type" text NOT NULL,
        "size_bytes" integer NOT NULL DEFAULT 0,
        "uploaded_by" text NOT NULL DEFAULT 'Unknown',
        "created_at" timestamp NOT NULL DEFAULT now()
      );
    `);

    // Seed default folders if they don't exist
    await client.query(`
      INSERT INTO "folders" ("name", "created_by")
      SELECT name, 'system' FROM (VALUES ('Minutes'), ('Inspections')) AS t(name)
      WHERE NOT EXISTS (SELECT 1 FROM "folders" WHERE "folders"."name" = t.name);
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS "chat_messages" (
        "id" serial PRIMARY KEY,
        "channel" text NOT NULL,
        "user_id" integer NOT NULL,
        "user_name" text NOT NULL,
        "message" text NOT NULL,
        "created_at" timestamp DEFAULT now()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS "push_tokens" (
        "id" serial PRIMARY KEY,
        "user_id" integer NOT NULL,
        "token" text NOT NULL UNIQUE,
        "platform" text DEFAULT 'web',
        "created_at" timestamp DEFAULT now()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS "notification_logs" (
        "id" serial PRIMARY KEY,
        "sent_by" integer NOT NULL,
        "title" text NOT NULL,
        "body" text NOT NULL,
        "type" text NOT NULL,
        "target_type" text NOT NULL,
        "target_value" text,
        "recipient_count" integer DEFAULT 0,
        "created_at" timestamp DEFAULT now()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS "notification_rules" (
        "id" serial PRIMARY KEY,
        "event_type" text NOT NULL,
        "title" text NOT NULL,
        "body" text NOT NULL,
        "target_type" text NOT NULL,
        "target_value" text NOT NULL,
        "enabled" boolean DEFAULT true,
        "created_by" integer NOT NULL,
        "updated_at" timestamp DEFAULT now(),
        "created_at" timestamp DEFAULT now()
      );
    `);

  } finally {
    client.release();
  }
}

export default app;
