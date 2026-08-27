#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const root = path.join(__dirname, "..");
const dist = path.join(root, "dist");
const source = path.join(dist, "firefox");
const version = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8")).version;

if (!fs.existsSync(path.join(source, "manifest.json"))) {
  const build = spawnSync(process.execPath, [path.join(root, "scripts", "build.js")], {
    cwd: root,
    stdio: "inherit"
  });
  if (build.error) throw build.error;
  if (build.status !== 0) process.exit(build.status || 1);
}

for (const name of ["WEB_EXT_API_KEY", "WEB_EXT_API_SECRET"]) {
  if (!process.env[name]) {
    console.error(`Missing ${name}. Create AMO API credentials, export both variables, and try again.`);
    process.exit(1);
  }
}

const webExt = process.env.WEB_EXT_BINARY || "web-ext";

const started = Date.now();
const result = spawnSync(webExt, [
  "sign",
  "--no-input",
  "--channel", "unlisted",
  "--source-dir", source,
  "--artifacts-dir", dist
], { cwd: root, env: process.env, stdio: "inherit" });

if (result.error && result.error.code === "ENOENT") {
  console.error("web-ext is not installed. Run npm install --global web-ext first.");
  process.exit(1);
}
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status || 1);

const signedFiles = fs.readdirSync(dist)
  .filter((name) => name.endsWith(".xpi"))
  .map((name) => ({ name, time: fs.statSync(path.join(dist, name)).mtimeMs }))
  .filter((file) => file.time >= started - 1000)
  .sort((a, b) => b.time - a.time);

if (signedFiles.length === 0) {
  console.error("Mozilla approved the submission, but no signed XPI was found in dist/.");
  process.exit(1);
}

const sourceXpi = path.join(dist, signedFiles[0].name);
const finalXpi = path.join(dist, `google-goto-url-fix-firefox-${version}.xpi`);
if (sourceXpi !== finalXpi) fs.renameSync(sourceXpi, finalXpi);

console.log(`Firefox signed XPI: ${finalXpi}`);
