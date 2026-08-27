#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");

const version = process.argv[2];
if (!/^\d+\.\d+\.\d+$/.test(version ?? "")) {
  console.error("Usage: npm run version:set -- <major.minor.patch>");
  process.exit(1);
}

const root = path.join(__dirname, "..");
const files = ["package.json", "manifest.json", "manifests/firefox.json", "manifests/safari.json"];
for (const file of files) {
  const filename = path.join(root, file);
  const json = JSON.parse(fs.readFileSync(filename, "utf8"));
  json.version = version;
  fs.writeFileSync(filename, `${JSON.stringify(json, null, 2)}\n`);
}

console.log(`Set release version to ${version} in all manifests`);
