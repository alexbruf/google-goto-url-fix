# Changelog

## 1.0.6 — 2026-11-24

- Stops rewriting a link after three rewrites in ten seconds if the page keeps
  putting its `/goto` address back, so the extension can no longer trade changes
  with the page indefinitely and use high CPU (#12).
- Adds a CPU stress fixture, `npm run test:stress`.
- Adds an optional fallback service, off by default. When Google won't resolve a
  link, the extension can ask DataForSEO or cloro using the user's own account.
  DataForSEO lookups are sent together as one batch request.

## 1.0.5 — 2026-11-01

- Fixes Safari with nonpersistent background processes by removing unsupported
  webRequest listeners. Safari resolves destinations from page data and readable
  Google responses; some redirects may stay unresolved where Safari hides them (#10).

## 1.0.4 — 2026-10-31

- Decodes redirect URLs with plain string replacement instead of assigning
  response HTML to a DOM element.
- Changes the Firefox add-on ID to `google-goto-url-fix@alexbruf.github.io`.
  Firefox treats this as a new add-on: remove an earlier signed XPI before
  installing this version.

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
- Provides Safari-specific first-install and Private Browsing guidance on macOS.

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
