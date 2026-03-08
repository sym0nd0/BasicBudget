import axios from 'axios';

const BASE_URL = process.env.API_URL || 'http://localhost:3099';
const DEMO_EMAIL = 'demo@basicbudget.app';
const DEMO_PASSWORD = 'DemoPass123!';

interface DemoData {
  csrf?: string;
  cookies?: Record<string, string>;
}

const demoData: DemoData = {};

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function request(
  method: string,
  endpoint: string,
  body?: unknown,
): Promise<axios.AxiosResponse> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (demoData.csrf) {
    headers['x-csrf-token'] = demoData.csrf;
  }

  const config = {
    method,
    url: `${BASE_URL}${endpoint}`,
    headers,
    withCredentials: true,
    validateStatus: () => true, // Don't throw on any status
  } as unknown as axios.AxiosRequestConfig;

  if (body) {
    config.data = body;
  }

  try {
    const response = await axios(config);
    return response;
  } catch (error) {
    console.error(`Request failed: ${method} ${endpoint}`, error);
    throw error;
  }
}

async function getCsrfToken(): Promise<void> {
  console.log('Getting CSRF token...');
  const res = await request('GET', '/api/auth/csrf-token');
  if (res.status !== 200) {
    throw new Error(`Failed to get CSRF token: ${res.status}`);
  }
  demoData.csrf = res.data.token;
  console.log('✓ CSRF token obtained');
}

async function registerUser(): Promise<void> {
  console.log('Registering demo user...');
  const res = await request('POST', '/api/auth/register', {
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
    display_name: 'Demo User',
  });
  if (res.status === 409) {
    console.log('✓ User already exists (expected in reruns)');
  } else if (res.status === 201 || res.status === 200) {
    console.log('✓ User registered');
  } else {
    throw new Error(`Failed to register: ${res.status} ${JSON.stringify(res.data)}`);
  }
}

async function loginUser(): Promise<void> {
  console.log('Logging in demo user...');
  const res = await request('POST', '/api/auth/login', {
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
  });
  if (res.status !== 200) {
    throw new Error(`Failed to login: ${res.status} ${JSON.stringify(res.data)}`);
  }
  console.log('✓ User logged in');
}

async function createIncomes(): Promise<void> {
  console.log('Creating income entries...');

  const incomes = [
    {
      name: 'Salary – James',
      amount_pence: 320000, // £3,200
      posting_day: 25,
      gross_or_net: 'net' as const,
      is_recurring: true,
      recurrence_type: 'monthly',
    },
    {
      name: 'Freelance',
      amount_pence: 65000, // £650
      posting_day: 15,
      gross_or_net: 'gross' as const,
      is_recurring: true,
      recurrence_type: 'monthly',
    },
    {
      name: 'Child Benefit',
      amount_pence: 10200, // £102
      posting_day: 1,
      gross_or_net: 'net' as const,
      is_recurring: true,
      recurrence_type: 'monthly',
    },
  ];

  for (const income of incomes) {
    const res = await request('POST', '/api/incomes', income);
    if (res.status !== 201) {
      throw new Error(`Failed to create income "${income.name}": ${res.status} ${JSON.stringify(res.data)}`);
    }
    console.log(`  ✓ Created "${income.name}"`);
  }
}

async function createExpenses(): Promise<void> {
  console.log('Creating expense entries...');

  const expenses = [
    {
      name: 'Mortgage',
      amount_pence: 105000, // £1,050
      posting_day: 1,
      category: 'Housing',
      is_recurring: true,
      recurrence_type: 'monthly',
    },
    {
      name: 'Council Tax',
      amount_pence: 18500, // £185
      posting_day: 5,
      category: 'Housing',
      is_recurring: true,
      recurrence_type: 'monthly',
    },
    {
      name: 'Electricity & Gas',
      amount_pence: 14500, // £145
      posting_day: 10,
      category: 'Utilities',
      is_recurring: true,
      recurrence_type: 'monthly',
    },
    {
      name: 'Broadband',
      amount_pence: 4200, // £42
      posting_day: 18,
      category: 'Utilities',
      is_recurring: true,
      recurrence_type: 'monthly',
    },
    {
      name: 'Groceries',
      amount_pence: 38000, // £380
      posting_day: 1,
      category: 'Food',
      is_recurring: true,
      recurrence_type: 'monthly',
    },
    {
      name: 'Car Insurance',
      amount_pence: 6800, // £68
      posting_day: 22,
      category: 'Transport',
      is_recurring: true,
      recurrence_type: 'monthly',
    },
    {
      name: 'Netflix',
      amount_pence: 1800, // £18
      posting_day: 3,
      category: 'Entertainment',
      is_recurring: true,
      recurrence_type: 'monthly',
    },
  ];

  for (const expense of expenses) {
    const res = await request('POST', '/api/expenses', expense);
    if (res.status !== 201) {
      throw new Error(`Failed to create expense "${expense.name}": ${res.status} ${JSON.stringify(res.data)}`);
    }
    console.log(`  ✓ Created "${expense.name}"`);
  }
}

async function createDebts(): Promise<void> {
  console.log('Creating debt entries...');

  const debts = [
    {
      name: 'Barclaycard',
      balance_pence: 425000, // £4,250
      interest_rate: 22.9,
      minimum_payment_pence: 8500, // £85
      overpayment_pence: 15000, // £150
      is_recurring: true,
      recurrence_type: 'monthly',
      posting_day: 1,
    },
    {
      name: 'Car Finance',
      balance_pence: 880000, // £8,800
      interest_rate: 0,
      minimum_payment_pence: 22000, // £220
      overpayment_pence: 0,
      is_recurring: true,
      recurrence_type: 'monthly',
      posting_day: 1,
    },
  ];

  for (const debt of debts) {
    const res = await request('POST', '/api/debts', debt);
    if (res.status !== 201) {
      throw new Error(`Failed to create debt "${debt.name}": ${res.status} ${JSON.stringify(res.data)}`);
    }
    console.log(`  ✓ Created "${debt.name}"`);
  }
}

async function createSavingsGoals(): Promise<void> {
  console.log('Creating savings goals...');

  const goals = [
    {
      name: 'Emergency Fund',
      current_amount_pence: 450000, // £4,500
      target_amount_pence: 1000000, // £10,000
      monthly_contribution_pence: 20000, // £200
    },
    {
      name: 'Holiday 2026',
      current_amount_pence: 83000, // £830
      target_amount_pence: 200000, // £2,000
      monthly_contribution_pence: 15000, // £150
    },
  ];

  for (const goal of goals) {
    const res = await request('POST', '/api/savings-goals', goal);
    if (res.status !== 201) {
      throw new Error(`Failed to create savings goal "${goal.name}": ${res.status} ${JSON.stringify(res.data)}`);
    }
    console.log(`  ✓ Created "${goal.name}"`);
  }
}

async function main(): Promise<void> {
  console.log(`\n=== BasicBudget Demo Seed ===`);
  console.log(`API URL: ${BASE_URL}\n`);

  try {
    // Allow server to start up
    for (let i = 0; i < 5; i++) {
      try {
        await getCsrfToken();
        break;
      } catch (error) {
        if (i === 4) throw error;
        console.log('Server not ready, retrying in 1s...');
        await sleep(1000);
      }
    }

    await registerUser();
    await loginUser();
    await createIncomes();
    await createExpenses();
    await createDebts();
    await createSavingsGoals();

    console.log('\n✓ Demo database seeded successfully!\n');
    process.exit(0);
  } catch (error) {
    console.error('\n✗ Seed failed:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
