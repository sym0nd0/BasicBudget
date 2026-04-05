import { spawn, spawnSync, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { chromium, request as playwrightRequest, type Browser, type BrowserContext, type Page } from 'playwright';
import { existsSync, rmSync, mkdirSync, cpSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';

const DEMO_DB_PATH = join(process.cwd(), 'data', 'demo.db');
const DIST_SERVER = join(process.cwd(), 'dist-server', 'server', 'index.js');
const SCREENSHOTS_DIR = join(process.cwd(), 'docs', 'screenshots');
const API_PORT = 3099;
const BASE_URL = `http://localhost:${API_PORT}`;
const DEMO_EMAIL = 'demo@basicbudget.app';
const DEMO_PASSWORD = 'DemoPass123!';

function generateSecretKey(bytes = 32): string {
  return randomBytes(bytes).toString('hex');
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function isServerReady(): Promise<boolean> {
  try {
    const response = await fetch(`${BASE_URL}/api/auth/csrf-token`);
    return response.ok;
  } catch {
    return false;
  }
}

async function waitForServer(maxAttempts = 30): Promise<void> {
  console.log('Waiting for server to start...');
  for (let i = 0; i < maxAttempts; i++) {
    if (await isServerReady()) {
      console.log('✓ Server is ready');
      return;
    }
    await sleep(1000);
  }
  throw new Error('Server failed to start within timeout');
}

async function setTheme(page: Page, theme: 'dark' | 'light'): Promise<void> {
  await page.evaluate((t: string) => {
    localStorage.setItem('bb-theme', JSON.stringify(t));
  }, theme);
}

async function captureScreenshot(
  context: BrowserContext,
  page: Page,
  path: string,
  url: string,
  theme: 'dark' | 'light',
): Promise<void> {
  console.log(`  Capturing: ${url}`);
  await page.goto(url, { waitUntil: 'networkidle' });

  if (page.url().includes('/login')) {
    console.log('    Session expired; restoring demo login...');
    await loginDemoUser(context, page, theme);
    await page.goto(url, { waitUntil: 'networkidle' });
    if (page.url().includes('/login')) {
      throw new Error(`Session lost while capturing ${url} — page redirected to login`);
    }
  }

  // Wait for content to settle
  await sleep(1000);

  await page.screenshot({ path, fullPage: false });
  console.log(`    ✓ Saved: ${path}`);
}

function startServer(): ChildProcessWithoutNullStreams {
  console.log('Starting Express server...');
  const server = spawn(process.execPath, [DIST_SERVER], {
    env: {
      ...process.env,
      PORT: String(API_PORT),
      DB_PATH: DEMO_DB_PATH,
      NODE_ENV: 'production',
      COOKIE_SECURE: 'false',
      SESSION_SECRET: process.env.SESSION_SECRET || generateSecretKey(32),
      TOTP_ENCRYPTION_KEY: process.env.TOTP_ENCRYPTION_KEY || generateSecretKey(32),
      APP_URL: BASE_URL,
      CORS_ORIGIN: BASE_URL,
    },
    stdio: 'pipe',
  });

  server.stderr?.on('data', (data) => {
    console.error(`Server error: ${data}`);
  });
  server.stdout?.on('data', (data) => {
    process.stdout.write(data);
  });

  return server;
}

async function stopServer(server: ChildProcessWithoutNullStreams): Promise<void> {
  server.kill('SIGTERM');
  await new Promise<void>((resolve) => {
    server.on('exit', () => resolve());
    setTimeout(resolve, 5000);
  });
}

async function loginDemoUser(
  context: BrowserContext,
  page: Page,
  theme: 'dark' | 'light',
): Promise<void> {
  const apiContext = await playwrightRequest.newContext({ baseURL: BASE_URL });

  const csrfRes = await apiContext.get('/api/auth/csrf-token');
  if (!csrfRes.ok()) throw new Error(`CSRF token fetch failed: ${csrfRes.status()}`);
  const { token: csrfToken } = await csrfRes.json() as { token: string };

  const loginRes = await apiContext.post('/api/auth/login', {
    headers: { 'X-CSRF-Token': csrfToken },
    data: { email: DEMO_EMAIL, password: DEMO_PASSWORD },
  });
  if (!loginRes.ok()) throw new Error(`Login failed: HTTP ${loginRes.status()}`);

  const { cookies } = await apiContext.storageState();
  await context.clearCookies();
  await context.addCookies(cookies.map(c => ({ ...c, secure: false })));
  await apiContext.dispose();

  await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded' });
  await setTheme(page, theme);
}

async function main(): Promise<void> {
  console.log('\n=== BasicBudget Screenshot Generator ===\n');

  // Check if compiled server exists
  if (!existsSync(DIST_SERVER)) {
    console.error('✗ Production build not found. Run: npm run build');
    process.exit(1);
  }

  // Clean up old demo database
  if (existsSync(DEMO_DB_PATH)) {
    console.log('Cleaning up old demo database...');
    rmSync(DEMO_DB_PATH);
  }

  // Copy built frontend to public/ (server looks for static files there in production mode)
  const distDir = join(process.cwd(), 'dist');
  const publicDir = join(process.cwd(), 'public');
  const publicIndexPath = join(publicDir, 'index.html');
  const originalPublicIndex = existsSync(publicIndexPath)
    ? readFileSync(publicIndexPath, 'utf8')
    : null;
  let browser: Browser | null = null;
  let server: ChildProcessWithoutNullStreams | null = null;
  let exitCode = 0;
  try {
    console.log('Copying frontend assets...');
    cpSync(distDir, publicDir, { recursive: true, force: true });

    // Ensure screenshots directory exists
    mkdirSync(SCREENSHOTS_DIR, { recursive: true });

    server = startServer();

    // Wait for server to be ready
    console.log('Waiting for server startup...');
    await waitForServer();

    // Run demo seed
    console.log('Seeding demo database...');
    const seedProcess = spawnSync(process.execPath, ['--import', 'tsx', 'scripts/demo-seed-db.ts'], {
      env: {
        ...process.env,
        DB_PATH: DEMO_DB_PATH,
      },
      stdio: 'inherit',
    });

    if (seedProcess.status !== 0) {
      throw new Error('Demo seed failed');
    }

    // Launch Playwright
    console.log('\nLaunching Playwright...');
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    // Set viewport
    await page.setViewportSize({ width: 1440, height: 900 });

    // Login via API request context — bypasses browser's Secure-cookie restriction
    // over plain HTTP, so no server rebuild or COOKIE_SECURE env var is needed.
    console.log('Logging in...');
    await loginDemoUser(context, page, 'dark');

    // Navigate home and verify the app shows the authenticated view
    await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });
    if (page.url().includes('/login')) {
      throw new Error('Authentication failed: app redirected back to login page');
    }
    console.log('✓ Logged in successfully\n');

    // Capture dark theme screenshots
    console.log('Capturing dark theme screenshots...');
    await setTheme(page, 'dark');
    await captureScreenshot(context, page, join(SCREENSHOTS_DIR, 'dashboard-dark.png'), `${BASE_URL}/`, 'dark');
    await captureScreenshot(context, page, join(SCREENSHOTS_DIR, 'income-dark.png'), `${BASE_URL}/income`, 'dark');
    await captureScreenshot(context, page, join(SCREENSHOTS_DIR, 'expenses-dark.png'), `${BASE_URL}/expenses`, 'dark');
    await captureScreenshot(context, page, join(SCREENSHOTS_DIR, 'debt-dark.png'), `${BASE_URL}/debt`, 'dark');
    await captureScreenshot(context, page, join(SCREENSHOTS_DIR, 'savings-dark.png'), `${BASE_URL}/savings`, 'dark');
    await captureScreenshot(context, page, join(SCREENSHOTS_DIR, 'reports-dark.png'), `${BASE_URL}/reports`, 'dark');
    await captureScreenshot(context, page, join(SCREENSHOTS_DIR, 'household-dark.png'), `${BASE_URL}/household`, 'dark');
    await captureScreenshot(context, page, join(SCREENSHOTS_DIR, 'settings-dark.png'), `${BASE_URL}/settings`, 'dark');
    await captureScreenshot(context, page, join(SCREENSHOTS_DIR, 'admin-users-dark.png'), `${BASE_URL}/admin/users`, 'dark');
    await captureScreenshot(context, page, join(SCREENSHOTS_DIR, 'admin-settings-dark.png'), `${BASE_URL}/admin/settings`, 'dark');
    await captureScreenshot(context, page, join(SCREENSHOTS_DIR, 'admin-audit-log-dark.png'), `${BASE_URL}/admin/audit-log`, 'dark');

    console.log('\nRestarting server before light theme screenshots...');
    await stopServer(server);
    server = startServer();
    await waitForServer();
    await loginDemoUser(context, page, 'light');

    // Capture light theme screenshots
    console.log('\nCapturing light theme screenshots...');
    await captureScreenshot(context, page, join(SCREENSHOTS_DIR, 'dashboard-light.png'), `${BASE_URL}/`, 'light');
    await captureScreenshot(context, page, join(SCREENSHOTS_DIR, 'income-light.png'), `${BASE_URL}/income`, 'light');
    await captureScreenshot(context, page, join(SCREENSHOTS_DIR, 'expenses-light.png'), `${BASE_URL}/expenses`, 'light');
    await captureScreenshot(context, page, join(SCREENSHOTS_DIR, 'debt-light.png'), `${BASE_URL}/debt`, 'light');
    await captureScreenshot(context, page, join(SCREENSHOTS_DIR, 'savings-light.png'), `${BASE_URL}/savings`, 'light');
    await captureScreenshot(context, page, join(SCREENSHOTS_DIR, 'reports-light.png'), `${BASE_URL}/reports`, 'light');
    await captureScreenshot(context, page, join(SCREENSHOTS_DIR, 'household-light.png'), `${BASE_URL}/household`, 'light');
    await captureScreenshot(context, page, join(SCREENSHOTS_DIR, 'settings-light.png'), `${BASE_URL}/settings`, 'light');
    await captureScreenshot(context, page, join(SCREENSHOTS_DIR, 'admin-users-light.png'), `${BASE_URL}/admin/users`, 'light');
    await captureScreenshot(context, page, join(SCREENSHOTS_DIR, 'admin-settings-light.png'), `${BASE_URL}/admin/settings`, 'light');
    await captureScreenshot(context, page, join(SCREENSHOTS_DIR, 'admin-audit-log-light.png'), `${BASE_URL}/admin/audit-log`, 'light');

    // Clean up
    console.log('\nCleaning up...');
    console.log('\n✓ Screenshots generated successfully!\n');
    console.log(`Screenshots saved to: ${SCREENSHOTS_DIR}\n`);
  } catch (error) {
    exitCode = 1;
    console.error('\n✗ Screenshot generation failed:', error instanceof Error ? error.message : error);
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }

    if (server) {
      await stopServer(server).catch(() => {});
    }

    if (originalPublicIndex === null) {
      if (existsSync(publicIndexPath)) {
        unlinkSync(publicIndexPath);
      }
    } else {
      writeFileSync(publicIndexPath, originalPublicIndex, 'utf8');
    }

    for (let i = 0; i < 5; i++) {
      try {
        if (existsSync(DEMO_DB_PATH)) rmSync(DEMO_DB_PATH);
        if (existsSync(DEMO_DB_PATH + '-wal')) rmSync(DEMO_DB_PATH + '-wal');
        if (existsSync(DEMO_DB_PATH + '-shm')) rmSync(DEMO_DB_PATH + '-shm');
        break;
      } catch {
        if (i === 4) console.warn('Warning: could not delete demo database');
        await sleep(1000);
      }
    }
  }

  process.exitCode = exitCode;
}

main();
