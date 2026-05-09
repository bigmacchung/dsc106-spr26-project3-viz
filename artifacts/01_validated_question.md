# Project Idea Validation — FINAL submission (revised)

**Agent:** project-idea-validator
**Status:** PROCEED — question is well-scoped and honest about its data.

## Pitch under review (revised for the final website)
> *Trends in California Vegetation Over Time*
> **Question:** *How does California's vegetation visually change across seasons?*
> Built on real NASA GIBS true-color imagery (`MODIS_Terra_CorrectedReflectance_TrueColor`), 4 seasonal images per year × 6 years = 24 JPGs.

## Pressure-test (anti-sycophancy, fatal-flaw hunt)

**1. Is the data real?** Yes — true-color JPGs are pixels NASA's Terra satellite actually saw. No colormap-decoding to fake numeric NDVI; no synthetic CSVs.

**2. Is the question honest about what the data can answer?** Yes, and that's the key edit from the checkpoint. The checkpoint over-promised "NDVI trend, slope per decade, statistical significance"; we did not have real NDVI numbers. The final question asks only what true-color imagery can actually show: **visible seasonal change**. No statistical claims.

**3. Hidden incumbent (NASA Worldview).** Worldview itself shows these tiles. Differentiation must come from **interaction design that compresses 6 years × 4 seasons into a single browseable view**: side-by-side season comparison, year-stepping, locked-frame brushing. Not "build a worse Worldview".

**4. The "visual proxy" trap.** Computing mean greenness from RGB pixels is fine *as a UI hint*, but must be labeled a **proxy**, not NDVI. Any axis title or legend that says "NDVI" without real NDVI behind it is a lie. The optional mini-chart must say "image-derived greenness proxy (G − R) / (G + R + B)" or similar, with caveat copy.

**5. Sample-size honesty.** 4 dates per year × 6 years is enough to *show seasonality* but not enough to claim *trend*. The question intentionally targets the first, not the second.

## Earned credit
- Real data + bounded scope + honest framing.
- Interaction design has a clear job (let viewers compare across season AND year fast).
- Single page, GitHub-Pages deployable, no backend.

## Locked scope for final submission

**Title:** *Trends in California Vegetation Over Time*
**Question:** *How does California's vegetation visually change across seasons?*

**Imagery:** 24 NASA GIBS true-color JPGs, California bbox (-125, 32, -114, 42), 4 seasonal dates/year (Jan 15, Apr 15, Jul 15, Oct 15) × 2020–2025. Layer: `MODIS_Terra_CorrectedReflectance_TrueColor`.

**Interactions (locked from research-analyst spec):**
1. Date slider (24 stops).
2. Season filter (Winter/Spring/Summer/Autumn) and Year filter chips.
3. Before/after comparison toggle (split view: same season, two different years).
4. Caption + details-on-demand panel (date, season, year, image-derived greenness proxy value).
5. Optional greenness mini-chart — clearly labeled "proxy, not official NDVI".

**Out of scope (explicit):**
- Numeric NDVI claims, statistical trends, p-values.
- AppEEARS, GEE, synthetic data.
- Multi-region splits (state-level only — sub-region aggregation belongs in a future iteration).

## Verdict: **GO** — proceed to data-explorer once 24 JPGs are on disk in `data/raw/vegetation/`.

## Handoff
- Artifact path: `artifacts/01_validated_question.md`
- Next: `data-explorer.py` against `data/raw/vegetation/*.jpg`
