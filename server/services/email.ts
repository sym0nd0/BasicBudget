import nodemailer from 'nodemailer';
import { config } from '../config.js';
import { getSmtpConfig } from './settings.js';

function createTransport() {
  const smtp = getSmtpConfig();
  if (!smtp) return null;
  return nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    auth: smtp.user && smtp.pass
      ? { user: smtp.user, pass: smtp.pass }
      : undefined,
  });
}

async function sendMail(to: string, subject: string, html: string): Promise<void> {
  const smtp = getSmtpConfig();
  const transport = createTransport();
  if (!transport) {
    // Log email to console when SMTP is not configured
    console.log(`[EMAIL] To: ${to}\nSubject: ${subject}\n${html}`);
    return;
  }
  await transport.sendMail({
    from: smtp?.from ?? 'BasicBudget <no-reply@basicbudget.app>',
    to,
    subject,
    html,
  });
}

export async function sendEmailVerification(to: string, token: string): Promise<void> {
  const url = `${config.APP_URL}/verify-email?token=${token}`;
  await sendMail(
    to,
    'Verify your BasicBudget email',
    `<p>Click the link below to verify your email address. This link expires in 24 hours.</p>
     <p><a href="${url}">${url}</a></p>`,
  );
}

export async function sendPasswordReset(to: string, token: string): Promise<void> {
  const url = `${config.APP_URL}/reset-password?token=${token}`;
  await sendMail(
    to,
    'Reset your BasicBudget password',
    `<p>Click the link below to reset your password. This link expires in 30 minutes.</p>
     <p><a href="${url}">${url}</a></p>
     <p>If you didn't request this, you can safely ignore this email.</p>`,
  );
}

export async function sendHouseholdInvite(
  to: string,
  inviterName: string,
  householdName: string,
  token: string,
): Promise<void> {
  const url = `${config.APP_URL}/accept-invite?token=${token}`;
  await sendMail(
    to,
    `${inviterName} invited you to join ${householdName} on BasicBudget`,
    `<p>${inviterName} has invited you to join their household <strong>${householdName}</strong> on BasicBudget.</p>
     <p><a href="${url}">Accept invitation</a> (expires in 7 days)</p>`,
  );
}

export async function sendTotpResetNotification(to: string): Promise<void> {
  await sendMail(
    to,
    'Two-factor authentication reset requested',
    `<p>A request to reset your two-factor authentication has been initiated.</p>
     <p>This will take effect in 24 hours. If you did not request this, please contact support immediately.</p>`,
  );
}

export async function sendLoginAlert(to: string, ip: string | undefined, userAgent: string | undefined): Promise<void> {
  await sendMail(
    to,
    'New login detected on BasicBudget',
    `<p>A new login was detected on your account from a device we haven't seen before.</p>
     <ul>
       <li>IP address: ${ip ?? 'unknown'}</li>
       <li>Device: ${userAgent ?? 'unknown'}</li>
     </ul>
     <p>If this was you, no action is needed. If it wasn't you, change your password immediately.</p>`,
  );
}

export async function sendEmailChangeVerification(to: string, token: string): Promise<void> {
  const url = `${config.APP_URL}/confirm-email-change?token=${token}`;
  await sendMail(
    to,
    'Confirm your new email address for BasicBudget',
    `<p>Click the link below to confirm your new email address. This link expires in 30 minutes.</p>
     <p><a href="${url}">${url}</a></p>`,
  );
}

export async function sendTestEmail(to: string): Promise<void> {
  await sendMail(
    to,
    'BasicBudget SMTP test',
    `<p>This is a test email from BasicBudget. Your SMTP configuration is working correctly.</p>`,
  );
}
