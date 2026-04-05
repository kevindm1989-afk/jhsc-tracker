import express, { type Express } from "express";
import cors from "cors";
import session from "express-session";
import connectPg from "connect-pg-simple";
import pinoHttp from "pino-http";
import path from "path";
import { existsSync } from "fs";
import { fileURLToPath } from "url";
import router from "./routes";
import { logger } from "./lib/logger";
import { pool } from "@workspace/db";
import "./sessionTypes";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app: Express = express();

app.set("trust proxy", 1);

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

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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

app.use("/api", router);

// Always attempt to serve the JHSC tracker frontend static build.
// In development the dist directory won't exist so express.static is a no-op;
// in production (or after a local build) it serves the SPA correctly.
const staticDir = path.resolve(__dirname, "../../jhsc-tracker/dist/public");
logger.info({ staticDir, exists: existsSync(staticDir), NODE_ENV: process.env.NODE_ENV }, "Static file serving setup");

if (existsSync(staticDir)) {
  app.use(express.static(staticDir));
  // SPA fallback — all non-API routes return index.html (Express 5 wildcard syntax)
  app.get("/{*splat}", (_req, res) => {
    res.sendFile(path.join(staticDir, "index.html"));
  });
} else {
  logger.warn({ staticDir }, "Static dir not found — frontend will not be served");
}

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

    // ── Idempotent column additions for existing databases ────────────────────

    await client.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "email" text NOT NULL DEFAULT '';`);
    await client.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "updated_at" timestamp NOT NULL DEFAULT now();`);

  } finally {
    client.release();
  }
}

app.get("/health", (_req, res) => {
  res.status(200).send("OK");
});

export default app;
