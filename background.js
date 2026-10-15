const googleHostnames = [
      "google.ad",
      "google.ae",
      "google.al",
      "google.am",
      "google.as",
      "google.at",
      "google.az",
      "google.ba",
      "google.be",
      "google.bf",
      "google.bg",
      "google.bi",
      "google.bj",
      "google.bs",
      "google.bt",
      "google.by",
      "google.ca",
      "google.cat",
      "google.cd",
      "google.cf",
      "google.cg",
      "google.ch",
      "google.ci",
      "google.cl",
      "google.cm",
      "google.cn",
      "google.co",
      "google.co.ao",
      "google.co.bw",
      "google.co.ck",
      "google.co.cr",
      "google.co.id",
      "google.co.il",
      "google.co.in",
      "google.co.jp",
      "google.co.ke",
      "google.co.kr",
      "google.co.ls",
      "google.co.ma",
      "google.co.mz",
      "google.co.nz",
      "google.co.th",
      "google.co.tz",
      "google.co.ug",
      "google.co.uk",
      "google.co.uz",
      "google.co.ve",
      "google.co.vi",
      "google.co.za",
      "google.co.zm",
      "google.co.zw",
      "google.com",
      "google.com.af",
      "google.com.ag",
      "google.com.ai",
      "google.com.ar",
      "google.com.au",
      "google.com.bd",
      "google.com.bh",
      "google.com.bn",
      "google.com.bo",
      "google.com.br",
      "google.com.bz",
      "google.com.co",
      "google.com.cu",
      "google.com.cy",
      "google.com.do",
      "google.com.ec",
      "google.com.eg",
      "google.com.et",
      "google.com.fj",
      "google.com.gh",
      "google.com.gi",
      "google.com.gt",
      "google.com.hk",
      "google.com.jm",
      "google.com.kh",
      "google.com.kw",
      "google.com.lb",
      "google.com.ly",
      "google.com.mm",
      "google.com.mt",
      "google.com.mx",
      "google.com.my",
      "google.com.na",
      "google.com.ng",
      "google.com.ni",
      "google.com.np",
      "google.com.om",
      "google.com.pa",
      "google.com.pe",
      "google.com.pg",
      "google.com.ph",
      "google.com.pk",
      "google.com.pr",
      "google.com.py",
      "google.com.qa",
      "google.com.sa",
      "google.com.sb",
      "google.com.sg",
      "google.com.sl",
      "google.com.sv",
      "google.com.tj",
      "google.com.tr",
      "google.com.tw",
      "google.com.ua",
      "google.com.uy",
      "google.com.vc",
      "google.com.vn",
      "google.cv",
      "google.cz",
      "google.de",
      "google.dj",
      "google.dk",
      "google.dm",
      "google.dz",
      "google.ee",
      "google.es",
      "google.fi",
      "google.fm",
      "google.fr",
      "google.ga",
      "google.ge",
      "google.gg",
      "google.gl",
      "google.gm",
      "google.gr",
      "google.gy",
      "google.hn",
      "google.hr",
      "google.ht",
      "google.hu",
      "google.ie",
      "google.im",
      "google.iq",
      "google.is",
      "google.it",
      "google.je",
      "google.jo",
      "google.kg",
      "google.ki",
      "google.kz",
      "google.la",
      "google.li",
      "google.lk",
      "google.lt",
      "google.lu",
      "google.lv",
      "google.md",
      "google.me",
      "google.mg",
      "google.mk",
      "google.ml",
      "google.mn",
      "google.ms",
      "google.mu",
      "google.mv",
      "google.mw",
      "google.ne",
      "google.nl",
      "google.no",
      "google.nr",
      "google.nu",
      "google.pl",
      "google.pn",
      "google.ps",
      "google.pt",
      "google.ro",
      "google.rs",
      "google.ru",
      "google.rw",
      "google.sc",
      "google.se",
      "google.sh",
      "google.si",
      "google.sk",
      "google.sm",
      "google.sn",
      "google.so",
      "google.sr",
      "google.st",
      "google.td",
      "google.tg",
      "google.tl",
      "google.tm",
      "google.tn",
      "google.to",
      "google.tt",
      "google.vg",
      "google.vu",
      "google.ws"
];

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
      googleHostnames.includes(url.hostname.replace(/^www\./, "")) &&
      (url.pathname === "/goto" || url.pathname.startsWith("/goto/"));
  } catch {
    return false;
  }
}

const pendingRedirects = new Map();
let gotoUrls = [];
for(let googleHostname of googleHostnames){
  gotoUrls.push("https://".googleHostname."/goto*");
  gotoUrls.push("https://www.".googleHostname."/goto*");
}
const gotoRequestFilter = {
  urls: gotoUrls
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
