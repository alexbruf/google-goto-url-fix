(() => {
  const api = globalThis.browser ?? globalThis.chrome;
  const originals = new Map();
  const cache = new Map();
  const queued = new Set();
  const queue = [];
  let enabled = false;
  let active = 0;
  let observer;
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

  function isGotoLink(anchor) {
    try {
      const url = new URL(anchor.href);
      return googleHostnames.includes(url.hostname.replace(/^www\./, "")) &&
        (url.pathname === "/goto" || url.pathname.startsWith("/goto/"));
    } catch {
      return false;
    }
  }

  function enqueue(anchor) {
    if (!enabled || !anchor.isConnected || !isGotoLink(anchor)) return;
    const original = anchor.href;
    if (!originals.has(anchor)) originals.set(anchor, original);

    const cached = cache.get(original);
    if (cached) {
      anchor.href = cached;
      return;
    }
    if (queued.has(original)) return;
    queued.add(original);
    queue.push({ anchor, original });
    drain();
  }

  function scan(root = document) {
    if (root instanceof HTMLAnchorElement) enqueue(root);
    root.querySelectorAll?.("a[href]").forEach(enqueue);
  }

  function drain() {
    while (enabled && active < 3 && queue.length) {
      const item = queue.shift();
      active += 1;
      api.runtime.sendMessage({ type: "resolve-goto", url: item.original })
        .then((result) => {
          if (!result?.ok || !result.url) return;
          cache.set(item.original, result.url);
          for (const [anchor, original] of originals) {
            if (enabled && original === item.original && anchor.isConnected) {
              anchor.href = result.url;
            }
          }
        })
        .catch(() => {})
        .finally(() => {
          queued.delete(item.original);
          active -= 1;
          drain();
        });
    }
  }

  function start() {
    if (enabled) return;
    enabled = true;
    scan();
    observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) scan(node);
        });
        if (mutation.type === "attributes") enqueue(mutation.target);
      }
    });
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["href"]
    });
    drain();
  }

  function stop() {
    enabled = false;
    observer?.disconnect();
    observer = undefined;
    queue.length = 0;
    queued.clear();
    for (const [anchor, original] of originals) {
      if (anchor.isConnected) anchor.href = original;
    }
    originals.clear();
  }

  api.runtime.onMessage.addListener((message) => {
    if (message?.type === "set-enabled") message.enabled ? start() : stop();
  });

  api.storage.local.get("enabled").then(({ enabled: initial }) => {
    if (initial === true) start();
  });
})();
