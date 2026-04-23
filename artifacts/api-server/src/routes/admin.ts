import { Router, type IRouter } from "express";
import { requireAdmin } from "../middleware/requireAuth";
import { runDriveBackup, getServiceAccountEmail, BACKUP_FOLDER_ID, type BackupResult } from "../services/driveBackup";

const router: IRouter = Router();

// ─── In-memory backup state ────────────────────────────────────────────────
// Persists for the lifetime of the process. Good enough for a single-instance
// Fly.io deployment — the admin who triggered the backup polls the same VM.

interface BackupState {
  running: boolean;
  startedAt: string | null;
  finishedAt: string | null;
  result: BackupResult | null;
}

const state: BackupState = {
  running: false,
  startedAt: null,
  finishedAt: null,
  result: null,
};

// ─── POST /api/admin/backup ────────────────────────────────────────────────
// Trigger a backup. Returns 202 immediately; poll /backup/status for outcome.
router.get("/backup", requireAdmin, (_req, res) => {
  if (state.running) {
    return res.status(409).json({
      accepted: false,
      running: true,
      startedAt: state.startedAt,
      message: "A backup is already in progress. Poll /api/admin/backup/status for updates.",
    });
  }

  state.running = true;
  state.startedAt = new Date().toISOString();
  state.finishedAt = null;
  state.result = null;

  const serviceAccountEmail = getServiceAccountEmail();
  console.info(
    `[BACKUP] Triggered by admin. Service account: ${serviceAccountEmail ?? "unknown (check GOOGLE_SERVICE_ACCOUNT_JSON)"}. Folder: ${BACKUP_FOLDER_ID}`,
  );

  res.status(202).json({
    accepted: true,
    startedAt: state.startedAt,
    serviceAccountEmail,
    message: "Backup started. Poll /api/admin/backup/status for the result.",
  });

  // Fire-and-forget — runDriveBackup() catches all errors internally.
  runDriveBackup()
    .then((result) => {
      state.result = result;
      state.finishedAt = new Date().toISOString();
      state.running = false;
    })
    .catch((err) => {
      // Should never reach here — runDriveBackup always resolves — but just in case.
      console.error(`[BACKUP] Unhandled rejection:`, err);
      state.result = {
        success: false,
        filename: `jhsc_backup_${new Date().toISOString().slice(0, 10)}.json`,
        error: err?.message ?? String(err),
      };
      state.finishedAt = new Date().toISOString();
      state.running = false;
    });
});

// ─── GET /api/admin/backup/status ──────────────────────────────────────────
// Returns the current backup state. Poll this after a 202 from /backup.
router.get("/backup/status", requireAdmin, (_req, res) => {
  return res.json({
    running: state.running,
    startedAt: state.startedAt,
    finishedAt: state.finishedAt,
    result: state.result,
    configured: !!process.env["GOOGLE_SERVICE_ACCOUNT_JSON"],
    // Expose the SA email so the UI can tell the admin exactly which account
    // needs Editor access on the backup Drive folder.
    serviceAccountEmail: getServiceAccountEmail(),
    folderId: BACKUP_FOLDER_ID,
  });
});

export default router;
