(() => {
  const runtimeListeners = [];
  const requested = [];
  const messages = [];
  let releaseHeldPrefetch;
  const destinations = new Map([
    ["https://www.google.com/goto?url=fixture-main", "https://example.com/resolved-main"],
    ["https://www.google.com/goto?url=fixture-second", "https://example.com/resolved-second"],
    ["https://www.google.com/goto?url=fixture-third", "https://example.com/resolved-third"],
    ["https://www.google.com/goto?url=fixture-fourth", "https://example.com/resolved-fourth"],
    ["https://www.google.com/goto?url=fixture-citation", "https://example.com/resolved-citation"],
    ["https://www.google.com/goto?url=fixture-dynamic", "https://example.org/resolved-dynamic"]
  ]);

  globalThis.chrome = {
    storage: { local: { get: async () => ({ enabled: true, prefetchNearby: location.search.includes('prefetch=1') || location.search.includes('hold=1') }) } },
    runtime: {
      onMessage: { addListener(listener) { runtimeListeners.push(listener); } },
      async sendMessage(message) {
        if (message.type === 'promote-goto') {
          messages.push(message);
          return { ok: true };
        }
        requested.push(message.url);
        messages.push(message);
        if (message.prefetch && location.search.includes('hold=1') && !releaseHeldPrefetch) {
          await new Promise(resolve => { releaseHeldPrefetch = resolve; });
        }
        const url = destinations.get(message.url);
        const log = document.querySelector("#log");
        if (requested.length === 1) log.textContent = "";
        log.textContent += `${JSON.stringify({ ...message, simulatedResult: url ?? null }, null, 2)}\n\n`;
        return url ? { ok: true, url } : { ok: false, error: "Unknown fixture URL" };
      }
    }
  };

  globalThis.fixture = {
    releasePrefetch() { releaseHeldPrefetch?.(); },
    setEnabled(enabled) {
      runtimeListeners.forEach((listener) => listener({ type: "set-enabled", enabled }));
      document.querySelector("#status").textContent = enabled ? "Fixture ready — enabled" : "Fixture ready — disabled";
    },
    addDynamicResult() {
      const item = document.createElement("li");
      item.innerHTML = '<a id="dynamic-link" href="https://www.google.com/goto?url=fixture-dynamic"><h3>Dynamic Google result</h3></a>';
      document.querySelector("#results").append(item);
    },
    snapshot() {
      return {
        main: document.querySelector("#goto-link").href,
        third: document.querySelector("#goto-third").href,
        fourth: document.querySelector("#goto-fourth").href,
        citation: document.querySelector("#goto-citation").href,
        normal: document.querySelector("#normal-link").href,
        dynamic: document.querySelector("#dynamic-link")?.href ?? null,
        requests: requested.length,
        messages: [...messages]
      };
    }
  };

  window.addEventListener("load", async () => {
    await new Promise((resolve) => setTimeout(resolve, 50));
    document.querySelector("#status").textContent = "Fixture ready";
  });
})();
