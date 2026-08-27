# Store listing copy

## Name

Google Goto Url Fix

Character count: 19 of 30 (Apple) / 75 (Chrome).

## Short description

Restores Google's redirected search-result URLs as ordinary, copyable links.

Character count: 76 of 132 (Chrome).

## Apple subtitle

Copy real Google result URLs

Character count: 28 of 30.

## Apple promotional text

Skip opaque Google Goto redirects. Restore ordinary destination URLs directly on
the results page with one private, local toolbar toggle.

Character count: 137 of 170.

## Apple keywords

redirect,link,url,copy,search,browser,toolbar,destination,privacy,utility

## Full description

Google Goto Url Fix turns opaque `google.com/goto` search-result links back
into their ordinary destination URLs.

Click the toolbar button to switch it on. While enabled, it fixes existing results
and results Google adds dynamically. Click again to switch it off and restore the
original links.

- Makes result links easy to copy and inspect
- Works only on Google Search result pages
- Stores only the on/off preference locally
- No analytics, advertising, tracking, accounts, or remote code
- No developer-operated server

The extension contacts Google only to resolve Google's own redirect links. It does
not request access to destination websites.

## Category

Productivity

## Chrome permission justifications

- `storage`: Persists the user's on/off preference locally.
- `webRequest`: Reads the destination of Google's opaque `/goto` redirect. It is
  filtered in code and by host access to Google only.
- `https://google.com/*`, `https://www.google.com/*`: Finds and resolves `/goto`
  links only on Google Search. No access to destination sites is requested.

## Firefox data-collection disclosure

The extension does not collect or transmit data to the developer or third parties.
It processes Google redirect URLs locally and sends them only to Google as required
to resolve the user-visible link. It stores the on/off preference locally.

## Apple App Privacy answers

- Data collected: None.
- Tracking: No.
- Third-party analytics: No.
- Advertising: No.

## Search keywords

Google links, copy link, search results, redirect URL, productivity

## Support and marketing URLs

- Support URL: https://github.com/alexbruf/google-goto-url-fix/issues
- Privacy URL: https://github.com/alexbruf/google-goto-url-fix/blob/main/store/privacy-policy.md
- Marketing URL: https://github.com/alexbruf/google-goto-url-fix
