# Google Goto Url Fix

A small, dependency-free cross-browser extension that resolves Google's `/goto`
search-result redirects and replaces them with normal destination URLs. This makes
the links copyable again.

## Install

See [INSTALL.md](INSTALL.md) for Chrome, Edge, Firefox, and Safari instructions,
including temporary installation before the store listings are approved.
4. Pin the extension if you want the toggle to remain visible.

Click the toolbar button to switch rewriting on or off. A blue **ON** badge means
it is active. The setting persists across browser restarts. Turning it off restores
the original Google links already changed on the current page.

The extension runs only on `google.com/search` pages and only sends Google `/goto`
URLs back to Google to obtain their redirect target. Chrome's `webRequest` API is
used only to read that redirect event; the extension does not request access to
destination sites. It has no dependencies, analytics, or remote code.

## Tests

Run `npm run check`. The tests validate all manifests, parse both scripts, simulate
the reported 402 and opaque 3xx responses, verify that non-Google URLs are never
fetched, and create all three upload packages.

`test/fixture.html` is a deterministic browser fixture for the real content script.
It covers initial links, dynamically inserted results, normal links, and turning
the extension off. It uses no network and does not need Google to avoid bot-check
flakiness. Run it with `npm run test:browser`; the script always closes its single
agent-browser session on completion.

## Release packages

`npm run build` creates unpacked directories and upload ZIPs under `dist/` for:

- Chrome Web Store
- Microsoft Edge Add-ons
- Firefox Add-ons (AMO)
- Safari Web Extension Packager / App Store Connect

Store copy, privacy disclosures, reviewer notes, and the remaining account/signing
checklist are in `store/`. Safari can be packaged through App Store Connect, or its
ZIP can be converted into an Xcode project on macOS.
