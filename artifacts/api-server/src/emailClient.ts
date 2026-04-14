import nodemailer from "nodemailer";

export function createTransporter() {
  const user = process.env.GMAIL_USER?.trim();
  const pass = process.env.GMAIL_APP_PASSWORD?.replace(/\s/g, "");

  if (!user || !pass) {
    throw new Error("GMAIL_USER and GMAIL_APP_PASSWORD environment variables are required");
  }

  return nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: { user, pass },
    tls: { rejectUnauthorized: false },
  });
}

export function getSenderAddress(): string {
  const user = process.env.GMAIL_USER?.trim();
  if (!user) throw new Error("GMAIL_USER not set");
  return user;
}
