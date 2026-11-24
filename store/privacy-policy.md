# Privacy Policy for Google Goto Url Fix

Effective date: August 27, 2026

Google Goto Url Fix does not collect, retain, sell, or share personal data.
It does not contain analytics, advertising, tracking, remote code, or developer-
operated network services.

When enabled on a supported Google Search results page, the extension reads result
links and their destination-related attributes. It may request Google `/goto` and
matching `/url` ping addresses using the browser's existing session, including a
limited number of nearby links by default. The user can disable nearby prefetching
in the extension settings. It observes Google's response to replace the link in
the page with its destination. Link processing occurs on
the user's device. The developer never receives the search query, browsing
activity, redirect URL, cookies, or destination URL.

## Optional fallback service

The extension has an optional fallback that is off by default. If the user chooses
DataForSEO or cloro in the extension settings and enters their own account details
for that service, Google `/goto` links that Google does not resolve are sent to the
chosen service, which returns their destinations. Only those Google link addresses
are sent, along with the user's own credentials for that service. Search queries,
cookies and page contents are not sent. The service's own privacy policy applies to
those requests. Choosing "None" in the settings stops all requests to the service.
The developer never receives this data.

## Data stored on the device

The extension stores the toolbar and prefetch preferences, the optional fallback
service choice and credentials, a temporary pause time,
and the latest lookup error on the user's device. Removing the extension deletes
this data through the browser's normal extension-data removal process.

The extension's use of information received from browser APIs is limited to its
single disclosed purpose and complies with the Chrome Web Store User Data Policy,
including its Limited Use requirements.

Questions about this policy may be opened at:
https://github.com/alexbruf/google-goto-url-fix/issues.
