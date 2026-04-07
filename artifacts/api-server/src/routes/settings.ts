import { Router, type IRouter } from "express";
import { pool } from "@workspace/db";
import "../sessionTypes";

const router: IRouter = Router();

// GET /api/settings/nav-order — public (any logged-in user)
router.get("/nav-order", async (_req, res) => {
  try {
    const result = await pool.query(`SELECT value FROM app_settings WHERE key = 'nav_order'`);
    if (result.rows.length === 0) return res.json({ order: null });
    return res.json({ order: JSON.parse(result.rows[0].value) });
  } catch (err) {
    console.error("GET nav-order error:", err);
    return res.status(500).json({ error: "Failed to fetch nav order" });
  }
});

// PATCH /api/settings/nav-order — admin only
router.patch("/nav-order", async (req, res) => {
  if (!req.session?.userId) return res.status(401).json({ error: "Not authenticated" });

  // Check admin role
  const userResult = await pool.query(`SELECT role FROM users WHERE id = $1`, [req.session.userId]);
  if (!userResult.rows[0] || userResult.rows[0].role !== "admin") {
    return res.status(403).json({ error: "Admin only" });
  }

  try {
    const { order } = req.body as { order: string[] };
    if (!Array.isArray(order)) return res.status(400).json({ error: "order must be an array" });

    await pool.query(
      `INSERT INTO app_settings (key, value, updated_at)
       VALUES ('nav_order', $1, now())
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
      [JSON.stringify(order)]
    );

    return res.json({ success: true });
  } catch (err) {
    console.error("PATCH nav-order error:", err);
    return res.status(500).json({ error: "Failed to save nav order" });
  }
});

export default router;
