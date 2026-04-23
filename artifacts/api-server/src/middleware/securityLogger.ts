import type { Request, Response, NextFunction } from "express";
import { createTransporter, getSenderAddress } from "../emailClient";

/**
 * In-memory per-IP and per-account security tracker.
 *
 * IP tracking (sliding 10-minute window):
 *   - 5+ attempts  → log a [SECURITY ALERT] (possible brute force)
 *   - 10+ attempts → block the IP for 30 minutes (HTTP 429)
 *
 * Account tracking:
 *   - 5 consecutive failed attempts on an account → lock account for 15 minutes
 *   - 3 consecutive failures → email admin alert
 *
 * Records are garbage-collected every 15 minutes.
 */

const FAILED_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const ALERT_THRESHOLD = 5;
const BLOCK_THRESHOLD = 10;
const BLOCK_DURATION_MS = 30 * 60 * 1000; // 30 minutes
const CLEANUP_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

const ACCOUNT_LOCK_THRESHOLD = 5;
const ACCOUNT_LOCK_DURATION_MS = 15 * 60 * 1000; // 15 minutes
const ACCOUNT_EMAIL_ALERT_THRESHOLD = 3;

interface IpRecord {
  failedAttempts: number[]; // unix-ms timestamps of failures within the window
  blockedUntil: number | null; // unix-ms; null when not blocked
}

interface AccountRecord {
  consecutiveFails: number;
  lockedUntil: number | null;
  emailAlertSent: boolean;
}

const ipRecords: Map<string, IpRecord> = new Map();
const accountRecords: Map<string, AccountRecord> = new Map();

function nowTs(): string {
  return new Date().toISOString();
}

/**
 * Best-effort client IP extraction. Honours `x-forwarded-for` because
 * the app sits behind Fly.io's proxy (and `app.set("trust proxy", 1)`
 * is already configured upstream).
 */
export function getClientIp(req: Request): string {
  const fwd = req.headers["x-forwarded-for"];
  if (typeof fwd === "string" && fwd.length > 0) {
    return fwd.split(",")[0].trim();
  }
  if (Array.isArray(fwd) && fwd.length > 0) {
    return fwd[0];
  }
  return req.ip || req.socket.remoteAddress || "unknown";
}

function getOrCreate(ip: string): IpRecord {
  let rec = ipRecords.get(ip);
  if (!rec) {
    rec = { failedAttempts: [], blockedUntil: null };
    ipRecords.set(ip, rec);
  }
  return rec;
}

function pruneOldAttempts(rec: IpRecord, now: number) {
  const cutoff = now - FAILED_WINDOW_MS;
  rec.failedAttempts = rec.failedAttempts.filter((ts) => ts >= cutoff);
}

/**
 * Check whether an account is currently locked out.
 * Returns the unlock time (ms) if locked, or null if not locked.
 */
export function getAccountLockout(identifier: string): number | null {
  const rec = accountRecords.get(identifier.toLowerCase());
  if (!rec || !rec.lockedUntil) return null;
  if (rec.lockedUntil > Date.now()) return rec.lockedUntil;
  rec.lockedUntil = null;
  rec.consecutiveFails = 0;
  rec.emailAlertSent = false;
  return null;
}

/**
 * Call from the login route whenever credentials are rejected.
 * Logs the failure, escalates to a brute-force alert, may
 * place the IP on the block list, and tracks per-account lockout.
 */
export function recordFailedLogin(ip: string, identifier: string): void {
  const now = Date.now();

  // ── IP tracking ──
  const rec = getOrCreate(ip);
  pruneOldAttempts(rec, now);
  rec.failedAttempts.push(now);

  console.warn(
    `[SECURITY] Failed login attempt from IP: ${ip} identifier: ${identifier || "(none)"} at ${nowTs()}`,
  );

  const ipCount = rec.failedAttempts.length;
  if (ipCount >= BLOCK_THRESHOLD) {
    rec.blockedUntil = now + BLOCK_DURATION_MS;
    console.error(
      `[SECURITY ALERT] IP blocked for brute force — IP: ${ip} attempts: ${ipCount} blockedUntil: ${new Date(rec.blockedUntil).toISOString()}`,
    );
  } else if (ipCount >= ALERT_THRESHOLD) {
    console.warn(
      `[SECURITY ALERT] Possible brute force attack from IP: ${ip} — attempts: ${ipCount}`,
    );
  }

  // ── Account tracking ──
  if (!identifier) return;
  const key = identifier.toLowerCase();
  let accRec = accountRecords.get(key);
  if (!accRec) {
    accRec = { consecutiveFails: 0, lockedUntil: null, emailAlertSent: false };
    accountRecords.set(key, accRec);
  }

  accRec.consecutiveFails++;

  if (accRec.consecutiveFails >= ACCOUNT_LOCK_THRESHOLD) {
    accRec.lockedUntil = now + ACCOUNT_LOCK_DURATION_MS;
    console.error(
      `[SECURITY ALERT] Account locked — identifier: ${key} consecutiveFails: ${accRec.consecutiveFails} lockedUntil: ${new Date(accRec.lockedUntil).toISOString()}`,
    );
  }

  if (accRec.consecutiveFails >= ACCOUNT_EMAIL_ALERT_THRESHOLD && !accRec.emailAlertSent) {
    accRec.emailAlertSent = true;
    try {
      const transporter = createTransporter();
      const adminEmail = getSenderAddress();
      transporter.sendMail({
        from: adminEmail,
        to: adminEmail,
        subject: "⚠️ Failed Login Alert — JHSC Advisor",
        html: `
          <p>There have been <strong>${accRec.consecutiveFails} consecutive failed login attempts</strong> on the following account:</p>
          <p style="font-size:15px;font-weight:600;margin:12px 0;">${key}</p>
          <p>IP address: <code>${ip}</code></p>
          <p>Time: ${nowTs()}</p>
          ${accRec.consecutiveFails >= ACCOUNT_LOCK_THRESHOLD
            ? `<p style="color:#b91c1c;font-weight:600;">This account has been automatically locked for 15 minutes.</p>`
            : `<p>The account will be locked after ${ACCOUNT_LOCK_THRESHOLD} attempts.</p>`
          }
          <p style="font-size:12px;color:#888;margin-top:24px;">JHSC Advisor Security</p>
        `,
      }).catch((e: any) => console.error("[SECURITY] Failed login email error:", e));
    } catch (e) {
      console.error("[SECURITY] Failed login email setup error:", e);
    }
  }
}

/**
 * Call from the login route on a successful authentication.
 * Clears the IP's and account's failure history.
 */
export function recordSuccessfulLogin(ip: string, identifier?: string): void {
  console.info(`[SECURITY] Successful login from IP: ${ip} at ${nowTs()}`);
  const rec = ipRecords.get(ip);
  if (rec) {
    rec.failedAttempts = [];
    rec.blockedUntil = null;
  }
  if (identifier) {
    const key = identifier.toLowerCase();
    const accRec = accountRecords.get(key);
    if (accRec) {
      accRec.consecutiveFails = 0;
      accRec.lockedUntil = null;
      accRec.emailAlertSent = false;
    }
  }
}

/**
 * Express middleware. Must be installed AFTER body/session middleware
 * but BEFORE the route handlers.
 *
 *   1. Rejects requests from blocked IPs with HTTP 429.
 *   2. Wraps `res.status` so any 401/403 response is logged.
 */
export function securityLogger(req: Request, res: Response, next: NextFunction) {
  const ip = getClientIp(req);
  const now = Date.now();

  const rec = ipRecords.get(ip);
  if (rec && rec.blockedUntil && rec.blockedUntil > now) {
    const retryAfterSec = Math.ceil((rec.blockedUntil - now) / 1000);
    console.warn(
      `[SECURITY] Blocked request from banned IP: ${ip} endpoint: ${req.originalUrl} retryIn: ${retryAfterSec}s`,
    );
    res.setHeader("Retry-After", String(retryAfterSec));
    return res
      .status(429)
      .json({ error: "Too many failed login attempts. Try again later." });
  }
  if (rec && rec.blockedUntil && rec.blockedUntil <= now) {
    rec.blockedUntil = null;
    rec.failedAttempts = [];
  }

  const originalStatus = res.status.bind(res);
  res.status = function (code: number): Response {
    if (code === 401 || code === 403) {
      console.warn(
        `[SECURITY] Unauthorized access attempt — IP: ${ip} endpoint: ${req.originalUrl} status: ${code} at ${nowTs()}`,
      );
    }
    return originalStatus(code);
  };

  return next();
}

/**
 * Periodically discard records that have no recent failures and are
 * not currently blocked. Prevents the Map from growing unbounded.
 */
function cleanupExpiredRecords() {
  const now = Date.now();
  const cutoff = now - FAILED_WINDOW_MS;
  let removed = 0;
  for (const [ip, rec] of ipRecords.entries()) {
    pruneOldAttempts(rec, now);
    const stillBlocked = rec.blockedUntil && rec.blockedUntil > now;
    if (!stillBlocked && rec.failedAttempts.length === 0) {
      ipRecords.delete(ip);
      removed++;
    } else if (rec.blockedUntil && rec.blockedUntil <= now) {
      rec.blockedUntil = null;
    }
    void cutoff;
  }
  if (removed > 0) {
    console.info(`[SECURITY] Cleaned up ${removed} expired IP record(s)`);
  }
}

const cleanupTimer = setInterval(cleanupExpiredRecords, CLEANUP_INTERVAL_MS);
// Don't keep the event loop alive just for the cleaner.
if (typeof cleanupTimer.unref === "function") {
  cleanupTimer.unref();
}
