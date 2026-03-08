import http from 'node:http';
import https from 'node:https';

const BASE_URL = process.env.API_URL || 'http://localhost:3099';
const DEMO_EMAIL = 'demo@basicbudget.app';
const DEMO_PASSWORD = 'DemoPass123!';

const cookies: Map<string, string> = new Map();
let csrfToken = '';

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function makeRequest(
  method: string,
  path: string,
  body?: unknown,
): Promise<{ status: number; data: unknown; headers: Record<string, any> }> {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const isHttps = url.protocol === 'https:';
    const client = isHttps ? https : http;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'Demo-Seed/1.0',
    };

    // Add CSRF token if available
    if (csrfToken) {
      headers['x-csrf-token'] = csrfToken;
    }

    // Add cookies
    if (cookies.size > 0) {
      headers['Cookie'] = Array.from(cookies.entries())
        .map(([name, value]) => `${name}=${value}`)
        .join('; ');
    }

    let bodyStr = '';
    if (body) {
      bodyStr = JSON.stringify(body);
      headers['Content-Length'] = Buffer.byteLength(bodyStr);
    }

    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers,
    };

    const req = client.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        // Extract and store cookies from Set-Cookie header
        const setCookieHeaders = res.headers['set-cookie'];
        if (setCookieHeaders) {
          const cookieArray = Array.isArray(setCookieHeaders)
            ? setCookieHeaders
            : [setCookieHeaders];
          for (const cookie of cookieArray) {
            const [nameValue] = cookie.split(';');
            const [name, value] = nameValue.split('=');
            if (name && value) {
              cookies.set(name.trim(), value.trim());
            }
          }
        }

        try {
          const parsed = JSON.parse(data);
          resolve({
            status: res.statusCode || 200,
            data: parsed,
            headers: res.headers as Record<string, any>,
          });
        } catch {
          resolve({
            status: res.statusCode || 200,
            data: data,
            headers: res.headers as Record<string, any>,
          });
        }
      });
    });

    req.on('error', reject);

    if (bodyStr) {
      req.write(bodyStr);
    }
    req.end();
  });
}

async function getCsrfToken(): Promise<void> {
  console.log('Getting CSRF token...');
  const res = await makeRequest('GET', '/api/auth/csrf-token');
  if (res.status !== 200) {
    throw new Error(`Failed to get CSRF token: ${res.status}`);
  }
  const data = res.data as Record<string, unknown>;
  csrfToken = data.token as string;
  console.log(`✓ CSRF token obtained: ${csrfToken.substring(0, 16)}...`);
  console.log(`✓ Cookies stored: ${Array.from(cookies.entries()).map(([k, v]) => `${k}=${v.substring(0, 10)}...`).join(', ')}`);
}

async function registerUser(): Promise<void> {
  console.log('Registering demo user...');
  console.log(`  Sending CSRF token: ${csrfToken.substring(0, 16)}...`);
  console.log(`  Sending cookies: ${Array.from(cookies.entries()).map(([k, v]) => `${k}=${v.substring(0, 10)}...`).join(', ')}`);
  const res = await makeRequest('POST', '/api/auth/register', {
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
    display_name: 'Demo User',
  });
  if (res.status === 409) {
    console.log('✓ User already exists (expected in reruns)');
  } else if (res.status === 201 || res.status === 200) {
    console.log('✓ User registered');
  } else {
    const data = res.data as Record<string, unknown>;
    throw new Error(
      `Failed to register: ${res.status} ${JSON.stringify(data.message ?? data)}`,
    );
  }
}

async function loginUser(): Promise<void> {
  console.log('Logging in demo user...');
  const res = await makeRequest('POST', '/api/auth/login', {
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
  });
  if (res.status !== 200) {
    const data = res.data as Record<string, unknown>;
    throw new Error(`Failed to login: ${res.status} ${JSON.stringify(data)}`);
  }
  console.log('✓ User logged in');
}

async function createIncomes(): Promise<void> {
  console.log('Creating income entries...');

  const incomes = [
    {
      name: 'Salary – James',
      amount_pence: 320000,
      posting_day: 25,
      gross_or_net: 'net' as const,
      is_recurring: true,
      recurrence_type: 'monthly',
    },
    {
      name: 'Freelance',
      amount_pence: 65000,
      posting_day: 15,
      gross_or_net: 'gross' as const,
      is_recurring: true,
      recurrence_type: 'monthly',
    },
    {
      name: 'Child Benefit',
      amount_pence: 10200,
      posting_day: 1,
      gross_or_net: 'net' as const,
      is_recurring: true,
      recurrence_type: 'monthly',
    },
  ];

  for (const income of incomes) {
    const res = await makeRequest('POST', '/api/incomes', income);
    if (res.status !== 201) {
      const data = res.data as Record<string, unknown>;
      throw new Error(
        `Failed to create income "${income.name}": ${res.status} ${JSON.stringify(data)}`,
      );
    }
    console.log(`  ✓ Created "${income.name}"`);
  }
}

async function createExpenses(): Promise<void> {
  console.log('Creating expense entries...');

  const expenses = [
    { name: 'Mortgage', amount_pence: 105000, posting_day: 1, category: 'Housing', is_recurring: true, recurrence_type: 'monthly' },
    { name: 'Council Tax', amount_pence: 18500, posting_day: 5, category: 'Housing', is_recurring: true, recurrence_type: 'monthly' },
    { name: 'Electricity & Gas', amount_pence: 14500, posting_day: 10, category: 'Utilities', is_recurring: true, recurrence_type: 'monthly' },
    { name: 'Broadband', amount_pence: 4200, posting_day: 18, category: 'Utilities', is_recurring: true, recurrence_type: 'monthly' },
    { name: 'Groceries', amount_pence: 38000, posting_day: 1, category: 'Food', is_recurring: true, recurrence_type: 'monthly' },
    { name: 'Car Insurance', amount_pence: 6800, posting_day: 22, category: 'Transport', is_recurring: true, recurrence_type: 'monthly' },
    { name: 'Netflix', amount_pence: 1800, posting_day: 3, category: 'Entertainment', is_recurring: true, recurrence_type: 'monthly' },
  ];

  for (const expense of expenses) {
    const res = await makeRequest('POST', '/api/expenses', expense);
    if (res.status !== 201) {
      const data = res.data as Record<string, unknown>;
      throw new Error(`Failed to create expense "${expense.name}": ${res.status} ${JSON.stringify(data)}`);
    }
    console.log(`  ✓ Created "${expense.name}"`);
  }
}

async function createDebts(): Promise<void> {
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
    const res = await makeRequest('POST', '/api/debts', debt);
    if (res.status !== 201) {
      const data = res.data as Record<string, unknown>;
      throw new Error(`Failed to create debt "${debt.name}": ${res.status} ${JSON.stringify(data)}`);
    }
    console.log(`  ✓ Created "${debt.name}"`);
  }
}

async function createSavingsGoals(): Promise<void> {
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
    const res = await makeRequest('POST', '/api/savings-goals', goal);
    if (res.status !== 201) {
      const data = res.data as Record<string, unknown>;
      throw new Error(
        `Failed to create savings goal "${goal.name}": ${res.status} ${JSON.stringify(data)}`,
      );
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
    console.error(
      '\n✗ Seed failed:',
      error instanceof Error ? error.message : error,
    );
    process.exit(1);
  }
}

main();
