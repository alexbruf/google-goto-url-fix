const http = require('node:http');
const https = require('node:https');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn, execFileSync } = require('node:child_process');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const root = path.resolve(__dirname, '..');
const chrome = process.env.CHROMIUM_PATH || path.join(os.homedir(), '.cache/ms-playwright/chromium-1243/chrome-linux64/chrome');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'goto-e2e-'));
let browser;
let server;
let pageServer;
const connections = [];
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(fn, label) {
  for (let i = 0; i < 100; i++) {
    try { const value = await fn(); if (value) return value; } catch {}
    await delay(100);
  }
  throw new Error(`Timed out: ${label}`);
}
async function cdp(url) {
  const ws = new WebSocket(url);
  connections.push(ws);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  let id = 0;
  const pending = new Map();
  const contexts = new Map();
  ws.onmessage = ({ data }) => {
    const msg = JSON.parse(data);
    if (msg.method === 'Runtime.executionContextCreated') contexts.set(msg.params.context.name, msg.params.context.id);
    if (msg.method === 'Runtime.executionContextsCleared') contexts.clear();
    if (process.env.E2E_TRACE && msg.method && /^(Page|Network|Runtime)\./.test(msg.method)) console.log('CDP', msg.method, JSON.stringify(msg.params).slice(0, 800));
    if (!msg.id || !pending.has(msg.id)) return;
    const { resolve, reject } = pending.get(msg.id); pending.delete(msg.id);
    msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
  };
  return { contexts, send(method, params = {}) { return new Promise((resolve, reject) => { const n = ++id; pending.set(n, { resolve, reject }); ws.send(JSON.stringify({ id: n, method, params })); }); }, close() { ws.close(); } };
}

async function main() {
  execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', path.join(tmp, 'key.pem'), '-out', path.join(tmp, 'cert.pem'), '-subj', '/CN=www.google.com', '-days', '1'], { stdio: 'ignore' });
  const requests = [];
  const networkEvents = [];
  server = https.createServer({ key: fs.readFileSync(path.join(tmp, 'key.pem')), cert: fs.readFileSync(path.join(tmp, 'cert.pem')) }, (req, res) => {
    const u = new URL(req.url, 'https://www.google.com');
    requests.push(u.pathname + u.search);
    if (u.pathname === '/search') {
      res.writeHead(200, { 'content-type': 'text/html' });
      res.end('<a id="direct" href="/goto?url=direct">direct</a><a id="fallback" href="/goto?url=fallback" ping="/url?sa=t&amp;url=fallback">fallback</a><a id="blocked" href="/goto?url=blocked" ping="/url?url=blocked">blocked</a>');
    } else if (u.pathname === '/goto' && u.searchParams.get('url') === 'direct') {
      res.writeHead(302, { location: 'https://example.com/direct' }).end();
    } else if (u.pathname === '/goto' && u.searchParams.get('url') === 'fallback') {
      res.writeHead(302, { location: 'https://example.com/fallback?a=1&b=2' }).end();
    } else if (u.pathname === '/goto' && u.searchParams.get('url') === 'blocked') {
      res.writeHead(302, { location: '/sorry/index' }).end();
    } else if (u.pathname === '/goto') {
      res.writeHead(200, { 'content-type': 'text/html' }).end('Verifying your request');
    } else if (u.pathname === '/url') {
      if (u.searchParams.get('url') === 'blocked') res.writeHead(302, { location: '/sorry/index' }).end();
      else if (u.searchParams.get('url') === 'ping') res.writeHead(200, { 'content-type': 'text/html' }).end('<meta http-equiv="refresh" content="0;url=https://example.com/ping?a=1&amp;b=2">');
      else res.writeHead(200, { 'content-type': 'text/html' }).end('No destination');
    } else res.writeHead(404).end();
  });
  server.on('connection', () => networkEvents.push('tcp connection'));
  server.on('secureConnection', socket => { networkEvents.push('tls connected'); socket.on('data', data => networkEvents.push(`data: ${data.subarray(0, 120).toString()}`)); });
  server.on('tlsClientError', error => networkEvents.push(`tls error: ${error.message}`));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  pageServer = http.createServer((_req, res) => {
    networkEvents.push(`page request ${_req.url}`);
    const base = `https://www.google.com:${port}`;
    res.writeHead(200, { 'content-type': 'text/html' }).end(`<a id="direct" href="${base}/goto?url=direct">direct</a><a id="ping" href="${base}/goto?url=ping" ping="${base}/url?url=ping">ping</a><a id="fallback" href="${base}/goto?url=fallback" ping="${base}/url?sa=t&amp;url=fallback">fallback</a><a id="blocked" href="${base}/goto?url=blocked" ping="${base}/url?url=blocked">blocked</a>`);
  });
  await new Promise(resolve => pageServer.listen(0, '127.0.0.1', resolve));
  const extension = path.join(tmp, 'extension');
  fs.mkdirSync(extension);
  for (const file of ['background.js', 'content.js', 'options.html', 'options.js', 'welcome.html', 'welcome-firefox.html', 'welcome-safari.html']) fs.copyFileSync(path.join(root, file), path.join(extension, file));
  fs.cpSync(path.join(root, 'icons'), path.join(extension, 'icons'), { recursive: true });
  fs.mkdirSync(path.join(extension, 'assets'));
  for (const file of ['chrome-extension-list.png', 'chrome-incognito-setting.png']) fs.copyFileSync(path.join(root, 'assets', file), path.join(extension, 'assets', file));
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json')));
  manifest.content_scripts[0].matches.push('http://127.0.0.1/search*');
  if (process.env.E2E_NARROW) {
    manifest.host_permissions = ['https://google.com/*', 'https://www.google.com/*'];
    manifest.content_scripts[0].matches = ['https://google.com/search*', 'https://www.google.com/search*'];
    const background = path.join(extension, 'background.js');
    fs.writeFileSync(background, fs.readFileSync(background, 'utf8').replace(/urls: \[\.\.\.googleHostnames\]\.flatMap\([^\n]+/, 'urls: ["https://www.google.com/goto*", "https://www.google.com/url*"]'));
  }
  if (process.env.E2E_NO_CONTENT) manifest.content_scripts = [];
  fs.writeFileSync(path.join(extension, 'manifest.json'), JSON.stringify(manifest));
  const extArgs = process.env.E2E_NO_EXTENSION ? [] : [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`];
  browser = spawn(chrome, ['--headless=new', '--no-first-run', '--no-default-browser-check', '--disable-gpu', '--disable-background-networking', '--enable-features=NetworkService,NetworkServiceInProcess', '--disable-features=LocalNetworkAccessChecks,LocalNetworkAccessPermissionPrompt,PrivateNetworkAccessSendPreflights', '--no-proxy-server', '--ignore-certificate-errors', '--host-resolver-rules=MAP www.google.com 127.0.0.1', `--user-data-dir=${tmp}/profile`, '--remote-debugging-port=0', ...extArgs, 'about:blank'], { stdio: 'ignore' });
  const debug = await until(() => fs.existsSync(path.join(tmp, 'profile/DevToolsActivePort')) && fs.readFileSync(path.join(tmp, 'profile/DevToolsActivePort'), 'utf8').split('\n')[0], 'Chromium debugging port');
  const list = async () => (await fetch(`http://127.0.0.1:${debug}/json/list`)).json();
  let worker;
  let sw;
  if (!process.env.E2E_NO_EXTENSION) {
    const extensionId = crypto.createHash('sha256').update(extension).digest('hex').slice(0, 32).replace(/[0-9a-f]/g, digit => String.fromCharCode(97 + parseInt(digit, 16)));
    worker = await until(async () => (await list()).find(t => t.type === 'service_worker' && t.url === `chrome-extension://${extensionId}/background.js`), 'extension service worker');
    console.log('Worker:', worker.url);
    sw = await cdp(worker.webSocketDebuggerUrl);
    await until(async () => {
      const state = await sw.send('Runtime.evaluate', { expression: 'chrome.storage.local.get("enabled")', awaitPromise: true, returnByValue: true });
      return typeof state.result.value?.enabled === 'boolean';
    }, 'extension installation');
    const enabledResult = await sw.send('Runtime.evaluate', { expression: 'chrome.storage.local.set({enabled:true,prefetchNearby:false})', awaitPromise: true });
    if (enabledResult.exceptionDetails) throw new Error(`Could not enable extension: ${JSON.stringify(enabledResult.exceptionDetails)}`);
  }
  const browserInfo = await (await fetch(`http://127.0.0.1:${debug}/json/version`)).json();
  const browserCdp = await cdp(browserInfo.webSocketDebuggerUrl);
  const pageInfo = await until(async () => (await list()).find(t => t.type === 'page'), 'test page');
  const page = await cdp(pageInfo.webSocketDebuggerUrl);
  await page.send('Page.enable');
  await page.send('Runtime.enable');
  await page.send('Security.setIgnoreCertificateErrors', { ignore: true });
  await page.send('Network.enable');
  let navigationTimer;
  const navigation = await Promise.race([
    page.send('Page.navigate', { url: process.env.E2E_HTTP ? 'http://127.0.0.1:4173/test/fixture.html' : `http://127.0.0.1:${pageServer.address().port}/search?q=fixture` }),
    new Promise((_, reject) => { navigationTimer = setTimeout(() => reject(new Error(`Navigation timed out; server requests: ${JSON.stringify(requests)}; network: ${JSON.stringify(networkEvents)}`)), 30000); })
  ]).finally(() => clearTimeout(navigationTimer));
  if (navigation.errorText) throw new Error(`Navigation failed: ${navigation.errorText}`);
  if (process.env.E2E_NO_EXTENSION) { console.log('Navigation without extension passed'); return; }
  const evalPage = async expression => (await page.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result.value;
  try {
    await until(() => evalPage('document.querySelector("#direct") && document.readyState === "complete"'), 'fixture page');
  } catch (error) {
    console.error('Page:', await evalPage('({url:location.href, text:document.body?.innerText?.slice(0,500)})'), 'Requests:', requests);
    throw error;
  }
  await delay(500);
  await page.send('Page.bringToFront');
  async function focus(id) { await evalPage(`document.querySelector("#${id}").focus()`); }
  await focus('direct');
  try {
    await until(async () => (await evalPage('document.querySelector("#direct").href')) === 'https://example.com/direct', 'direct redirect');
  } catch (error) {
    console.error('Requests:', requests, 'storage:', JSON.stringify(await sw.send('Runtime.evaluate', { expression: 'chrome.storage.local.get(null)', awaitPromise: true, returnByValue: true })));
    console.error('Content:', JSON.stringify(await page.send('Runtime.evaluate', { contextId: page.contexts.get('Google Goto Url Fix'), expression: '({href:document.querySelector("#direct").href, chrome:typeof chrome.storage, listeners:typeof getEventListeners === "function" ? Object.keys(getEventListeners(document)) : []})', includeCommandLineAPI: true, returnByValue: true })));
    throw error;
  }
  await focus('ping');
  await until(async () => (await evalPage('document.querySelector("#ping").href')) === 'https://example.com/ping?a=1&b=2', 'HTML ping destination');
  assert.ok(!requests.some(x => x.startsWith('/goto?url=ping')), 'successful ping must avoid /goto');
  await focus('fallback');
  await until(async () => (await evalPage('document.querySelector("#fallback").href')) === 'https://example.com/fallback?a=1&b=2', 'HTML fallback');
  await focus('blocked');
  await until(async () => (await sw.send('Runtime.evaluate', { expression: 'chrome.storage.local.get("pausedUntil")', awaitPromise: true, returnByValue: true })).result.value.pausedUntil > Date.now(), 'challenge pause');
  assert.equal(await evalPage('document.querySelector("#blocked").pathname'), '/goto');
  assert.ok(!requests.some(x => x.startsWith('/goto?url=blocked')), 'challenge must stop fallback');
  assert.ok(requests.findIndex(x => x.startsWith('/url?sa=t&url=fallback')) < requests.findIndex(x => x.startsWith('/goto?url=fallback')), 'ping should run before /goto');
  console.log('Extension E2E passed: direct redirect, HTML ping destination, ping-first fallback, challenge pause');
  page.close(); sw.close(); browserCdp.close();
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  for (const connection of connections) connection.close();
  if (browser) { browser.kill('SIGTERM'); await Promise.race([new Promise(resolve => browser.once('exit', resolve)), delay(2000)]); }
  if (server) server.close();
  if (pageServer) pageServer.close();
  fs.rmSync(tmp, { recursive: true, force: true });
});
