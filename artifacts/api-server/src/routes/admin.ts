import { Router, type IRouter } from "express";
import { requireAdmin } from "../middleware/requireAuth";
import { runDriveBackup } from "../services/driveBackup";

const router: IRouter = Router();

/**
 * GET /api/admin/backup
 *
 * Admin-only on-demand database backup.
 *
 * Triggers the Google Drive backup service which dumps every table in
 * the Neon database to JSON and uploads it to the "JHSC Advisor
 * Backups" folder in Drive (created on first run). Old backups beyond
 * the most recent 30 are pruned automatically.
 *
 * Requires the GOOGLE_SERVICE_ACCOUNT_JSON Fly.io secret to be set:
 *   flyctl secrets set GOOGLE_SERVICE_ACCOUNT_JSON='<paste json here>' --app jhsctracker-api
 */
router.get("/backup", requireAdmin, async (_req, res) => {
  res.setTimeout(300000); // 5-minute timeout — Drive upload can be slow on large datasets
  const startedAt = new Date().toISOString();
  const result = await runDriveBackup();
  const finishedAt = new Date().toISOString();

  if (result.success) {
    return res.json({
      success: true,
      startedAt,
      finishedAt,
      filename: result.filename,
      fileId: result.fileId,
      folderId: result.folderId,
      tableCount: result.tableCount,
      rowCount: result.rowCount,
      byteSize: result.byteSize,
      message: "Database backup uploaded to Google Drive.",
    });
  }

  return res.status(500).json({
    success: false,
    startedAt,
    finishedAt,
    filename: result.filename,
    error: result.error,
    message: "Database backup failed. See server logs for details.",
  });
});

export default router;
