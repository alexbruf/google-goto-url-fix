# Release process

GitHub Actions validates every push and pull request. A pushed `v*` tag creates a
GitHub Release containing all four browser ZIPs and `SHA256SUMS.txt`.

## Prepare a release

1. Choose a semantic version such as `1.0.1`.
2. Update every manifest at once:

   ```sh
   npm run version:set -- 1.0.1
   ```

3. Add the release changes to `CHANGELOG.md`.
4. Run the complete local validation:

   ```sh
   npm run check
   npm run test:browser
   ```

5. Commit and push the version change:

   ```sh
   git add .
   git commit -m "Prepare v1.0.1"
   git push origin main
   ```

6. After CI passes on `main`, tag that exact commit and push the tag:

   ```sh
   git tag -a v1.0.1 -m "Google Goto Url Fix v1.0.1"
   git push origin v1.0.1
   ```

The release workflow rejects a tag that does not exactly match the version in
`package.json`. This prevents mislabeled store packages.

## What CI does

- Builds Chrome, Edge, Firefox, and Safari packages from readable source.
- Confirms all manifests use the same version and narrow Google-only permissions.
- Validates JavaScript, redirect handling, URL-fetch restrictions, icon dimensions,
  store-art dimensions, and archive generation.
- Keeps unsigned ZIP artifacts from branch and pull-request builds for 14 days.
- Generates SHA-256 checksums for tagged releases.

Firefox and Safari signing remain publisher-authenticated steps. Complete them on
the tagged commit before attaching the installable artifacts to the release.

## Sign Firefox for direct distribution

Create JWT credentials on the AMO developer API keys page. Keep both values out of
the repository and shell history, then expose them to `web-ext` through its standard
environment variables:

```sh
export WEB_EXT_API_KEY="your AMO JWT issuer"
export WEB_EXT_API_SECRET="your AMO JWT secret"
npm install --global web-ext
npm run build
npm run sign:firefox
```

This uses Mozilla's `unlisted` channel and writes
`dist/google-goto-url-fix-firefox-<version>.xpi`. The Gecko ID in
`manifests/firefox.json` is permanent after the first submission.

## Sign and notarize Safari for direct distribution

This requires macOS, current Xcode, a Developer ID Application certificate, and an
Apple Developer account signed into Xcode. The default command uses that Xcode
account for notarization:

```sh
npm run build
npm run sign:safari
```

For CI or a Mac without an account signed into Xcode, store App Store Connect team
API-key credentials in the login keychain once (the issuer is the UUID shown for
the API key in App Store Connect):

```sh
xcrun notarytool store-credentials google-goto-url-fix \
  --key /path/to/AuthKey_KEYID.p8 \
  --key-id KEYID \
  --issuer ISSUER-UUID
```

Then select that profile explicitly:

```sh
npm run build
NOTARYTOOL_PROFILE=google-goto-url-fix npm run sign:safari
```

The command automatically uses the first Developer ID Application identity in the
keychain and writes `dist/google-goto-url-fix-safari-app-<version>.zip`. Override
defaults with `APPLE_SIGNING_IDENTITY`, `APPLE_TEAM_ID`,
`SAFARI_BUNDLE_IDENTIFIER`, `SAFARI_DEPLOYMENT_TARGET`, or `NOTARYTOOL_PROFILE`.
For signature-only diagnostics, set `SKIP_NOTARIZATION=1`; never publish that
unnotarized build because Gatekeeper rejects normal downloaded installation.
