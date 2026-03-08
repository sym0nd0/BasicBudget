import Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import { hashPassword } from '../server/auth/password.js';

const DB_PATH = process.env.DB_PATH || 'data/demo.db';
const DEMO_EMAIL = 'demo@basicbudget.app';
const DEMO_PASSWORD = 'DemoPass123!';

async function seedDatabase(): Promise<void> {
  console.log(`\n=== BasicBudget Demo Database Seed ===`);
  console.log(`Database: ${DB_PATH}\n`);

  const db = new Database(DB_PATH);

  try {
    // Initialize schema (copy from main database)
    const mainDb = new Database('data/basicbudget.db');
    const schema = mainDb.exec('SELECT sql FROM sqlite_master WHERE sql IS NOT NULL ORDER BY rowid');
    mainDb.close();

    // Create tables
    db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        display_name TEXT,
        email_verified INTEGER DEFAULT 0,
        system_role TEXT DEFAULT 'user',
        colour_palette TEXT DEFAULT 'default',
        notify_updates INTEGER DEFAULT 1,
        created_at TEXT,
        updated_at TEXT
      );

      CREATE TABLE IF NOT EXISTS households (
        id TEXT PRIMARY KEY,
        name TEXT,
        owner_user_id TEXT NOT NULL,
        created_at TEXT,
        updated_at TEXT
      );

      CREATE TABLE IF NOT EXISTS household_members (
        id TEXT PRIMARY KEY,
        household_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        role TEXT DEFAULT 'member',
        created_at TEXT,
        UNIQUE(household_id, user_id)
      );

      CREATE TABLE IF NOT EXISTS incomes (
        id TEXT PRIMARY KEY,
        household_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        contributor_user_id TEXT,
        name TEXT NOT NULL,
        amount_pence INTEGER,
        posting_day INTEGER,
        gross_or_net TEXT,
        is_recurring INTEGER DEFAULT 1,
        recurrence_type TEXT DEFAULT 'monthly',
        start_date TEXT,
        end_date TEXT,
        is_household INTEGER DEFAULT 0,
        notes TEXT,
        created_at TEXT,
        updated_at TEXT
      );

      CREATE TABLE IF NOT EXISTS expenses (
        id TEXT PRIMARY KEY,
        household_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        contributor_user_id TEXT,
        name TEXT NOT NULL,
        amount_pence INTEGER,
        posting_day INTEGER,
        account_id TEXT,
        category TEXT,
        is_recurring INTEGER DEFAULT 1,
        recurrence_type TEXT DEFAULT 'monthly',
        start_date TEXT,
        end_date TEXT,
        is_household INTEGER DEFAULT 0,
        split_ratio REAL,
        notes TEXT,
        created_at TEXT,
        updated_at TEXT
      );

      CREATE TABLE IF NOT EXISTS debts (
        id TEXT PRIMARY KEY,
        household_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        contributor_user_id TEXT,
        name TEXT NOT NULL,
        balance_pence INTEGER,
        interest_rate REAL,
        minimum_payment_pence INTEGER,
        overpayment_pence INTEGER,
        compounding_frequency TEXT,
        is_recurring INTEGER DEFAULT 1,
        recurrence_type TEXT DEFAULT 'monthly',
        posting_day INTEGER,
        start_date TEXT,
        end_date TEXT,
        is_household INTEGER DEFAULT 0,
        split_ratio REAL,
        notes TEXT,
        reminder_months INTEGER DEFAULT 0,
        created_at TEXT,
        updated_at TEXT
      );

      CREATE TABLE IF NOT EXISTS savings_goals (
        id TEXT PRIMARY KEY,
        household_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        contributor_user_id TEXT,
        name TEXT NOT NULL,
        target_amount_pence INTEGER DEFAULT 0,
        current_amount_pence INTEGER DEFAULT 0,
        monthly_contribution_pence INTEGER DEFAULT 0,
        is_household INTEGER DEFAULT 0,
        target_date TEXT,
        notes TEXT,
        created_at TEXT,
        updated_at TEXT
      );
    `);

    const now = new Date().toISOString();
    const userId = randomUUID();
    const householdId = randomUUID();

    // Create user
    console.log('Creating demo user...');
    const passwordHash = await hashPassword(DEMO_PASSWORD);
    db.prepare(`
      INSERT INTO users (id, email, password_hash, display_name, email_verified, system_role, created_at, updated_at)
      VALUES (?, ?, ?, ?, 1, 'admin', ?, ?)
    `).run(userId, DEMO_EMAIL, passwordHash, 'Demo User', now, now);
    console.log('✓ User created');

    // Create household
    console.log('Creating household...');
    db.prepare(`
      INSERT INTO households (id, name, owner_user_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(householdId, 'Demo Household', userId, now, now);
    console.log('✓ Household created');

    // Add user to household
    db.prepare(`
      INSERT INTO household_members (id, household_id, user_id, role, created_at)
      VALUES (?, ?, ?, 'owner', ?)
    `).run(randomUUID(), householdId, userId, now);

    // Create incomes
    console.log('Creating income entries...');
    const incomes = [
      ['Salary – James', 320000, 25, 'net'],
      ['Freelance', 65000, 15, 'gross'],
      ['Child Benefit', 10200, 1, 'net'],
    ];

    for (const [name, amount, day, type] of incomes) {
      db.prepare(`
        INSERT INTO incomes
          (id, household_id, user_id, name, amount_pence, posting_day, gross_or_net, is_recurring, recurrence_type, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 1, 'monthly', ?, ?)
      `).run(randomUUID(), householdId, userId, name, amount, day, type, now, now);
      console.log(`  ✓ Created "${name}"`);
    }

    // Create expenses
    console.log('Creating expense entries...');
    const expenses = [
      ['Mortgage', 105000, 1, 'Housing'],
      ['Council Tax', 18500, 5, 'Housing'],
      ['Electricity & Gas', 14500, 10, 'Utilities'],
      ['Broadband', 4200, 18, 'Utilities'],
      ['Groceries', 38000, 1, 'Food'],
      ['Car Insurance', 6800, 22, 'Transport'],
      ['Netflix', 1800, 3, 'Entertainment'],
    ];

    for (const [name, amount, day, category] of expenses) {
      db.prepare(`
        INSERT INTO expenses
          (id, household_id, user_id, name, amount_pence, posting_day, category, is_recurring, recurrence_type, split_ratio, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 1, 'monthly', 1.0, ?, ?)
      `).run(randomUUID(), householdId, userId, name, amount, day, category, now, now);
      console.log(`  ✓ Created "${name}"`);
    }

    // Create debts
    console.log('Creating debt entries...');
    const debts = [
      ['Barclaycard', 425000, 22.9, 8500, 15000],
      ['Car Finance', 880000, 0, 22000, 0],
    ];

    for (const [name, balance, rate, min, over] of debts) {
      db.prepare(`
        INSERT INTO debts
          (id, household_id, user_id, name, balance_pence, interest_rate, minimum_payment_pence, overpayment_pence, is_recurring, recurrence_type, posting_day, split_ratio, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 'monthly', 1, 1.0, ?, ?)
      `).run(randomUUID(), householdId, userId, name, balance, rate, min, over, now, now);
      console.log(`  ✓ Created "${name}"`);
    }

    // Create savings goals
    console.log('Creating savings goals...');
    const goals = [
      ['Emergency Fund', 1000000, 450000, 20000],
      ['Holiday 2026', 200000, 83000, 15000],
    ];

    for (const [name, target, current, monthly] of goals) {
      db.prepare(`
        INSERT INTO savings_goals
          (id, household_id, user_id, name, target_amount_pence, current_amount_pence, monthly_contribution_pence, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(randomUUID(), householdId, userId, name, target, current, monthly, now, now);
      console.log(`  ✓ Created "${name}"`);
    }

    console.log('\n✓ Demo database seeded successfully!\n');
    db.close();
    process.exit(0);
  } catch (error) {
    console.error('\n✗ Seed failed:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

seedDatabase();
