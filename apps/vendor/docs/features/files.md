# Files

**Last updated:** 2026-09-28 — **Feature:** `src/features/files/`

## Overview

The Files library (`/content/files`) provides shop asset management (images, PDFs, videos) in list or grid view with multi-type filtering, search, and header sorting. File creation supports direct device upload or server-side download via URL (`POST /attachments/from-url`).

Clicking an image opens the full-screen editor route (`/content/files/[fileId]`) featuring two workspaces:
- **Edit:** Standard photo adjustments (crop, resize, draw, focal point).
- **AI Studio (`?tab=ai`):** Multi-shot AI enhancement suite generating studio shots, cutouts, catalog squares, and social layouts with node-based review.

Non-image files open a detail sheet (`?file=<id>`) for metadata edits, link copying, and usage tracking.

## Screens / routes

| Route | Purpose |
|-------|---------|
| `/content/files` | Library list/grid view (`FilesPage`) |
| `/content/files?file=<id>` | Non-image detail sheet (`FileDetailSheet`) |
| `/content/files/[fileId]` | Full-screen image editor & AI Studio (`FileViewPage`) |
| `/content/files/studio` | Standalone AI Studio doorway without preselected file (`AiStudioPage`) |
| `/content/files/studio?ids=a&ids=b` | Batch AI Studio processing up to 20 images (`EnhanceBatchStudio`) |
| `?run=<runId>` | Restores run review canvas and resumes polling if active |

## Diagram

```mermaid
flowchart TD
    P[FilesPage] --> T[FilesToolbar / FilesBulkBar]
    P --> V{view}
    V -- list --> L[FilesListView]
    V -- grid --> G[FilesGrid]
    L -- click image --> F[route /content/files/:fileId]
    L -- click other --> D[FileDetailSheet (?file=id)]
    P -- AI Studio --> Z[route /content/files/studio]
    F --> E[FilesImageEditor]
    E -- AI Studio --> S[EnhanceStudioControls]
    S -- run shots --> N[useEnhanceFile -> enhanceImageShots]
    N --> C[EnhanceCanvas (node graph)]
    C -- compare --> W[EnhanceCompare]
```

## Components

- **`FilesPage`:** Orchestrates URL filter state, upload triggers, selection, and routing.
- **`FilesToolbar`:** Type view tabs (All / Images / Videos / PDFs), compact search, list/grid toggle — same chrome as the other vendor lists.
- **`FileViewPage`:** Resolves target asset via `GET_FILE`, synchronizes `?tab=ai` workspace parameter, and wraps editor.
- **`AiStudioPage` & `AiStudioSourcePicker`:** Source selection (upload, library, or URL) transitioning to active file view.
- **`FilesListView` & `FilesGrid`:** Displays asset records with type icons, dimensions, and quick hover actions (Enhance, Replace, Copy link).
- **`EnhanceStudioControls`:** AI configuration panel: shot selection, styles, backdrops, aspect ratios, social designs, the caption field, 3D lighting trackball, and live quota/cost calculation. Every block that drives only some outputs is nested under Outputs, rendered only while a picked shot consumes it, and captioned with the outputs it applies to (driven by the registry flags `uses_style_options`, `honours_lighting`, `accepts_caption`).
- **`EnhancePresetBar`:** Saved configuration chips for quick shot/style application.
- **`EnhanceCanvas`:** Interactive node-graph canvas visualizing original image and derivative generations with status and re-roll triggers.
- **`EnhanceCompare`:** Side-by-side / split-screen comparison slider for enhanced photos.
- **`FileDetailSheet`:** Metadata editor (alt text, title) with save bar integration.

## State & forms

- Browse state (`types`, `search`, `sort`, `page`) lives in the URL via `parseFilesListQueryState`.
- AI runs are tracked via `?run=<runId>` allowing state restoration across reloads. A restored node re-rolls on its own recorded `params.enhance` options and `params.caption` (read by `recordedCaption`), including "no caption".
- The caption is panel state, not preset state: `onSubmit` carries it as its fifth argument (only while a picked output `accepts_caption`), the hosts forward the whole run to `useEnhanceFile().enhance`, and presets never store it.
- Bulk selections are managed in local `Set<string>` state.
- Metadata updates stage through the global save bar.

## GraphQL & REST operations

| Operation | Type | Purpose |
|-----------|------|---------|
| `GET_FILES` (`attachments`) | Query | Paginated asset list with faceted filters. |
| `GET_FILE` (`attachment`) | Query | Single asset query by ID. |
| `UPDATE_FILE` / `DELETE_FILES` | Mutation | Metadata updates and single/bulk deletion. |
| `ENHANCE_IMAGE_SHOTS` | Mutation | Submits multi-shot generation request with idempotency key, plus the optional run-level `caption`. |
| `GET_ENHANCE_STYLES` | Query | Retrieves style presets, shot catalog (incl. `accepts_caption`), and quota limits. |
| `GET_ENHANCE_RUN` / `GET_ENHANCE_RUNS` | Query | Restores active or past generation runs. |
| `GET_ENHANCE_PRESETS` / `SAVE_ENHANCE_PRESET` | Query / Mutation | Manages stored generation presets. |
| `POST /attachments` / `POST /attachments/from-url` | REST | Multipart upload and URL ingestion endpoints. |

## Key rules

- **Non-destructive generation:** AI outputs create new library attachments rather than overwriting source files.
- **Custom scene limit:** Custom prompts are capped at 500 characters and server-moderated.
- **Caption:** one line (Arabic or English, `dir="auto"`, max 280 characters, trimmed) that the server draws onto the finished image of every picked shot flagged `accepts_caption` — today the social post, in the band its layout keeps clear at the top. The catalogue photo stays unlettered because marketplaces reject overlaid text. It is moderated server-side before any spend; a refusal (`AI_IMAGE_PROMPT_REJECTED` on field `caption`) shows `aiStudio.run.captionRejected` rather than the generic safety-filter copy.
- **WebGL resource management:** 3D lighting controls dynamically mount WebGL contexts with 2D canvas fallback.
- **Language:** the library reads `files.*` (en + ar) — errors from `files.errors`, the studio source flow from `files.studioSource`, the grid from `files.grid` — and the AI Studio reads `aiStudio.*`. The shared uploader (`src/shared/lib/upload/use-attachment-upload.ts`) words its own errors from `upload.*` and sends `Accept-Language` (the page's `<html lang>`) on `POST /attachments`, as do the from-URL upload, the replace-file call and the Sidekick's chat upload, so the API's own error message comes back in the merchant's language.
