# Reviewer notes

This extension has one purpose: replace opaque Google `/goto` links on Google
Search results pages with the redirect destination so the user can copy and inspect
normal links.

Test steps:

1. Use an unauthenticated/private browser session and search on `google.com`.
2. Confirm a result has an `href` beginning with `https://www.google.com/goto`.
3. Click the extension toolbar action. Its badge changes to `ON`.
4. Hover or focus a result, wait for resolution, then inspect or copy the result URL.
5. Click the action again; the badge clears and original URLs are restored.

The `webRequest` permission is necessary because browsers expose Google's ordinary
3xx response to `fetch` as an opaque redirect with no readable status or Location
header. Listeners cover Google `/goto` and `/url` addresses on supported country
domains. The extension requests no access to destination sites. Nearby prefetch is
on by default and can be disabled in extension options; explicit Google challenges
pause lookups.

No login, purchase, test account, remote server, analytics, or user-data collection
is involved.
