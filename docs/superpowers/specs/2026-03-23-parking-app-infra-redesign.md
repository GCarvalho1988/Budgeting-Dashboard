# Parking App — Infrastructure Redesign Spec

**Date:** 2026-03-23
**Project:** LeedsParkingArea
**Status:** Draft

---

## Overview

Replace the Azure SWA + MSAL + Microsoft Graph stack with GitHub Pages hosting, Power Automate HTTP flows as the backend, and a localStorage-based identity system. The booking UI (style, grid, booking cells) is entirely unchanged.

---

## Motivation

The original design required an Azure App Registration (Entra ID admin consent) and an Azure Static Web Apps resource, both of which require IT admin permissions that are not available. This redesign achieves the same functional result using tools already accessible to the app owner: GitHub Pages (free, already in use) and Power Automate (already licensed).

---

## Architecture

| Layer | Before | After |
|-------|--------|-------|
| Hosting | Azure Static Web Apps | GitHub Pages |
| Authentication | MSAL.js / Entra ID | None |
| Identity | Entra ID account | Name stored in `localStorage` |
| Data API | Microsoft Graph (SharePoint) | Power Automate HTTP flows |
| Employee list | N/A | Teams site membership (via PA flow) |

---

## Hosting: GitHub Pages

- Enabled via repo Settings → Pages → Source: main branch, root folder
- A `.nojekyll` file is added to the repo root to prevent Jekyll from interfering with ES module imports
- App URL: `https://gcarvalho1988.github.io/LeedsParkingApp` (GitHub repo name is `LeedsParkingApp`; local folder is `LeedsParkingArea`)
- `staticwebapp.config.json` and `.github/workflows/deploy.yml` are deleted — no longer needed
- Future deploys: `git push` to `main` automatically updates the live app via GitHub Pages

---

## Identity

### First visit
An overlay is shown before the booking grid renders. It contains:
- A dropdown populated from the `PA-GetEmployees` flow (Leeds Office Teams site members, sorted alphabetically)
- An **"Other…"** option at the bottom of the dropdown. Selecting it reveals a free-text input for typing a visitor or external employee name
- A **"Let's go"** button — disabled until a non-empty, non-whitespace name is selected or typed. On click: trims the value, calls `setName()`, hides overlay, calls `render()`

### Returning visits
`localStorage` is checked on load. If `parkingUserName` is set, the overlay is skipped and the grid renders immediately.

### "Not you?" link
Displayed in the week navigator bar alongside the week range label. Clicking it clears `parkingUserName` from `localStorage` and re-renders the identity overlay. Allows correcting a wrong selection or switching for a shared/guest device.

### Cell display
All booking cells display the booker's actual name (no "You" shorthand). The green `cell-mine` state still distinguishes the current user's bookings from others, but the text always shows the real name (e.g. "Guilherme ✕" rather than "You ✕"). This makes it easy to spot if the wrong identity was saved.

The "mine" check: `booking.bookedBy === getName()`.

### Known limitation: name uniqueness
The duplicate-booking check in `PA-BookSpace` uses the display name as the user identifier. If two people share an identical display name, the second person would be prevented from booking on a day the first has already booked. This is acceptable for a small office team where the admin controls the names list.

---

## Data: SharePoint

### Lists

**`ParkingBookings`** (one list, same SharePoint site as the Leeds Office Teams team)

| Column | Type | Notes |
|--------|------|-------|
| `Date` | Date | The booked date |
| `Space` | Number | 1 or 2 |
| `BookedBy` | Text | Booker's display name |

`BookedByEmail` is removed — email was only needed for MSAL identity matching, which no longer applies.

No `ParkingEmployees` list is needed. The employee dropdown is sourced from Leeds Office Teams site membership via Power Automate.

---

## Power Automate Flows

Four flows, each with a **"When an HTTP request is received"** trigger and **no authentication** (security by obscurity — the long GUID URLs are not published). Flow URLs are pasted into `config.js` after creation.

**Security note:** There is no server-side ownership check on `PA-CancelBooking` — any caller who knows the flow URL and a valid item ID can delete a booking. Ownership is enforced client-side only (the cancel button is only rendered on the current user's bookings). This is an accepted trade-off given the non-sensitive nature of the data.

### PA-GetEmployees

**Trigger:** HTTP GET (no inputs)

**Steps:**
1. List members of the Leeds Office Teams team
2. Extract `displayName` for each member
3. Sort alphabetically
4. Respond with HTTP 200:
```json
["Alice Smith", "Bob Jones", "Guilherme Carvalho"]
```

### PA-GetBookings

**Trigger:** HTTP GET

**Query parameters:** `start` (YYYY-MM-DD), `end` (YYYY-MM-DD)

**Steps:**
1. Get items from `ParkingBookings` where `Date >= start` and `Date <= end`
2. Respond with HTTP 200:
```json
[
  { "id": "42", "date": "2026-03-24", "space": 1, "bookedBy": "Guilherme Carvalho" }
]
```

### PA-BookSpace

**Trigger:** HTTP POST

**Request body:**
```json
{ "date": "2026-03-24", "space": 1, "name": "Guilherme Carvalho" }
```

**Steps:**
1. Query `ParkingBookings` for any item where `Date = date` and `BookedBy = name`. If found → respond `{ "error": "alreadyBooked" }`
2. Query `ParkingBookings` for any item where `Date = date` and `Space = space`. If found → respond `{ "error": "taken", "bookedBy": "<name>" }`
3. Create new item: `{ Date: date, Space: space, BookedBy: name }`
4. Respond with HTTP 200: `{ "success": true }`

### PA-CancelBooking

**Trigger:** HTTP POST

**Request body:**
```json
{ "id": "42" }
```

**Steps:**
1. Delete item with ID `id` from `ParkingBookings`
2. Respond with HTTP 200: `{ "success": true }`

---

## File Changes

### Deleted
- `auth.js` — MSAL wrapper no longer needed
- `staticwebapp.config.json` — SWA auth config no longer needed
- `.github/workflows/deploy.yml` — SWA deploy workflow no longer needed

### Added
- `.nojekyll` — empty file, prevents GitHub Pages Jekyll processing
- `identity.js` — replaces `auth.js`; manages `localStorage` identity

### Modified
- `config.js` — replaces Azure/SharePoint constants with 4 Power Automate flow URLs
- `api.js` — replaces Graph API calls with `fetch` calls to PA flow URLs; `bookSpace` signature changes from `(date, space, displayName, email)` to `(date, space, name)`
- `app.js` — removes MSAL bootstrap; checks identity then calls `render()`
- `index.html` — removes MSAL CDN script tag
- `style.css` — adds styles for identity overlay (backdrop, dropdown, text input, button) and "Not you?" link
- `ui.js` — identity overlay (first-visit name picker); "Not you?" link in nav; cell text shows real name; `_renderGrid` and `_handleBook` replace `getAccount()` calls with `getName()`; import changes from `auth.js` to `identity.js`

### Unchanged
- `dates.js`

---

## `identity.js`

Single responsibility: read and write the user's display name from `localStorage`.

```js
const KEY = 'parkingUserName';
export const getName = () => localStorage.getItem(KEY);
export const setName = (name) => localStorage.setItem(KEY, name);
export const clearName = () => localStorage.removeItem(KEY);
```

---

## `config.js`

```js
export const FLOW_GET_EMPLOYEES  = 'YOUR_PA_GET_EMPLOYEES_URL';
export const FLOW_GET_BOOKINGS   = 'YOUR_PA_GET_BOOKINGS_URL';
export const FLOW_BOOK_SPACE     = 'YOUR_PA_BOOK_SPACE_URL';
export const FLOW_CANCEL_BOOKING = 'YOUR_PA_CANCEL_BOOKING_URL';
```

---

## `api.js` updated signatures

- `getEmployees()` — **new**; returns `string[]` of display names
- `getBookingsForWeek(startDate, endDate)` — returns `[{ id, date, space, bookedBy }]` (unchanged shape, `bookedByEmail` removed)
- `bookSpace(date, space, name)` — **changed from** `(date, space, displayName, email)`; returns `{ success } | { error: 'alreadyBooked' } | { error: 'taken', bookedBy }`
- `cancelBooking(id)` — returns `{ success: true }` (previously returned void)

---

## `app.js` bootstrap

```
1. getName() — check localStorage
2. If no name: render identity overlay (in ui.js), wait for selection
3. Once name is set: call render()
```

No MSAL, no redirect handling, no token acquisition.

---

## `ui.js` changes

### Identity overlay
Shown when `getName()` returns null. Full-card overlay with:
- Heading: "Who are you?"
- Dropdown populated by `getEmployees()`; last item is "Other…"
- Text input (hidden until "Other…" selected)
- "Let's go" button — disabled until a non-empty name is resolved; on click calls `setName(trimmed value)`, hides overlay, calls `render()`
- Error state if `getEmployees()` fails: message + retry button

### Week navigator
Adds a **"Not you? [name]"** link (small, muted) to the right of the week label. Clicking it calls `clearName()` and re-shows the identity overlay.

### `_renderGrid`
Replaces `getAccount()` / `userEmail` with `getName()`. The "mine" check becomes `booking.bookedBy === getName()`.

### `_handleBook`
Replaces `getAccount()` call — passes `getName()` as the `name` argument to `bookSpace(date, space, getName())`.

### `_buildCell` — mine state
`stateEl.textContent` is set to `` `${getName()} ✕` `` (the stored name) instead of `'You ✕'`.

### Import change
`import { getAccount } from './auth.js'` → `import { getName } from './identity.js'`

---

## Error Handling

- **PA flow unreachable:** existing error banner behaviour unchanged — "Could not load bookings. Check your connection and try again."
- **`getEmployees()` fails:** overlay shows an error message with a retry button
- **`bookSpace` returns `alreadyBooked` or `taken`:** existing inline cell message behaviour unchanged

---

## Tests

`api.js` and `identity.js` are unit-testable with Jest (mock `fetch` and `localStorage`). `tests/api.test.js` must be rewritten to reflect the new `fetch`-based implementation and the updated `bookSpace(date, space, name)` signature. `dates.js` tests are unaffected. There are no `auth.js` tests to delete.

---

## Out of Scope

- Any change to the booking UI visual design
- Admin UI for managing the employee list (Teams site membership is the admin interface)
- Booking on behalf of another person
- Server-side authentication on the PA flow URLs
