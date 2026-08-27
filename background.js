const ENABLED_KEY = "enabled";
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

const pendingRedirects = new Map();

api.webRequest.onBeforeRedirect.addListener(
  ({ url, redirectUrl }) => {
    const pending = pendingRedirects.get(url);
    if (pending) pending(redirectUrl);
  },
  { urls: ["https://google.com/goto*", "https://www.google.com/goto*"] }
);

async function resolveGoto(url) {
  if (!isGoogleGoto(url)) throw new Error("Unsupported redirect URL");

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

    // Chrome deliberately hides a manual 3xx response from fetch as an
    // opaque redirect, so onBeforeRedirect supplies its destination. If Google
    // returns a non-3xx response (including the reported 402) with Location,
    // the header remains readable and is handled by the fallback below.
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
        finish(undefined, new Error(`Google did not return a redirect (${response.status})`));
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
