(() => {
  const runtimeListeners = [];
  const requested = [];
  const destinations = new Map([
    ["https://www.google.com/goto?url=fixture-main", "https://example.com/resolved-main"],
    ["https://www.google.com/goto?url=fixture-second", "https://example.com/resolved-second"],
    ["https://www.google.com/goto?url=fixture-third", "https://example.com/resolved-third"],
    ["https://www.google.com/goto?url=fixture-fourth", "https://example.com/resolved-fourth"],
    ["https://www.google.com/goto?url=fixture-citation", "https://example.com/resolved-citation"]
  ]);

  globalThis.chrome = {
    storage: { local: { get: async () => ({ enabled: true }) } },
    runtime: {
      onMessage: { addListener(listener) { runtimeListeners.push(listener); } },
      async sendMessage(message) {
        requested.push(message.url);
        const url = destinations.get(message.url);
        return url ? { ok: true, url } : { ok: false, error: "Unknown fixture URL" };
      }
    }
  };

  globalThis.fixture = {
    setEnabled(enabled) {
      runtimeListeners.forEach((listener) => listener({ type: "set-enabled", enabled }));
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
        requests: requested.length
      };
    }
  };

  window.addEventListener("load", async () => {
    await new Promise((resolve) => setTimeout(resolve, 50));
    document.querySelector("#status").textContent = "Fixture ready";
  });
})();
