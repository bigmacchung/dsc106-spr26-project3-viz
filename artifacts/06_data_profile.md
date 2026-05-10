# Data Profile — Real MODIS True-Color JPGs

**Agent:** data-explorer.py
**Source:** `data/raw/vegetation`
**Dates:** 8
**Date range:** 2023-01-01 → 2024-10-15
**Years:** 2023, 2024
**Seasons:** autumn, spring, summer, winter
**Image dimensions:** 1200 × 1000 px (sample)
**Layers available:** aqua-truecolor, terra-bands721, terra-truecolor

## Per-image table

| date | season | year | greenness (state) | sierra | valley | socal | cloud cover | layers |
|---|---|---|---|---|---|---|---|---|
| 2023-01-01 | winter | 2023 | +0.0153 | +0.0004 | +0.0045 | -0.0098 | 22.8% | aqua-truecolor, terra-bands721, terra-truecolor |
| 2023-04-07 | spring | 2023 | +0.0002 | -0.0017 | +0.0022 | -0.0164 | 10.0% | aqua-truecolor, terra-bands721, terra-truecolor |
| 2023-07-12 | summer | 2023 | -0.0264 | -0.0376 | -0.0404 | -0.0342 | 0.2% | aqua-truecolor, terra-bands721, terra-truecolor |
| 2023-10-16 | autumn | 2023 | -0.0211 | -0.0377 | -0.0404 | -0.0369 | 3.4% | aqua-truecolor, terra-bands721, terra-truecolor |
| 2024-01-01 | winter | 2024 | +0.0087 | -0.0345 | -0.0058 | -0.0223 | 0.7% | aqua-truecolor, terra-bands721, terra-truecolor |
| 2024-04-06 | spring | 2024 | +0.0089 | -0.0069 | +0.0198 | -0.0203 | 6.8% | aqua-truecolor, terra-bands721, terra-truecolor |
| 2024-07-11 | summer | 2024 | -0.0203 | -0.0231 | -0.0172 | -0.0172 | 0.5% | aqua-truecolor, terra-bands721, terra-truecolor |
| 2024-10-15 | autumn | 2024 | -0.0206 | -0.0340 | -0.0297 | -0.0373 | 5.0% | aqua-truecolor, terra-bands721, terra-truecolor |

## Notes

- `greenness = (G - R) / (G + R + B)` — image-derived proxy, NOT NDVI.
- `brown = (R - G) / (G + R + B)` — dryback proxy.
- `cloud_cover` = fraction of near-white pixels (R,G,B ≥ 230) — visual cloudiness hint, not a real cloud mask.
- Per-region values come from clipping the image to a lat/lon bbox.
- `greenness_grid` is a 60×50 downsampling of greenness per cell.
- For dates with multiple layers, metrics are computed from the Terra true-color file.
- Every value is computed from real MODIS Terra true-color pixels via NASA GIBS.
