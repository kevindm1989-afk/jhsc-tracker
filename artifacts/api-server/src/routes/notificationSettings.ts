import { Router, type IRouter, type Request, type Response } from "express";
import { pool } from "@workspace/db";
import { requireAdmin } from "../middleware/requireAuth";

const router: IRouter = Router();

const KEYS = [
  "notifyOnNewHSReport",
  "notifyOnNewIncident",
  "notifyOnNewMeeting",
  "notificationEmails",
];

router.get("/", async (req: Request, res: Response) => {
  try {
    const client = await pool.connect();
    try {
      const result = await client.query(
        `SELECT key, value FROM app_settings WHERE key = ANY($1)`,
        [KEYS]
      );
      const settings: Record<string, string> = {};
      for (const row of result.rows) settings[row.key] = row.value;
      res.json(settings);
    } finally {
      client.release();
    }
  } catch (err) {
    req.log?.error({ err }, "Failed to get notification settings");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/", requireAdmin, async (req: Request, res: Response) => {
  try {
    const client = await pool.connect();
    try {
      for (const [key, value] of Object.entries(req.body)) {
        if (!KEYS.includes(key)) continue;
        await client.query(
          `INSERT INTO app_settings (key, value, updated_at)
           VALUES ($1, $2, now())
           ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = now()`,
          [key, String(value)]
        );
      }
      res.json({ success: true });
    } finally {
      client.release();
    }
  } catch (err) {
    req.log?.error({ err }, "Failed to update notification settings");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
