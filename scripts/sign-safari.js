#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync, spawnSync } = require("node:child_process");

if (process.platform !== "darwin") {
  console.error("Safari signing requires macOS and Xcode.");
  process.exit(1);
}

const root = path.join(__dirname, "..");
const dist = path.join(root, "dist");
const version = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8")).version;
const appName = "Google Goto Url Fix";
const bundleId = process.env.SAFARI_BUNDLE_IDENTIFIER || "com.alexbruf.google-goto-url-fix";
const deploymentTarget = process.env.SAFARI_DEPLOYMENT_TARGET || "13.0";
const notaryProfile = process.env.NOTARYTOOL_PROFILE;
const skipNotarization = process.env.SKIP_NOTARIZATION === "1";

function run(file, args, options = {}) {
  return execFileSync(file, args, { cwd: root, stdio: "inherit", ...options });
}

function writeExportOptions(file, destination, teamId) {
  fs.writeFileSync(file, [
    "<?xml version=\"1.0\" encoding=\"UTF-8\"?>",
    "<!DOCTYPE plist PUBLIC \"-//Apple//DTD PLIST 1.0//EN\" \"http://www.apple.com/DTDs/PropertyList-1.0.dtd\">",
    "<plist version=\"1.0\"><dict>",
    "<key>method</key><string>developer-id</string>",
    `<key>destination</key><string>${destination}</string>`,
    `<key>teamID</key><string>${teamId}</string>`,
    "<key>signingStyle</key><string>manual</string>",
    "<key>signingCertificate</key><string>Developer ID Application</string>",
    "</dict></plist>",
    ""
  ].join("\n"));
}

function stapleWhenReady(app) {
  for (let attempt = 1; attempt <= 40; attempt += 1) {
    const result = spawnSync("xcrun", ["stapler", "staple", app], {
      cwd: root,
      encoding: "utf8"
    });
    if (result.status === 0) {
      process.stdout.write(result.stdout || "");
      return;
    }
    if (attempt === 40) {
      process.stderr.write(result.stderr || result.stdout || "");
      throw new Error("Apple did not provide a notarization ticket within 10 minutes. Check Xcode Organizer.");
    }
    if (attempt === 1 || attempt % 4 === 0) console.log("Waiting for Apple notarization approval...");
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 15000);
  }
}

if (!fs.existsSync(path.join(dist, "safari", "manifest.json"))) {
  run(process.execPath, [path.join(root, "scripts", "build.js")]);
}

function findSigningIdentity() {
  const identities = execFileSync("security", ["find-identity", "-v", "-p", "codesigning"], {
    encoding: "utf8"
  });
  const requested = process.env.APPLE_SIGNING_IDENTITY;
  const lines = identities.split("\n").filter((line) => line.includes("Developer ID Application:"));
  const line = requested ? lines.find((candidate) => candidate.includes(requested)) : lines[0];
  const match = line && line.match(/"(Developer ID Application: .+ \(([A-Z0-9]+)\))"/);
  if (!match) {
    throw new Error("No matching Developer ID Application certificate was found in the keychain.");
  }
  return { name: match[1], teamId: process.env.APPLE_TEAM_ID || match[2] };
}

const signing = findSigningIdentity();
const projectRoot = path.join(dist, "safari-xcode");
const projectDirectory = path.join(projectRoot, appName);
const project = path.join(projectDirectory, `${appName}.xcodeproj`);
const projectFile = path.join(project, "project.pbxproj");
const archive = path.join(dist, "google-goto-url-fix-safari.xcarchive");
const exportDirectory = path.join(dist, "safari-export");

for (const generated of [projectRoot, archive, exportDirectory]) {
  fs.rmSync(generated, { recursive: true, force: true });
}

run("xcrun", [
  "safari-web-extension-converter",
  path.join(dist, "safari"),
  "--project-location", projectRoot,
  "--app-name", appName,
  "--bundle-identifier", bundleId,
  "--copy-resources",
  "--macos-only",
  "--no-open",
  "--no-prompt",
  "--force"
]);

// Xcode's converter derives the host ID from the app name but uses the supplied
// ID for the extension. Normalize both so the extension is embedded legally.
let projectSource = fs.readFileSync(projectFile, "utf8");
const generatedIds = [...projectSource.matchAll(/PRODUCT_BUNDLE_IDENTIFIER = "([^"]+)";/g)]
  .map((match) => match[1]);
const hostIds = [...new Set(generatedIds.filter((id) => !id.endsWith(".Extension")))];
const extensionIds = [...new Set(generatedIds.filter((id) => id.endsWith(".Extension")))];
if (hostIds.length !== 1 || extensionIds.length !== 1) {
  throw new Error("Could not identify the generated Safari host and extension bundle IDs.");
}
projectSource = projectSource
  .replaceAll(`PRODUCT_BUNDLE_IDENTIFIER = "${hostIds[0]}";`, `PRODUCT_BUNDLE_IDENTIFIER = "${bundleId}";`)
  .replaceAll(`PRODUCT_BUNDLE_IDENTIFIER = "${extensionIds[0]}";`, `PRODUCT_BUNDLE_IDENTIFIER = "${bundleId}.Extension";`);
fs.writeFileSync(projectFile, projectSource);

const buildNumber = String(version.split(".").reduce((value, part) => value * 1000 + Number(part), 0));
run("xcodebuild", [
  "-quiet",
  "-project", project,
  "-scheme", appName,
  "-configuration", "Release",
  "-archivePath", archive,
  "-destination", "generic/platform=macOS",
  "CODE_SIGN_STYLE=Manual",
  `DEVELOPMENT_TEAM=${signing.teamId}`,
  `CODE_SIGN_IDENTITY=${signing.name}`,
  "OTHER_CODE_SIGN_FLAGS=--timestamp",
  `MACOSX_DEPLOYMENT_TARGET=${deploymentTarget}`,
  `MARKETING_VERSION=${version}`,
  `CURRENT_PROJECT_VERSION=${buildNumber}`,
  "archive"
]);

let app = path.join(archive, "Products", "Applications", `${appName}.app`);
run("codesign", ["--verify", "--deep", "--strict", "--verbose=2", app]);

const suffix = skipNotarization ? "-signed-unnotarized" : "";
const output = path.join(dist, `google-goto-url-fix-safari-app-${version}${suffix}.zip`);
fs.rmSync(output, { force: true });

if (skipNotarization) {
  run("ditto", ["-c", "-k", "--keepParent", app, output]);
  console.warn("Skipping notarization. This build is signed, but Gatekeeper will reject normal downloaded installation.");
  console.log(`Safari signed app archive: ${output}`);
  process.exit(0);
}

if (notaryProfile) {
  run("ditto", ["-c", "-k", "--keepParent", app, output]);
  run("xcrun", ["notarytool", "submit", output, "--keychain-profile", notaryProfile, "--wait"]);
  run("xcrun", ["stapler", "staple", app]);
} else {
  const uploadOptions = path.join(dist, "safari-export-upload.plist");
  const localOptions = path.join(dist, "safari-export-local.plist");
  writeExportOptions(uploadOptions, "upload", signing.teamId);
  writeExportOptions(localOptions, "export", signing.teamId);
  run("xcodebuild", [
    "-exportArchive",
    "-archivePath", archive,
    "-exportOptionsPlist", uploadOptions,
    "-exportPath", exportDirectory,
    "-allowProvisioningUpdates"
  ]);
  run("xcodebuild", [
    "-exportArchive",
    "-archivePath", archive,
    "-exportOptionsPlist", localOptions,
    "-exportPath", exportDirectory,
    "-allowProvisioningUpdates"
  ]);
  app = path.join(exportDirectory, `${appName}.app`);
  stapleWhenReady(app);
}

run("xcrun", ["stapler", "validate", app]);
run("spctl", ["--assess", "--type", "execute", "--verbose=4", app]);

// Create the release archive after stapling so it works without a network check.
fs.rmSync(output, { force: true });
run("ditto", ["-c", "-k", "--keepParent", app, output]);
console.log(`Safari signed and notarized app archive: ${output}`);
