/**
 * Comprehensive Puppeteer UI visual check
 * Run: npx tsx tests/ui-check.ts
 *
 * Clicks through every affordance, captures screenshots,
 * and logs element sizes/positions to verify layout quality.
 */
import puppeteer, { type Page, type Browser } from 'puppeteer';
import { mkdirSync } from 'fs';

const UI_URL = 'http://localhost:3333';
const SHOT_DIR = 'tests/screenshots';
mkdirSync(SHOT_DIR, { recursive: true });

let shotIndex = 0;
async function shot(page: Page, name: string) {
  shotIndex++;
  const filename = `${SHOT_DIR}/${String(shotIndex).padStart(2, '0')}-${name}.png`;
  await page.screenshot({ path: filename, fullPage: true });
  console.log(`  📸 ${filename}`);
}

async function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

async function login(page: Page) {
  await page.goto(UI_URL, { waitUntil: 'networkidle2', timeout: 15000 });
  const emailInput = await page.$('input[type="email"]');
  if (emailInput) {
    // Clear and set value via JS to avoid appending to existing content
    await page.evaluate(() => {
      const email = document.querySelector('input[type="email"]') as HTMLInputElement;
      const pass = document.querySelector('input[type="password"]') as HTMLInputElement;
      if (email) { email.value = ''; email.value = 'test@brick.studio'; email.dispatchEvent(new Event('input', { bubbles: true })); }
      if (pass) { pass.value = ''; pass.value = 'password123'; pass.dispatchEvent(new Event('input', { bubbles: true })); }
    });
    await sleep(300);
    // Find and click the sign-in button
    const buttons = await page.$$('button');
    for (const btn of buttons) {
      const text = await page.evaluate(el => el.textContent, btn);
      if (text && /log\s*in|login|sign\s*in/i.test(text)) {
        await btn.click();
        break;
      }
    }
    await sleep(2000);
  }
}

async function navigateToEditor(page: Page) {
  const firstCard = await page.$('.dashboard-card');
  if (firstCard) {
    await firstCard.click();
    await sleep(2000);
  }
}

async function getBoxInfo(page: Page, selector: string): Promise<{ width: number; height: number; x: number; y: number } | null> {
  const el = await page.$(selector);
  if (!el) return null;
  const box = await el.boundingBox();
  return box ? { width: Math.round(box.width), height: Math.round(box.height), x: Math.round(box.x), y: Math.round(box.y) } : null;
}

async function getComputedStyleProps(page: Page, selector: string, props: string[]): Promise<Record<string, string> | null> {
  const el = await page.$(selector);
  if (!el) return null;
  return page.evaluate((sel, ps) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const cs = window.getComputedStyle(el);
    const result: Record<string, string> = {};
    for (const p of ps) result[p] = cs.getPropertyValue(p);
    return result;
  }, selector, props);
}

// ─── TEST SECTIONS ───────────────────────────────────────────

async function testDashboard(page: Page) {
  console.log('\n═══ DASHBOARD ═══');
  await login(page);
  await shot(page, 'dashboard');

  // Count cards
  const cards = await page.$$('.dashboard-card');
  console.log(`  Cards: ${cards.length}`);

  // Check card contents
  for (let i = 0; i < cards.length; i++) {
    const text = await page.evaluate(el => el.textContent, cards[i]);
    const title = text?.slice(0, 60).replace(/\s+/g, ' ').trim();
    console.log(`  Card ${i + 1}: "${title}..."`);
  }

  // Check Demo and Deploy buttons
  const demoBtns = await page.$$('.dashboard-card-preview-btn');
  const deployBtns = await page.$$('.dashboard-card-deploy-btn');
  const deleteBtns = await page.$$('[title="Delete project"]');
  console.log(`  Demo buttons: ${demoBtns.length}, Deploy buttons: ${deployBtns.length}, Delete buttons: ${deleteBtns.length}`);

  // Check card layout / spacing
  if (cards.length >= 2) {
    const box0 = await cards[0].boundingBox();
    const box1 = await cards[1].boundingBox();
    if (box0 && box1) {
      const gap = box1.x - (box0.x + box0.width);
      console.log(`  Card gap: ${Math.round(gap)}px, Card width: ${Math.round(box0.width)}px`);
    }
  }

  // Check architecture mini-diagrams in cards
  const miniDiagrams = await page.$$('.dashboard-card svg');
  console.log(`  Architecture mini-diagrams (SVGs in cards): ${miniDiagrams.length}`);
}

async function testEditorCanvasView(page: Page) {
  console.log('\n═══ EDITOR - CANVAS VIEW ═══');
  await login(page);
  await navigateToEditor(page);
  await shot(page, 'editor-canvas');

  // Header
  const header = await getBoxInfo(page, 'header');
  console.log(`  Header: ${header?.width}x${header?.height}`);

  // Check view mode buttons
  for (const label of ['Canvas', 'Docs', 'Code']) {
    const btns = await page.$$(`button`);
    let found = false;
    for (const btn of btns) {
      const text = await page.evaluate(el => el.textContent?.trim(), btn);
      if (text === label) { found = true; break; }
    }
    console.log(`  "${label}" button: ${found ? 'YES' : 'MISSING'}`);
  }

  // Diagram panel
  const diagram = await getBoxInfo(page, '.diagram-panel');
  console.log(`  Diagram panel: ${diagram?.width}x${diagram?.height}`);

  // Side panels
  const chatPanel = await getBoxInfo(page, '.chat-panel');
  console.log(`  Chat/Assistant panel: ${chatPanel?.width}x${chatPanel?.height}`);

  const palettePanel = await getBoxInfo(page, '.palette-panel');
  console.log(`  Palette panel: ${palettePanel?.width}x${palettePanel?.height}`);

  const costPanel = await getBoxInfo(page, '.cost-panel');
  console.log(`  Cost panel: ${costPanel?.width}x${costPanel?.height}`);

  // Run Locally / Quick Deploy buttons
  const allButtons = await page.$$('button');
  for (const btn of allButtons) {
    const text = await page.evaluate(el => el.textContent?.trim(), btn);
    if (text && (text.includes('Run Locally') || text.includes('Quick Deploy') || text.includes('Deploy Settings'))) {
      console.log(`  Action button: "${text}"`);
    }
  }

  // Collapse button
  const collapseBtn = await page.$('[title="Collapse panels to sidebar"]');
  console.log(`  Collapse button: ${collapseBtn ? 'YES' : 'MISSING'}`);

  // React Flow nodes
  const rfNodes = await page.$$('.react-flow__node');
  console.log(`  React Flow nodes: ${rfNodes.length}`);

  // Minimap
  const minimap = await page.$('.react-flow__minimap');
  if (minimap) {
    const minimapStyle = await getComputedStyleProps(page, '.react-flow__minimap', ['background-color']);
    console.log(`  Minimap: present, bg=${minimapStyle?.['background-color']}`);
  } else {
    console.log(`  Minimap: MISSING`);
  }
}

async function testPanelCollapse(page: Page) {
  console.log('\n═══ PANEL COLLAPSE ═══');
  await login(page);
  await navigateToEditor(page);

  // Measure diagram BEFORE collapse
  const diagramBefore = await getBoxInfo(page, '.diagram-panel');
  console.log(`  Diagram BEFORE: ${diagramBefore?.width}x${diagramBefore?.height}`);

  // Click collapse button
  const collapseBtn = await page.$('[title="Collapse panels to sidebar"]');
  if (collapseBtn) {
    await collapseBtn.click();
    await sleep(600);
  } else {
    console.log('  ⚠️ No collapse button found!');
    return;
  }

  await shot(page, 'panels-collapsed');

  // Measure diagram AFTER collapse
  const diagramAfter = await getBoxInfo(page, '.diagram-panel');
  console.log(`  Diagram AFTER: ${diagramAfter?.width}x${diagramAfter?.height}`);

  if (diagramBefore && diagramAfter) {
    const widthDelta = diagramAfter.width - diagramBefore.width;
    console.log(`  Diagram width change: +${widthDelta}px (${widthDelta > 100 ? '✅ GOOD' : '⚠️ SMALL'})`);
  }

  // Check collapse bar
  const collapseBar = await page.$('.collapse-bar');
  console.log(`  Collapse bar: ${collapseBar ? 'YES' : 'MISSING'}`);

  // Count collapse bar items
  const barItems = await page.$$('.collapse-bar-item');
  console.log(`  Collapse bar items: ${barItems.length}`);
  for (let i = 0; i < barItems.length; i++) {
    const text = await page.evaluate(el => el.getAttribute('title') || el.textContent?.trim(), barItems[i]);
    console.log(`    Item ${i}: "${text}"`);
  }

  // Click first bar item to open panel as overlay
  if (barItems.length > 0) {
    await barItems[0].click();
    await sleep(500);
    await shot(page, 'collapsed-panel-overlay');

    const activePanelWrapper = await page.$('.active-panel-wrapper');
    if (activePanelWrapper) {
      const style = await getComputedStyleProps(page, '.active-panel-wrapper', ['position', 'left', 'z-index', 'width']);
      console.log(`  Active panel overlay: position=${style?.position}, left=${style?.left}, z-index=${style?.['z-index']}, width=${style?.width}`);

      // Verify diagram is still full-width behind the overlay
      const diagramDuringOverlay = await getBoxInfo(page, '.diagram-panel');
      console.log(`  Diagram during overlay: ${diagramDuringOverlay?.width}x${diagramDuringOverlay?.height}`);
    } else {
      console.log('  ⚠️ No active panel wrapper found');
    }

    // Click the same bar item again to close overlay
    await barItems[0].click();
    await sleep(500);
    await shot(page, 'overlay-closed');
  }

  // Expand panels back
  const expandBtn = await page.$('[title="Expand all panels"]');
  if (expandBtn) {
    await expandBtn.click();
    await sleep(500);
    await shot(page, 'panels-expanded');

    const diagramExpanded = await getBoxInfo(page, '.diagram-panel');
    console.log(`  Diagram after re-expand: ${diagramExpanded?.width}x${diagramExpanded?.height}`);
  }
}

async function testPanelHeaderCollapse(page: Page) {
  console.log('\n═══ PANEL HEADER COLLAPSE ═══');
  await login(page);
  await navigateToEditor(page);

  // Click the Assistant panel header to collapse
  const headers = await page.$$('.panel-header');
  let assistantHeader: any = null;
  for (const h of headers) {
    const text = await page.evaluate(el => el.textContent, h);
    if (text?.includes('Assistant')) {
      assistantHeader = h;
      break;
    }
  }

  if (assistantHeader) {
    await assistantHeader.click();
    await sleep(600);
    await shot(page, 'header-collapse-assistant');

    // Should trigger unified collapse
    const collapseBar = await page.$('.collapse-bar');
    console.log(`  Unified collapse bar appeared: ${collapseBar ? 'YES' : 'NO'}`);

    const diagram = await getBoxInfo(page, '.diagram-panel');
    console.log(`  Diagram after header collapse: ${diagram?.width}x${diagram?.height}`);
  } else {
    console.log('  ⚠️ No Assistant panel header found');
  }
}

async function testViewTransitions(page: Page) {
  console.log('\n═══ VIEW MODE TRANSITIONS ═══');
  await login(page);
  await navigateToEditor(page);

  const viewportWidth = 1440;

  // Test each view mode
  for (const view of ['Canvas', 'Docs', 'Code']) {
    const buttons = await page.$$('button');
    for (const btn of buttons) {
      const text = await page.evaluate(el => el.textContent?.trim(), btn);
      if (text === view) {
        await btn.click();
        await sleep(600);
        break;
      }
    }
    await shot(page, `view-${view.toLowerCase()}`);

    // Check what's visible in this view
    const diagram = await getBoxInfo(page, '.diagram-panel');
    const docsPanel = await page.$('.docs-markdown-panel');
    const codePanel = await page.$('.code-view-panel, .code-editor-panel');
    const editorContent = await page.$('.editor-content-area');

    console.log(`  ${view} view:`);
    console.log(`    Diagram: ${diagram ? `${diagram.width}x${diagram.height}` : 'hidden'}`);
    console.log(`    Docs panel: ${docsPanel ? 'visible' : 'hidden'}`);
    console.log(`    Code panel: ${codePanel ? 'visible' : 'hidden'}`);

    // Check if content fills available space
    if (editorContent) {
      const contentBox = await getBoxInfo(page, '.editor-content-area');
      if (contentBox) {
        const usagePercent = Math.round((contentBox.width / viewportWidth) * 100);
        console.log(`    Content area: ${contentBox.width}x${contentBox.height} (${usagePercent}% width)`);
      }
    }
  }

  // Test collapse in each non-Canvas view
  for (const view of ['Docs', 'Code']) {
    // Switch to view
    const buttons = await page.$$('button');
    for (const btn of buttons) {
      const text = await page.evaluate(el => el.textContent?.trim(), btn);
      if (text === view) {
        await btn.click();
        await sleep(500);
        break;
      }
    }

    // Collapse panels
    const collapseBtn = await page.$('[title="Collapse panels to sidebar"]');
    if (collapseBtn) {
      await collapseBtn.click();
      await sleep(600);
      await shot(page, `view-${view.toLowerCase()}-collapsed`);

      const editorContent = await getBoxInfo(page, '.editor-content-area');
      console.log(`  ${view} collapsed - content area: ${editorContent?.width}x${editorContent?.height}`);

      // Expand back
      const expandBtn = await page.$('[title="Expand all panels"]');
      if (expandBtn) {
        await expandBtn.click();
        await sleep(500);
      }
    }
  }

  // Switch back to Canvas
  const canvasButtons = await page.$$('button');
  for (const btn of canvasButtons) {
    const text = await page.evaluate(el => el.textContent?.trim(), btn);
    if (text === 'Canvas') { await btn.click(); await sleep(500); break; }
  }
}

async function testEditorButtons(page: Page) {
  console.log('\n═══ EDITOR HEADER BUTTONS ═══');
  await login(page);
  await navigateToEditor(page);

  // Collect all header buttons
  const headerButtons = await page.$$('header button');
  console.log(`  Header buttons count: ${headerButtons.length}`);

  for (let i = 0; i < headerButtons.length; i++) {
    const text = await page.evaluate(el => el.textContent?.trim(), headerButtons[i]);
    const title = await page.evaluate(el => el.getAttribute('title') || '', headerButtons[i]);
    const box = await headerButtons[i].boundingBox();
    const disabled = await page.evaluate(el => (el as HTMLButtonElement).disabled, headerButtons[i]);
    console.log(`  Button ${i}: text="${text}" title="${title}" size=${box ? Math.round(box.width) + 'x' + Math.round(box.height) : '?'} disabled=${disabled}`);
  }

  // Check back button navigation
  const backBtn = await page.$('header button');
  if (backBtn) {
    const text = await page.evaluate(el => el.textContent?.trim(), backBtn);
    if (text?.includes('←') || text?.includes('Back') || text === '') {
      console.log('  Back button: present, testing navigation...');
      await backBtn.click();
      await sleep(1000);

      // Should be back on dashboard
      const cards = await page.$$('.dashboard-card');
      console.log(`  After back: ${cards.length > 0 ? 'Dashboard (✅)' : 'Not dashboard (⚠️)'}`);
      await shot(page, 'back-to-dashboard');
    }
  }
}

async function testScrollAndOverflow(page: Page) {
  console.log('\n═══ SCROLL & OVERFLOW CHECKS ═══');
  await login(page);
  await navigateToEditor(page);

  // Check for horizontal scrollbar on body
  const bodyOverflow = await page.evaluate(() => {
    return {
      scrollWidth: document.body.scrollWidth,
      clientWidth: document.body.clientWidth,
      hasHScroll: document.body.scrollWidth > document.body.clientWidth,
      scrollHeight: document.body.scrollHeight,
      clientHeight: document.body.clientHeight,
      hasVScroll: document.body.scrollHeight > document.body.clientHeight,
    };
  });
  console.log(`  Body: ${bodyOverflow.scrollWidth}x${bodyOverflow.scrollHeight}, viewport: ${bodyOverflow.clientWidth}x${bodyOverflow.clientHeight}`);
  console.log(`  Horizontal overflow: ${bodyOverflow.hasHScroll ? '⚠️ YES' : '✅ NO'}`);
  console.log(`  Vertical overflow: ${bodyOverflow.hasVScroll ? '⚠️ YES' : '✅ NO'}`);

  // Check each panel for overflow
  for (const selector of ['.diagram-panel', '.chat-panel', '.palette-panel', '.cost-panel']) {
    const overflow = await page.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const cs = window.getComputedStyle(el);
      return {
        overflow: cs.overflow,
        overflowX: cs.overflowX,
        overflowY: cs.overflowY,
        scrollWidth: el.scrollWidth,
        clientWidth: el.clientWidth,
        hasHScroll: el.scrollWidth > el.clientWidth + 2,
      };
    }, selector);
    if (overflow) {
      console.log(`  ${selector}: overflow=${overflow.overflow} overflowX=${overflow.overflowX} hScroll=${overflow.hasHScroll ? '⚠️' : '✅'}`);
    }
  }
}

async function testCanvasInteractions(page: Page) {
  console.log('\n═══ CANVAS INTERACTIONS ═══');
  await login(page);
  await navigateToEditor(page);

  // Click on a React Flow node
  const nodes = await page.$$('.react-flow__node');
  console.log(`  React Flow nodes: ${nodes.length}`);

  if (nodes.length > 0) {
    // Click first node
    const nodeBox = await nodes[0].boundingBox();
    if (nodeBox) {
      console.log(`  Clicking node at ${Math.round(nodeBox.x + nodeBox.width/2)}, ${Math.round(nodeBox.y + nodeBox.height/2)}`);
      await nodes[0].click();
      await sleep(500);
      await shot(page, 'node-selected');

      // Check if node got selected class
      const selectedNodes = await page.$$('.react-flow__node.selected');
      console.log(`  Selected nodes after click: ${selectedNodes.length}`);
    }

    // Click on each node to check labels/styling
    for (let i = 0; i < Math.min(nodes.length, 5); i++) {
      const label = await page.evaluate(el => el.textContent?.trim(), nodes[i]);
      const box = await nodes[i].boundingBox();
      console.log(`  Node ${i}: "${label?.slice(0, 40)}" at ${box ? Math.round(box.x) + ',' + Math.round(box.y) : '?'} size=${box ? Math.round(box.width) + 'x' + Math.round(box.height) : '?'}`);
    }
  }

  // Check React Flow controls (zoom buttons etc)
  const controls = await page.$('.react-flow__controls');
  if (controls) {
    const controlButtons = await page.$$('.react-flow__controls button');
    console.log(`  React Flow control buttons: ${controlButtons.length}`);
  }

  // Check edges
  const edges = await page.$$('.react-flow__edge');
  console.log(`  React Flow edges: ${edges.length}`);
}

async function testCodeView(page: Page) {
  console.log('\n═══ CODE VIEW DEEP CHECK ═══');
  await login(page);
  await navigateToEditor(page);

  // Switch to Code view
  const buttons = await page.$$('button');
  for (const btn of buttons) {
    const text = await page.evaluate(el => el.textContent?.trim(), btn);
    if (text === 'Code') { await btn.click(); break; }
  }
  await sleep(600);
  await shot(page, 'code-view-detail');

  // Check for code content
  const codeContent = await page.evaluate(() => {
    const body = document.body.textContent || '';
    return {
      hasYaml: body.includes('services:') || body.includes('docker-compose'),
      hasJson: body.includes('"name"') || body.includes('"version"'),
      hasMermaid: body.includes('graph') || body.includes('flowchart'),
      length: body.length,
    };
  });
  console.log(`  Code content: yaml=${codeContent.hasYaml}, json=${codeContent.hasJson}, mermaid=${codeContent.hasMermaid}`);

  // Check code panels/tabs
  const codeTabs = await page.$$('.code-tab, .code-file-tab, [role="tab"]');
  console.log(`  Code tabs: ${codeTabs.length}`);

  // Check for copy button
  const copyBtn = await page.$('button[title*="copy" i], button[title*="Copy" i]');
  console.log(`  Copy button: ${copyBtn ? 'YES' : 'not found'}`);

  // Test collapse in code view
  const collapseBtn = await page.$('[title="Collapse panels to sidebar"]');
  if (collapseBtn) {
    await collapseBtn.click();
    await sleep(600);
    await shot(page, 'code-view-collapsed');

    // Editor panel should fill available space (file-tree hidden)
    const editorPanel = await getBoxInfo(page, '.editor-panel');
    const fileTree = await page.$('.file-tree-panel');
    const fileTreeVisible = fileTree ? await page.evaluate(el => window.getComputedStyle(el).display !== 'none', fileTree) : false;
    console.log(`  Code collapsed - editor panel: ${editorPanel?.width}x${editorPanel?.height}`);
    console.log(`  Code collapsed - file tree hidden: ${!fileTreeVisible ? '✅ YES' : '⚠️ NO'}`);
    if (editorPanel && editorPanel.width > 1000) {
      console.log(`  Code collapsed - editor fills space: ✅ GOOD (${editorPanel.width}px)`);
    } else {
      console.log(`  Code collapsed - editor fills space: ⚠️ SMALL (${editorPanel?.width}px)`);
    }

    const expandBtn = await page.$('[title="Expand all panels"]');
    if (expandBtn) {
      await expandBtn.click();
      await sleep(500);
    }
  }
}

async function testDocsView(page: Page) {
  console.log('\n═══ DOCS VIEW DEEP CHECK ═══');
  await login(page);
  await navigateToEditor(page);

  // Switch to Docs view
  const buttons = await page.$$('button');
  for (const btn of buttons) {
    const text = await page.evaluate(el => el.textContent?.trim(), btn);
    if (text === 'Docs') { await btn.click(); break; }
  }
  await sleep(600);
  await shot(page, 'docs-view-detail');

  // Check docs content
  const docsContent = await page.evaluate(() => {
    const body = document.body.textContent || '';
    return {
      hasHeadings: !!document.querySelector('h1, h2, h3, .docs-heading'),
      hasMarkdown: body.includes('#') || body.includes('Architecture'),
      contentLength: body.length,
    };
  });
  console.log(`  Docs content: headings=${docsContent.hasHeadings}, markdown=${docsContent.hasMarkdown}`);

  // Test collapse in docs view
  const collapseBtn = await page.$('[title="Collapse panels to sidebar"]');
  if (collapseBtn) {
    await collapseBtn.click();
    await sleep(600);
    await shot(page, 'docs-view-collapsed');

    // Docs panel should fill available space
    const docsPanel = await getBoxInfo(page, '.docs-panel');
    console.log(`  Docs collapsed - docs panel: ${docsPanel?.width}x${docsPanel?.height}`);
    if (docsPanel && docsPanel.width > 1000) {
      console.log(`  Docs collapsed - fills space: ✅ GOOD (${docsPanel.width}px)`);
    } else {
      console.log(`  Docs collapsed - fills space: ⚠️ SMALL (${docsPanel?.width}px)`);
    }

    const expandBtn = await page.$('[title="Expand all panels"]');
    if (expandBtn) {
      await expandBtn.click();
      await sleep(500);
    }
  }
}

// ─── MAIN ────────────────────────────────────────────────────

async function main() {
  console.log('🧱 Brick Studio — Comprehensive UI Check\n');
  console.log(`URL: ${UI_URL}`);
  console.log(`Screenshots: ${SHOT_DIR}/\n`);

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    defaultViewport: { width: 1440, height: 900 },
  });

  const page = await browser.newPage();

  // Capture console messages for debugging
  page.on('console', msg => {
    if (msg.type() === 'error') {
      const text = msg.text();
      if (!text.includes('favicon') && !text.includes('net::ERR')) {
        console.log(`  [CONSOLE ERROR] ${text.slice(0, 200)}`);
      }
    }
  });

  const issues: string[] = [];

  try {
    await testDashboard(page);
    await testEditorCanvasView(page);
    await testPanelCollapse(page);
    await testPanelHeaderCollapse(page);
    await testViewTransitions(page);
    await testEditorButtons(page);
    await testScrollAndOverflow(page);
    await testCanvasInteractions(page);
    await testCodeView(page);
    await testDocsView(page);
  } catch (err) {
    console.error('\n❌ Error during testing:', err);
    await shot(page, 'error-state');
  } finally {
    await browser.close();
  }

  console.log('\n═══ SUMMARY ═══');
  console.log(`Screenshots saved to ${SHOT_DIR}/`);
  console.log('Review screenshots visually for layout/polish issues.');
}

main().catch(console.error);
