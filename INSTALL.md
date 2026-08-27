# Install Google Goto Url Fix

Until the browser-store listings are approved, use the instructions below. Only
install extensions downloaded from this project's official GitHub Releases page.

## Chrome

1. Download `google-goto-url-fix-chrome-<version>.zip` from the latest GitHub Release.
2. Unzip it into a permanent folder. Do not delete that folder after installation.
3. Open `chrome://extensions`.
4. Enable **Developer mode** in the upper-right corner.
5. Click **Load unpacked** and select the unzipped folder.
6. Pin **Google Goto Url Fix** from Chrome's Extensions menu if desired.

Chrome may periodically display a developer-mode warning. Updates are manual:
download the new release, replace the files in the same folder, then click the
extension's **Reload** button on `chrome://extensions`.

## Microsoft Edge

1. Download `google-goto-url-fix-edge-<version>.zip` from the latest GitHub Release.
2. Unzip it into a permanent folder.
3. Open `edge://extensions`.
4. Enable **Developer mode**.
5. Click **Load unpacked** and select the unzipped folder.

Updates are manual until the Microsoft Edge Add-ons listing is available.

## Firefox

The release ZIP is intended for review and temporary testing. In Firefox:

1. Download and unzip `google-goto-url-fix-firefox-<version>.zip`.
2. Open `about:debugging#/runtime/this-firefox`.
3. Click **Load Temporary Add-on**.
4. Select `manifest.json` inside the unzipped folder.

Firefox removes temporary add-ons when it restarts. A persistent one-click install
requires Mozilla's signed `.xpi`; that file will be added to Releases when signing
is complete.

## Safari on macOS

Safari 18.4 or later can load a temporary web-extension folder:

1. Download and unzip `google-goto-url-fix-safari-<version>.zip`.
2. In Safari, enable developer features if the **Developer** settings tab is hidden.
3. Open Safari → Settings → Developer.
4. Click **Add Temporary Extension…** and select the unzipped folder.
5. Approve the unsigned-extension prompt and enable the extension.

Safari removes temporary extensions after 24 hours or when Safari quits. Normal
distribution requires the signed Safari app or TestFlight build that will be linked
from Releases when available.

## Use

1. Open an unauthenticated Google Search results page containing `/goto` links.
2. Click the extension's toolbar button.
3. A blue **ON** badge means Google redirect links are being replaced with their
   ordinary destination URLs.
4. Click again to turn it off and restore the original links.

The extension runs only on `google.com/search`, stores only its on/off preference,
and has no analytics or developer-operated service.

## Build from source

Node.js 20 or newer and a JDK providing the `jar` command are required.

```sh
npm run check
npm run test:browser  # optional; requires agent-browser
```

Generated browser directories and release ZIPs are written to `dist/`.
