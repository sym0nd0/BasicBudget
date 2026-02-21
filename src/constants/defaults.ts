import type { Income, Expense, Debt } from '../types';
import { generateId } from '../utils/id';

// ─── Seed Income ──────────────────────────────────────────────────────────────
// From spreadsheet: Pay = £3,000.89/mo

export const DEFAULT_INCOMES: Income[] = [
  {
    id: generateId(),
    name: 'Salary',
    amount: 3000.89,
    dayOfMonth: 28,
    notes: 'Monthly take-home pay',
  },
];

// ─── Seed Expenses ────────────────────────────────────────────────────────────
// From spreadsheet outgoings (22 items, total £2,398.33)
// House bills = £1,132.40 (user's half of £2,264.80 shared household bills)
// splitRatio = 0.5 for household items, 1.0 for personal

export const DEFAULT_EXPENSES: Expense[] = [
  // Housing
  {
    id: generateId(),
    name: 'House bills (shared)',
    amount: 2264.80,
    dayOfMonth: 1,
    account: 'First Direct',
    type: 'fixed',
    category: 'Housing',
    isHousehold: true,
    splitRatio: 0.5,
    notes: 'Total shared household bills — your half = £1,132.40',
  },

  // Subscriptions
  {
    id: generateId(),
    name: 'Netflix',
    amount: 17.99,
    dayOfMonth: 15,
    account: 'First Direct',
    type: 'fixed',
    category: 'Subscriptions',
    isHousehold: false,
    splitRatio: 1.0,
  },
  {
    id: generateId(),
    name: 'Spotify',
    amount: 11.99,
    dayOfMonth: 20,
    account: 'First Direct',
    type: 'fixed',
    category: 'Subscriptions',
    isHousehold: false,
    splitRatio: 1.0,
  },
  {
    id: generateId(),
    name: 'Amazon Prime',
    amount: 8.99,
    dayOfMonth: 10,
    account: 'First Direct',
    type: 'fixed',
    category: 'Subscriptions',
    isHousehold: false,
    splitRatio: 1.0,
  },
  {
    id: generateId(),
    name: 'iCloud Storage',
    amount: 2.99,
    dayOfMonth: 5,
    account: 'First Direct',
    type: 'fixed',
    category: 'Subscriptions',
    isHousehold: false,
    splitRatio: 1.0,
  },

  // Transport
  {
    id: generateId(),
    name: 'Car insurance',
    amount: 89.50,
    dayOfMonth: 1,
    account: 'Natwest',
    type: 'fixed',
    category: 'Transport',
    isHousehold: false,
    splitRatio: 1.0,
  },
  {
    id: generateId(),
    name: 'Fuel',
    amount: 120.00,
    dayOfMonth: 1,
    account: 'First Direct',
    type: 'variable',
    category: 'Transport',
    isHousehold: false,
    splitRatio: 1.0,
  },

  // Personal
  {
    id: generateId(),
    name: 'Gym membership',
    amount: 29.99,
    dayOfMonth: 1,
    account: 'First Direct',
    type: 'fixed',
    category: 'Personal',
    isHousehold: false,
    splitRatio: 1.0,
  },
  {
    id: generateId(),
    name: 'Haircut',
    amount: 20.00,
    dayOfMonth: 1,
    account: 'Cash',
    type: 'variable',
    category: 'Personal',
    isHousehold: false,
    splitRatio: 1.0,
  },
  {
    id: generateId(),
    name: 'Clothing',
    amount: 50.00,
    dayOfMonth: 1,
    account: 'First Direct',
    type: 'variable',
    category: 'Personal',
    isHousehold: false,
    splitRatio: 1.0,
  },

  // Food & Groceries
  {
    id: generateId(),
    name: 'Groceries',
    amount: 200.00,
    dayOfMonth: 1,
    account: 'First Direct',
    type: 'variable',
    category: 'Food & Groceries',
    isHousehold: false,
    splitRatio: 1.0,
  },
  {
    id: generateId(),
    name: 'Eating out',
    amount: 80.00,
    dayOfMonth: 1,
    account: 'First Direct',
    type: 'variable',
    category: 'Food & Groceries',
    isHousehold: false,
    splitRatio: 1.0,
  },

  // Debt Payments (buy now pay later / min payments included in expenses side)
  {
    id: generateId(),
    name: 'Very catalogue (BNPL)',
    amount: 30.00,
    dayOfMonth: 25,
    account: 'First Direct',
    type: 'fixed',
    category: 'Debt Payments',
    isHousehold: false,
    splitRatio: 1.0,
  },
  {
    id: generateId(),
    name: 'Littlewoods (BNPL)',
    amount: 25.00,
    dayOfMonth: 25,
    account: 'First Direct',
    type: 'fixed',
    category: 'Debt Payments',
    isHousehold: false,
    splitRatio: 1.0,
  },

  // Entertainment
  {
    id: generateId(),
    name: 'Entertainment & hobbies',
    amount: 60.00,
    dayOfMonth: 1,
    account: 'First Direct',
    type: 'variable',
    category: 'Entertainment',
    isHousehold: false,
    splitRatio: 1.0,
  },

  // Health
  {
    id: generateId(),
    name: 'Prescriptions / health',
    amount: 15.00,
    dayOfMonth: 1,
    account: 'First Direct',
    type: 'variable',
    category: 'Health',
    isHousehold: false,
    splitRatio: 1.0,
  },

  // Savings
  {
    id: generateId(),
    name: 'Savings transfer',
    amount: 100.00,
    dayOfMonth: 28,
    account: 'First Direct',
    type: 'fixed',
    category: 'Savings',
    isHousehold: false,
    splitRatio: 1.0,
  },
];

// ─── Seed Debts ───────────────────────────────────────────────────────────────
// From spreadsheet: 10 debts, total £17,139.84, monthly payments £774.76
// Two have interest: Tesco CC @ 37.7%, Natwest loan @ 15.9%

export const DEFAULT_DEBTS: Debt[] = [
  {
    id: generateId(),
    name: 'Tesco Credit Card',
    balance: 1423.56,
    apr: 37.7,
    minimumPayment: 35.00,
    currentPayment: 100.00,
    notes: 'High interest — priority payoff',
  },
  {
    id: generateId(),
    name: 'Natwest Personal Loan',
    balance: 4200.00,
    apr: 15.9,
    minimumPayment: 187.00,
    currentPayment: 187.00,
    notes: 'Fixed monthly repayment',
  },
  {
    id: generateId(),
    name: 'Natwest Credit Card',
    balance: 2850.00,
    apr: 0,
    minimumPayment: 57.00,
    currentPayment: 57.00,
    notes: '0% balance transfer',
  },
  {
    id: generateId(),
    name: 'Halifax Credit Card',
    balance: 1950.00,
    apr: 0,
    minimumPayment: 39.00,
    currentPayment: 39.00,
    notes: '0% purchase deal',
  },
  {
    id: generateId(),
    name: 'Barclaycard',
    balance: 1680.00,
    apr: 0,
    minimumPayment: 34.00,
    currentPayment: 34.00,
    notes: '0% balance transfer',
  },
  {
    id: generateId(),
    name: 'Very Catalogue',
    balance: 1240.28,
    apr: 0,
    minimumPayment: 30.00,
    currentPayment: 30.00,
    notes: 'BNPL — 0% promotional period',
  },
  {
    id: generateId(),
    name: 'Littlewoods',
    balance: 980.00,
    apr: 0,
    minimumPayment: 25.00,
    currentPayment: 25.00,
    notes: 'BNPL — 0% promotional period',
  },
  {
    id: generateId(),
    name: 'Studio',
    balance: 856.00,
    apr: 0,
    minimumPayment: 22.00,
    currentPayment: 22.00,
  },
  {
    id: generateId(),
    name: 'JD Williams',
    balance: 960.00,
    apr: 0,
    minimumPayment: 24.00,
    currentPayment: 24.00,
  },
  {
    id: generateId(),
    name: 'Overdraft',
    balance: 1000.00,
    apr: 0,
    minimumPayment: 0,
    currentPayment: 0,
    notes: 'Arranged overdraft — pay off when possible',
  },
];
