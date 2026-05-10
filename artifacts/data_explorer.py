"""
data-explorer agent — profile every JPG in data/raw/vegetation/.

Each date may have multiple layer files (true-color Terra, true-color Aqua,
bands 7-2-1 false color). The Terra true-color file is the canonical
"primary" image for metric computation; alternative layers are listed so
the website can swap them in to dodge cloud cover.

Filename convention recognized:
    california_truecolor_YYYY-MM-DD.jpg          → terra-truecolor (PRIMARY)
    california_aqua_truecolor_YYYY-MM-DD.jpg     → aqua-truecolor
    california_bands721_YYYY-MM-DD.jpg           → terra-bands721

For each (primary) image we also compute:
  - statewide image-derived greenness proxy
  - per-region greenness/brown/brightness (Sierra Nevada, Central Valley,
    Southern California)
  - 60×50 downsampled greenness grid for the binned overlay
  - cloud_cover_proxy, derived from how much of the image is near-white
    (R,G,B all > 230). This is a crude visual hint, not an MOD35 cloud
    mask.

Outputs:
  - data/manifest.json            one row per date
  - artifacts/06_data_profile.md  human-readable summary

NOTE: 'greenness' is an image-derived proxy (G − R) / (G + R + B). NOT NDVI.
"""
from __future__ import annotations
import json, re
from collections import defaultdict
from datetime import date
from pathlib import Path

import numpy as np
from PIL import Image

ROOT       = Path(__file__).resolve().parent.parent
SRC        = ROOT / "data" / "raw" / "vegetation"
MANIFEST   = ROOT / "data" / "manifest.json"
PROFILE_MD = ROOT / "artifacts" / "06_data_profile.md"

LON_MIN, LAT_MIN, LON_MAX, LAT_MAX = -125.0, 32.0, -114.0, 42.0

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

GRID_W, GRID_H = 60, 50

# (regex matched on filename stem, layer id, label)
LAYER_PATTERNS = [
    (re.compile(r"^california_truecolor_(\d{4}-\d{2}-\d{2})$"),       "terra-truecolor", "Terra (true color)"),
    (re.compile(r"^california_aqua_truecolor_(\d{4}-\d{2}-\d{2})$"),  "aqua-truecolor",  "Aqua (true color)"),
    (re.compile(r"^california_bands721_(\d{4}-\d{2}-\d{2})$"),        "terra-bands721",  "Terra (bands 7-2-1, sees through clouds)"),
]


def parse_filename(stem: str):
    """Return (layer_id, label, iso_date) or None."""
    for pat, lid, lbl in LAYER_PATTERNS:
        m = pat.match(stem)
        if m:
            return lid, lbl, m.group(1)
    # fallback: any *_YYYY-MM-DD.jpg → terra-truecolor
    m = DATE_RE.search(stem)
    if m:
        return "terra-truecolor", "Terra (true color)", f"{m.group(1)}-{m.group(2)}-{m.group(3)}"
    return None


def latlon_to_px(lat, lon, w, h):
    x = (lon - LON_MIN) / (LON_MAX - LON_MIN) * w
    y = (LAT_MAX - lat) / (LAT_MAX - LAT_MIN) * h
    return int(round(x)), int(round(y))


def metrics(arr_rgb: np.ndarray):
    R, G, B = arr_rgb[..., 0], arr_rgb[..., 1], arr_rgb[..., 2]
    denom = (R + G + B + 1e-6)
    g  = float(np.mean((G - R) / denom))
    b  = float(np.mean((R - G) / denom))
    br = float(np.mean((R + G + B) / 3.0))
    return round(g, 5), round(b, 5), round(br, 2)


def cloud_cover_proxy(arr_rgb: np.ndarray) -> float:
    """Fraction of pixels that are near-white (R,G,B all >= 230) — crude
    visual cloudiness hint, NOT a real cloud mask."""
    near_white = (arr_rgb[..., 0] >= 230) & (arr_rgb[..., 1] >= 230) & (arr_rgb[..., 2] >= 230)
    return round(float(np.mean(near_white)), 4)


def downsample_greenness(arr_rgb, gw=GRID_W, gh=GRID_H):
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


def discover_layers():
    """Group files in SRC by ISO date and layer."""
    by_date = defaultdict(dict)
    for f in sorted(SRC.glob("*.jpg")) + sorted(SRC.glob("*.jpeg")):
        info = parse_filename(f.stem)
        if not info:
            continue
        layer_id, label, iso = info
        by_date[iso][layer_id] = {
            "file": f"data/raw/vegetation/{f.name}",
            "label": label,
            "size_kb": round(f.stat().st_size / 1024, 1),
        }
    return by_date


def profile_primary(rec_path: Path) -> dict:
    """Compute statistics from the primary (Terra true-color) image."""
    img = Image.open(rec_path).convert("RGB")
    arr = np.asarray(img, dtype=np.float32)
    H, W, _ = arr.shape

    g_all, br_all, bright_all = metrics(arr)

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
            "px": [x0, y_top, x1, y_bot],
        }

    return {
        "width":  W,
        "height": H,
        "all": {"greenness": g_all, "brown": br_all, "brightness": bright_all},
        "regions": region_metrics,
        "cloud_cover": cloud_cover_proxy(arr),
        "grid_w": GRID_W,
        "grid_h": GRID_H,
        "greenness_grid": downsample_greenness(arr).tolist(),
    }


def main():
    if not SRC.is_dir():
        raise SystemExit(f"missing folder: {SRC}")
    by_date = discover_layers()
    if not by_date:
        raise SystemExit(f"no recognized JPGs in {SRC}")

    records = []
    for iso in sorted(by_date.keys()):
        layers = by_date[iso]
        primary = layers.get("terra-truecolor")
        if not primary:
            print(f"  [warn] {iso} has no terra-truecolor file — skipping primary metrics")
            continue
        d = date.fromisoformat(iso)
        primary_path = ROOT / primary["file"]
        stats = profile_primary(primary_path)

        rec = {
            "date":    iso,
            "year":    d.year,
            "month":   d.month,
            "season":  SEASON_BY_MONTH[d.month],
            "primary_layer": "terra-truecolor",
            "layers":  layers,
            **stats,
            # convenience top-level "file" = primary, for back-compat
            "file":    primary["file"],
            "size_kb": primary["size_kb"],
        }
        records.append(rec)

    records.sort(key=lambda r: r["date"])
    MANIFEST.parent.mkdir(parents=True, exist_ok=True)
    with open(MANIFEST, "w") as fp:
        json.dump(records, fp)

    # ---------- profile markdown ----------
    md = []
    md.append("# Data Profile — Real MODIS True-Color JPGs\n")
    md.append("**Agent:** data-explorer.py")
    md.append("**Source:** `data/raw/vegetation`")
    md.append(f"**Dates:** {len(records)}")
    md.append(f"**Date range:** {records[0]['date']} → {records[-1]['date']}")
    md.append(f"**Years:** {', '.join(map(str, sorted({r['year'] for r in records})))}")
    md.append(f"**Seasons:** {', '.join(sorted({r['season'] for r in records}))}")
    if records:
        d0 = records[0]
        md.append(f"**Image dimensions:** {d0['width']} × {d0['height']} px (sample)")
    layer_ids = sorted({lid for r in records for lid in r['layers'].keys()})
    md.append(f"**Layers available:** {', '.join(layer_ids)}")
    md.append("")

    md.append("## Per-image table\n")
    md.append("| date | season | year | greenness (state) | sierra | valley | socal | cloud cover | layers |")
    md.append("|---|---|---|---|---|---|---|---|---|")
    for r in records:
        rg = r["regions"]
        layers_str = ", ".join(sorted(r["layers"].keys()))
        md.append(
            f"| {r['date']} | {r['season']} | {r['year']} | "
            f"{r['all']['greenness']:+.4f} | "
            f"{rg.get('sierra',{}).get('greenness',float('nan')):+.4f} | "
            f"{rg.get('valley',{}).get('greenness',float('nan')):+.4f} | "
            f"{rg.get('socal',{}).get('greenness',float('nan')):+.4f} | "
            f"{r['cloud_cover']*100:.1f}% | {layers_str} |"
        )

    md.append("\n## Notes\n")
    md.append("- `greenness = (G - R) / (G + R + B)` — image-derived proxy, NOT NDVI.")
    md.append("- `brown = (R - G) / (G + R + B)` — dryback proxy.")
    md.append("- `cloud_cover` = fraction of near-white pixels (R,G,B ≥ 230) — visual cloudiness hint, not a real cloud mask.")
    md.append("- Per-region values come from clipping the image to a lat/lon bbox.")
    md.append("- `greenness_grid` is a 60×50 downsampling of greenness per cell.")
    md.append("- For dates with multiple layers, metrics are computed from the Terra true-color file.")
    md.append("- Every value is computed from real MODIS Terra true-color pixels via NASA GIBS.\n")

    PROFILE_MD.write_text("\n".join(md))
    print(f"wrote {len(records)} records → {MANIFEST}")
    print(f"wrote profile           → {PROFILE_MD}")


if __name__ == "__main__":
    main()
