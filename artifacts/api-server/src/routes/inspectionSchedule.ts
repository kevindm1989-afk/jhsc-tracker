import { Router, type IRouter } from "express";
import { pool } from "@workspace/db";

const router: IRouter = Router();

const KEYS = ["inspectionDay", "reminderLeadDays", "coChairEmail1", "coChairEmail2", "enabled"];

router.get("/", async (req, res) => {
  try {
    const client = await pool.connect();
    try {
      const result = await client.query(`SELECT key, value FROM inspection_schedule WHERE key = ANY($1)`, [KEYS]);
      const settings: Record<string, string> = {};
      for (const row of result.rows) settings[row.key] = row.value;
      res.json(settings);
    } finally {
      client.release();
    }
  } catch (err) {
    req.log.error({ err }, "Failed to get inspection schedule");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/", async (req, res) => {
  try {
    const client = await pool.connect();
    try {
      for (const [key, value] of Object.entries(req.body)) {
        if (!KEYS.includes(key)) continue;
        await client.query(
          `INSERT INTO inspection_schedule (key, value, updated_at) VALUES ($1, $2, now())
           ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = now()`,
          [key, String(value)]
        );
      }
      res.json({ success: true });
    } finally {
      client.release();
    }
  } catch (err) {
    req.log.error({ err }, "Failed to update inspection schedule");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
