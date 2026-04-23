import { Router, type IRouter } from "express";
import { requireAdmin } from "../middleware/requireAuth";
import { runDriveBackup } from "../services/driveBackup";

const router: IRouter = Router();

/**
 * GET /api/admin/backup
 *
 * Admin-only on-demand database backup.
 *
 * Returns HTTP 202 immediately so the request never times out in the browser
 * or at the Fly.io proxy layer (default idle timeout is 60 s, backup can take
 * several minutes on larger datasets). The actual dump + Drive upload runs in
 * the background; results are logged to the server console.
 *
 * Requires the GOOGLE_SERVICE_ACCOUNT_JSON Fly.io secret to be set:
 *   flyctl secrets set GOOGLE_SERVICE_ACCOUNT_JSON='<paste json here>' \
 *     --app jhsctracker-api
 */
router.get("/backup", requireAdmin, (_req, res) => {
  const dateStamp = new Date().toISOString().slice(0, 10);
  const filename = `jhsc_backup_${dateStamp}.json`;
  const startedAt = new Date().toISOString();

  // Respond immediately — do NOT await the backup. This avoids:
  //   • Fly.io's 60-second idle timeout terminating the connection
  //   • Mobile browsers showing "Failed to fetch" on slow uploads
  res.status(202).json({
    accepted: true,
    startedAt,
    filename,
    message:
      "Backup started in the background. Check Google Drive in a few minutes, or view the server logs for the result.",
  });

  // Fire-and-forget — errors are caught inside runDriveBackup() and logged.
  runDriveBackup().catch((err) => {
    console.error(
      `[${new Date().toISOString()}] [BACKUP] Unhandled error in background backup:`,
      err,
    );
  });
});

export default router;
