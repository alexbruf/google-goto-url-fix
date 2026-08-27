#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const root = path.join(__dirname, "..");
const dist = path.join(root, "dist");
const sharedFiles = ["background.js", "content.js"];

execFileSync(process.execPath, [path.join(__dirname, "generate-icons.js")]);
fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist, { recursive: true });

const variants = {
  chrome: path.join(root, "manifest.json"),
  edge: path.join(root, "manifest.json"),
  firefox: path.join(root, "manifests", "firefox.json"),
  safari: path.join(root, "manifests", "safari.json")
};

for (const [browser, manifest] of Object.entries(variants)) {
  const directory = path.join(dist, browser);
  fs.mkdirSync(path.join(directory, "icons"), { recursive: true });
  fs.copyFileSync(manifest, path.join(directory, "manifest.json"));
  for (const file of sharedFiles) fs.copyFileSync(path.join(root, file), path.join(directory, file));
  for (const icon of fs.readdirSync(path.join(root, "icons"))) {
    fs.copyFileSync(path.join(root, "icons", icon), path.join(directory, "icons", icon));
  }

  const archive = path.join(dist, `google-goto-url-fix-${browser}-1.0.0.zip`);
  execFileSync("jar", ["--create", "--no-manifest", "--file", archive, "-C", directory, "."]);
}

console.log("Built Chrome, Edge, Firefox, and Safari packages in dist/");
