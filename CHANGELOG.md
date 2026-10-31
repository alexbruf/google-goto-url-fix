# Changelog

## Unreleased

- Resolves links only on hover, keyboard focus, touch, or right-click, one at a
  time, instead of on page load, to avoid Google flagging users.
- Never rewrites a link to Google's `/sorry` verification page.
- Pauses all lookups for five minutes when Google asks for verification or
  returns a response with no redirect.
- Shows a red `!` badge, with the reason in the tooltip, when links can't be resolved.

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
