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
    // Session table (required by connect-pg-simple)
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

    // Password reset tokens table — ensures it exists in production
    await client.query(`
      CREATE TABLE IF NOT EXISTS "password_reset_tokens" (
        "id" serial PRIMARY KEY,
        "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "token" text NOT NULL UNIQUE,
        "expires_at" timestamp NOT NULL,
        "used_at" timestamp
      );
    `);

    // Ensure users table has email and updated_at columns (added after initial deploy)
    await client.query(`
      ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "email" text NOT NULL DEFAULT '';
    `);
    await client.query(`
      ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "updated_at" timestamp NOT NULL DEFAULT now();
    `);
  } finally {
    client.release();
  }
}

export default app;
