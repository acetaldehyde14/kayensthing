# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

Kayen is a smart handwriting analysis app: the user scans a sample of their handwriting (camera capture or upload) and the app analyzes it to reveal their personality — which of 5 archetypes they are, their traits, emotional tone, and writing characteristics, presented as a shareable result card. The `backend/` Flask service now performs the real analysis (see Backend below); the frontend posts the captured/uploaded photo to it instead of picking randomly.

## Repository state

The frontend is still a single self-contained React component file (`HandwritingAnalysisApp.jsx`) with no package.json, bundler, test setup, or linter — there is no frontend install/build/lint/test command to run. Treat it as a design-prototype-style component, not a scaffolded app; it's expected to be dropped into a host app or served directly. There is no git history/repo initialized here.

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

`backend/` is a Flask service (`app.py`) exposing `POST /api/analyze` (multipart field `image`) and `GET /api/health`.

**Currently a placeholder**: `/api/analyze` just does `random.choice()` over `PERSONALITY_VECTORS.keys()` and returns that archetype's canned trait vector — it reads the uploaded image only far enough to validate it's non-empty and under `MAX_IMAGE_BYTES`. This was deliberately reverted from a real analysis so the frontend flow could be exercised without depending on external calls.

The real analysis pipeline still exists but is disabled/unused:
- `handwriting_analysis.py` — `extract_image_features()` is a pixel-level heuristic (ink density/pressure, size, slant via centered-pixel correlation, spacing via empty-column ratio, line-height consistency) computed directly from the image with Pillow/NumPy, and `match_personality()` cosine-scores those 5 features against each archetype's `values` vector in `PERSONALITY_VECTORS` (kept in sync with `PERSONALITIES[].values` in the frontend).
- `ocr_client.py` — submits the image to the PaddleOCR job API (`https://paddleocr.aistudio-app.com`), polls until done, and pulls recognized text out of the result JSONL. Note OCR alone was never going to drive the personality match — it reads text, not graphology traits like slant/pressure — so `extract_image_features()`/`match_personality()` was always the piece that decided the result.

To restore real analysis in `app.py`, reintroduce the `extract_image_features()` → `match_personality()` call (and optionally the `ocr_client.extract_text()` call, which fails soft via `ocrError`) in place of the `random.choice()` line.

Setup:
```
cd backend
python3 -m venv .venv && ./.venv/bin/pip install -r requirements.txt
cp .env.example .env   # then set PADDLEOCR_TOKEN
./.venv/bin/python3 app.py   # serves on :5001 (see PORT in .env)
```
`PADDLEOCR_TOKEN` must be set via `backend/.env` (gitignored) — never hardcode it back into `app.py`/`ocr_client.py`.

The frontend's `API_BASE_URL` constant near the top of `HandwritingAnalysisApp.jsx` must point at this backend (defaults to `http://localhost:5001`).

## Frontend architecture

`HandwritingAnalysisApp.jsx` exports a single default component implementing a 4-screen mobile-card-style flow, driven by one `screen` state value: `start -> scan -> loading -> result`. There is no router — screens are conditionally rendered `<div>` blocks inside one component, and all styling is inline JS style objects (no CSS files/modules).

Key pieces:
- `PERSONALITIES`: a hardcoded array of 5 personality archetypes (Sketcher, Keeper, Encourager, Thinker, Connector), each with a per-archetype `bg`, a radar-chart `values` fallback, and canned copy (`personalityText`, `emotionalTone`, `writingCharacteristics`). `values` is now 6 numbers matching `STRENGTH_LABELS` 1:1 (`["Attention to detail", "Observation Skills", "Intuition", "Organisation", "Time Management", "Analytical Thinking"]`, clockwise from top — pulled from the actual axis labels in Figma's "Strengths" chart). This is **decoupled** from `backend/handwriting_analysis.py`'s `PERSONALITY_VECTORS` (5-dim, pixel-heuristic semantics `[pressure, size, slant, spacing, consistency]`) — the two no longer need to match dimension-for-dimension; if real backend analysis is ever re-enabled, its `traitValues` response just needs to be 6 numbers in the `STRENGTH_LABELS` order to render correctly. Card/bar/tag colors are no longer per-archetype fields (see Design tokens above) — they're the shared `CARD_BG`/`BAR_BG`/`ACCENT` constants.
- `radarPoint()`/`radarPoints()`/`pointsToPolygon()`: map N trait values (0-1) onto an N-point radar polygon (currently N=6, a hexagon) around `(CHART_CX, CHART_CY)` with radius `CHART_R`. Used for the faint background grid (`GRID`), the filled data polygon, the spoke lines, and — via `LABEL_POINTS` (radius 1.5×) — the `STRENGTH_LABELS` text position around the chart (top/bottom labels centered, side labels wrapped to 2 lines and anchored start/end based on which side of center they fall on). The result screen prefers the backend's per-user `liveAnalysis.traitValues` over the archetype's canned `values` when available.
- Camera flow (`openCamera`/`closeCamera`/`capturePhoto`/`retakePhoto`): uses `navigator.mediaDevices.getUserMedia` + a hidden `<canvas>` to capture a still frame from `<video>` into a data URL (`capturedPhoto`). Stream tracks are stopped on capture, retake, close, and unmount (see the `useEffect` cleanup). If `getUserMedia` is unsupported or the user denies/it errors (`cameraError` state), the UI falls back to a hidden `<input type="file">` triggered via `triggerFileUpload()`/`handleFileChange()` — same `capturedPhoto` data-URL path either way.
- `startLoading()`: converts `capturedPhoto` to a `Blob` (`dataUrlToBlob`) and POSTs it to `${API_BASE_URL}/api/analyze`; on success it matches the returned `personalityId` against `PERSONALITIES` and stores `traitValues`/`ocrText` in `liveAnalysis`, on failure it sets `analysisError` and returns to the `scan` screen.
- Mascot art: the header mascot and the two "Letter Besties" thumbnails all load `images/${id}/personality.png` live (the besties images being the *other* two archetypes' mascots, matching what Figma actually shows there instead of colored initials). `ImagePlaceholder` (dashed-border box) is only used now for the "Your Writing Sample" slot before a photo exists.
- Style helper functions (`barStyle`, `pixelBtn`) centralize the two recurring visual patterns (section header bars, pixel-font CTA buttons) instead of repeating inline style objects.

Fonts (`Pixelify Sans`, `Anonymous Pro` — see Design tokens above) are pulled from Google Fonts via an `@import` inside an injected `<style>` tag at the top of the component — there's no separate global stylesheet.
