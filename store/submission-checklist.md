# Submission checklist

The extension code and upload archives are generated with `npm run build`.
Account ownership, signing, and public URLs must be supplied by the publisher.

## Before every release

1. Verify the public support and privacy URLs in `store/listing.md`.
2. Update the version in `package.json` and all three manifests.
3. Run `npm run check` and manually test the toolbar toggle in each browser.
4. Verify that the prepared screenshots still match the current product UI.

## Chrome Web Store

- Upload `dist/google-goto-url-fix-chrome-<version>.zip`.
- Upload `icons/icon-128.png` as the store icon.
- Upload `store/assets/store-screenshot-1280x800.png` as the required screenshot.
- Upload `store/assets/promo-small-440x280.png` as the small promotional tile.
- Optionally upload `store/assets/promo-marquee-1400x560.png` as the marquee tile.
- Paste the permission justifications and privacy disclosures from `listing.md`.
- Host `privacy-policy.md` at the public privacy URL.
- Complete the developer account, registration fee, and two-step verification.

## Firefox Add-ons (AMO)

- Confirm the permanent Gecko ID in `manifests/firefox.json`; do not change it
  after the first release.
- Run `npm run sign:firefox` with the AMO JWT environment variables described in
  `RELEASE.md`, or upload `dist/google-goto-url-fix-firefox-<version>.zip` manually.
- Paste the summary/category and data disclosure from `listing.md`.
- Upload `store/assets/store-screenshot-1280x800.png` as the listing screenshot.
- If Mozilla requests source, this repository is the complete readable source;
  there is no minification or dependency build step.
- Install the signed XPI returned by AMO for the final release test.

## Microsoft Edge Add-ons

- Upload `dist/google-goto-url-fix-edge-<version>.zip`.
- Reuse the Chrome listing copy, privacy disclosures, screenshots, and icon.
- Use the prepared files listed in `store/assets/README.md`.
- Complete Microsoft's extension certification questionnaire and publisher account.

## Safari direct distribution

- Sign into an Apple Developer account in Xcode, or configure the optional
  `notarytool` keychain profile described in `RELEASE.md`.
- Run `npm run sign:safari` on a Mac with the Developer ID Application certificate.
- Install and launch `dist/google-goto-url-fix-safari-app-<version>.zip` on a second Mac
  if available, then verify the extension can be enabled without developer mode.
- Attach the signed XPI and signed/notarized Safari app archive to the GitHub Release.

## Safari / Apple App Store (optional)

Two official paths are available:

1. Upload `dist/google-goto-url-fix-safari-<version>.zip` to the Safari Web
   Extension Packager in App Store Connect; or
2. On a Mac with current Xcode, run:

   `xcrun safari-web-extension-packager dist/safari --app-name "Google Goto Url Fix" --bundle-identifier "REPLACE.WITH.REVERSE.DNS.ID" --swift`

Then select the publisher's Apple Developer team, set signing, build/test in
Safari, archive, and upload through Xcode. Create the App Store Connect record with
the same bundle ID. Upload `store/assets/store-screenshot-1280x800.png` for the
macOS 16:10 screenshot. Supply the privacy-policy URL and the Apple title,
subtitle, promotional text, keywords, and privacy answers in `listing.md`.

The final Safari app/project cannot be signed on Linux because signing identities
and Apple team selection belong to the publisher's Apple Developer account.
