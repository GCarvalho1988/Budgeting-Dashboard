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

- **Provider:** Microsoft Entra ID via MSAL.js (CDN)
- **Flow:** Redirect (not popup — Teams can block popups)
- **SWA platform auth:** `staticwebapp.config.json` configured to require Entra ID authentication at the platform level. Unauthenticated requests are redirected to login before the app loads.
- **Token acquisition:** Silent token request on each Graph call; MSAL handles refresh automatically.
- **User identity:** `displayName` and `email` read from the MSAL account object — no extra Graph profile call needed.
- **Graph scope required:** `Sites.ReadWrite.All`

---

## Data

### SharePoint List Schema

| Column | Type | Notes |
|--------|------|-------|
| `Date` | Date | The booked date |
| `Space` | Number | 1 or 2 |
| `BookedBy` | Text | User's display name |
| `BookedByEmail` | Text | User's email address |

### API Operations (`api.js`)

**`getBookingsForWeek(startDate, endDate)`**
Single Graph call with `$filter` on Date column. Returns array of booking objects for the displayed week. Called on every week navigation and after every book/cancel.

**`bookSpace(date, space, displayName, email)`**
1. Re-fetches that specific date+space to confirm it's still free (race condition guard).
2. If already booked: returns `{ error: 'taken', bookedBy }` — `ui.js` shows inline message.
3. If free: POSTs new list item to Graph.
4. Enforces one booking per user per day: checks user has no existing booking on that date before writing.

**`cancelBooking(listItemId)`**
Sends DELETE to Graph for the given list item ID. The cancel button is only rendered where `bookedByEmail` matches the logged-in user's email.

**No optimistic UI.** The grid re-fetches after every book/cancel to guarantee displayed state matches SharePoint.

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
| Past date | Greyed out | No action |

### Booking Rules (enforced in `api.js`)

- No double-booking a space (checked at write time)
- No user booking both spaces on the same day (checked at write time)
- No booking past dates (enforced in `ui.js` — past date cells are non-interactive)

### Error Handling

- Race condition (space taken between render and click): inline message in the cell — "Just taken by [name]"
- Network/Graph error: brief error banner at top of the week view, grid state preserved
- Auth failure: MSAL redirect flow re-triggered automatically

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

Embedded as a personal tab pointing at the Azure SWA URL. No Teams JS SDK required. The app is iframe-compatible by default (Azure SWA does not set `X-Frame-Options: DENY`).

### `.gitignore`

Excludes `.superpowers/` and any local config overrides.

---

## Out of Scope

- Recurring bookings
- Admin roles or management views
- Waitlist
- Email notifications
- Booking both spaces (prevented, not supported)
- Infrastructure provisioning (Azure App Registration, SharePoint List setup) — separate follow-on step

---

## Open Configuration Values (placeholders until infrastructure provisioned)

| Value | `config.js` key |
|-------|----------------|
| Azure Tenant ID | `TENANT_ID` |
| Azure App Registration Client ID | `CLIENT_ID` |
| SharePoint Site URL | `SHAREPOINT_SITE_URL` |
| SharePoint List ID | `LIST_ID` |
