# Data Profile — Real MODIS True-Color JPGs

**Agent:** data-explorer.py
**Source:** `data/raw/vegetation`
**Images:** 8
**Date range:** 2023-01-01 → 2024-10-15
**Years:** 2023, 2024
**Seasons:** autumn, spring, summer, winter
**Image dimensions:** 1200 × 1000 px (sample)

## Image-derived greenness proxy by season (NOT official NDVI)

| Season | n | mean greenness | mean brown | mean brightness |
|---|---|---|---|---|
| winter | 2 | +0.0120 | -0.0120 | 110.7 |
| spring | 2 | +0.0046 | -0.0046 | 138.5 |
| summer | 2 | -0.0233 | +0.0233 | 109.4 |
| autumn | 2 | -0.0209 | +0.0209 | 119.8 |

## Per-image table

| date | season | year | greenness (state) | sierra | valley | socal | brightness | size KB |
|---|---|---|---|---|---|---|---|---|
| 2023-01-01 | winter | 2023 | +0.0153 | +0.0004 | +0.0045 | -0.0098 | 140.2 | 320.7 |
| 2023-04-07 | spring | 2023 | +0.0002 | -0.0017 | +0.0022 | -0.0164 | 157.1 | 197.5 |
| 2023-07-12 | summer | 2023 | -0.0264 | -0.0376 | -0.0404 | -0.0342 | 101.7 | 212.8 |
| 2023-10-16 | autumn | 2023 | -0.0211 | -0.0377 | -0.0404 | -0.0369 | 110.3 | 223.0 |
| 2024-01-01 | winter | 2024 | +0.0087 | -0.0345 | -0.0058 | -0.0223 | 81.2 | 244.1 |
| 2024-04-06 | spring | 2024 | +0.0089 | -0.0069 | +0.0198 | -0.0203 | 120.0 | 288.4 |
| 2024-07-11 | summer | 2024 | -0.0203 | -0.0231 | -0.0172 | -0.0172 | 117.1 | 187.3 |
| 2024-10-15 | autumn | 2024 | -0.0206 | -0.0340 | -0.0297 | -0.0373 | 129.3 | 194.3 |

## Notes

- `greenness = (G - R) / (G + R + B)` — image-derived proxy, NOT NDVI.
- `brown = (R - G) / (G + R + B)` — dryback proxy.
- Per-region values come from clipping the image to a lat/lon bbox.
- `greenness_grid` is a 60×50 downsampling of greenness per cell, used by the website's overlay.

- Every value is computed from real MODIS Terra true-color pixels via NASA GIBS.
