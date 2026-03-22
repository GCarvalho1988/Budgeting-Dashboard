# Sectra UK Office Parking Booking App — Design Spec

**Date:** 2026-03-22
**Project:** LeedsParkingArea
**Status:** Approved

---

## Overview

A single-page web app for booking one of two office parking spaces at the Sectra UK office. Hosted on Azure Static Web Apps, embedded as a tab in Microsoft Teams. Vanilla HTML, CSS, and JavaScript only — no frameworks, no build step.

---

## Architecture

### Approach

Multi-file vanilla JS (no framework, no bundler). MSAL.js loaded from CDN. All Graph calls via native `fetch`.

### File Structure

```
LeedsParkingArea/
├── index.html                  # Shell: loads MSAL from CDN, imports app.js
├── style.css                   # All styling — Teams-friendly, mobile-first
├── config.js                   # Environment constants (tenant ID, client ID, etc.)
├── auth.js                     # MSAL initialisation, login, silent token acquisition
├── api.js                      # All Microsoft Graph API calls (SharePoint list CRUD)
├── ui.js                       # DOM rendering: week grid, booking/cancel interactions
├── app.js                      # Entry point: wires auth → ui on page load
├── staticwebapp.config.json    # Azure SWA auth + routing config
├── .github/
│   └── workflows/
│       └── deploy.yml          # GitHub Actions deployment to Azure SWA
└── .gitignore
```

### Module Responsibilities

| Module | Responsibility |
|--------|---------------|
| `config.js` | Single source of truth for all environment-specific values (tenant ID, client ID, SharePoint site URL, list ID). Placeholders until infrastructure is provisioned. |
| `auth.js` | Owns the MSAL instance. Exposes `getAccount()` and `getToken()`. Nothing else touches MSAL. |
| `api.js` | Owns all `fetch` calls to Microsoft Graph. Accepts and returns plain JS objects. No DOM access. |
| `ui.js` | Owns all DOM reads and writes. Calls `api.js` functions. No direct Graph knowledge. |
| `app.js` | Bootstraps on page load: initialises auth, waits for sign-in, then calls `ui.js` to render. |

---

## Authentication

### Two-Layer Auth Strategy

The app uses two complementary auth layers that serve different purposes:

1. **SWA platform auth** (`staticwebapp.config.json`) — handles the login wall. Unauthenticated requests are redirected to Entra ID login before the app ever loads. This means MSAL redirect flows never run inside the Teams iframe, avoiding known iframe/redirect incompatibilities on Teams desktop.

2. **MSAL.js** (client-side) — handles Graph token acquisition after the user is already authenticated at the SWA level. MSAL acquires delegated tokens scoped to Microsoft Graph so the app can read and write the SharePoint list on behalf of the signed-in user.

These two layers use different tokens: the SWA auth token (managed by the platform, in a cookie) establishes the session; the MSAL token (a Graph access token) is used in `Authorization: Bearer` headers on Graph API calls. They are independent and both required.

### Auth Flow Details

- **Provider:** Microsoft Entra ID via MSAL.js (CDN, `@azure/msal-browser`)
- **Flow:** Redirect (not popup — Teams can block popups in some clients)
- **Startup sequence in `app.js`:**
  1. Call `msalInstance.handleRedirectPromise()` on every page load to process any in-flight redirect response. This is mandatory for the redirect flow and must be the first MSAL call.
  2. Check for an active account via `msalInstance.getAllAccounts()`.
  3. If no account found, call `msalInstance.loginRedirect()` to initiate login.
  4. If account found, acquire a Graph token silently and render the UI.
- **Token acquisition:** `acquireTokenSilent()` on each Graph call; falls back to `acquireTokenRedirect()` if the silent call fails (e.g. token expired).
- **User identity:** `displayName` and `email` read from the MSAL account object — no extra Graph profile call needed.
- **Graph scope:** `Sites.ReadWrite.All` (delegated). **Note:** This scope requires tenant admin consent. Admin consent must be granted in the Azure App Registration before the app will work for any user. This is a provisioning prerequisite.

### Teams Iframe Compatibility

SWA platform auth handles login before the iframe renders, so MSAL redirect flows are not triggered within the Teams iframe. This avoids the known issue where MSAL redirect responses are lost in Teams iframes. MSAL is used only for silent token acquisition once the user is already signed in.

---

## Data

### SharePoint List Schema

| Column | Type | Notes |
|--------|------|-------|
| `Date` | Date | The booked date |
| `Space` | Number | 1 or 2 |
| `BookedBy` | Text | User's display name |
| `BookedByEmail` | Text | User's email address |

**Note on internal column names:** SharePoint column display names may differ from their internal names as used in Graph OData filters. At provisioning time, confirm the internal name for each column (e.g. `Date` may be stored as `Date0` or `fields/Date`). The `LIST_ID` and internal column names must be verified against the actual provisioned list before deploying.

### API Operations (`api.js`)

**`getBookingsForWeek(startDate, endDate)`**

Single Graph call with OData `$filter` on the Date column. Example filter template:
```
$filter=fields/Date ge '2026-03-23T00:00:00Z' and fields/Date le '2026-03-27T23:59:59Z'
```
Dates are ISO 8601 UTC strings. Returns an array of `{ id, date, space, bookedBy, bookedByEmail }` objects. Called on every week navigation and after every book/cancel action.

**`bookSpace(date, space, displayName, email)`**

Ordered sequence:
1. **Check user has no existing booking that day** — query `$filter=fields/Date eq '{date}' and fields/BookedByEmail eq '{email}'`. If a booking exists: return `{ error: 'alreadyBooked' }` — `ui.js` shows inline message "You already have a space booked this day."
2. **Check the requested space is still free** — query `$filter=fields/Date eq '{date}' and fields/Space eq {space}`. If taken: return `{ error: 'taken', bookedBy }` — `ui.js` shows inline message "Just taken by [name] — try the other space."
3. **POST new list item** to Graph with `{ Date: date, Space: space, BookedBy: displayName, BookedByEmail: email }`.

**`cancelBooking(listItemId)`**

Sends `DELETE` to Graph for the given list item ID. The cancel button is only rendered in `ui.js` where `bookedByEmail` matches the logged-in user's email, so this is user-initiated only.

**No optimistic UI.** The grid re-fetches from SharePoint after every book/cancel to guarantee displayed state matches the source of truth.

---

## UI

### Week View

- **Layout:** Day Cards — days displayed as rows (Mon–Fri), each row showing Space 1 and Space 2 side by side as card panels.
- **Navigation:** Prev/Next week arrows. Prev is disabled when already at the current week. Forward navigation limited to **current week + 3 more weeks** (rolling 4-week window).
- **Mobile-first:** Vertical scrolling, no horizontal scroll required. Cards stack cleanly in Teams tab on both desktop and mobile.

### Cell States

| State | Appearance | Action |
|-------|-----------|--------|
| Free | Amber — "Free ✚" | Click to book immediately (no confirmation dialog) |
| Booked by current user | Green — "You ✕" | Click ✕ to cancel |
| Booked by someone else | Red — name only | No action |
| Today (free or bookable) | Normal state — bookable if free | Today's date **is** bookable. "Past" means `date < today` (i.e. yesterday and earlier). |
| Past date (`date < today`) | Greyed out | No action — non-interactive |

### Booking Rules (enforced in `api.js`)

- No double-booking a space (checked at write time — step 2 of `bookSpace`)
- No user booking both spaces on the same day (checked at write time — step 1 of `bookSpace`)
- No booking past dates (enforced in `ui.js` — cells where `date < today` are rendered non-interactive and greyed out)

### Error Handling

- Race condition (space taken between render and click): inline message in the cell — "Just taken by [name] — try the other space"
- User already has a booking that day: inline message — "You already have a space booked this day"
- Network/Graph error: brief error banner at top of the week view, grid state preserved
- Silent token acquisition failure: falls back to `acquireTokenRedirect()` automatically

---

## Deployment

### `staticwebapp.config.json`

- Entra ID configured as the identity provider (built-in SWA auth)
- All routes require `authenticated` role
- SPA fallback: all routes serve `index.html`

### GitHub Actions (`deploy.yml`)

Triggers on push to `main`:
1. Checkout repo
2. Deploy via `Azure/static-web-apps-deploy` action
3. Deployment token stored as `AZURE_STATIC_WEB_APPS_API_TOKEN` repo secret

No build step — static files deployed as-is.

### Teams Tab

Embedded as a personal tab pointing at the Azure SWA URL. No Teams JS SDK required. SWA does not set `X-Frame-Options: DENY` so the app loads correctly in the Teams iframe. Login is handled by SWA platform auth (a browser redirect before the iframe renders), not by MSAL within the iframe, which avoids compatibility issues on Teams desktop and web clients.

### `.gitignore`

Excludes `.superpowers/` and any local config overrides.

---

## Out of Scope

- Recurring bookings
- Admin roles or management views
- Waitlist
- Email notifications
- Booking both spaces on the same day (prevented, not supported)
- Infrastructure provisioning (Azure App Registration, SharePoint List setup, SWA resource, Teams app manifest) — separate follow-on step

---

## Open Configuration Values (placeholders until infrastructure provisioned)

| Value | `config.js` key | Notes |
|-------|----------------|-------|
| Azure Tenant ID | `TENANT_ID` | From Azure Active Directory |
| Azure App Registration Client ID | `CLIENT_ID` | From App Registration overview |
| SharePoint Site URL | `SHAREPOINT_SITE_URL` | Full URL of the SharePoint site |
| SharePoint List ID | `LIST_ID` | GUID from List settings |
| SharePoint List internal column names | N/A | Verify at provisioning time — display names may differ from internal names used in Graph OData filters |

## Provisioning Prerequisites

Before the app can be deployed and used:

1. Azure App Registration created with `Sites.ReadWrite.All` delegated permission
2. Tenant admin consent granted for `Sites.ReadWrite.All`
3. SWA redirect URIs registered in the App Registration
4. SharePoint List created with the schema above
5. Internal column names confirmed and updated in `api.js` filter strings. Also confirm the `Space` column is created as **Number** type (not Text) — if it is Text, the unquoted OData filter `fields/Space eq 1` will silently return no results.
6. `config.js` values populated with real IDs/URLs
7. `AZURE_STATIC_WEB_APPS_API_TOKEN` secret added to the GitHub repo
