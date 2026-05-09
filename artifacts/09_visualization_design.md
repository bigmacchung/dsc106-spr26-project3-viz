# Visualization Design Spec — Final submission

**Agent:** research-analyst
**Input:** analytical summary (artifact 07)
**Output:** interaction + layout spec consumed by `index.html` / `style.css` / `script.js`.

## Page anatomy (top → bottom)

```
┌──────────────────────────────────────────────────────────────────┐
│ HERO                                                             │
│  Title: Trends in California Vegetation Over Time                │
│  Q:     How does California's vegetation visually change         │
│         across seasons?                                          │
│  Caption: 24 real NASA Terra/MODIS true-color images via GIBS,   │
│           4 seasons × 6 years (2020–2025)                        │
├──────────────────────────────────────────────────────────────────┤
│ CONTROL BAR                                                      │
│  [ Single ▣ | Compare ◻ ]  ← view-mode toggle                    │
│  Season chips: [Winter] [Spring] [Summer] [Autumn] [All]         │
│  Year chips:   [2020][2021][2022][2023][2024][2025] [All]        │
│  Date slider: ●─────────────────────  (24 stops, snap to image)  │
├──────────────────────────────────────────────────────────────────┤
│ MAIN STAGE                                                       │
│  Single mode:  one large MODIS JPG, ~960×800 px                  │
│  Compare mode: two JPGs side-by-side with shared header strip    │
│                showing date pickers per panel                    │
│  Bottom-right overlay: "NASA Terra/MODIS · {date}"               │
├──────────────────────────────────────────────────────────────────┤
│ DETAILS PANEL  (right rail or below stage on narrow screens)     │
│  Date │ Season │ Year                                            │
│  Greenness proxy:  +0.024  (image-derived, NOT NDVI)             │
│  Brightness:       138.2                                         │
│  Narrative caption: 1–2 sentences keyed off date (2020-10:       │
│    "Smoke and burn scars visible — 2020 fire season".)           │
├──────────────────────────────────────────────────────────────────┤
│ MINI CHART  (greenness proxy over time)                          │
│  X = date (24 ticks), Y = greenness proxy                        │
│  Colored dots per season, current frame highlighted in amber     │
│  Y-axis label: "Image-derived greenness proxy (G−R)/(G+R+B)"     │
│  Sub-label: "Visual hint, not official NDVI"                     │
├──────────────────────────────────────────────────────────────────┤
│ WRITE-UP                                                         │
│  - What you're looking at                                        │
│  - Design rationale                                              │
│  - Development process (DAG, agents, fixes)                      │
│  - Data source disclosure (NASA Worldview/GIBS)                  │
└──────────────────────────────────────────────────────────────────┘
```

## Interactions (must-have, all required by the brief)

1. **Date slider** — 24 ordered stops, one per image. Drag updates the main stage immediately, plus the details panel and mini-chart highlight. Keyboard ←/→ also steps.
2. **Season filter chips** — clicking "Spring" filters the slider stops to spring images only; mini-chart dims non-matching points.
3. **Year filter chips** — same idea, restricts to one year. Combined with season filter, e.g. all Spring (2020-25) = 6 stops.
4. **View-mode toggle: Single ⇄ Compare.** Compare mode renders two JPGs side-by-side. Each panel has its own date selector (a small native `<select>`). Default Compare pairing: same season, two contrasting years (2022-04 vs 2023-04).
5. **Details-on-demand panel** — always visible; updates with the active frame (single mode) or with whichever panel was last clicked (compare mode).
6. **Mini chart of greenness proxy** — clicking a dot scrubs the slider to that date.
7. **Image fade-in** — 150 ms cross-fade on slider scrub so transitions read as continuous, not a hard cut.

## Visual rules (SWD)
- Background: warm off-white `#F7F6F2`.
- Accent: amber `#D97706` (active selection); secondary teal `#0F766E` (positive); gray `#C7C5BD` (inactive).
- Typography: system stack, h1 28-32 px, body 15 px, captions 13 px.
- Mini-chart spines: bottom + left only; gridlines none or one horizontal.
- Direct labels, no legend box.
- Mini-chart axis title MUST contain the word "proxy" and the disclaimer that it is not NDVI. Non-negotiable.

## Responsiveness
- ≥ 1100 px: stage 60% width, details panel 40%.
- 700–1100 px: stage full width, details panel below.
- < 700 px: chips wrap, slider full width, compare mode collapses to top/bottom stack.

## Accessibility
- Slider has `aria-label="Date"`, value text reads as "Spring 2023, April 15".
- Chips are `<button>` elements with `aria-pressed`.
- Mini-chart dots get `tabindex=0` and respond to Enter.
- All imagery has `alt="MODIS Terra true-color image of California, {date}"`.

## What's intentionally out of scope
- Region-level breakdowns (still statewide bbox).
- Monthly cadence (4 seasonal dates is the scope).
- Live GIBS fetch on page load (images are bundled in the repo for GitHub Pages).
- Any quantitative claim about NDVI trend.

## Files this design produces
| File | Purpose |
|---|---|
| `index.html` | Markup, hero, controls, stage, details, chart, write-up |
| `style.css`  | All styling (no external CSS dependency) |
| `script.js`  | Loads `data/manifest.json`, drives all interactions, draws mini-chart with vanilla SVG |
| `README.md`  | One-page project README for the GitHub Pages repo |

## Handoff
- Artifact: `artifacts/09_visualization_design.md`
- Next: build the website (`index.html`, `style.css`, `script.js`), then visual-design-critic.
