# Submission checklist

The extension code and upload archives are generated with `npm run build`.
Account ownership, signing, and public URLs must be supplied by the publisher.

## Before every release

1. Verify the public support and privacy URLs in `store/listing.md`.
2. Update the version in `package.json` and all three manifests.
3. Run `npm run check` and manually test the toolbar toggle in each browser.
4. Verify that the prepared screenshots still match the current product UI.

## Chrome Web Store

- Upload `dist/google-goto-url-fix-chrome-1.0.0.zip`.
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
- Upload `dist/google-goto-url-fix-firefox-1.0.0.zip` to AMO for signing.
- Paste the summary/category and data disclosure from `listing.md`.
- Upload `store/assets/store-screenshot-1280x800.png` as the listing screenshot.
- If Mozilla requests source, this repository is the complete readable source;
  there is no minification or dependency build step.
- Install the signed XPI returned by AMO for the final release test.

## Microsoft Edge Add-ons

- Upload `dist/google-goto-url-fix-edge-1.0.0.zip`.
- Reuse the Chrome listing copy, privacy disclosures, screenshots, and icon.
- Use the prepared files listed in `store/assets/README.md`.
- Complete Microsoft's extension certification questionnaire and publisher account.

## Safari / Apple App Store

Two official paths are available:

1. Upload `dist/google-goto-url-fix-safari-1.0.0.zip` to the Safari Web
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
