// Capture the actual Chromium extension details screen for the welcome tutorial.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const binary = process.env.CHROMIUM_PATH || path.join(os.homedir(), '.cache/ms-playwright/chromium-1243/chrome-linux64/chrome');
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'goto-tutorial-'));
const id = crypto.createHash('sha256').update(root).digest('hex').slice(0, 32).replace(/[0-9a-f]/g, c => String.fromCharCode(97 + parseInt(c, 16)));
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
let browser, ws;
async function waitFor(fn) {
  for (let i = 0; i < 200; i++) {
    try { const value = await fn(); if (value) return value; } catch {}
    await delay(100);
  }
  throw new Error('Timed out waiting for Chromium');
}
async function run() {
  browser = spawn(binary, ['--headless=new', '--no-first-run', '--no-default-browser-check', '--disable-background-networking', `--user-data-dir=${profile}`, '--remote-debugging-port=0', `--disable-extensions-except=${root}`, `--load-extension=${root}`, 'about:blank'], { stdio: 'ignore' });
  const port = await waitFor(() => fs.existsSync(path.join(profile, 'DevToolsActivePort')) && fs.readFileSync(path.join(profile, 'DevToolsActivePort'), 'utf8').split('\n')[0]);
  const getTargets = async () => (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  await waitFor(async () => (await getTargets()).find(t => t.type === 'service_worker' && t.url.startsWith(`chrome-extension://${id}/`)));
  const target = await waitFor(async () => (await getTargets()).find(t => t.type === 'page' && t.url === 'about:blank'));
  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  let n = 0;
  const pending = new Map();
  ws.onmessage = ({ data }) => { const message = JSON.parse(data); if (message.id && pending.has(message.id)) { const p = pending.get(message.id); pending.delete(message.id); message.error ? p.reject(new Error(message.error.message)) : p.resolve(message.result); } };
  const send = (method, params = {}) => new Promise((resolve, reject) => { const i = ++n; pending.set(i, { resolve, reject }); ws.send(JSON.stringify({ id: i, method, params })); });
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
  await send('Page.enable');
  await send('Page.navigate', { url: `chrome://extensions/?id=${id}` });
  await waitFor(async () => (await send('Runtime.evaluate', { expression: 'document.readyState === "complete" && !!document.querySelector("extensions-manager")?.shadowRoot', returnByValue: true })).result.value);
  await delay(1500);
  const found = await send('Runtime.evaluate', { expression: `(() => {
    function search(root) {
      for (const el of root.querySelectorAll('*')) {
        if (el.textContent.trim().toLowerCase() === 'allow in incognito') return el;
        if (el.shadowRoot) { const result = search(el.shadowRoot); if (result) return result; }
      }
      return null;
    }
    const el = search(document);
    if (!el) {
      const hits = [];
      function collect(root) { for (const e of root.querySelectorAll('*')) { if (/incognito/i.test(e.textContent) && e.children.length < 3) hits.push(e.textContent.trim().slice(0,200)); if (e.shadowRoot) collect(e.shadowRoot); } }
      collect(document); return hits.slice(0,10);
    }
    el.scrollIntoView({block:'center'});
    return true;
  })()`, returnByValue: true });
  if (found.result.value !== true) throw new Error(`Could not find the Incognito permission control: ${JSON.stringify(found.result.value)}`);
  await delay(500);
  const detail = await send('Page.captureScreenshot', { format: 'png', clip: { x: 335, y: 479, width: 685, height: 135, scale: 1 } });
  fs.writeFileSync(path.join(root, 'assets', 'chrome-incognito-setting.png'), Buffer.from(detail.data, 'base64'));
  await send('Page.navigate', { url: 'chrome://extensions/' });
  await delay(1500);
  const listing = await send('Page.captureScreenshot', { format: 'png', clip: { x: 335, y: 105, width: 430, height: 215, scale: 1 } });
  fs.writeFileSync(path.join(root, 'assets', 'chrome-extension-list.png'), Buffer.from(listing.data, 'base64'));
  console.log('Captured Chrome extension list and Incognito setting');
}
run().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  ws?.close();
  if (browser) { browser.kill('SIGTERM'); await Promise.race([new Promise(resolve => browser.once('exit', resolve)), delay(2000)]); }
  fs.rmSync(profile, { recursive: true, force: true });
});
