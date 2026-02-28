# Plan: Debt Deal Periods + Rate-Change Email Notifications

## Overview
Two linked features:
1. **Deal periods** — a debt can have multiple time-bounded interest rate periods (e.g. 0% for 12 months, then 19.9% APR). The repayment schedule switches rates at period boundaries automatically.
2. **Email notifications** — per-debt configurable reminder: send an email N months before a deal period ends. Tracked to avoid duplicate sends.

---

## 1. Schema changes (`server/schema.sql` + migration in `server/db.ts`)

### New table: `debt_deal_periods`
```sql
CREATE TABLE IF NOT EXISTS debt_deal_periods (
  id          TEXT PRIMARY KEY,
  debt_id     TEXT NOT NULL REFERENCES debts(id) ON DELETE CASCADE,
  label       TEXT,           -- e.g. "0% intro offer", "Fixed rate", "SVR"
  interest_rate REAL NOT NULL DEFAULT 0,
  start_date  TEXT NOT NULL,  -- YYYY-MM-DD — first day this rate applies
  end_date    TEXT,           -- YYYY-MM-DD — last day (NULL = open-ended / current period)
  created_at  TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_deal_periods_debt ON debt_deal_periods(debt_id);
```

### New column on `debts`: `reminder_months INTEGER DEFAULT 0`
0 = no reminder. 1–24 = send email this many months before any deal period's `end_date`.

### New table: `debt_notifications_sent`
Prevents duplicate reminder emails per period:
```sql
CREATE TABLE IF NOT EXISTS debt_notifications_sent (
  id              TEXT PRIMARY KEY,
  debt_id         TEXT NOT NULL,
  deal_period_id  TEXT NOT NULL REFERENCES debt_deal_periods(id) ON DELETE CASCADE,
  sent_at         TEXT DEFAULT (datetime('now')),
  UNIQUE(debt_id, deal_period_id)
);
```

### Migrations (appended to `server/db.ts`)
```typescript
try { db.prepare("ALTER TABLE debts ADD COLUMN reminder_months INTEGER DEFAULT 0").run(); } catch {}
// debt_deal_periods and debt_notifications_sent created via schema.sql CREATE TABLE IF NOT EXISTS
```

---

## 2. Type changes (`shared/types.ts`)

```typescript
export interface DebtDealPeriod {
  id: string;
  debt_id: string;
  label?: string | null;
  interest_rate: number;
  start_date: string;       // YYYY-MM-DD
  end_date?: string | null; // YYYY-MM-DD or null
  created_at?: string;
}

// Add to Debt interface:
reminder_months?: number;
deal_periods?: DebtDealPeriod[];  // populated on GET /api/debts (full list)
```

---

## 3. Server: `server/routes/debts.ts`

### `GET /api/debts`
After fetching debts, for each debt JOIN/query its deal_periods ordered by `start_date`. Attach as `deal_periods` array on each debt object.

### `computeRepayments()` — rate-aware schedule
The function receives a debt (with `deal_periods`). For each month iteration:
```typescript
function rateForMonth(debt: Debt & { deal_periods: DebtDealPeriod[] }, monthDate: Date): number {
  // monthDate = first day of that month
  const iso = monthDate.toISOString().slice(0, 10);
  // Find a period where start_date <= iso AND (end_date IS NULL OR end_date >= iso)
  const match = debt.deal_periods.find(p =>
    p.start_date <= iso && (!p.end_date || p.end_date >= iso)
  );
  return match ? match.interest_rate : debt.interest_rate;  // fallback to base rate
}
```
The existing monthly loop uses this instead of the fixed `monthlyRate`.

### `POST /api/debts` and `PUT /api/debts/:id`
Accept optional `deal_periods` array and `reminder_months` in the body. On create/update:
- Validate each period: `interest_rate >= 0`, `start_date` is valid date, `end_date` is valid date or null, no overlapping periods (checked server-side).
- In a transaction: save the debt row, then DELETE all existing deal_periods for this debt and INSERT the new set (full replace pattern — simplest, avoids partial update complexity). New UUIDs for each period.
- Existing `debt_notifications_sent` rows cascade-delete when deal_periods are replaced (via `ON DELETE CASCADE`), allowing fresh reminders to be sent for the new periods.

### Validation helper `validateDealPeriods(periods)`
- Each period needs `interest_rate >= 0` and valid `start_date`.
- Only one period may have `end_date = null` (the open-ended/current one), and it must be the latest by `start_date`.
- Periods must not overlap: sort by `start_date`, check each period's `end_date < next.start_date`.

---

## 4. Email notification service

### `server/services/email.ts` — new function
```typescript
export async function sendDealPeriodReminder(
  to: string,
  debtName: string,
  periodLabel: string,
  endDate: string,        // YYYY-MM-DD
  monthsUntilEnd: number,
): Promise<void>
```
HTML body: "Your deal period '[label]' on [debtName] ends on [formatted date] — that's [N] month(s) away. Log in to review your options."

### `server/services/debtNotifications.ts` — new file
```typescript
export async function checkAndSendDealReminders(): Promise<void>
```
Logic:
1. Find all debts where `reminder_months > 0`: `SELECT * FROM debts WHERE reminder_months > 0`
2. For each, get its deal_periods where `end_date IS NOT NULL`
3. For each period, compute `monthsUntilEnd = diffInMonths(today, end_date)`
4. If `monthsUntilEnd <= reminder_months` and no row in `debt_notifications_sent` for this `(debt_id, deal_period_id)`:
   - Look up the debt owner's email: `SELECT email FROM users WHERE id = debt.user_id`
   - Call `sendDealPeriodReminder(...)`
   - Insert into `debt_notifications_sent`
5. Errors are caught per-debt and logged, not thrown.

### `server/index.ts` — schedule the check
```typescript
import { checkAndSendDealReminders } from './services/debtNotifications.js';

// Run once on startup (after a 10s delay to allow DB init), then every 24h
setTimeout(() => {
  checkAndSendDealReminders().catch(console.error);
  setInterval(() => checkAndSendDealReminders().catch(console.error), 24 * 60 * 60 * 1000);
}, 10_000);
```

---

## 5. API client (`src/api/client.ts`)

Update `createDebt` and `updateDebt` to accept and forward:
- `deal_periods?: Omit<DebtDealPeriod, 'id' | 'debt_id' | 'created_at'>[]`
- `reminder_months?: number`

---

## 6. UI: `src/components/forms/DebtForm.tsx`

### New state
```typescript
const [dealPeriods, setDealPeriods] = useState<DraftPeriod[]>(initial?.deal_periods?.map(...) ?? []);
const [reminderMonths, setReminderMonths] = useState(initial?.reminder_months ?? 0);
```
where `DraftPeriod = { key: string; label: string; interest_rate: string; start_date: string; end_date: string }` (all strings for form inputs, converted on submit).

### "Deal Periods" section (collapsible or always visible, after Notes)
- Header: "Deal Periods" with a small "Add Period" button
- Each period row (inline mini-form):
  - Label input (placeholder "e.g. 0% intro")
  - Rate input (number, suffix "%")
  - Start date input (type="date")
  - End date input (type="date", placeholder "Leave blank for ongoing")
  - Remove button (×)
- Validation on submit: delegate to server (keep client-side light — just check required fields).

### "Reminder" field (below Deal Periods)
```
Notify me [ 2 ] months before a deal period ends  (0 = off)
```
A small number input, min 0 max 24. Only meaningful if deal periods with end_dates exist.

### Submit: include `deal_periods` + `reminder_months` in the `onSave` payload.

---

## 7. UI: `src/pages/DebtPage.tsx`

### Table: deal periods badge
In the Name column, if `debt.deal_periods?.length > 0`, show a small badge:
- e.g. `2 rates` (count of deal periods)
- Colour: primary/info tone

### RepaymentPanel
No change needed — the server now returns a rate-aware schedule automatically. The existing table columns (Interest column) will naturally show varying amounts per month when rates change.

Optionally add a small legend below the panel header: "Rate changes: [list period transitions]" — e.g. "0% until Jan 2026, then 19.9%".

---

## 8. `src/pages/DebtPage.tsx` — show deal periods inline in expanded row

Below the RepaymentPanel, add a "Deal Periods" mini-table if the debt has any:

| Period | Rate | From | Until |
|---|---|---|---|
| 0% intro | 0% | 1 Jan 2025 | 31 Dec 2025 |
| Standard rate | 19.9% | 1 Jan 2026 | ongoing |

Also show: "Reminder: 2 months before end" if `reminder_months > 0`.

---

## 9. README update

- Income section: "fortnightly" was already updated.
- Debt section: add deal periods and email reminder mention.

---

## Files to create/modify

| File | Change |
|---|---|
| `server/schema.sql` | Add `debt_deal_periods` and `debt_notifications_sent` tables |
| `server/db.ts` | Migration for `reminder_months` column |
| `shared/types.ts` | Add `DebtDealPeriod` interface; extend `Debt` |
| `server/routes/debts.ts` | `computeRepayments` rate-aware; GET includes periods; POST/PUT accept periods |
| `server/services/email.ts` | Add `sendDealPeriodReminder()` |
| `server/services/debtNotifications.ts` | New file — `checkAndSendDealReminders()` |
| `server/index.ts` | Schedule notification check |
| `src/api/client.ts` | Update `createDebt` / `updateDebt` signatures |
| `src/components/forms/DebtForm.tsx` | Deal periods UI + reminder field |
| `src/pages/DebtPage.tsx` | Badge in table; deal periods mini-table in expanded row |
| `README.md` | Update debt section |

---

## Branch / PR
Branch: `feature/debt-deal-periods`
Version bump: `v2.6.0` → `v2.7.0` (new backward-compatible feature)
