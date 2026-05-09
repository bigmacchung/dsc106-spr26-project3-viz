"""
data-explorer agent — profile every JPG in data/raw/vegetation/.

Every image is a real NASA Terra/MODIS true-color tile of California
(WMS bbox -125, 32, -114, 42 → 1200 × 1000 px).  For each image we compute:

  - statewide image-derived greenness proxy
  - per-sub-region greenness proxy (Sierra Nevada, Central Valley,
    Southern California) — these power the "click a region on the map"
    interaction in the website
  - brown proxy and brightness for measure-switching
  - a 60×50 downsampled greenness grid (per-cell), stored as a tiny array
    per image so the front-end can draw a binned greenness overlay
    without having to do per-pixel work in the browser

Outputs:
  - data/manifest.json          one row per image, all metrics
  - artifacts/06_data_profile.md  human-readable summary

NOTE: 'greenness' here is an image-derived proxy
      (G − R) / (G + R + B). It is NOT NDVI. The website states this
      anywhere a number appears.
"""
from __future__ import annotations
import json, re
from datetime import date
from pathlib import Path

import numpy as np
from PIL import Image

ROOT       = Path(__file__).resolve().parent.parent
SRC        = ROOT / "data" / "raw" / "vegetation"
MANIFEST   = ROOT / "data" / "manifest.json"
PROFILE_MD = ROOT / "artifacts" / "06_data_profile.md"

# ---------------------------------------------------------------------------
# WMS BBOX of the imagery — this MUST match fetch_truecolor.py
#   lon_min, lat_min, lon_max, lat_max
# ---------------------------------------------------------------------------
LON_MIN, LAT_MIN, LON_MAX, LAT_MAX = -125.0, 32.0, -114.0, 42.0

# Sub-regions used for the interactive chart filter.
# (lat_min, lon_min, lat_max, lon_max)
SUBREGIONS = {
    "sierra":   (36.0, -120.5, 40.0, -118.0),
    "valley":   (35.5, -121.5, 39.5, -119.5),
    "socal":    (32.5, -119.0, 35.5, -114.5),
}

DATE_RE = re.compile(r"(\d{4})[-_](\d{2})[-_](\d{2})")
SEASON_BY_MONTH = {
    12: "winter", 1: "winter", 2: "winter",
    3: "spring", 4: "spring", 5: "spring",
    6: "summer", 7: "summer", 8: "summer",
    9: "autumn", 10: "autumn", 11: "autumn",
}

# Heatmap downsample
GRID_W, GRID_H = 60, 50  # tiny, fits in JSON cheaply (3000 cells per image)


def parse_date(stem: str):
    m = DATE_RE.search(stem)
    if not m:
        return None
    y, mo, d = (int(x) for x in m.groups())
    try:
        return date(y, mo, d)
    except ValueError:
        return None


def latlon_to_px(lat, lon, w, h):
    x = (lon - LON_MIN) / (LON_MAX - LON_MIN) * w
    y = (LAT_MAX - lat) / (LAT_MAX - LAT_MIN) * h  # flip Y
    return int(round(x)), int(round(y))


def metrics(arr_rgb: np.ndarray):
    """Compute greenness/brown/brightness over a (H, W, 3) float32 array."""
    R, G, B = arr_rgb[..., 0], arr_rgb[..., 1], arr_rgb[..., 2]
    denom = (R + G + B + 1e-6)
    g = float(np.mean((G - R) / denom))
    b = float(np.mean((R - G) / denom))
    br = float(np.mean((R + G + B) / 3.0))
    return round(g, 5), round(b, 5), round(br, 2)


def downsample_greenness(arr_rgb: np.ndarray, gw=GRID_W, gh=GRID_H):
    """Return (gh, gw) array of greenness proxy values."""
    H, W, _ = arr_rgb.shape
    grid = np.empty((gh, gw), dtype=np.float32)
    xs = np.linspace(0, W, gw + 1, dtype=int)
    ys = np.linspace(0, H, gh + 1, dtype=int)
    for j in range(gh):
        for i in range(gw):
            cell = arr_rgb[ys[j]:ys[j+1], xs[i]:xs[i+1]]
            R, G, B = cell[..., 0], cell[..., 1], cell[..., 2]
            denom = (R + G + B + 1e-6)
            grid[j, i] = float(np.mean((G - R) / denom))
    return np.round(grid, 4)


def profile_image(path: Path) -> dict | None:
    d = parse_date(path.stem)
    if d is None:
        return None
    img = Image.open(path).convert("RGB")
    arr = np.asarray(img, dtype=np.float32)
    H, W, _ = arr.shape

    # statewide
    g_all, br_all, bright_all = metrics(arr)

    # per sub-region
    region_metrics = {}
    for name, (lat0, lon0, lat1, lon1) in SUBREGIONS.items():
        x0, y_top = latlon_to_px(lat1, lon0, W, H)
        x1, y_bot = latlon_to_px(lat0, lon1, W, H)
        x0, x1 = sorted([max(0, x0), min(W, x1)])
        y_top, y_bot = sorted([max(0, y_top), min(H, y_bot)])
        sub = arr[y_top:y_bot, x0:x1]
        if sub.size == 0:
            continue
        g, b, br = metrics(sub)
        region_metrics[name] = {
            "greenness": g, "brown": b, "brightness": br,
            "px": [x0, y_top, x1, y_bot],   # rectangle in image-pixel space
        }

    grid = downsample_greenness(arr)

    return {
        "file":       f"data/raw/vegetation/{path.name}",
        "date":       d.isoformat(),
        "year":       d.year,
        "month":      d.month,
        "season":     SEASON_BY_MONTH[d.month],
        "size_kb":    round(path.stat().st_size / 1024, 1),
        "width":      W,
        "height":     H,
        "all": {"greenness": g_all, "brown": br_all, "brightness": bright_all},
        "regions": region_metrics,
        "grid_w": GRID_W,
        "grid_h": GRID_H,
        "greenness_grid": grid.tolist(),
    }


def main():
    if not SRC.is_dir():
        raise SystemExit(f"missing folder: {SRC}")
    files = sorted(SRC.glob("*.jpg")) + sorted(SRC.glob("*.jpeg"))
    if not files:
        raise SystemExit(f"no JPGs in {SRC}")

    records = []
    for f in files:
        rec = profile_image(f)
        if rec:
            records.append(rec)
    records.sort(key=lambda r: r["date"])

    MANIFEST.parent.mkdir(parents=True, exist_ok=True)
    with open(MANIFEST, "w") as fp:
        json.dump(records, fp)

    # human profile
    md = []
    md.append("# Data Profile — Real MODIS True-Color JPGs\n")
    md.append("**Agent:** data-explorer.py")
    md.append(f"**Source:** `data/raw/vegetation`")
    md.append(f"**Images:** {len(records)}")
    md.append(f"**Date range:** {records[0]['date']} → {records[-1]['date']}")
    md.append(f"**Years:** {', '.join(map(str, sorted({r['year'] for r in records})))}")
    md.append(f"**Seasons:** {', '.join(sorted({r['season'] for r in records}))}")
    if records:
        d0 = records[0]
        md.append(f"**Image dimensions:** {d0['width']} × {d0['height']} px (sample)")
    md.append("")
    md.append("## Image-derived greenness proxy by season (NOT official NDVI)\n")
    md.append("| Season | n | mean greenness | mean brown | mean brightness |")
    md.append("|---|---|---|---|---|")
    for s in ["winter", "spring", "summer", "autumn"]:
        bucket = [r for r in records if r["season"] == s]
        if not bucket:
            continue
        g  = np.mean([r["all"]["greenness"]  for r in bucket])
        b  = np.mean([r["all"]["brown"]      for r in bucket])
        br = np.mean([r["all"]["brightness"] for r in bucket])
        md.append(f"| {s} | {len(bucket)} | {g:+.4f} | {b:+.4f} | {br:.1f} |")

    md.append("\n## Per-image table\n")
    md.append("| date | season | year | greenness (state) | sierra | valley | socal | brightness | size KB |")
    md.append("|---|---|---|---|---|---|---|---|---|")
    for r in records:
        rg = r["regions"]
        md.append(
            f"| {r['date']} | {r['season']} | {r['year']} | "
            f"{r['all']['greenness']:+.4f} | "
            f"{rg.get('sierra',{}).get('greenness',float('nan')):+.4f} | "
            f"{rg.get('valley',{}).get('greenness',float('nan')):+.4f} | "
            f"{rg.get('socal',{}).get('greenness',float('nan')):+.4f} | "
            f"{r['all']['brightness']:.1f} | {r['size_kb']} |"
        )

    md.append("\n## Notes\n")
    md.append("- `greenness = (G - R) / (G + R + B)` — image-derived proxy, NOT NDVI.")
    md.append("- `brown = (R - G) / (G + R + B)` — dryback proxy.")
    md.append("- Per-region values come from clipping the image to a lat/lon bbox.")
    md.append("- `greenness_grid` is a 60×50 downsampling of greenness per cell, used by the website's overlay.\n")
    md.append("- Every value is computed from real MODIS Terra true-color pixels via NASA GIBS.\n")

    PROFILE_MD.write_text("\n".join(md))
    print(f"wrote {len(records)} records → {MANIFEST}")
    print(f"wrote profile           → {PROFILE_MD}")


if __name__ == "__main__":
    main()
