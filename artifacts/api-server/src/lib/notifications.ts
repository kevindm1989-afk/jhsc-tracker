import { pool } from "@workspace/db";
import { createTransporter, getSenderAddress } from "../emailClient";

async function getNotificationSettings(): Promise<{
  emails: string[];
  flags: Record<string, boolean>;
}> {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT key, value FROM app_settings WHERE key = ANY($1)`,
      [["notifyOnNewHSReport", "notifyOnNewIncident", "notifyOnNewMeeting", "notificationEmails"]]
    );
    const cfg: Record<string, string> = {};
    for (const row of result.rows) cfg[row.key] = row.value;

    const rawEmails = cfg["notificationEmails"] ?? "";
    const emails = rawEmails
      .split(",")
      .map((e) => e.trim())
      .filter(Boolean);

    return {
      emails,
      flags: {
        notifyOnNewHSReport: cfg["notifyOnNewHSReport"] === "true",
        notifyOnNewIncident: cfg["notifyOnNewIncident"] === "true",
        notifyOnNewMeeting: cfg["notifyOnNewMeeting"] === "true",
      },
    };
  } finally {
    client.release();
  }
}

export async function sendNotification(
  type: "hsReport" | "incident" | "meeting",
  data: Record<string, string>
): Promise<void> {
  try {
    const { emails, flags } = await getNotificationSettings();

    const flagKey =
      type === "hsReport"
        ? "notifyOnNewHSReport"
        : type === "incident"
        ? "notifyOnNewIncident"
        : "notifyOnNewMeeting";

    if (!flags[flagKey] || emails.length === 0) return;

    const transporter = createTransporter();
    const from = getSenderAddress();

    let subject = "";
    let html = "";

    if (type === "hsReport") {
      subject = `New H&S Concern Report Submitted — JHSC Advisor`;
      html = `
        <p>A new Health &amp; Safety concern report has been submitted.</p>
        <ul>
          <li><strong>Date:</strong> ${data.reportDate ?? "N/A"}</li>
          <li><strong>Location:</strong> ${data.location ?? "N/A"}</li>
          <li><strong>Description:</strong> ${data.description ?? "N/A"}</li>
          <li><strong>Submitted by:</strong> ${data.createdBy ?? "N/A"}</li>
        </ul>
        <p>Log in to JHSC Advisor to review the full report.</p>
        <p><em>JHSC Advisor — Automated Notification</em></p>
      `;
    } else if (type === "incident") {
      subject = `New Incident/Near-Miss Logged — ${data.incidentCode ?? ""} — JHSC Advisor`;
      html = `
        <p>A new incident or near-miss report has been logged.</p>
        <ul>
          <li><strong>Code:</strong> ${data.incidentCode ?? "N/A"}</li>
          <li><strong>Type:</strong> ${data.incidentType ?? "N/A"}</li>
          <li><strong>Date:</strong> ${data.incidentDate ?? "N/A"}</li>
          <li><strong>Location:</strong> ${data.location ?? "N/A"}</li>
          <li><strong>Description:</strong> ${data.description ?? "N/A"}</li>
          <li><strong>Logged by:</strong> ${data.createdBy ?? "N/A"}</li>
        </ul>
        <p>Log in to JHSC Advisor to review and take action.</p>
        <p><em>JHSC Advisor — Automated Notification</em></p>
      `;
    } else if (type === "meeting") {
      subject = `Meeting Scheduled — ${data.title ?? ""} — JHSC Advisor`;
      html = `
        <p>A new JHSC meeting has been scheduled.</p>
        <ul>
          <li><strong>Title:</strong> ${data.title ?? "N/A"}</li>
          <li><strong>Type:</strong> ${data.meetingType ?? "N/A"}</li>
          <li><strong>Date:</strong> ${data.scheduledDate ?? "N/A"}</li>
          <li><strong>Time:</strong> ${data.scheduledTime ?? "N/A"}</li>
          <li><strong>Location:</strong> ${data.location ?? "N/A"}</li>
        </ul>
        <p>Log in to JHSC Advisor to view the agenda and details.</p>
        <p><em>JHSC Advisor — Automated Notification</em></p>
      `;
    }

    await transporter.sendMail({ from, to: emails.join(", "), subject, html });
  } catch {
    // Notifications are best-effort; never throw
  }
}
