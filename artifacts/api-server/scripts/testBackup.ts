/**
 * testBackup.ts
 *
 * End-to-end smoke test for the admin backup endpoint.
 *
 * Usage:
 *   TEST_ADMIN_EMAIL=admin@example.com TEST_ADMIN_PASSWORD=secret \
 *     pnpm --filter @workspace/api-server test:backup
 *
 * The script:
 *   1. POSTs to /api/auth/login and captures the Set-Cookie header.
 *   2. GETs /api/admin/backup with that session cookie.
 *   3. Prints the full JSON response.
 *   4. Exits 0 on success, 1 on failure.
 */

const BASE_URL = "https://jhscadvisor.com";

const email = process.env["TEST_ADMIN_EMAIL"];
const password = process.env["TEST_ADMIN_PASSWORD"];

if (!email || !password) {
  console.error(
    "[testBackup] ERROR: TEST_ADMIN_EMAIL and TEST_ADMIN_PASSWORD must be set.",
  );
  process.exit(1);
}

async function main(): Promise<void> {
  // ── 1. Login ──────────────────────────────────────────────────────────────
  console.log(`[testBackup] Logging in as ${email} …`);

  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
    redirect: "manual",
  });

  const rawCookies = loginRes.headers.getSetCookie?.() ?? [];
  const cookieHeader = rawCookies.map((c) => c.split(";")[0]).join("; ");

  const loginBody = await loginRes.text();

  if (!loginRes.ok) {
    console.error(
      `[testBackup] Login FAILED — HTTP ${loginRes.status}: ${loginBody}`,
    );
    process.exit(1);
  }

  if (!cookieHeader) {
    console.error(
      "[testBackup] Login succeeded but no Set-Cookie header was returned.",
    );
    process.exit(1);
  }

  console.log(`[testBackup] Login OK (HTTP ${loginRes.status})`);
  console.log(`[testBackup] Session cookie: ${cookieHeader.slice(0, 60)}…`);

  // ── 2. Trigger backup ─────────────────────────────────────────────────────
  console.log("[testBackup] Calling GET /api/admin/backup …");
  console.log("[testBackup] (This may take up to 5 minutes for large datasets)");

  const backupRes = await fetch(`${BASE_URL}/api/admin/backup`, {
    method: "GET",
    headers: { Cookie: cookieHeader },
    // Node 18 fetch does not support a request-level timeout natively;
    // AbortSignal.timeout is available in Node 18.3+.
    signal: AbortSignal.timeout(310_000), // 310 seconds — slightly over the server's 300s
  });

  const backupText = await backupRes.text();

  let backupJson: unknown;
  try {
    backupJson = JSON.parse(backupText);
  } catch {
    backupJson = backupText;
  }

  console.log(`\n[testBackup] Response — HTTP ${backupRes.status}:`);
  console.log(JSON.stringify(backupJson, null, 2));

  if (!backupRes.ok) {
    console.error(`\n[testBackup] FAILURE — backup endpoint returned HTTP ${backupRes.status}`);
    process.exit(1);
  }

  const result = backupJson as Record<string, unknown>;
  if (result["success"] !== true) {
    console.error("\n[testBackup] FAILURE — backup service reported success:false");
    process.exit(1);
  }

  console.log(`\n[testBackup] SUCCESS — file: ${result["filename"]}`);
  process.exit(0);
}

main().catch((err: unknown) => {
  console.error("[testBackup] Unexpected error:", err);
  process.exit(1);
});
