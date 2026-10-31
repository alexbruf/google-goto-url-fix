# Google Goto Url Fix

A small cross-browser extension with no runtime dependencies that resolves Google's `/goto`
search-result redirects and replaces them with normal destination URLs. It first checks
the result anchor for a direct destination, then tries its matching `/url` ping address,
and falls back to `/goto` if needed. Explicit verification redirects and rate limits
pause lookups instead.

## Install

Download the files from the [latest GitHub Release](https://github.com/alexbruf/google-goto-url-fix/releases/latest):

- **Firefox:** download the signed `.xpi`, then open `about:addons` and choose
  **Install Add-on From File…** from the gear menu.
- **Safari:** download the `safari-app` ZIP, unzip it, move the app into Applications,
  open it once, then enable the extension in Safari → Settings → Extensions.
- **Chrome and Edge:** download the browser's ZIP and follow the developer-mode
  installation steps in [INSTALL.md](INSTALL.md).

The Firefox XPI is signed by Mozilla. The Safari app and embedded extension are
signed with Apple Developer ID and notarized for direct installation outside the
Mac App Store. See [INSTALL.md](INSTALL.md) for complete instructions and temporary
developer-install alternatives.

Click the toolbar button to switch rewriting on or off. A blue **ON** badge means
it is active. The setting persists across browser restarts. Turning it off restores
the original Google links already changed on the current page.

By default, the extension cautiously prefetches a few nearby links after the page
or scrolling settles. It also resolves links when you hover, focus, touch, or
right-click them. To use hover-only mode, open the extension's settings from your
browser's extensions page and turn off **Prefetch nearby search results**. Google
can request verification, in which case lookups pause for five minutes.

When an unambiguous direct destination is already present on a result anchor, the
extension resolves it across the loaded page without a network request. Other page
state is not used as a source because a nearby URL may belong to a different result.

A red **!** badge means links can't be resolved right now. Hover over the toolbar
button to see why. The badge clears after the next successful lookup. The **…**
badge means a lookup is in progress.

The extension runs on supported Google country-domain search pages and only sends Google `/goto` or
matching `/url` ping URLs back to Google to obtain their redirect target. Chrome's
`webRequest` API is used only to read Google redirect events; the extension does not
request access to destination sites. It has no dependencies, analytics, or remote code.

## Tests

Run `npm run check`. The tests validate all manifests, parse both scripts, simulate
the reported 402 and opaque 3xx responses, verify that non-Google URLs are never
fetched, and create all four upload packages.

`test/fixture.html` is a deterministic browser fixture for the real content script.
It covers hover resolution, dynamically inserted results, normal links, and turning
the extension off. It uses no network and does not need Google to avoid bot-check
flakiness. Run it with `npm run test:browser`; the script always closes its single
agent-browser session on completion.

For an interactive local test, run `npm run test:serve` and open
`http://127.0.0.1:4173/` in a browser. Hover or focus a result to see the simulated
resolution and message log; use the buttons to disable rewriting or add a result.
This fixture mocks the extension backend, so it does not test real Google responses.
To test the full extension, load the repository as an unpacked extension in Chrome
using [INSTALL.md](INSTALL.md), enable it, and hover a result on Google Search.

Run `npm run test:e2e` for a controlled Chromium test of the actual content script
and background worker. It requires Node.js with WebSocket support, OpenSSL, and
Chromium; set `CHROMIUM_PATH` if it is not at the default Playwright cache path. The
test adds a localhost-only content-script match to a temporary manifest and simulates
Google responses locally. It does not measure live Google behavior.

## Release packages

`npm run build` creates unpacked directories and upload ZIPs under `dist/` for:

- Chrome Web Store
- Microsoft Edge Add-ons
- Firefox Add-ons (AMO)
- Safari Web Extension Packager / App Store Connect

Store copy, privacy disclosures, reviewer notes, and the remaining account/signing
checklist are in `store/`. Safari can be packaged through App Store Connect, or its
ZIP can be converted into an Xcode project on macOS.

See [RELEASE.md](RELEASE.md) for the automated CI/CD and version-tag release process.
It also documents Mozilla-signed Firefox XPI and Apple-signed/notarized Safari app
builds for direct distribution without public store listings.

## License

[MIT](LICENSE) © 2026 Alex Brufsky
