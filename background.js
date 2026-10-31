const googleHostnames = new Set(["google.ad","google.ae","google.al","google.am","google.as","google.at","google.az","google.ba","google.be","google.bf","google.bg","google.bi","google.bj","google.bs","google.bt","google.by","google.ca","google.cat","google.cd","google.cf","google.cg","google.ch","google.ci","google.cl","google.cm","google.cn","google.co","google.co.ao","google.co.bw","google.co.ck","google.co.cr","google.co.id","google.co.il","google.co.in","google.co.jp","google.co.ke","google.co.kr","google.co.ls","google.co.ma","google.co.mz","google.co.nz","google.co.th","google.co.tz","google.co.ug","google.co.uk","google.co.uz","google.co.ve","google.co.vi","google.co.za","google.co.zm","google.co.zw","google.com","google.com.af","google.com.ag","google.com.ai","google.com.ar","google.com.au","google.com.bd","google.com.bh","google.com.bn","google.com.bo","google.com.br","google.com.bz","google.com.co","google.com.cu","google.com.cy","google.com.do","google.com.ec","google.com.eg","google.com.et","google.com.fj","google.com.gh","google.com.gi","google.com.gt","google.com.hk","google.com.jm","google.com.kh","google.com.kw","google.com.lb","google.com.ly","google.com.mm","google.com.mt","google.com.mx","google.com.my","google.com.na","google.com.ng","google.com.ni","google.com.np","google.com.om","google.com.pa","google.com.pe","google.com.pg","google.com.ph","google.com.pk","google.com.pr","google.com.py","google.com.qa","google.com.sa","google.com.sb","google.com.sg","google.com.sl","google.com.sv","google.com.tj","google.com.tr","google.com.tw","google.com.ua","google.com.uy","google.com.vc","google.com.vn","google.cv","google.cz","google.de","google.dj","google.dk","google.dm","google.dz","google.ee","google.es","google.fi","google.fm","google.fr","google.ga","google.ge","google.gg","google.gl","google.gm","google.gr","google.gy","google.hn","google.hr","google.ht","google.hu","google.ie","google.im","google.iq","google.is","google.it","google.je","google.jo","google.kg","google.ki","google.kz","google.la","google.li","google.lk","google.lt","google.lu","google.lv","google.md","google.me","google.mg","google.mk","google.ml","google.mn","google.ms","google.mu","google.mv","google.mw","google.ne","google.nl","google.no","google.nr","google.nu","google.pl","google.pn","google.ps","google.pt","google.ro","google.rs","google.ru","google.rw","google.sc","google.se","google.sh","google.si","google.sk","google.sm","google.sn","google.so","google.sr","google.st","google.td","google.tg","google.tl","google.tm","google.tn","google.to","google.tt","google.vg","google.vu","google.ws"]);
const ENABLED_KEY = "enabled";
const PAUSED_UNTIL_KEY = "pausedUntil";
const PAUSE_MS = 5 * 60 * 1000;
const LOOKUP_ERROR_KEY = "lookupError";
const PAUSED_MESSAGE = "Paused after Google asked for verification";
const GOTO_TIMEOUT_MS = 10000;
const api = globalThis.browser ?? globalThis.chrome;
let lookupInProgress = false;

async function isEnabled() {
  const stored = await api.storage.local.get(ENABLED_KEY);
  return stored[ENABLED_KEY] === true;
}

async function updateAction(enabled, tabId) {
  const target = Number.isInteger(tabId) ? { tabId } : {};
  const stored = await api.storage.local.get(LOOKUP_ERROR_KEY);
  const lookupError = enabled ? stored[LOOKUP_ERROR_KEY] : undefined;
  let title = `Google Goto Url Fix: ${enabled ? "on" : "off"}`;
  if (lookupError) title = `Google Goto Url Fix: can't resolve links (${lookupError})`;
  else if (enabled && lookupInProgress) title = "Google Goto Url Fix: resolving a link";
  await Promise.all([
    api.action.setBadgeText({ ...target, text: lookupError ? "!" : enabled ? (lookupInProgress ? "…" : "ON") : "" }),
    api.action.setBadgeBackgroundColor({ ...target, color: lookupError ? "#d93025" : "#1a73e8" }),
    api.action.setTitle({ ...target, title })
  ]);
}

// The paused message is skipped so the tooltip keeps the reason for the pause.
async function reportLookup(error) {
  const stored = await api.storage.local.get(LOOKUP_ERROR_KEY);
  const previous = stored[LOOKUP_ERROR_KEY] ?? "";
  if (error === PAUSED_MESSAGE && previous) return;
  if (error === previous) return;
  await api.storage.local.set({ [LOOKUP_ERROR_KEY]: error });
  await updateAction(await isEnabled());
}

api.runtime.onInstalled.addListener(async (details) => {
  const stored = await api.storage.local.get(ENABLED_KEY);
  if (typeof stored[ENABLED_KEY] !== "boolean") {
    await api.storage.local.set({ [ENABLED_KEY]: false });
  }
  await updateAction(stored[ENABLED_KEY] === true);
  if (details.reason === "install") {
    let welcomePage = "welcome.html";
    // The Safari package declares both background forms; Chrome declares only
    // a service worker and Firefox declares only background scripts.
    const background = api.runtime.getManifest().background;
    const agent = globalThis.navigator?.userAgent ?? "";
    const safariAgent = /Safari\//.test(agent) && !/(?:Chrome|Chromium|CriOS|Edg|OPR|FxiOS)\//.test(agent);
    if ((background?.service_worker && Array.isArray(background.scripts)) || safariAgent) {
      welcomePage = "welcome-safari.html";
    } else if (typeof api.runtime.getBrowserInfo === "function") {
      try {
        const info = await api.runtime.getBrowserInfo();
        if (info.name?.toLowerCase() === "firefox") welcomePage = "welcome-firefox.html";
      } catch {
        // Use the general welcome page if browser identification is unavailable.
      }
    }
    try {
      await api.tabs.create({ url: api.runtime.getURL(welcomePage) });
    } catch {
      // The extension remains usable if the browser cannot open a welcome tab.
    }
  }
});

api.runtime.onStartup.addListener(async () => updateAction(await isEnabled()));

api.action.onClicked.addListener(async (tab) => {
  const enabled = !(await isEnabled());
  await api.storage.local.set({ [ENABLED_KEY]: enabled });
  await updateAction(enabled);

  if (tab.id) {
    try {
      await api.tabs.sendMessage(tab.id, { type: "set-enabled", enabled });
    } catch {
      // The active tab is not a supported Google results page.
    }
  }
});

function isGoogleGoto(rawUrl) {
  try {
    const url = new URL(rawUrl);
    return url.protocol === "https:" &&
      googleHostnames.has(url.hostname.replace(/^www\./, "")) &&
      (url.pathname === "/goto" || url.pathname.startsWith("/goto/"));
  } catch {
    return false;
  }
}

function isGooglePing(rawUrl) {
  try {
    const url = new URL(rawUrl);
    return url.protocol === "https:" &&
      googleHostnames.has(url.hostname.replace(/^www\./, "")) &&
      url.pathname === "/url";
  } catch {
    return false;
  }
}

function tokenFromGoto(rawUrl) {
  try {
    return new URL(rawUrl).searchParams.get("url");
  } catch {
    return null;
  }
}

function sameGoogleToken(gotoUrl, pingUrl) {
  const token = tokenFromGoto(gotoUrl);
  if (!token || !isGooglePing(pingUrl)) return false;
  try {
    return new URL(pingUrl).searchParams.get("url") === token;
  } catch {
    return false;
  }
}

function isVerificationPage(rawUrl) {
  const url = new URL(rawUrl);
  return googleHostnames.has(url.hostname.replace(/^www\./, "")) &&
    (url.pathname === "/sorry" || url.pathname.startsWith("/sorry/"));
}

function isGoogleNavigationPage(url) {
  const host = url.hostname;
  if (host.startsWith("consent.") && googleHostnames.has(host.slice("consent.".length))) return true;
  return googleHostnames.has(host.replace(/^www\./, "")) &&
    /^\/(?:goto|url|search|sorry|recaptcha)(?:\/|$)/.test(url.pathname);
}

// Stored rather than held in memory because the service worker can be stopped
// at any time, and a restart must not resume requests while Google is flagging us.
async function pauseLookups() {
  await api.storage.local.set({ [PAUSED_UNTIL_KEY]: Date.now() + PAUSE_MS });
}

async function lookupsPaused() {
  const stored = await api.storage.local.get(PAUSED_UNTIL_KEY);
  return Date.now() < (stored[PAUSED_UNTIL_KEY] ?? 0);
}

const observesRedirects = api.runtime.getManifest().permissions?.includes("webRequest") !== false;
const pendingRedirects = new Map();
const gotoRequestFilter = {
  urls: [...googleHostnames].flatMap((host) => ["https://" + host + "/goto*", "https://www." + host + "/goto*", "https://" + host + "/url*", "https://www." + host + "/url*"])
};

const extensionOrigin = api.runtime.getURL("").replace(/\/$/, "");

if (observesRedirects) {
api.webRequest.onBeforeRequest.addListener((details) => {
  const pending = pendingRedirects.get(details.url);
  const source = details.initiator ?? details.originUrl ?? "";
  if (pending && !pending.requestId && details.tabId === -1 &&
      (source === extensionOrigin || source.startsWith(`${extensionOrigin}/`))) {
    pending.requestId = details.requestId;
  }
}, gotoRequestFilter);

function finishPendingRedirect(url, redirectUrl, requestId, statusCode) {
  const pending = pendingRedirects.get(url);
  if (pending?.requestId && pending.requestId === requestId) {
    if (statusCode === 429) pending.reject(new Error("Google rate limited requests"));
    else if (redirectUrl) pending.resolve(new URL(redirectUrl, url).href);
  }
}

api.webRequest.onBeforeRedirect.addListener(
  ({ url, redirectUrl, requestId, statusCode }) => {
    finishPendingRedirect(url, redirectUrl, requestId, statusCode);
  },
  gotoRequestFilter
);

// Firefox does not emit onBeforeRedirect for a fetch using redirect: "manual".
// Read Location while the response headers are available instead. This also
// catches Google's occasional non-3xx response carrying a Location header.
api.webRequest.onHeadersReceived.addListener(
  ({ url, requestId, statusCode, responseHeaders = [] }) => {
    const location = responseHeaders.find(
      ({ name }) => name.toLowerCase() === "location"
    )?.value;
    if (location || statusCode === 429) finishPendingRedirect(url, location, requestId, statusCode);
  },
  gotoRequestFilter,
  ["responseHeaders"]
);
}

async function resolveGoto(url, pingUrl) {
  if (!isGoogleGoto(url)) throw new Error("Unsupported redirect URL");
  if (await lookupsPaused()) throw new Error(PAUSED_MESSAGE);

  let lastError;
  if (sameGoogleToken(url, pingUrl)) {
    try {
      return await requestPing(pingUrl);
    } catch (error) {
      if (error.message === "Google rate limited requests" || error.message === "Google asked for verification") {
        await pauseLookups();
        throw error;
      }
      lastError = error;
    }
  }

  try {
    const destination = await requestRedirect(url);
    if (isVerificationPage(destination)) {
      await pauseLookups();
      throw new Error("Google asked for verification");
    }
    const validated = validateDestination(destination, url);
    if (validated) return validated;
    lastError = new Error("Google returned an invalid destination");
  } catch (error) {
    if (error.message === "Google asked for verification" || error.message === "Google rate limited requests") {
      await pauseLookups();
      throw error;
    }
    lastError = error;
  }

  throw new Error(`Google link resolution failed: ${lastError.message}`);
}

function requestRedirect(url) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const controller = new AbortController();
    const finish = (value, error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      pendingRedirects.delete(url);
      error ? reject(error) : resolve(value);
    };
    const timeout = setTimeout(() => {
      controller.abort();
      finish(undefined, new Error("Timed out waiting for Google's redirect"));
    }, GOTO_TIMEOUT_MS);

    // Chrome deliberately hides a manual 3xx response from fetch as an opaque
    // redirect, so webRequest supplies its destination. Firefox exposes the
    // Location header through onHeadersReceived instead of onBeforeRedirect.
    // The fetch fallback handles readable non-3xx responses such as HTTP 402.
    pendingRedirects.set(url, { requestId: null, resolve: (redirectUrl) => finish(redirectUrl), reject: error => finish(undefined, error) });
    fetch(url, {
      method: "GET",
      signal: controller.signal,
      credentials: "include",
      redirect: "manual",
      cache: "no-store"
    }).then(async (response) => {
      const location = response.headers.get("location");
      if (response.status === 429) finish(undefined, new Error("Google rate limited requests"));
      else if (location) finish(new URL(location, url).href);
      else if (response.type === "opaqueredirect" && !observesRedirects) {
        finish(undefined, new Error("Safari could not read Google’s redirect"));
      } else if (response.type !== "opaqueredirect") {
        if (response.text) {
          const body = await response.text();
          if (/unusual traffic|g-recaptcha|recaptcha|\/sorry\/index/i.test(body)) {
            finish(undefined, new Error("Google asked for verification"));
            return;
          }
        }
        // A readable response with no destination is a block or interstitial.
        finish(undefined, new Error(`Google did not return a redirect (${response.status})`));
      }
    }).catch((error) => finish(undefined, error));
  });
}

function destinationFromHtml(body) {
  const meta = body.match(/<meta\b[^>]*\bcontent\s*=\s*["']\s*0\s*;\s*url\s*=\s*([^"']+)["']/i);
  const redirect = body.match(/\bredirectUrl\s*[:=]\s*["']([^"']+)["']/i);
  const raw = meta?.[1] ?? redirect?.[1];
  if (!raw) return null;
  return decodeHtmlUrl(raw);
}

function decodeHtmlUrl(value) {
  const textarea = globalThis.document?.createElement?.("textarea");
  let decoded = value
    .replace(/\\x([0-9a-fA-F]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
  if (textarea) {
    textarea.innerHTML = decoded;
    decoded = textarea.value;
  } else {
    decoded = decoded
      .replace(/&#(x[0-9a-f]+|[0-9]+);/gi, (entity, number) => {
        const value = number[0].toLowerCase() === "x" ? parseInt(number.slice(1), 16) : parseInt(number, 10);
        return value > 0 && value <= 0x10ffff && !(value >= 0xd800 && value <= 0xdfff)
          ? String.fromCodePoint(value) : entity;
      })
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">");
  }
  return decoded;
}

function validateDestination(rawUrl, baseUrl) {
  if (!rawUrl) return null;
  try {
    const url = new URL(rawUrl, baseUrl);
    if (!["http:", "https:"].includes(url.protocol) || !url.hostname) return null;
    if (isGoogleNavigationPage(url)) return null;
    if (url.username || url.password) return null;
    return url.href;
  } catch {
    return null;
  }
}

async function requestPing(url) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const controller = new AbortController();
    const finish = (value, error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      pendingRedirects.delete(url);
      error ? reject(error) : resolve(value);
    };
    const timeout = setTimeout(() => {
      controller.abort();
      finish(undefined, new Error("Timed out waiting for Google's ping"));
    }, GOTO_TIMEOUT_MS);

    pendingRedirects.set(url, { requestId: null, reject: error => finish(undefined, error), resolve: (redirectUrl) => {
      if (isVerificationPage(redirectUrl)) {
        finish(undefined, new Error("Google asked for verification"));
        return;
      }
      const destination = validateDestination(redirectUrl, url);
      if (destination) finish(destination);
      else finish(undefined, new Error("Google ping returned an invalid destination"));
    } });

    fetch(url, {
      method: "GET",
      signal: controller.signal,
      credentials: "include",
      redirect: "manual",
      cache: "no-store"
    }).then(async (response) => {
      if (response.status === 429) {
        finish(undefined, new Error("Google rate limited requests"));
        return;
      }
      const location = response.headers.get("location");
      if (location && isVerificationPage(new URL(location, url).href)) {
        finish(undefined, new Error("Google asked for verification"));
        return;
      }
      let destination = validateDestination(location, url);
      if (!destination && response.type !== "opaqueredirect" && response.text) {
        const body = await response.text();
        if (/unusual traffic|g-recaptcha|recaptcha|\/sorry\/index/i.test(body)) {
          finish(undefined, new Error("Google asked for verification"));
          return;
        }
        if (response.status === 200) destination = validateDestination(destinationFromHtml(body), url);
      }
      if (destination) finish(destination);
      else if (response.type === "opaqueredirect" && !observesRedirects) {
        finish(undefined, new Error("Safari could not read Google’s ping redirect"));
      } else if (response.type !== "opaqueredirect") {
        finish(undefined, new Error(`Google ping did not return a destination (${response.status})`));
      }
    }).catch((error) => finish(undefined, error));
  });
}

// Serialize across tabs, while letting user interactions jump ahead of queued prefetches.
const lookupQueue = [];
let drainingLookups = false;
async function drainLookups() {
  if (drainingLookups) return;
  drainingLookups = true;
  try {
    while (lookupQueue.length) {
      const interactive = lookupQueue.findIndex(item => !item.message.prefetch);
      const { message, sendResponse } = lookupQueue.splice(interactive < 0 ? 0 : interactive, 1)[0];
      try {
        const settings = await api.storage.local.get([ENABLED_KEY, "prefetchNearby"]);
        if (settings[ENABLED_KEY] !== true || (message.prefetch && settings.prefetchNearby === false)) {
          sendResponse({ ok: false, error: "Lookup cancelled" });
          continue;
        }
        lookupInProgress = true;
        await updateAction(true);
        const url = await resolveGoto(message.url, message.pingUrl);
        lookupInProgress = false;
        await reportLookup("");
        await updateAction(await isEnabled());
        sendResponse({ ok: true, url });
      } catch (error) {
        lookupInProgress = false;
        await reportLookup(error.message);
        await updateAction(await isEnabled());
        sendResponse({ ok: false, error: error.message });
      }
    }
  } finally {
    drainingLookups = false;
  }
}

api.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "promote-goto") {
    const queued = lookupQueue.find(item => item.message.prefetch && item.message.url === message.url &&
      item.sender.tab?.id === sender.tab?.id && item.sender.frameId === sender.frameId);
    if (queued) queued.message.prefetch = false;
    return undefined;
  }
  if (message?.type !== "resolve-goto") return undefined;
  lookupQueue.push({ message, sender, sendResponse });
  void drainLookups();
  return true;
});
