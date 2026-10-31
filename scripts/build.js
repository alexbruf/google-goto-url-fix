#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const root = path.join(__dirname, "..");
const dist = path.join(root, "dist");
const sharedFiles = ["background.js", "content.js", "options.html", "options.js", "welcome.html"];
const version = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8")).version;

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function listFiles(directory, prefix = "") {
  return fs.readdirSync(directory, { withFileTypes: true })
    .sort((a, b) => a.name.localeCompare(b.name))
    .flatMap((entry) => {
      const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
      const absolute = path.join(directory, entry.name);
      return entry.isDirectory() ? listFiles(absolute, relative) : [{ relative, absolute }];
    });
}

// Write a conservative ZIP with stored entries and no Java-specific metadata.
// Browser packages are tiny, so broad extractor compatibility matters more than
// shaving a few kilobytes with compression.
function createZip(directory, output) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  for (const file of listFiles(directory)) {
    const name = Buffer.from(file.relative);
    const data = fs.readFileSync(file.absolute);
    const crc = crc32(data);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(0x21, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    localParts.push(local, name, data);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt16LE(0, 12);
    central.writeUInt16LE(0x21, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    centralParts.push(central, name);

    offset += local.length + name.length + data.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  const count = centralParts.length / 2;
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(count, 8);
  end.writeUInt16LE(count, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);

  fs.writeFileSync(output, Buffer.concat([...localParts, centralDirectory, end]));
}

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

  const archive = path.join(dist, `google-goto-url-fix-${browser}-${version}.zip`);
  createZip(directory, archive);
}

console.log("Built Chrome, Edge, Firefox, and Safari packages in dist/");
