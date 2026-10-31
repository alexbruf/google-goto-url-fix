# Google Goto Url Fix

A small cross-browser extension with no runtime dependencies that resolves Google's `/goto`
search-result redirects and replaces them with normal destination URLs. This makes
the links copyable again.

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

The first three result headings are resolved automatically. Other links are resolved
when you hover, focus, touch, or right-click them. Sending every link to Google can
trigger its verification page, so all lookups pause for five minutes if that happens.

A red **!** badge means links can't be resolved right now. Hover over the toolbar
button to see why. The badge clears after the next successful lookup.

The extension runs only on `google.com/search` pages and only sends Google `/goto`
URLs back to Google to obtain their redirect target. Chrome's `webRequest` API is
used only to read that redirect event; the extension does not request access to
destination sites. It has no dependencies, analytics, or remote code.

## Tests

Run `npm run check`. The tests validate all manifests, parse both scripts, simulate
the reported 402 and opaque 3xx responses, verify that non-Google URLs are never
fetched, and create all four upload packages.

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

See [RELEASE.md](RELEASE.md) for the automated CI/CD and version-tag release process.
It also documents Mozilla-signed Firefox XPI and Apple-signed/notarized Safari app
builds for direct distribution without public store listings.

## License

[MIT](LICENSE) © 2026 Alex Brufsky
