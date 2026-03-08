import supertest from 'supertest';
import { createServer } from 'node:http';

const BASE_URL = process.env.API_URL || 'http://localhost:3099';
const DEMO_EMAIL = 'demo@basicbudget.app';
const DEMO_PASSWORD = 'DemoPass123!';

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitForServer(maxAttempts = 10): Promise<void> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const res = await fetch(`${BASE_URL}/api/auth/csrf-token`);
      if (res.ok) return;
    } catch {
      // Server not ready yet
    }
    await sleep(1000);
  }
  throw new Error('Server not responding');
}

async function seed(): Promise<void> {
  console.log(`\n=== BasicBudget Demo Seed ===`);
  console.log(`API URL: ${BASE_URL}\n`);

  await waitForServer();

  const agent = supertest(BASE_URL);
  let csrfToken = '';

  // Get CSRF token
  console.log('Getting CSRF token...');
  const tokenRes = await agent.get('/api/auth/csrf-token');
  csrfToken = tokenRes.body.token;
  console.log('✓ CSRF token obtained');

  // Register user
  console.log('Registering demo user...');
  const regRes = await agent
    .post('/api/auth/register')
    .set('X-CSRF-Token', csrfToken)
    .send({
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD,
      display_name: 'Demo User',
    });

  if (regRes.status === 409) {
    console.log('✓ User already exists (expected in reruns)');
  } else if (regRes.status !== 201 && regRes.status !== 200) {
    throw new Error(
      `Failed to register: ${regRes.status} ${JSON.stringify(regRes.body)}`,
    );
  } else {
    console.log('✓ User registered');
  }

  // Get new CSRF token for login
  const tokenRes2 = await agent.get('/api/auth/csrf-token');
  csrfToken = tokenRes2.body.token;

  // Login user
  console.log('Logging in demo user...');
  await agent
    .post('/api/auth/login')
    .set('X-CSRF-Token', csrfToken)
    .send({
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD,
    });
  console.log('✓ User logged in');

  // Create incomes
  console.log('Creating income entries...');
  const incomes = [
    {
      name: 'Salary – James',
      amount_pence: 320000,
      posting_day: 25,
      gross_or_net: 'net',
      is_recurring: true,
      recurrence_type: 'monthly',
    },
    {
      name: 'Freelance',
      amount_pence: 65000,
      posting_day: 15,
      gross_or_net: 'gross',
      is_recurring: true,
      recurrence_type: 'monthly',
    },
    {
      name: 'Child Benefit',
      amount_pence: 10200,
      posting_day: 1,
      gross_or_net: 'net',
      is_recurring: true,
      recurrence_type: 'monthly',
    },
  ];

  for (const income of incomes) {
    const tokenRes3 = await agent.get('/api/auth/csrf-token');
    await agent
      .post('/api/incomes')
      .set('X-CSRF-Token', tokenRes3.body.token)
      .send(income);
    console.log(`  ✓ Created "${income.name}"`);
  }

  // Create expenses
  console.log('Creating expense entries...');
  const expenses = [
    {
      name: 'Mortgage',
      amount_pence: 105000,
      posting_day: 1,
      category: 'Housing',
      is_recurring: true,
      recurrence_type: 'monthly',
    },
    {
      name: 'Council Tax',
      amount_pence: 18500,
      posting_day: 5,
      category: 'Housing',
      is_recurring: true,
      recurrence_type: 'monthly',
    },
    {
      name: 'Electricity & Gas',
      amount_pence: 14500,
      posting_day: 10,
      category: 'Utilities',
      is_recurring: true,
      recurrence_type: 'monthly',
    },
    {
      name: 'Broadband',
      amount_pence: 4200,
      posting_day: 18,
      category: 'Utilities',
      is_recurring: true,
      recurrence_type: 'monthly',
    },
    {
      name: 'Groceries',
      amount_pence: 38000,
      posting_day: 1,
      category: 'Food',
      is_recurring: true,
      recurrence_type: 'monthly',
    },
    {
      name: 'Car Insurance',
      amount_pence: 6800,
      posting_day: 22,
      category: 'Transport',
      is_recurring: true,
      recurrence_type: 'monthly',
    },
    {
      name: 'Netflix',
      amount_pence: 1800,
      posting_day: 3,
      category: 'Entertainment',
      is_recurring: true,
      recurrence_type: 'monthly',
    },
  ];

  for (const expense of expenses) {
    const tokenRes4 = await agent.get('/api/auth/csrf-token');
    await agent
      .post('/api/expenses')
      .set('X-CSRF-Token', tokenRes4.body.token)
      .send(expense);
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
      is_recurring: true,
      recurrence_type: 'monthly',
      posting_day: 1,
    },
    {
      name: 'Car Finance',
      balance_pence: 880000,
      interest_rate: 0,
      minimum_payment_pence: 22000,
      overpayment_pence: 0,
      is_recurring: true,
      recurrence_type: 'monthly',
      posting_day: 1,
    },
  ];

  for (const debt of debts) {
    const tokenRes5 = await agent.get('/api/auth/csrf-token');
    await agent
      .post('/api/debts')
      .set('X-CSRF-Token', tokenRes5.body.token)
      .send(debt);
    console.log(`  ✓ Created "${debt.name}"`);
  }

  // Create savings goals
  console.log('Creating savings goals...');
  const goals = [
    {
      name: 'Emergency Fund',
      current_amount_pence: 450000,
      target_amount_pence: 1000000,
      monthly_contribution_pence: 20000,
    },
    {
      name: 'Holiday 2026',
      current_amount_pence: 83000,
      target_amount_pence: 200000,
      monthly_contribution_pence: 15000,
    },
  ];

  for (const goal of goals) {
    const tokenRes6 = await agent.get('/api/auth/csrf-token');
    await agent
      .post('/api/savings-goals')
      .set('X-CSRF-Token', tokenRes6.body.token)
      .send(goal);
    console.log(`  ✓ Created "${goal.name}"`);
  }

  console.log('\n✓ Demo database seeded successfully!\n');
}

seed().catch((error) => {
  console.error('✗ Seed failed:', error.message);
  process.exit(1);
});
