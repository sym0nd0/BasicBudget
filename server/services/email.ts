import nodemailer from 'nodemailer';
import { config } from '../config.js';
import { getSmtpConfig } from './settings.js';
import type { SmtpConfigFull } from './settings.js';
import { logger } from './logger.js';

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function createTransport(smtp: SmtpConfigFull | null) {
  if (!smtp) return null;
  logger.debug('Creating SMTP transport', {
    smtp_host: smtp.host,
    smtp_port: smtp.port,
    smtp_secure: smtp.secure,
    smtp_auth_enabled: Boolean(smtp.user && smtp.pass),
  });
  return nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    auth: smtp.user && smtp.pass
      ? { user: smtp.user, pass: smtp.pass }
      : undefined,
  });
}

async function sendMail(template: string, to: string, subject: string, html: string): Promise<void> {
  const smtp = getSmtpConfig();
  const transport = createTransport(smtp);
  if (!transport) {
    logger.warn('Email delivery skipped because SMTP is not configured', { template });
    return;
  }

  logger.debug('Sending email via SMTP', {
    template,
    smtp_host: smtp?.host,
    smtp_port: smtp?.port,
    smtp_secure: smtp?.secure,
  });

  try {
    await transport.sendMail({
      from: smtp?.from ?? 'BasicBudget <no-reply@basicbudget.app>',
      to,
      subject,
      html,
    });
    logger.info('Email sent successfully', { template });
  } catch (err) {
    logger.error('SMTP send failed', { template, error: err });
    throw err;
  }
}

export async function sendEmailVerification(to: string, token: string): Promise<void> {
  const url = `${config.APP_URL}/verify-email?token=${token}`;
  await sendMail(
    'email_verification',
    to,
    'Verify your BasicBudget email',
    `<p>Click the link below to verify your email address. This link expires in 24 hours.</p>
     <p><a href="${url}">${url}</a></p>`,
  );
}

export async function sendPasswordReset(to: string, token: string): Promise<void> {
  const url = `${config.APP_URL}/reset-password?token=${token}`;
  await sendMail(
    'password_reset',
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
    'household_invite',
    to,
    `${escapeHtml(inviterName)} invited you to join ${escapeHtml(householdName)} on BasicBudget`,
    `<p>${escapeHtml(inviterName)} has invited you to join their household <strong>${escapeHtml(householdName)}</strong> on BasicBudget.</p>
     <p><a href="${url}">Accept invitation</a> (expires in 7 days)</p>`,
  );
}

export async function sendTotpResetNotification(to: string): Promise<void> {
  await sendMail(
    'totp_reset_notification',
    to,
    'Two-factor authentication reset requested',
    `<p>A request to reset your two-factor authentication has been initiated.</p>
     <p>This will take effect in 24 hours. If you did not request this, please contact support immediately.</p>`,
  );
}

export async function sendLoginAlert(to: string, ip: string | undefined, userAgent: string | undefined): Promise<void> {
  await sendMail(
    'login_alert',
    to,
    'New login detected on BasicBudget',
    `<p>A new login was detected on your account from a device we haven't seen before.</p>
     <ul>
       <li>IP address: ${escapeHtml(ip ?? 'unknown')}</li>
       <li>Device: ${escapeHtml(userAgent ?? 'unknown')}</li>
     </ul>
     <p>If this was you, no action is needed. If it wasn't you, change your password immediately.</p>`,
  );
}

export async function sendEmailChangeVerification(to: string, token: string): Promise<void> {
  const url = `${config.APP_URL}/confirm-email-change?token=${token}`;
  await sendMail(
    'email_change_verification',
    to,
    'Confirm your new email address for BasicBudget',
    `<p>Click the link below to confirm your new email address. This link expires in 30 minutes.</p>
     <p><a href="${url}">${url}</a></p>`,
  );
}

export async function sendTestEmail(to: string): Promise<void> {
  await sendMail(
    'smtp_test',
    to,
    'BasicBudget SMTP test',
    `<p>This is a test email from BasicBudget. Your SMTP configuration is working correctly.</p>`,
  );
}

export async function sendDealPeriodReminder(
  to: string,
  debtName: string,
  periodLabel: string,
  endDate: string,
  monthsUntilEnd: number,
): Promise<void> {
  const formattedDate = new Date(endDate).toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' });
  const timeText = monthsUntilEnd === 0 ? 'ends today' : monthsUntilEnd === 1 ? 'ends in 1 month' : `ends in ${monthsUntilEnd} months`;

  await sendMail(
    'deal_period_reminder',
    to,
    `Deal period expiring: ${escapeHtml(debtName)}`,
    `<p>Your deal period <strong>"${escapeHtml(periodLabel)}"</strong> on <strong>${escapeHtml(debtName)}</strong> ${timeText} — on <strong>${formattedDate}</strong>.</p>
     <p>Log in to your BasicBudget account to review your options and plan for any rate changes or payment adjustments.</p>`,
  );
}
