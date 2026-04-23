import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { db } from "@workspace/db";
import { usersTable, registrationsTable, passwordResetTokensTable } from "@workspace/db/schema";
import { eq, and, gt, isNull, or } from "drizzle-orm";
import { createTransporter, getSenderAddress } from "../emailClient";
import "../sessionTypes";
import { PRIVACY_POLICY_VERSION } from "../lib/privacy";
import {
  getClientIp,
  recordFailedLogin,
  recordSuccessfulLogin,
} from "../middleware/securityLogger";

const router: IRouter = Router();

// POST /api/auth/login
router.post("/login", async (req, res) => {
  const ip = getClientIp(req);
  try {
    // Accept either { username } or { email } as the login identifier so
    // both legacy clients and email-first clients work against the same route.
    const body = (req.body || {}) as {
      username?: string;
      email?: string;
      password?: string;
    };
    const rawIdentifier = body.username ?? body.email ?? "";
    const password = body.password ?? "";

    if (!rawIdentifier || !password) {
      return res
        .status(400)
        .json({ error: "Username (or email) and password are required" });
    }

    const identifier = rawIdentifier.trim().toLowerCase();
    const [user] = await db
      .select()
      .from(usersTable)
      .where(or(eq(usersTable.username, identifier), eq(usersTable.email, identifier)));

    if (!user) {
      recordFailedLogin(ip, identifier);
      return res.status(401).json({ error: "Invalid username or password" });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      recordFailedLogin(ip, identifier);
      return res.status(401).json({ error: "Invalid username or password" });
    }

    recordSuccessfulLogin(ip);
    const displayName = user.role === "admin" ? "admin" : user.displayName;

    req.session.userId = user.id;
    req.session.username = user.username;
    req.session.displayName = displayName;
    req.session.role = user.role;
    req.session.permissions = user.permissions;

    return req.session.save((err) => {
      if (err) {
        console.error("Session save error:", err);
        return res.status(500).json({ error: "Login failed" });
      }
      return res.json({
        id: user.id,
        username: user.username,
        displayName,
        role: user.role,
        permissions: user.permissions,
      });
    });
  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({ error: "Login failed" });
  }
});

// POST /api/auth/register — public, creates a pending registration
router.post("/register", async (req, res) => {
  try {
    const { name, password, department, shift, email, consent } = req.body as {
      name: string;
      password: string;
      department: string;
      shift: string;
      email: string;
      consent?: boolean;
    };

    if (!name?.trim() || !password || !department?.trim() || !shift?.trim() || !email?.trim()) {
      return res.status(400).json({ error: "All fields are required" });
    }

    // PIPEDA: explicit, recorded consent is required before collecting personal information.
    if (consent !== true) {
      return res.status(400).json({
        error: "You must read and accept the Privacy Policy to request access.",
      });
    }

    const emailTrimmed = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrimmed)) {
      return res.status(400).json({ error: "Please enter a valid email address" });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters" });
    }

    // Auto-generate username: firstName + firstLetterOfLastName (lowercase, letters only)
    const nameParts = name.trim().toLowerCase().replace(/[^a-z\s]/g, "").split(/\s+/).filter(Boolean);
    const firstName = nameParts[0] ?? "";
    const lastInitial = nameParts.length > 1 ? nameParts[nameParts.length - 1][0] : "";
    const baseUsername = firstName + lastInitial;

    // Find a unique username by appending a number if needed
    let normalized = baseUsername;
    let suffix = 2;
    while (true) {
      const [takenUser] = await db
        .select({ id: usersTable.id })
        .from(usersTable)
        .where(eq(usersTable.username, normalized));
      const [takenReg] = await db
        .select({ id: registrationsTable.id, status: registrationsTable.status })
        .from(registrationsTable)
        .where(eq(registrationsTable.username, normalized));
      if (!takenUser && (!takenReg || takenReg.status !== "pending")) break;
      normalized = baseUsername + suffix;
      suffix++;
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
      consentAcceptedAt: new Date(),
      consentVersion: PRIVACY_POLICY_VERSION,
    });

    // Notify admin of new access request (non-fatal)
    try {
      const transporter = createTransporter();
      const adminEmail = getSenderAddress();
      await transporter.sendMail({
        from: adminEmail,
        to: adminEmail,
        subject: "New Access Request — JHSC Tracker",
        html: `
          <p>A new access request has been submitted and is waiting for your review.</p>
          <table style="border-collapse:collapse;margin:12px 0;">
            <tr><td style="padding:4px 12px 4px 0;color:#555;font-size:13px;">Name</td><td style="padding:4px 0;font-size:13px;font-weight:600;">${name.trim()}</td></tr>
            <tr><td style="padding:4px 12px 4px 0;color:#555;font-size:13px;">Email</td><td style="padding:4px 0;font-size:13px;">${emailTrimmed}</td></tr>
            <tr><td style="padding:4px 12px 4px 0;color:#555;font-size:13px;">Department</td><td style="padding:4px 0;font-size:13px;">${department.trim()}</td></tr>
            <tr><td style="padding:4px 12px 4px 0;color:#555;font-size:13px;">Shift</td><td style="padding:4px 0;font-size:13px;">${shift.trim()}</td></tr>
          </table>
          <p>Sign in to the tracker to approve or decline this request.</p>
          <br/>
          <p style="font-size:12px;color:#888;">JHSC Tracker</p>
        `,
      });
    } catch (emailErr) {
      console.error("Admin notification email error (non-fatal):", emailErr);
    }

    return res.status(201).json({ success: true });
  } catch (err) {
    console.error("Register error:", err);
    return res.status(500).json({ error: "Registration failed" });
  }
});

// POST /api/auth/forgot-password — public, sends reset email
router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body as { email: string };
    if (!email?.trim()) {
      return res.status(400).json({ error: "Email is required" });
    }
    const emailTrimmed = email.trim().toLowerCase();

    const [user] = await db
      .select({ id: usersTable.id, email: usersTable.email, displayName: usersTable.displayName })
      .from(usersTable)
      .where(eq(usersTable.email, emailTrimmed));

    // Always respond with success to avoid revealing whether email exists
    if (user) {
      const token = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      await db.insert(passwordResetTokensTable).values({
        userId: user.id,
        token,
        expiresAt,
      });

      const proto = (req.headers["x-forwarded-proto"] as string) || req.protocol;
      const host = (req.headers["x-forwarded-host"] as string) || req.headers.host;
      const basePath = (process.env.BASE_PATH || "").replace(/\/$/, "");
      const resetUrl = `${proto}://${host}${basePath}/reset-password?token=${token}`;

      try {
        const transporter = createTransporter();
        const from = getSenderAddress();
        await transporter.sendMail({
          from,
          to: user.email,
          subject: "Reset your JHSC Tracker password",
          html: `
            <p>Hi ${user.displayName},</p>
            <p>We received a request to reset your password for the <strong>JHSC Tracker</strong>.</p>
            <p><a href="${resetUrl}" style="background:#1d4ed8;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block;margin:12px 0;">Reset Password</a></p>
            <p>Or copy this link into your browser:</p>
            <p style="word-break:break-all;font-size:13px;color:#555;">${resetUrl}</p>
            <p>This link expires in <strong>1 hour</strong>. If you did not request a password reset, you can safely ignore this email.</p>
            <br/>
            <p style="font-size:12px;color:#888;">JHSC Tracker</p>
          `,
        });
      } catch (emailErr) {
        console.error("Password reset email error:", emailErr);
      }
    }

    return res.json({ success: true });
  } catch (err) {
    console.error("Forgot password error:", err);
    return res.status(500).json({ error: "Something went wrong" });
  }
});

// POST /api/auth/reset-password — public, updates password using token
router.post("/reset-password", async (req, res) => {
  try {
    const { token, newPassword } = req.body as { token: string; newPassword: string };
    if (!token?.trim() || !newPassword) {
      return res.status(400).json({ error: "Token and new password are required" });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters" });
    }

    const now = new Date();
    const [resetToken] = await db
      .select()
      .from(passwordResetTokensTable)
      .where(
        and(
          eq(passwordResetTokensTable.token, token.trim()),
          gt(passwordResetTokensTable.expiresAt, now)
        )
      );

    if (!resetToken) {
      return res.status(400).json({ error: "This reset link is invalid or has expired" });
    }
    if (resetToken.usedAt) {
      return res.status(400).json({ error: "This reset link has already been used" });
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await db
      .update(usersTable)
      .set({ passwordHash, updatedAt: now })
      .where(eq(usersTable.id, resetToken.userId));

    await db
      .update(passwordResetTokensTable)
      .set({ usedAt: now })
      .where(eq(passwordResetTokensTable.id, resetToken.id));

    return res.json({ success: true });
  } catch (err) {
    console.error("Reset password error:", err);
    return res.status(500).json({ error: "Something went wrong" });
  }
});

// POST /api/auth/change-password — authenticated user changes their own password
router.post("/change-password", async (req, res) => {
  if (!req.session?.userId) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  try {
    const { currentPassword, newPassword } = req.body as { currentPassword: string; newPassword: string };
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: "Current and new password are required" });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: "New password must be at least 6 characters" });
    }

    const [user] = await db
      .select({ id: usersTable.id, passwordHash: usersTable.passwordHash })
      .from(usersTable)
      .where(eq(usersTable.id, req.session.userId));

    if (!user) return res.status(404).json({ error: "User not found" });

    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) return res.status(401).json({ error: "Current password is incorrect" });

    const newHash = await bcrypt.hash(newPassword, 12);
    await db
      .update(usersTable)
      .set({ passwordHash: newHash, updatedAt: new Date() })
      .where(eq(usersTable.id, user.id));

    return res.json({ success: true });
  } catch (err) {
    console.error("Change password error:", err);
    return res.status(500).json({ error: "Failed to change password" });
  }
});

// POST /api/auth/logout
router.post("/logout", (req, res) => {
  return req.session.destroy((err) => {
    if (err) return res.status(500).json({ error: "Logout failed" });
    res.clearCookie("connect.sid");
    return res.json({ success: true });
  });
});

// GET /api/auth/me — always reads fresh from DB so permission changes take effect immediately
router.get("/me", async (req, res) => {
  if (!req.session?.userId) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  try {
    const [user] = await db
      .select({
        id: usersTable.id,
        username: usersTable.username,
        displayName: usersTable.displayName,
        role: usersTable.role,
        permissions: usersTable.permissions,
        consentAcceptedAt: usersTable.consentAcceptedAt,
        consentVersion: usersTable.consentVersion,
      })
      .from(usersTable)
      .where(eq(usersTable.id, req.session.userId));

    if (!user) {
      req.session.destroy(() => {});
      return res.status(401).json({ error: "Not authenticated" });
    }

    // Keep session in sync so requirePermission middleware stays accurate
    req.session.role = user.role;
    req.session.permissions = user.permissions;

    return res.json({
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      role: user.role,
      permissions: user.permissions,
      consentAcceptedAt: user.consentAcceptedAt,
      consentVersion: user.consentVersion,
      currentPolicyVersion: PRIVACY_POLICY_VERSION,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to fetch current user");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
