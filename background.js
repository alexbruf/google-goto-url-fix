const ENABLED_KEY = "enabled";
const PAUSED_UNTIL_KEY = "pausedUntil";
const PAUSE_MS = 5 * 60 * 1000;
const api = globalThis.browser ?? globalThis.chrome;

async function isEnabled() {
  const stored = await api.storage.local.get(ENABLED_KEY);
  return stored[ENABLED_KEY] === true;
}

async function updateAction(enabled, tabId) {
  const target = Number.isInteger(tabId) ? { tabId } : {};
  await Promise.all([
    api.action.setBadgeText({ ...target, text: enabled ? "ON" : "" }),
    api.action.setBadgeBackgroundColor({ ...target, color: "#1a73e8" }),
    api.action.setTitle({
      ...target,
      title: `Google Goto Url Fix: ${enabled ? "on" : "off"}`
    })
  ]);
}

api.runtime.onInstalled.addListener(async () => {
  const stored = await api.storage.local.get(ENABLED_KEY);
  if (typeof stored[ENABLED_KEY] !== "boolean") {
    await api.storage.local.set({ [ENABLED_KEY]: false });
  }
  await updateAction(stored[ENABLED_KEY] === true);
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
      (url.hostname === "google.com" || url.hostname === "www.google.com") &&
      (url.pathname === "/goto" || url.pathname.startsWith("/goto/"));
  } catch {
    return false;
  }
}

function isVerificationPage(rawUrl) {
  const url = new URL(rawUrl);
  return /(^|\.)google\.[a-z.]+$/.test(url.hostname) && url.pathname.startsWith("/sorry");
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

const pendingRedirects = new Map();
const gotoRequestFilter = {
  urls: ["https://google.com/goto*", "https://www.google.com/goto*"]
};

function finishPendingRedirect(url, redirectUrl) {
  const pending = pendingRedirects.get(url);
  if (pending) pending(new URL(redirectUrl, url).href);
}

api.webRequest.onBeforeRedirect.addListener(
  ({ url, redirectUrl }) => {
    finishPendingRedirect(url, redirectUrl);
  },
  gotoRequestFilter
);

// Firefox does not emit onBeforeRedirect for a fetch using redirect: "manual".
// Read Location while the response headers are available instead. This also
// catches Google's occasional non-3xx response carrying a Location header.
api.webRequest.onHeadersReceived.addListener(
  ({ url, responseHeaders = [] }) => {
    const location = responseHeaders.find(
      ({ name }) => name.toLowerCase() === "location"
    )?.value;
    if (location) finishPendingRedirect(url, location);
  },
  gotoRequestFilter,
  ["responseHeaders"]
);

async function resolveGoto(url) {
  if (!isGoogleGoto(url)) throw new Error("Unsupported redirect URL");
  if (await lookupsPaused()) throw new Error("Paused after Google asked for verification");

  const destination = await requestRedirect(url);
  if (isVerificationPage(destination)) {
    await pauseLookups();
    throw new Error("Google asked for verification");
  }
  return destination;
}

function requestRedirect(url) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (value, error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      pendingRedirects.delete(url);
      error ? reject(error) : resolve(value);
    };
    const timeout = setTimeout(() => {
      finish(undefined, new Error("Timed out waiting for Google's redirect"));
    }, 10000);

    // Chrome deliberately hides a manual 3xx response from fetch as an opaque
    // redirect, so webRequest supplies its destination. Firefox exposes the
    // Location header through onHeadersReceived instead of onBeforeRedirect.
    // The fetch fallback handles readable non-3xx responses such as HTTP 402.
    pendingRedirects.set(url, (redirectUrl) => finish(redirectUrl));
    fetch(url, {
      method: "GET",
      credentials: "include",
      redirect: "manual",
      cache: "no-store"
    }).then((response) => {
      const location = response.headers.get("location");
      if (location) finish(new URL(location, url).href);
      else if (response.type !== "opaqueredirect") {
        // A readable response with no destination is a block or interstitial.
        const error = new Error(`Google did not return a redirect (${response.status})`);
        pauseLookups().finally(() => finish(undefined, error));
      }
    }).catch((error) => finish(undefined, error));
  });
}

api.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "resolve-goto") return undefined;

  resolveGoto(message.url)
    .then((url) => sendResponse({ ok: true, url }))
    .catch((error) => sendResponse({ ok: false, error: error.message }));
  return true;
});
