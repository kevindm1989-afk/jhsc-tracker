import { Router, type IRouter } from "express";
import { execFile } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import { requireAdmin } from "../middleware/requireAuth";

const router: IRouter = Router();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Resolve the backup script. In dev the file lives next to the source
 * tree (`artifacts/api-server/scripts/backup.sh`); in the bundled
 * production build (`dist/index.js`) it sits one level up from the dist
 * folder. We try both so this works in either environment.
 */
function resolveBackupScript(): string {
  const candidates = [
    path.resolve(__dirname, "../../scripts/backup.sh"),
    path.resolve(__dirname, "../scripts/backup.sh"),
    path.resolve(process.cwd(), "scripts/backup.sh"),
    path.resolve(process.cwd(), "artifacts/api-server/scripts/backup.sh"),
  ];
  for (const p of candidates) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const fs = require("fs") as typeof import("fs");
      if (fs.existsSync(p)) return p;
    } catch {
      // ignore and try the next path
    }
  }
  return candidates[0];
}

// POST /api/admin/backup — admin-only on-demand backup trigger
// (also exposed as GET so it can be invoked from a browser address bar)
async function runBackup(): Promise<{ stdout: string; stderr: string }> {
  const scriptPath = resolveBackupScript();
  return new Promise((resolve, reject) => {
    execFile(
      "bash",
      [scriptPath],
      {
        env: { ...process.env },
        timeout: 10 * 60 * 1000, // 10 minutes hard cap
        maxBuffer: 10 * 1024 * 1024,
      },
      (err, stdout, stderr) => {
        if (err) {
          (err as any).stdout = stdout;
          (err as any).stderr = stderr;
          return reject(err);
        }
        resolve({ stdout: String(stdout), stderr: String(stderr) });
      },
    );
  });
}

router.get("/backup", requireAdmin, async (_req, res) => {
  const startedAt = new Date().toISOString();
  try {
    const { stdout, stderr } = await runBackup();
    return res.json({
      success: true,
      startedAt,
      finishedAt: new Date().toISOString(),
      message: "Database backup completed.",
      stdout: stdout.trim(),
      stderr: stderr.trim() || undefined,
    });
  } catch (err: any) {
    console.error(`[${new Date().toISOString()}] [BACKUP] route failure:`, err?.message || err);
    return res.status(500).json({
      success: false,
      startedAt,
      finishedAt: new Date().toISOString(),
      message: "Database backup failed.",
      error: err?.message || "Unknown error",
      stdout: typeof err?.stdout === "string" ? err.stdout.trim() : undefined,
      stderr: typeof err?.stderr === "string" ? err.stderr.trim() : undefined,
    });
  }
});

export default router;
