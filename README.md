# Trends in California Vegetation Over Time

DSC 106 · Project 3 · Final
Repo: <https://github.com/bigmacchung/dsc106-spr26-project3-viz>

**Question:** *How does California's vegetation visually change across seasons — and how much does it change between a wet year and a dry year?*

A single-page interactive visualization built on **8 real NASA Terra/MODIS true-color images** of California (4 seasons × 2 years, 2023 + 2024) plus optional Aqua and false-color (Bands 7-2-1) alternates per date for cloud-aware viewing. **D3.js v7** for the chart; vanilla DOM and `<canvas>` for everything else. No synthetic data, no fake NDVI claims, no AppEEARS.

## Live site

GitHub Pages serves the repo root. Enable Pages on `main` → root in **Settings → Pages**.

## Repo layout

```
.
├── index.html               ← page markup
├── style.css                ← all styling
├── script.js                ← D3 chart, brush, lens, overlay, region filter, layer switcher
├── fetch_layers.py          ← optional: pulls Aqua + Bands721 alternate layers per date
├── data/
│   ├── manifest.json        ← per-date profile + layers map + 60×50 greenness grid
│   └── raw/vegetation/      ← real MODIS JPGs (8 Terra + optional 16 alternates)
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
pip install requests pillow numpy
python3 fetch_layers.py                # OPTIONAL: 16 Aqua + Bands721 alternates
python3 artifacts/data_explorer.py     # rebuilds data/manifest.json
```

`fetch_layers.py` adds cloud-piercing alternates (Aqua afternoon overpass + Terra Bands 7-2-1 false-color) for the existing 8 dates. The site's **Layer** chip group then becomes meaningful — it lets the viewer switch satellites for a clearer view on cloudy days like Jan 2023 (Terra true-color is ~23% near-white pixels). Drop additional `california_*_YYYY-MM-DD.jpg` files in the same folder and re-run `data_explorer.py` to extend coverage.

## Interactions

| Control | What it does | Why it earns its keep |
|---|---|---|
| **Date slider** | Scrubs the main image. Keyboard ←/→. | Linear time access. |
| **Season + Year chips** | Dynamic query filters. | Compose to ask "all springs" or "all 2024". |
| **Region chips** + click image | Filters the chart to that ecoregion (Sierra Nevada / Central Valley / Southern California / Statewide). | Spatial→temporal linkage no static plot can do. |
| **Layer chips** | Same date through Terra true-color / Aqua true-color / Bands 7-2-1 false-color. | Dodges cloud cover; same date through different MODIS lenses. |
| **Measure switch** | Greenness ↔ Brown ↔ Brightness. | Reveals the dryback signal (brown) that mirrors greenness loss in summer. |
| **Single / Compare / Grid** | One image, two side-by-side, or all eight as small multiples. | Compare mode pairs same-season different-year by default. |
| **D3 brush on chart** | Drag to select a date range; the grid view filters to those images. | Direct date-range filtering. |
| **Click chart dot** | Scrubs slider to that image. | Linked highlighting. |
| **Magnifier lens** | Hover image → 4× zoom. | Pixel-level inspection of a 1200×1000 satellite tile. |
| **Greenness overlay** | Toggle a 60×50 binned-color heatmap. | Reveals where greenness concentrates spatially. |
| **Region rectangles** | Toggle bbox outlines for Sierra/Valley/SoCal. | Makes the abstract "Region" filter concrete on the image. |
| **Annotations** | Vertical bands marking 2023 atmospheric-river winter and 2024 late-season dryness. | Narrative anchoring. |

## What the numbers mean (and what they aren't)

`greenness = (G − R) / (G + R + B)` computed from JPG pixels. **Image-derived proxy, not NDVI.** Every UI surface that shows the value also says "proxy". Real NDVI requires the NIR band, which true-color JPGs don't carry — true NDVI numbers would come from AppEEARS or LP DAAC behind an Earthdata Login.

`cloud_cover` is the fraction of near-white pixels (R, G, B all ≥ 230). **Visual cloudiness hint, not a real cloud mask.** Snow looks white too — the Jan 2023 reading (22.8%) mixes storm clouds with Sierra snowpack. A real cloud quality flag would come from MOD35_L2.

## Data source

NASA EOSDIS Global Imagery Browse Services (GIBS), accessed via WMS 1.1.1 GetMap. Public domain. Source application: <https://worldview.earthdata.nasa.gov>.

Layers used:
- `MODIS_Terra_CorrectedReflectance_TrueColor` (primary)
- `MODIS_Aqua_CorrectedReflectance_TrueColor` (cloud alternate)
- `MODIS_Terra_CorrectedReflectance_Bands721` (false color: snow=red, clouds=white, vegetation=green)

## License / credit

Imagery © NASA EOSDIS GIBS (public domain). Code MIT.
