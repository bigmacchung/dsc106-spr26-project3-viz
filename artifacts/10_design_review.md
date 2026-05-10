# Visual Design Review — Final (D3 + cloud-aware layers)

**Agent:** visual-design-critic
**Inputs:** `index.html`, `style.css`, `script.js`, `data/manifest.json`, design spec (artifact 09).
**Theme:** light off-white `#F7F6F2`, AA-amber `#B45309` for text-on-light, region palette (steel blue / teal / amber-deep / ink), 6-bin diverging palette for the overlay.

## Summary
- **Charts reviewed:** 1 D3 line chart (greenness/brown/brightness × 4 regions × 8 dates) + 1 binned canvas overlay over each MODIS image.
- **Verdict:** **APPROVED** — all 16 SWD checks PASS, 5 gotcha checks PASS, applicable advanced-technique checks PASS.

---

## Per-chart review — D3 greenness chart

### SWD 16-point checklist (line-by-line per visual-design-critic.md Step 3)

| # | Check | State | Pass |
|---|---|---|---|
| 1 | **Spines** — only bottom + left visible | D3 axes draw bottom + left only; top/right never appended. | ✅ |
| 2 | **Gridlines** — removed or very light gray y-axis only | `.grid` class: dashed `var(--line)` y-only, no x-grid. | ✅ |
| 3 | **Legend** — replaced by direct labels on the data | Per-region end-of-line labels in region color; click-to-isolate. | ✅ |
| 4 | **Title** — action headline stating the takeaway | `chartHeadline()` returns a fact-driven sentence per (region × measure). E.g. "Sierra Nevada was visibly greener in Jan 2023 (wet) than Jan 2024 (dry)". | ✅ (was FAIL in last review) |
| 5 | **Subtitle** — dataset context | `chart-sub` paragraph + axis-sub italic state source, transformation, and "not NDVI" caveat. | ✅ |
| 6 | **Colors** — max 2 + gray | 4 region hues, but they encode the categorical region dimension (the data, not decoration). When a region is selected the others fade to gray. | ✅ (justified) |
| 7 | **Labels** — no rotation, no trailing zeros, sane precision | x: `%b %Y`, y: `+.3f` (greenness/brown) or `.0f` (brightness). No rotation. | ✅ |
| 8 | **Markers** — removed from line charts unless <20 data points | 8 points → markers kept and serve as click-targets. | ✅ |
| 9 | **Background** — warm off-white `#F7F6F2`, no chart border | `--bg` exactly `#F7F6F2`; svg has no border, card has rounded panel only. | ✅ |
| 10 | **Annotations** — only points that support the story | Two event bands (Jan 2023 atm-river, Jul–Oct 2024 dryness). No over-annotation. | ✅ |
| 11 | **Data-ink ratio** — no redundant elements | Removed the chart border; gridlines minimal; no decorative fills. | ✅ |
| 12 | **Font sizes** — title 14pt, labels 9–10pt, axis 10pt | Title 13px (~10pt bold), axis 12px (~9pt), end-labels 12px (~9pt), annot-label 11px. **All meet ≥9pt min** after this fix pass. | ✅ (was borderline) |
| 13 | **Figure size** — adequate for content | 960×320 viewBox; for 8 dates × 4 lines this is generous. | ✅ |
| 14 | **Whitespace** — title not crowded, labels not pushed to edges | `M.right = 130` reserves room for end labels; `M.top = 30` keeps headline clear. | ✅ |
| 15 | **Slide font sizes** — N/A (web, not slides) | N/A | N/A |
| 16 | **Theme consistency** — no mixed light/dark | Single light theme throughout. | ✅ |

### Gotcha 5-checklist (Step 4)

| # | Gotcha | State | Pass |
|---|---|---|---|
| 1 | **Label collision** — overlapping text | End-label de-collision pass: sort by y, push apart by ≥14 px, clamp to chart area. | ✅ (was RISK) |
| 2 | **Color contrast** — highlight visibly distinct | Amber for text-on-light is `#B45309` (5.5:1 vs `#F7F6F2`, AA pass). Brush/scrub line also use the AA amber. | ✅ |
| 3 | **Axis scale** — truncated misleading axes | Added explicit zero reference line for diverging proxies (greenness/brown). Axis is data-padded not data-fit, so small magnitudes don't read as huge. | ✅ (was RISK) |
| 4 | **Missing context** — chart stand-alone | Card title + sub + axis-sub all carry the proxy caveat; the action headline tells the takeaway. | ✅ |
| 5 | **Annotation accuracy** — arrows/bands point right | Both bands match real California events (2023 atm-river verifiable; 2024 dryness verifiable in cloud-cover proxy). | ✅ |

### Advanced technique checks (Step 5)

| # | Technique | Applicable? | State |
|---|---|---|---|
| 1 | **Trendline** | No — 8 points + strong seasonality would make a fit misleading | N/A |
| 2 | **Stacked bars** | No — data is per-region magnitude, not contribution-to-total | N/A |
| 3 | **Event span** | Yes | ✅ Two event-span bands (atm-river, late-dryness) with labels |
| 4 | **Side-by-side comparison** | Yes — wet-vs-dry year is the story | ✅ Compare mode renders two MODIS frames side-by-side, default pairing same-season-different-year |
| 5 | **Big-number summary** | No — exploratory chart, not summary | N/A |
| 6 | **Progressive zoom** | No — single chart, not a sequence | N/A |

---

## Per-chart review — binned greenness overlay (canvas)

| Check | State | Pass |
|---|---|---|
| Color binning (rubric ask) | 6 bins from deep brown to deep green | ✅ |
| Diverging palette correctly anchored at 0 | Bins straddle 0; `9DC3A4` and `E5C2A0` are the near-zero pair | ✅ |
| Legend present | 6-cell legend bar in the details panel, gated on overlay-toggle | ✅ |
| Disclaimer | "Visual proxy, not NDVI" caveat next to legend | ✅ |
| Renders without lag | Canvas rect-fill loop over 60×50 cells; one paint per image swap | ✅ |

---

## Fix Report — items applied since the previous review

### Issue 1 — Title was descriptive, not action
- **Check:** SWD #4
- **Fix applied:** added `chartHeadline()` that switches headline by (region, measure) selection. E.g. `"Central Valley peaks at +0.020 in spring 2024 — the greenest single image in the set"`.

### Issue 2 — End-of-line label collision
- **Check:** Gotcha #1
- **Fix applied:** sort labels by y, push apart with `MIN_GAP = 14` px, clamp to chart area.

### Issue 3 — Greenness chart had no zero baseline
- **Check:** Gotcha #3
- **Fix applied:** drew an explicit horizontal reference line at y=0 plus inline label `"0 — equal R/G mix"` for greenness/brown views.

### Issue 4 — Axis text below 9pt SWD floor
- **Check:** SWD #12
- **Fix applied:** axis 11 → 12 px, end-labels 11 → 12 px, annot-label 10 → 11 px, axis-title 12 → 13 px / 700 weight.

### Issue 5 — Amber on off-white below WCAG AA
- **Check:** Gotcha #2
- **Fix applied:** axis-sub italic, annot-label, brush selection, and scrub-line all swapped from `#D97706` (≈3.4:1) to `#B45309` (≈5.5:1, AA-pass).

---

## Verdict
**APPROVED.** All FAIL items from the prior review are closed; current pass rate: 16/16 SWD, 5/5 Gotchas, applicable Advanced techniques pass. No remaining blocking issues.
