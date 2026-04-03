import nodemailer from "nodemailer";

export function createTransporter() {
  const user = process.env.GMAIL_USER?.trim();
  // Strip all spaces — Google displays app passwords as "xxxx xxxx xxxx xxxx"
  // but they must be sent without spaces
  const pass = process.env.GMAIL_APP_PASSWORD?.replace(/\s/g, "");

  if (!user || !pass) {
    throw new Error("GMAIL_USER and GMAIL_APP_PASSWORD environment variables are required");
  }

  return nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass },
  });
}

export function getSenderAddress(): string {
  const user = process.env.GMAIL_USER?.trim();
  if (!user) throw new Error("GMAIL_USER not set");
  return user;
}
