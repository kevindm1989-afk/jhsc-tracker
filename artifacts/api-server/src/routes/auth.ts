import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import { usersTable, registrationsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import "../sessionTypes";

const router: IRouter = Router();

// POST /api/auth/login
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body as { username: string; password: string };

    if (!username || !password) {
      return res.status(400).json({ error: "Username and password are required" });
    }

    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.username, username.trim().toLowerCase()));

    if (!user) {
      return res.status(401).json({ error: "Invalid username or password" });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: "Invalid username or password" });
    }

    req.session.userId = user.id;
    req.session.username = user.username;
    req.session.displayName = user.displayName;
    req.session.role = user.role;
    req.session.permissions = user.permissions;

    req.session.save((err) => {
      if (err) {
        console.error("Session save error:", err);
        return res.status(500).json({ error: "Login failed" });
      }
      res.json({
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        role: user.role,
        permissions: user.permissions,
      });
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Login failed" });
  }
});

// POST /api/auth/register — public, creates a pending registration
router.post("/register", async (req, res) => {
  try {
    const { name, username, password, department, shift, email } = req.body as {
      name: string;
      username: string;
      password: string;
      department: string;
      shift: string;
      email: string;
    };

    if (!name?.trim() || !username?.trim() || !password || !department?.trim() || !shift?.trim() || !email?.trim()) {
      return res.status(400).json({ error: "All fields are required" });
    }

    const emailTrimmed = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrimmed)) {
      return res.status(400).json({ error: "Please enter a valid email address" });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters" });
    }

    const normalized = username.trim().toLowerCase();

    const [existingUser] = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.username, normalized));
    if (existingUser) {
      return res.status(409).json({ error: "That username is already taken" });
    }

    const [existingReg] = await db
      .select({ id: registrationsTable.id, status: registrationsTable.status })
      .from(registrationsTable)
      .where(eq(registrationsTable.username, normalized));
    if (existingReg && existingReg.status === "pending") {
      return res.status(409).json({ error: "A registration request for that username is already pending" });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    await db.insert(registrationsTable).values({
      name: name.trim(),
      username: normalized,
      passwordHash,
      department: department.trim(),
      shift: shift.trim(),
      email: emailTrimmed,
      status: "pending",
    });

    res.status(201).json({ success: true });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ error: "Registration failed" });
  }
});

// POST /api/auth/logout
router.post("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) return res.status(500).json({ error: "Logout failed" });
    res.clearCookie("connect.sid");
    res.json({ success: true });
  });
});

// GET /api/auth/me
router.get("/me", (req, res) => {
  if (!req.session?.userId) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  res.json({
    id: req.session.userId,
    username: req.session.username,
    displayName: req.session.displayName,
    role: req.session.role,
    permissions: req.session.permissions,
  });
});

export default router;
