# Vasquez Digital Solutions

A dependency-free static website for Vasquez Digital Solutions. The public homepage includes current work, contact links and clearly labeled app destinations.

## Run and build

- Preview: `python3 -m http.server 8765`
- Build the deployable allowlist: `python3 build.py`
- Unit tests: `node --test tests/brief-core.test.cjs`
- Static checks: `python3 tests/check_site.py`
- JavaScript syntax: `node --check assets/js/site.js && node --check assets/js/brief-core.js && node --check assets/js/brief.js`

Netlify builds the site into `dist/`. Original historical files remain in Git and are excluded from the deployed allowlist unless expressly included by `build.py`.

## Current functionality

- Responsive public portfolio and email contact links.
- Customer/owner access information. Website sign-in is not connected.
- A generic, local-only project brief preview with validation, editable review, optional device-local persistence, plain-text download, copying and browser printing.
- Daily Desk links to its existing private development app; this website does not handle that app’s authentication.

The general brief preview is not the private customer questionnaire. It does not upload files, transmit answers, create accounts, synchronize devices or submit to Notion. Browser local storage is not encrypted account storage. No credentials, identity provider configuration or customer-private content belong in this repository.

## Assets

The studio image is AI-generated concept artwork, not a photograph of an actual office. The website labels it accordingly. Portfolio images are screenshots of the linked public websites captured in October 2026.

Cormorant Garamond and DM Sans are self-hosted subset fonts under the SIL Open Font License. Their notices are in `assets/fonts/licenses/`. The company name and favicon use a plain text treatment, not a newly illustrated logo.
