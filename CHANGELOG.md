# Changelog

## 1.0.3 — 2026-10-31

- Resolves unambiguous destinations already present on result anchors, then tries
  the matching Google `/url` ping before falling back to `/goto`.
- Adds support for localized Google Search domains across Chrome, Firefox, and Safari.
- Preserves valid Google-hosted destinations while rejecting redirect and verification pages.
- Prefetches a small number of nearby results by default; extension settings provide
  a hover-only mode. Interactive lookups take priority over queued prefetches.
- Pauses lookups for five minutes on explicit verification or rate limits, leaves
  unresolved links unchanged, and displays loading and error badge states.
- Adds regression and controlled Chromium end-to-end tests for resolution and challenges.
- Shows optional private-browsing setup instructions on first installation.
- Tailors private-window instructions for Firefox and explains that slow links may need another hover.

## 1.0.2 — 2026-08-27

- Fixes Firefox timing out while resolving Google `/goto` links by reading the
  redirect destination when Firefox exposes the response headers.
- Adds regression coverage for Firefox's manual-redirect behavior.

## 1.0.1 — 2026-08-27

- Adds Mozilla-signed Firefox XPI releases for persistent self-distributed installs.
- Adds Developer ID-signed and Apple-notarized Safari app releases outside the Mac App Store.
- Documents normal Firefox and Safari installation and repeatable signing workflows.
- Declares that the Firefox extension collects no data and removes an unsupported Safari manifest key.
- Releases the project under the MIT License.

## 1.0.0 — 2026-08-27

Initial public release of Google Goto Url Fix.

- Restores ordinary, copyable URLs on Google Search result pages.
- Includes persistent toolbar on/off state and dynamic-result handling.
- Provides packages for Chrome, Microsoft Edge, Firefox, and Safari.
- Includes store artwork, privacy disclosures, reviewer notes, and installation
  instructions.
- Includes deterministic unit, packaging, and browser-fixture tests.
