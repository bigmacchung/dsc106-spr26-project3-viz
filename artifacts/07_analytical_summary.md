# Analytical Summary — Final submission

**Agent:** data-analyst
**Inputs:** `data/manifest.json` (produced by data-explorer.py once 24 JPGs exist on disk).
**Output:** this artifact + the seasonal aggregates the website's mini-chart consumes.

> ⚠️ All metrics below are **image-derived proxies** computed from real MODIS Terra true-color RGB pixels. They are *not* NDVI. The website copy must repeat this caveat anywhere a number appears.

## What the data can support

| Claim type | Supported? | Why |
|---|---|---|
| "California gets visibly greener Jan→Apr, browner Jul→Oct" | ✅ | RGB greenness proxy follows the seasonal cycle directly |
| "2022 spring was browner than 2023 spring" | ✅ as a *visual* claim | within-season cross-year comparison is what the slider exposes |
| "NDVI declined X% per decade" | ❌ | We have no NDVI values. Do not claim. |
| "Drought year intensity ranking" | ❌ | 4 dates/year is too sparse to rank severity statistically |

## Expected seasonal pattern (hypothesis the data should confirm)
- **Winter (Jan 15)** — Sierra snowpack visible, Central Valley still partly green, deserts dim. Greenness proxy moderate.
- **Spring (Apr 15)** — *Peak greenness*, especially Central Valley + foothills. Highest greenness proxy.
- **Summer (Jul 15)** — Brown-out across grasslands, snow gone. Greenness drops sharply, brown-proxy peaks.
- **Autumn (Oct 15)** — Fire scars often visible; chaparral still brown; before winter rains. Lowest greenness in many years.

If the actual numbers in the manifest don't match this pattern, the analyst layer should *flag it*, not paper over it. The website's copy should describe what the user is *currently* viewing, not what we assume.

## Cross-year notes worth highlighting in UI captions
- 2020 autumn — California had its largest fire season on record; expect smoke + burn scars visible in 2020-10 image.
- 2022 spring — third year of the 2020–22 drought; spring greenness should look noticeably muted vs 2023 spring.
- 2023 spring — atmospheric-river winter ended the drought; expect maximum greenness of the dataset.
- 2024 spring — return to drier conditions; greenness should sit between 2022 and 2023.

These are real-world events the viewer can verify by eye. Caption copy should narrate, not assert quantitatively.

## Aggregations the website needs (cheap, computed once at load time)
1. `manifest.json` — already produced by data-explorer.
2. **Seasonal mean greenness across all years** (4 numbers, used as gridlines on the mini-chart).
3. **Per-year greenness across the 4 seasons** (6 small lines, optional second viz).

These are the only "numbers" anywhere in the site, and they exist only as visual hints. No CSV of "NDVI" anywhere.

## Story for the page
> *Spring greens California, summer browns it, and the gap between a wet spring and a dry spring is something you can literally see from orbit.* The site lets the viewer step through 6 years × 4 seasons of real Terra/MODIS imagery, compare the same season across years side-by-side, and watch a small image-derived greenness proxy rise and fall in time with what's on screen.

## Handoff
- Artifact: `artifacts/07_analytical_summary.md`
- Next: `research-analyst.md` — translate this into the interaction spec.
