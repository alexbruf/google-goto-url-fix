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

Firefox signing, Safari signing/notarization, and browser-store submission remain
publisher-authenticated steps. The generated ZIPs are the inputs for those systems.
