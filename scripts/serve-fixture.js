const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const files = {
  "/": ["test/fixture.html", "text/html; charset=utf-8"],
  "/test/fixture.html": ["test/fixture.html", "text/html; charset=utf-8"],
  "/test/harness.js": ["test/harness.js", "text/javascript; charset=utf-8"],
  "/content.js": ["content.js", "text/javascript; charset=utf-8"]
};
const port = Number(process.env.PORT || 4173);
http.createServer((req, res) => {
  // Redirect so the fixture's relative script paths work at the root URL.
  if (req.url === "/") {
    res.writeHead(302, { Location: "/test/fixture.html" }).end();
    return;
  }
  const entry = files[req.url];
  if (!entry) { res.writeHead(404).end("Not found"); return; }
  res.writeHead(200, { "Content-Type": entry[1], "Cache-Control": "no-store" });
  fs.createReadStream(path.join(root, entry[0])).pipe(res);
}).listen(port, "127.0.0.1", () => {
  console.log(`Fixture available at http://127.0.0.1:${port}/`);
});
