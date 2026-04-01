# M2L Content Engine — Image Support Design

**Date:** 2026-04-01  
**Status:** Approved

## Overview

Add the ability to associate a local image with each post in the M2L content planner. The image reference is stored in draft frontmatter so that when Claude drafts post copy, it can view the planned image and write text that complements it.

## Data & Storage

- New folder: `m2l-content-engine/content/images/` — holds all post images, tracked in git alongside drafts
- Draft frontmatter gains an optional `image` field containing a relative path from the content root:
  ```yaml
  image: images/week-02-fred-whitton.jpg
  ```
- All existing drafts without an `image` field continue to work unchanged
- Images are stable-path — once saved to `content/images/`, they don't move

## Server API

Two new endpoints added to `server/index.js`:

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/images` | `POST` | Accepts multipart file upload, saves to `content/images/`, returns `{ path: "images/<filename>" }` |
| `/api/images/:filename` | `GET` | Serves the image file for UI preview |

No changes to existing endpoints. The draft `PUT` endpoint already persists whatever is in the draft object, so the `image` field is saved automatically once present.

## UI — DetailPanel

An image section is added to `DetailPanel.jsx`, positioned between the metadata chips and the body textarea:

- **No image set:** shows an "Add image" button
- **Image set:** shows a thumbnail preview and an "×" remove button
- Clicking "Add image" opens a native file picker (filtered to image types). On selection, the file is uploaded via `POST /api/images`; the returned path is written to the draft and saved immediately
- Clicking "×" clears the `image` field from the draft and saves

No changes to `PostCard` or any other component — the image association is a drafting-time concern, not a list-level concern.

## Claude Drafting Workflow

No code changes. Usage:

1. Associate the planned image via the file picker in the planner
2. Ask Claude to draft the post, pointing it at the markdown file
3. Claude reads the frontmatter, sees `image: images/<filename>`, opens and views the file, and writes copy that references or complements the photo

The `image` field signals to Claude that a specific visual is planned for this post — not just a filename hint, but content Claude will actually read.

## Out of Scope

- Image display in the PostCard list view
- Multiple images per post
- Remote image URLs
- Image resizing or processing
