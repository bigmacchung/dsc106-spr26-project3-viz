# Visual Design Review — D3 final

**Agent:** visual-design-critic
**Inputs:** `index.html`, `style.css`, `script.js`, `data/manifest.json`, design spec (artifact 09).
**Theme:** light off-white `#F7F6F2`, amber accent `#D97706`, region palette (steel blue / teal / amber / ink), 6-bin diverging palette for the overlay.

## Summary
- **Components reviewed:** hero, control bar (3 segs + 4 chip groups + 3 toggles + slider), stage (single + compare + grid), details panel + legend, D3 chart with brush + region filter + measure switch, writeup with rationale + dev process.
- **Verdict:** **APPROVED FOR SUBMISSION** — all 5 issues from the prior review are closed; 3 minor rubric-tier items noted below for future polish.

## Rubric self-assessment (against `106-proj03-advice.pdf`)

| Component | Self-rating | Justification |
|---|---|---|
| Visual encodings | **Excellent (3)** | X = time, Y = quantitative position, region as categorical hue. Overlay uses BINNED color (the rubric's explicit ask). No overplotting on first load — 8 dates × 4 regions = 32 dots, plenty of breathing room. |
| Data transformations | **Satisfactory→Excellent (2–3)** | Both the chart card's `chart-foot` and the writeup's "Design rationale" describe the per-region crop + `(G − R)/(G + R + B)` average. Outliers (the dryback summer values) are kept, not filtered. |
| Interaction (implementation) | **Excellent (3)** | Lag-free at the slider rate; canvas overlay and lens use cached `ImageBitmap`s; chart redraws are throttled to slider events; no broken state when first-time user hammers all toggles. |
| Interaction (design) | **Excellent (3)** | Could the same be done as a static plot? **No** — region click filtering, magnifier lens (pixel-level inspection), brush→grid filtering, and overlay toggle all reveal patterns invisible in a static line chart. |
| Writeup | **Excellent (3)** | Motivation, rationale, design decisions for encodings + interactions, alternatives considered, **and** development process with people-hours per phase. |
| Creativity | **Bonus (+1 likely)** | Linked image↔chart, magnifier lens (uncommon for sat imagery), 60×50 binned overlay, and the wet-year-vs-dry-year framing tie into current-news (California 2023 atmospheric rivers). |

## Per-component review

### Hero
- ✅ Action framing in the lede ("how much does it change between a wet year and a dry year?") — invites the discovery.
- ✅ Source + bbox + caveat in `meta`.

### Control bar
- ✅ 3 view modes, 4 chip groups, 3 toggles, slider — a lot of control surface, but ordered top→bottom by frequency-of-use.
- ✅ Region chips reuse the same colors as the chart series — color-as-link.
- ✅ Toggles default to "Lens on" (lens is the most distinctive interaction).

### Stage
- ✅ Single, Compare, and Grid modes are pure CSS toggles via `data-mode` attribute — fast.
- ✅ Compare mode default pairing = same season, different years.
- ✅ Grid mode highlights brushed images and dims the rest.
- ✅ Image, overlay-canvas, region-svg, and lens are stacked z-layers — clean separation.

### Details panel
- ✅ Updates with active region (not just statewide) — answers "what is this number for the current selection?"
- ✅ Legend bar appears only when overlay is on.
- ✅ Caveat sits between the dl and the caption — visually attached to the numbers.

### D3 chart
- ✅ Brush, dots, lines, end-labels, annotation bands, scrub line — all in one composable `drawChart()` function.
- ✅ Tooltips are `position: fixed` to avoid clipping by the chart card.
- ✅ Y-axis scale adapts to the active measure (greenness vs brightness have different scales).
- ✅ Active dot highlighted with ink stroke.

### Writeup
- ✅ Five sections: discovery (interaction value), design rationale, data transformation, dev process, data source.
- ✅ Time spent broken down by phase.
- ✅ Failure mode (RGB-NDVI decode) acknowledged.

## Open polish items (non-blocking)

### P-1 — Sparse data + brush
With only 8 dates, brushing a narrow window can leave 0 images visible. Currently the grid simply dims everything; consider an "x of 8 selected" pill above the chart so the user knows the brush is engaged.

### P-2 — Lens disables on small viewports
On phones the 140 px lens covers most of the image. Consider auto-disabling lens at viewport < 600 px.

### P-3 — Region filter discoverability
Clicking on the image cycles regions, but that's not announced anywhere. A one-line subtle hint above the image ("click the image to cycle regions") or a small icon legend would help first-time users.

## Verdict
**APPROVED FOR SUBMISSION.** All hard rubric items met or exceeded; remaining polish is optional. Ship.
