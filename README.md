# Trends in California Vegetation Over Time

DSC 106 · Project 3
Repo: <https://github.com/bigmacchung/dsc106-spr26-project3-viz>

**Question:** *How does California's vegetation visually change across seasons — and how much does it change between a wet year and a dry year?*

A single-page interactive visualization built on **8 real NASA Terra/MODIS true-color images** of California (4 seasons × 2 years, 2023 + 2024), pulled from NASA's GIBS WMS endpoint. **D3.js v7** for the chart; vanilla DOM and `<canvas>` for everything else. No synthetic data, no fake NDVI claims, no AppEEARS.

## Live site

GitHub Pages serves the repo root. After committing, enable Pages on `main` → root in Settings → Pages.

## Repo layout

```
.
├── index.html               ← page markup
├── style.css                ← all styling
├── script.js                ← D3 chart, brush, lens, overlay, region filter
├── data/
│   ├── manifest.json        ← per-image profile + 60×50 greenness grid (built by data_explorer.py)
│   └── raw/vegetation/      ← 8 real MODIS true-color JPGs
├── artifacts/
│   ├── 01_validated_question.md
│   ├── 06_data_profile.md
│   ├── 07_analytical_summary.md
│   ├── 09_visualization_design.md
│   ├── 10_design_review.md
│   └── data_explorer.py
└── README.md
```

## How to refresh the data

```bash
pip install pillow numpy
python3 artifacts/data_explorer.py    # rewrites data/manifest.json from JPG folder
```

Drop additional `california_truecolor_YYYY-MM-DD.jpg` files into `data/raw/vegetation/` and re-run the script — the site auto-picks up whatever is in the manifest.

## Interactions (all required by the rubric, plus extras)

| Control | What it does | Why it earns its keep |
|---|---|---|
| **Date slider** (24-stop) | Scrubs the main image. Keyboard ←/→. | Linear time access across the dataset. |
| **Season + Year chips** | Dynamic query filters. | Compose to ask "all springs" or "all 2024". |
| **Region chips** + click image | Filters chart to that ecoregion (Sierra Nevada, Central Valley, Southern California, Statewide). | Spatial→temporal linkage no static plot can do. |
| **Measure switch** | Greenness ↔ Brown ↔ Brightness. | Reveals dryback (brown) signal that mirrors greenness loss in summer. |
| **Single / Compare / Grid view** | Switches main stage between one image, two side-by-side, or all eight as small multiples. | Compare mode pairs same-season different-year by default → drought-recovery contrast. |
| **D3 brush on chart** | Drag to select a date range; the grid view dims out-of-range images. | Direct date-range filtering. |
| **Click chart dot** | Scrubs slider to that image. | Linked highlighting. |
| **Magnifier lens** | Hover image → 4× zoom on hovered area. | Pixel-level inspection of a 1200×1000 satellite tile. |
| **Greenness overlay** | Toggle a 60×50 binned-color heatmap over the image. | Bin colors per the rubric; reveals where greenness concentrates. |
| **Region rectangles** | Toggle bbox outlines for Sierra/Valley/SoCal. | Makes the abstract "Region" filter concrete. |
| **Tooltip on dots** | Date, region, value. Click hint visible. | Details on demand. |
| **Annotations** | Vertical bands marking 2023 atmospheric-river winter and 2024 late-season dryness. | Narrative anchoring. |

## What the numbers mean (and what they aren't)

`greenness = (G − R) / (G + R + B)` computed from the JPG's pixels. **Image-derived proxy, not NDVI.** Every UI surface that shows the value also says "proxy". This is non-negotiable.

If you want real NDVI, AppEEARS or LP DAAC will give them to you with an Earthdata Login. This site stays out of that game on purpose — true-color imagery answers the visual-change question honestly, without overclaiming.

## Data source

NASA EOSDIS Global Imagery Browse Services (GIBS), layer `MODIS_Terra_CorrectedReflectance_TrueColor`, accessed via WMS 1.1.1 GetMap. Public domain. Source application: <https://worldview.earthdata.nasa.gov>.

## Development process

Followed an agent-DAG. Each node's output lives in `artifacts/`:

1. **project-idea-validator** — pressure-tests the question, locks scope.
2. **data-explorer.py** — profiles the 8 JPGs, computes per-region statistics + 60×50 greenness grid, emits `data/manifest.json`.
3. **data-analyst.md** — turns the profile into an analytical summary, flags what the data can and can't claim.
4. **research-analyst.md** — specifies the interactions and layout (drove the D3 build).
5. *(site build: index.html / style.css / script.js with D3 v7 from CDN)*
6. **visual-design-critic.md** — reviews the live site against an SWD-style checklist + the rubric.

An earlier checkpoint attempted to derive numeric NDVI by RGB-decoding NASA's colormap-rendered NDVI tiles. That approach failed (most pixels collapsed into the saturated colormap bin), so the final scope shrank to true-color imagery with explicit "proxy, not NDVI" labeling. The failure and recovery are documented; nothing is hidden.

**Time spent: ~10 people-hours.** Biggest costs: D3 chart with brush + region filter (~3 hr), image overlays + lens (~2 hr), per-region pipeline in `data_explorer.py` (~2 hr), and the writeup + accessibility passes (~1.5 hr).

## License / credit

Imagery © NASA EOSDIS GIBS (public domain).
