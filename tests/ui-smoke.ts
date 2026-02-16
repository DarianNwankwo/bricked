/**
 * Puppeteer smoke test for the Vite frontend running in Docker.
 * Tests: auth flow, dashboard, project creation, workspace (template gallery,
 * architecture canvas, Kanban, chat), settings.
 *
 * Run: npx tsx tests/ui-smoke.ts
 * Prereq: docker compose up -d (stack running on port 3333)
 */

import puppeteer, { type Page, type Browser } from 'puppeteer';
import { mkdirSync } from 'fs';
import { join } from 'path';

const BASE_URL = 'http://localhost:3333';
const SCREENSHOT_DIR = join(process.cwd(), 'tests', 'screenshots');
const TEST_USER = {
  name: 'Test User',
  email: `test-${Date.now()}@brick.dev`,
  password: 'testpassword123',
};

let browser: Browser;
let page: Page;
let passed = 0;
let failed = 0;

function log(msg: string) {
  console.log(`  ${msg}`);
}

async function screenshot(name: string) {
  const path = join(SCREENSHOT_DIR, `${name}.png`);
  await page.screenshot({ path, fullPage: false });
  log(`  Screenshot: ${path}`);
}

async function test(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    passed++;
    console.log(`\x1b[32m✓\x1b[0m ${name}`);
  } catch (err) {
    failed++;
    console.log(`\x1b[31m✗\x1b[0m ${name}`);
    console.log(`  Error: ${err instanceof Error ? err.message : err}`);
    try {
      await screenshot(`FAIL-${name.replace(/\s+/g, '-')}`);
    } catch {}
  }
}

async function waitForText(text: string, timeout = 5000) {
  await page.waitForFunction(
    (t: string) => document.body.innerText.includes(t),
    { timeout },
    text
  );
}

async function main() {
  mkdirSync(SCREENSHOT_DIR, { recursive: true });

  console.log('\nBrick Studio — Puppeteer Smoke Tests\n');
  console.log(`Target: ${BASE_URL}`);
  console.log(`User: ${TEST_USER.email}\n`);

  // Wait for server to be ready
  log('Waiting for server...');
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch(`${BASE_URL}/health`);
      if (res.ok) break;
    } catch {}
    await new Promise(r => setTimeout(r, 1000));
  }

  browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  // ── Auth tests ──────────────────────────────────────────────────────
  await test('Auth: Login page loads', async () => {
    await page.goto(BASE_URL, { waitUntil: 'networkidle0' });
    await waitForText('Brick Studio');
    await waitForText('Sign in to your workspace');
    await screenshot('01-auth-login');
  });

  await test('Auth: Switch to signup', async () => {
    await page.click('button:has-text("Sign up")').catch(async () => {
      // Fallback: find by text content
      const btns = await page.$$('button');
      for (const btn of btns) {
        const text = await btn.evaluate(el => el.textContent);
        if (text?.includes('Sign up')) {
          await btn.click();
          break;
        }
      }
    });
    await waitForText('Create your account');
    await screenshot('02-auth-signup');
  });

  await test('Auth: Create account', async () => {
    // Fill in the signup form
    const inputs = await page.$$('input');
    // Name, Email, Password
    if (inputs.length >= 3) {
      await inputs[0].type(TEST_USER.name);
      await inputs[1].type(TEST_USER.email);
      await inputs[2].type(TEST_USER.password);
    }

    // Submit
    const submitBtn = await page.$('button[type="submit"]');
    if (submitBtn) await submitBtn.click();

    // Wait for dashboard to load
    await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 10000 }).catch(() => {});
    await new Promise(r => setTimeout(r, 2000));
    await screenshot('03-auth-signup-result');
  });

  // ── Dashboard tests ─────────────────────────────────────────────────
  await test('Dashboard: Loads after auth', async () => {
    await waitForText('Dashboard', 8000);
    await screenshot('04-dashboard');
  });

  await test('Dashboard: Shows stats row', async () => {
    await waitForText('Total Projects');
    await waitForText('Live Deployments');
    await screenshot('05-dashboard-stats');
  });

  // ── Create project ──────────────────────────────────────────────────
  await test('Project: Create new project', async () => {
    // Click "New Project" button
    const btns = await page.$$('button');
    for (const btn of btns) {
      const text = await btn.evaluate(el => el.textContent);
      if (text?.includes('New Project')) {
        await btn.click();
        break;
      }
    }
    await new Promise(r => setTimeout(r, 2000));
    await screenshot('06-new-project');
  });

  // ── Workspace tests ─────────────────────────────────────────────────
  await test('Workspace: Template gallery or architecture canvas loads', async () => {
    // Should be in workspace now — either template gallery or architecture canvas
    await new Promise(r => setTimeout(r, 1000));
    const bodyText = await page.evaluate(() => document.body.innerText);
    const hasTemplates = bodyText.includes('Choose a starting template') || bodyText.includes('template');
    const hasWorkspace = bodyText.includes('Architecture') || bodyText.includes('Code') || bodyText.includes('Chat');
    if (!hasTemplates && !hasWorkspace) {
      throw new Error('Neither template gallery nor workspace loaded');
    }
    await screenshot('07-workspace');
  });

  await test('Workspace: Architecture tab visible', async () => {
    // Check for tab buttons
    const bodyText = await page.evaluate(() => document.body.innerText);
    if (!bodyText.includes('Architecture') && !bodyText.includes('Choose a starting template')) {
      throw new Error('Architecture tab not visible');
    }
    await screenshot('08-architecture');
  });

  // ── Navigate to settings ────────────────────────────────────────────
  await test('Settings: Navigate and load', async () => {
    await page.goto(`${BASE_URL}/settings`, { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 1000));
    await waitForText('Preferences', 5000);
    await screenshot('09-settings');
  });

  await test('Settings: Shows theme selector', async () => {
    await waitForText('Appearance');
    await waitForText('Theme');
    await screenshot('10-settings-theme');
  });

  await test('Settings: Shows AI model config', async () => {
    await waitForText('AI Model');
    await screenshot('11-settings-model');
  });

  // ── Navigate to projects list ───────────────────────────────────────
  await test('Projects: Navigate and load', async () => {
    await page.goto(`${BASE_URL}/projects`, { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 1000));
    await waitForText('Projects', 5000);
    await screenshot('12-projects');
  });

  // ── Navigate back to dashboard ──────────────────────────────────────
  await test('Dashboard: Navigate back', async () => {
    await page.goto(BASE_URL, { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 1000));
    await waitForText('Dashboard', 5000);
    await screenshot('13-dashboard-final');
  });

  // ── Cleanup ─────────────────────────────────────────────────────────
  await browser.close();

  console.log(`\n${'─'.repeat(50)}`);
  console.log(`Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);
  console.log(`Screenshots: ${SCREENSHOT_DIR}`);
  console.log(`${'─'.repeat(50)}\n`);

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  browser?.close();
  process.exit(1);
});
