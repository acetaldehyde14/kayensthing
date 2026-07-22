# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

Kayen is a smart handwriting analysis app: the user scans a sample of their handwriting (camera capture or upload) and the app analyzes it to reveal their personality — which of 5 archetypes they are, their traits, emotional tone, and writing characteristics, presented as a shareable result card. Analysis is served by a Netlify Function (see Backend below), deployed alongside the frontend on Netlify.

## Repository state

The app is set up for a Vite build + Netlify deploy: `index.html` + `src/main.jsx` mount `HandwritingAnalysisApp.jsx` (still the single self-contained component with all screens/logic/styles — that file itself is untouched by the build scaffolding). `package.json`/`vite.config.js` drive `npm run dev`/`npm run build`; `netlify.toml` points Netlify at the `dist` build output and the `netlify/functions` directory.

A stale `backend/` directory (an old Flask service, see below) is left on disk but unused — the filesystem entries under it are root-owned in this environment so it couldn't be deleted programmatically. Run `sudo rm -rf backend` yourself to clean it up (via the `!` prefix in the Claude Code prompt, or your own terminal); nothing in the build references it anymore.

The `.vscode/mcp.json` config wires up the Figma MCP server (`https://mcp.figma.com/mcp`). The source-of-truth design file is **ILAB (Copy) (Copy)**, fileKey `l600l8ZhKnpdxZMfk6GYc2` (https://www.figma.com/design/l600l8ZhKnpdxZMfk6GYc2/ILAB--Copy---Copy-). Its "Page 1" canvas has one frame per screen: Start (`2:49`), Scan (`2:2`), Loading (`2:4`), and one result frame per archetype (Sketcher `66:6`, Keeper `68:128`, Encourager `73:189`, Thinker `73:246`, Connector `78:303` — plus an old unused "IGNORE" variant `2:61`). No Figma variables are bound in this file (`get_variable_defs` returns `{}`); every color is a raw hex value in the generated code.

`images/<personality-id>/personality.png` holds each archetype's mascot art (pulled from the Figma frames' `removalai_preview` image nodes) and is loaded live by the result screen (mascot header + "Letter Besties" thumbnails). `sample/` holds additional reference screen mockups + CSS, not code the app loads.

### Design tokens (from Figma, applied in `HandwritingAnalysisApp.jsx`)

Contrary to the original ad-hoc prototype styling, the real design uses **one fixed palette across all 5 personality cards** — only the outer screen background changes per archetype:
- `CARD_BG` `#FDF3CC` — every card background, regardless of personality
- `BAR_BG` `#0E0E0D` / `BAR_TEXT` white — every section-header bar (Strengths, Personality Traits, etc.)
- `ACCENT` `#876124` — tag chips, the percent stat, and the radar chart
- `TEXT_DARK` `#000000` — body copy and headline text
- `SCREEN_BG` `#FBF3EF` — Start/Scan/Loading screen background; CTA orange `#FF4D00` was already correct
- Per-personality `bg` (more saturated than the original guesses): Sketcher `#F9D143`, Keeper `#62BAFC`, Encourager `#73D5A6`, Thinker `#DB93F2`, Connector `#FA73AD`

Only two font families appear anywhere in the design (the prototype had guessed three — Baloo 2, Press Start 2P, Nunito — none of which are actually used):
- **Pixelify Sans** (weight 600/700) — all display type: titles, buttons, "The {Name}" headline, the percent number, and every section-header bar
- **Anonymous Pro** (weight 700) — all body copy: "You are...", tags, trait labels, and the three paragraph blocks

The absolute pixel layout in Figma (each frame is an 834×1194+ iPad-sized canvas) was not replicated 1:1 — only tokens (color/font) and content-level fixes (mascot art, "Letter Besties" now showing the two other archetypes' real mascot thumbnails instead of colored initials) were pulled in. Re-fetch via `get_design_context`/`get_variable_defs` with the fileKey/nodeIds above if a future pixel-accurate layout pass is wanted.

## Backend

Analysis is served by two Netlify Functions (Node, using the native fetch `Request`/`Response` API — no bundler-side dependencies):
- `netlify/functions/analyze.mjs` — routed to `POST /api/analyze` via `export const config = { path: "/api/analyze" }`. Parses the multipart `image` field with `req.formData()`, validates it's non-empty and under `MAX_IMAGE_BYTES` (8MB), then `random.choice()`-equivalent picks an archetype and returns its canned trait vector. This is a straight port of the old `backend/app.py` placeholder behavior (see below) — still a placeholder, not real analysis.
- `netlify/functions/health.mjs` — routed to `GET /api/health`, returns `{ status: "ok" }`.

`PERSONALITY_VALUES` in `analyze.mjs` is a hardcoded copy of `PERSONALITIES[].values` from the frontend (5 archetypes × 6 trait numbers) — keep the two in sync by hand if trait values change.

The frontend's `API_BASE_URL` constant near the top of `HandwritingAnalysisApp.jsx` is now `""` (same-origin) since `netlify dev`/Netlify prod both route `/api/*` to these functions directly via each function's `config.path` — no separate host/port needed.

**Old Flask backend (superseded, not deleted)**: `backend/` previously held a Flask service (`app.py`) exposing the same two routes, plus a disabled-but-present real analysis pipeline (`handwriting_analysis.py`'s pixel-heuristic `extract_image_features()`/`match_personality()`, and `ocr_client.py`'s PaddleOCR integration). It's no longer referenced by the build or the frontend. The directory ended up root-owned in this environment and couldn't be removed programmatically — run `sudo rm -rf backend` to clean it up. If real (non-placeholder) analysis is wanted again, port that same logic into `analyze.mjs` rather than reviving the Flask app.

## Frontend architecture

`HandwritingAnalysisApp.jsx` exports a single default component implementing a 4-screen mobile-card-style flow, driven by one `screen` state value: `start -> scan -> loading -> result`. There is no router — screens are conditionally rendered `<div>` blocks inside one component, and all styling is inline JS style objects (no CSS files/modules).

Key pieces:
- `PERSONALITIES`: a hardcoded array of 5 personality archetypes (Sketcher, Keeper, Encourager, Thinker, Connector), each with a per-archetype `bg`, a radar-chart `values` fallback, and canned copy (`personalityText`, `emotionalTone`, `writingCharacteristics`). `values` is now 6 numbers matching `STRENGTH_LABELS` 1:1 (`["Attention to detail", "Observation Skills", "Intuition", "Organisation", "Time Management", "Analytical Thinking"]`, clockwise from top — pulled from the actual axis labels in Figma's "Strengths" chart). This is **decoupled** from `backend/handwriting_analysis.py`'s `PERSONALITY_VECTORS` (5-dim, pixel-heuristic semantics `[pressure, size, slant, spacing, consistency]`) — the two no longer need to match dimension-for-dimension; if real backend analysis is ever re-enabled, its `traitValues` response just needs to be 6 numbers in the `STRENGTH_LABELS` order to render correctly. Card/bar/tag colors are no longer per-archetype fields (see Design tokens above) — they're the shared `CARD_BG`/`BAR_BG`/`ACCENT` constants.
- `radarPoint()`/`radarPoints()`/`pointsToPolygon()`: map N trait values (0-1) onto an N-point radar polygon (currently N=6, a hexagon) around `(CHART_CX, CHART_CY)` with radius `CHART_R`. Used for the faint background grid (`GRID`), the filled data polygon, the spoke lines, and — via `LABEL_POINTS` (radius 1.5×) — the `STRENGTH_LABELS` text position around the chart (top/bottom labels centered, side labels wrapped to 2 lines and anchored start/end based on which side of center they fall on). The result screen prefers the Netlify Function's per-user `liveAnalysis.traitValues` over the archetype's canned `values` when available.
- Camera flow (`openCamera`/`closeCamera`/`capturePhoto`/`retakePhoto`): uses `navigator.mediaDevices.getUserMedia` + a hidden `<canvas>` to capture a still frame from `<video>` into a data URL (`capturedPhoto`). Stream tracks are stopped on capture, retake, close, and unmount (see the `useEffect` cleanup). If `getUserMedia` is unsupported or the user denies/it errors (`cameraError` state), the UI falls back to a hidden `<input type="file">` triggered via `triggerFileUpload()`/`handleFileChange()` — same `capturedPhoto` data-URL path either way.
- `startLoading()`: converts `capturedPhoto` to a `Blob` (`dataUrlToBlob`) and POSTs it to `${API_BASE_URL}/api/analyze`; on success it matches the returned `personalityId` against `PERSONALITIES` and stores `traitValues`/`ocrText` in `liveAnalysis`, on failure it sets `analysisError` and returns to the `scan` screen.
- Mascot art: the header mascot and the two "Letter Besties" thumbnails all load `images/${id}/personality.png` live (the besties images being the *other* two archetypes' mascots, matching what Figma actually shows there instead of colored initials). `ImagePlaceholder` (dashed-border box) is only used now for the "Your Writing Sample" slot before a photo exists.
- Style helper functions (`barStyle`, `pixelBtn`) centralize the two recurring visual patterns (section header bars, pixel-font CTA buttons) instead of repeating inline style objects.

Fonts (`Pixelify Sans`, `Anonymous Pro` — see Design tokens above) are pulled from Google Fonts via an `@import` inside an injected `<style>` tag at the top of the component — there's no separate global stylesheet.
