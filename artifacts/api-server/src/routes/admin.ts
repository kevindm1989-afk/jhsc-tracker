import { Router, type IRouter } from "express";
import { requireAdmin } from "../middleware/requireAuth";
import { dumpDatabase } from "../services/dbDump";

const router: IRouter = Router();

/**
 * GET /api/admin/backup/download
 *
 * Streams the full database dump as a JSON file download.
 * No external storage (Google Drive, S3, etc.) — the file goes straight
 * to the admin's browser. Works on any setup with zero configuration.
 */
router.get("/backup/download", requireAdmin, async (_req, res) => {
  const dateStr = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const filename = `jhsc_backup_${dateStr}.json`;

  try {
    const dump = await dumpDatabase();
    const json = JSON.stringify(dump);
    const byteLen = Buffer.byteLength(json, "utf8");

    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Content-Length", byteLen);
    // Prevent proxies / CDNs from caching a backup download
    res.setHeader("Cache-Control", "no-store");
    res.send(json);
  } catch (err: any) {
    if (!res.headersSent) {
      res.status(500).json({ error: err.message ?? "Backup generation failed" });
    }
  }
});

export default router;
