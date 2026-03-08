import Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import { hashPassword } from '../server/auth/password.js';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const DB_PATH = process.env.DB_PATH || 'data/demo.db';
const SCHEMA_PATH = join(process.cwd(), 'server', 'schema.sql');
const DEMO_EMAIL = 'demo@basicbudget.app';
const DEMO_PASSWORD = 'DemoPass123!';

async function seedDatabase(): Promise<void> {
  console.log(`\n=== BasicBudget Demo Database Seed ===`);
  console.log(`Database: ${DB_PATH}\n`);

  const db = new Database(DB_PATH);

  try {
    // Load and execute schema
    const schema = readFileSync(SCHEMA_PATH, 'utf-8');
    db.exec(schema);

    const now = new Date().toISOString();
    const userId = randomUUID();
    const householdId = randomUUID();

    // Create user
    console.log('Creating demo user...');
    const passwordHash = await hashPassword(DEMO_PASSWORD);
    db.prepare(`
      INSERT INTO users (id, email, display_name, password_hash, email_verified, system_role, created_at, updated_at)
      VALUES (?, ?, ?, ?, 1, 'admin', ?, ?)
    `).run(userId, DEMO_EMAIL, 'Demo User', passwordHash, now, now);
    console.log('✓ User created');

    // Create household
    console.log('Creating household...');
    db.prepare(`
      INSERT INTO households (id, name, created_at)
      VALUES (?, ?, ?)
    `).run(householdId, 'Demo Household', now);
    console.log('✓ Household created');

    // Add user to household as owner
    db.prepare(`
      INSERT INTO household_members (household_id, user_id, role, joined_at)
      VALUES (?, ?, 'owner', ?)
    `).run(householdId, userId, now);

    // Create incomes
    console.log('Creating income entries...');
    const incomes = [
      {
        name: 'Salary – James',
        amount_pence: 320000,
        posting_day: 25,
        gross_or_net: 'net',
        contributor_name: 'James',
      },
      {
        name: 'Freelance',
        amount_pence: 65000,
        posting_day: 15,
        gross_or_net: 'gross',
        contributor_name: null,
      },
      {
        name: 'Child Benefit',
        amount_pence: 10200,
        posting_day: 1,
        gross_or_net: 'net',
        contributor_name: null,
      },
    ];

    for (const income of incomes) {
      db.prepare(`
        INSERT INTO incomes
          (id, household_id, user_id, name, amount_pence, posting_day, gross_or_net,
           is_recurring, recurrence_type, contributor_name, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 1, 'monthly', ?, ?, ?)
      `).run(
        randomUUID(),
        householdId,
        userId,
        income.name,
        income.amount_pence,
        income.posting_day,
        income.gross_or_net,
        income.contributor_name,
        now,
        now,
      );
      console.log(`  ✓ Created "${income.name}"`);
    }

    // Create expenses
    console.log('Creating expense entries...');
    const expenses = [
      { name: 'Mortgage', amount_pence: 105000, posting_day: 1, category: 'Housing' },
      { name: 'Council Tax', amount_pence: 18500, posting_day: 5, category: 'Housing' },
      { name: 'Electricity & Gas', amount_pence: 14500, posting_day: 10, category: 'Utilities' },
      { name: 'Broadband', amount_pence: 4200, posting_day: 18, category: 'Utilities' },
      { name: 'Groceries', amount_pence: 38000, posting_day: 1, category: 'Food' },
      { name: 'Car Insurance', amount_pence: 6800, posting_day: 22, category: 'Transport' },
      { name: 'Netflix', amount_pence: 1800, posting_day: 3, category: 'Entertainment' },
    ];

    for (const expense of expenses) {
      db.prepare(`
        INSERT INTO expenses
          (id, household_id, user_id, name, amount_pence, posting_day, category,
           is_recurring, recurrence_type, split_ratio, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 1, 'monthly', 1.0, ?, ?)
      `).run(
        randomUUID(),
        householdId,
        userId,
        expense.name,
        expense.amount_pence,
        expense.posting_day,
        expense.category,
        now,
        now,
      );
      console.log(`  ✓ Created "${expense.name}"`);
    }

    // Create debts
    console.log('Creating debt entries...');
    const debts = [
      {
        name: 'Barclaycard',
        balance_pence: 425000,
        interest_rate: 22.9,
        minimum_payment_pence: 8500,
        overpayment_pence: 15000,
      },
      {
        name: 'Car Finance',
        balance_pence: 880000,
        interest_rate: 0,
        minimum_payment_pence: 22000,
        overpayment_pence: 0,
      },
    ];

    for (const debt of debts) {
      db.prepare(`
        INSERT INTO debts
          (id, household_id, user_id, name, balance_pence, interest_rate,
           minimum_payment_pence, overpayment_pence, is_recurring, recurrence_type,
           posting_day, split_ratio, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 'monthly', 1, 1.0, ?, ?)
      `).run(
        randomUUID(),
        householdId,
        userId,
        debt.name,
        debt.balance_pence,
        debt.interest_rate,
        debt.minimum_payment_pence,
        debt.overpayment_pence,
        now,
        now,
      );
      console.log(`  ✓ Created "${debt.name}"`);
    }

    // Create savings goals
    console.log('Creating savings goals...');
    const goals = [
      {
        name: 'Emergency Fund',
        target_amount_pence: 1000000,
        current_amount_pence: 450000,
        monthly_contribution_pence: 20000,
      },
      {
        name: 'Holiday 2026',
        target_amount_pence: 200000,
        current_amount_pence: 83000,
        monthly_contribution_pence: 15000,
      },
    ];

    for (const goal of goals) {
      db.prepare(`
        INSERT INTO savings_goals
          (id, household_id, user_id, name, target_amount_pence, current_amount_pence,
           monthly_contribution_pence, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        randomUUID(),
        householdId,
        userId,
        goal.name,
        goal.target_amount_pence,
        goal.current_amount_pence,
        goal.monthly_contribution_pence,
        now,
        now,
      );
      console.log(`  ✓ Created "${goal.name}"`);
    }

    console.log('\n✓ Demo database seeded successfully!\n');
    db.close();
    process.exit(0);
  } catch (error) {
    console.error('\n✗ Seed failed:', error instanceof Error ? error.message : error);
    db.close();
    process.exit(1);
  }
}

seedDatabase();
