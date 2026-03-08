import { spawn, spawnSync } from 'node:child_process';
import { chromium } from 'playwright';
import { existsSync, rmSync, mkdirSync, cpSync } from 'node:fs';
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

async function captureScreenshot(
  page: any,
  path: string,
  url: string,
  theme: 'dark' | 'light',
): Promise<void> {
  console.log(`  Capturing ${theme} theme: ${url}`);
  await page.goto(url, { waitUntil: 'networkidle' });

  // Set theme via localStorage
  await page.evaluate((theme: string) => {
    localStorage.setItem('bb-theme', theme);
  }, theme);

  // Wait for theme to apply
  await sleep(500);

  // Trigger a reload to apply theme
  await page.goto(url, { waitUntil: 'networkidle' });

  // Wait for content to load
  await sleep(1000);

  await page.screenshot({ path, fullPage: false });
  console.log(`    ✓ Saved: ${path}`);
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
  console.log('Copying frontend assets...');
  cpSync(distDir, publicDir, { recursive: true, force: true });

  // Ensure screenshots directory exists
  mkdirSync(SCREENSHOTS_DIR, { recursive: true });

  // Start Express server
  console.log('Starting Express server...');
  const server = spawn('node', [DIST_SERVER], {
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

  let serverStarted = false;

  server.stdout?.on('data', (data) => {
    const output = data.toString();
    if (output.includes('listening on port') || output.includes('Server running')) {
      serverStarted = true;
    }
  });

  server.stderr?.on('data', (data) => {
    console.error(`Server error: ${data}`);
  });

  try {
    // Wait for server to be ready
    console.log('Waiting for server startup...');
    await waitForServer();

    // Run demo seed
    console.log('Seeding demo database...');
    const seedProcess = spawnSync('node', ['--import', 'tsx', 'scripts/demo-seed-db.ts'], {
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
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    // Set viewport
    await page.setViewportSize({ width: 1440, height: 900 });

    // Log in via browser UI (handles CSRF cookies transparently)
    console.log('Logging in...');
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });

    // Wait for form to be visible
    await page.waitForSelector('form', { timeout: 5000 });

    await page.fill('#email', DEMO_EMAIL);
    await page.fill('#password', DEMO_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(`${BASE_URL}/`, { timeout: 15000 });
    console.log('✓ Logged in successfully\n');

    // Capture dark theme screenshots
    console.log('Capturing dark theme screenshots...');
    await captureScreenshot(page, join(SCREENSHOTS_DIR, 'dashboard-dark.png'), `${BASE_URL}/`, 'dark');
    await captureScreenshot(page, join(SCREENSHOTS_DIR, 'income-dark.png'), `${BASE_URL}/income`, 'dark');
    await captureScreenshot(page, join(SCREENSHOTS_DIR, 'expenses-dark.png'), `${BASE_URL}/expenses`, 'dark');
    await captureScreenshot(page, join(SCREENSHOTS_DIR, 'debt-dark.png'), `${BASE_URL}/debt`, 'dark');
    await captureScreenshot(page, join(SCREENSHOTS_DIR, 'savings-dark.png'), `${BASE_URL}/savings`, 'dark');

    // Capture light theme screenshots
    console.log('\nCapturing light theme screenshots...');
    await captureScreenshot(page, join(SCREENSHOTS_DIR, 'dashboard-light.png'), `${BASE_URL}/`, 'light');
    await captureScreenshot(page, join(SCREENSHOTS_DIR, 'income-light.png'), `${BASE_URL}/income`, 'light');
    await captureScreenshot(page, join(SCREENSHOTS_DIR, 'expenses-light.png'), `${BASE_URL}/expenses`, 'light');
    await captureScreenshot(page, join(SCREENSHOTS_DIR, 'debt-light.png'), `${BASE_URL}/debt`, 'light');
    await captureScreenshot(page, join(SCREENSHOTS_DIR, 'savings-light.png'), `${BASE_URL}/savings`, 'light');

    // Clean up
    console.log('\nCleaning up...');
    await browser.close();

    // Kill server and wait for exit before deleting DB (avoids EPERM on Windows)
    server.kill('SIGTERM');
    await new Promise<void>((resolve) => {
      server.on('exit', () => resolve());
      setTimeout(resolve, 5000); // Fallback timeout
    });

    // Delete demo database (retry for Windows file-lock delays)
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

    console.log('\n✓ Screenshots generated successfully!\n');
    console.log(`Screenshots saved to: ${SCREENSHOTS_DIR}\n`);
    process.exit(0);
  } catch (error) {
    console.error('\n✗ Screenshot generation failed:', error instanceof Error ? error.message : error);

    // Kill server and wait before cleanup to avoid EPERM
    server.kill('SIGTERM');
    await new Promise<void>((resolve) => {
      server.on('exit', () => resolve());
      setTimeout(resolve, 5000);
    });

    if (existsSync(DEMO_DB_PATH)) {
      try { rmSync(DEMO_DB_PATH); } catch { /* ignore */ }
    }
    process.exit(1);
  }
}

main();
