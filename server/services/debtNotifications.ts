import { randomUUID } from 'node:crypto';
import db from '../db.js';
import { sendDealPeriodReminder } from './email.js';
import { logger } from './logger.js';
import type { Debt, DebtDealPeriod } from '../../shared/types.js';

function diffInMonths(from: Date, to: Date): number {
  const yearDiff = to.getFullYear() - from.getFullYear();
  const monthDiff = to.getMonth() - from.getMonth();
  return yearDiff * 12 + monthDiff;
}

export async function checkAndSendDealReminders(): Promise<void> {
  try {
    // Find all debts where reminder_months > 0
    const debtsWithReminders = db.prepare(
      'SELECT * FROM debts WHERE reminder_months > 0'
    ).all() as (Record<string, unknown> & { id: string; user_id: string; name: string; reminder_months: number })[];

    for (const debt of debtsWithReminders) {
      // Get deal periods for this debt with end_date set
      const periods = db.prepare(
        'SELECT * FROM debt_deal_periods WHERE debt_id = ? AND end_date IS NOT NULL ORDER BY start_date'
      ).all(debt.id) as (Record<string, unknown> & DebtDealPeriod)[];

      for (const period of periods) {
        // Check if we've already sent a notification for this period
        const alreadySent = db.prepare(
          'SELECT 1 FROM debt_notifications_sent WHERE debt_id = ? AND deal_period_id = ?'
        ).get(debt.id, period.id);

        if (alreadySent) continue;

        // Compute months until end_date
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const endDate = new Date(period.end_date!);
        endDate.setHours(0, 0, 0, 0);
        const monthsUntilEnd = diffInMonths(today, endDate);

        // Send if within reminder window
        if (monthsUntilEnd >= 0 && monthsUntilEnd <= debt.reminder_months) {
          const user = db.prepare('SELECT email FROM users WHERE id = ?').get(debt.user_id) as { email: string } | undefined;
          if (!user) continue;

          try {
            await sendDealPeriodReminder(
              user.email,
              debt.name,
              period.label || `Rate change at ${period.end_date}`,
              period.end_date!,
              monthsUntilEnd,
            );

            // Mark as sent
            db.prepare(
              'INSERT INTO debt_notifications_sent (id, debt_id, deal_period_id) VALUES (?, ?, ?)'
            ).run(randomUUID(), debt.id, period.id);
          } catch (err) {
            logger.error('Failed to send deal reminder', { debt_id: debt.id, error: err instanceof Error ? err.message : String(err) });
          }
        }
      }
    }
  } catch (err) {
    logger.error('Error checking deal reminders', { error: err instanceof Error ? err.message : String(err) });
  }
}
