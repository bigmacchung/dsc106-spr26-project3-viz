"""
fetch_layers.py — pulls cloud-piercing alternate views of the existing 8 dates.

Some Terra true-color images on the locked dates have heavy clouds.
NASA GIBS publishes the *same date* through multiple layers; switching
between them in the UI lets the viewer see California through the day's
clearest pass.

Layers fetched:
  * MODIS_Aqua_CorrectedReflectance_TrueColor   — Aqua satellite afternoon
                                                 overpass, often a different
                                                 cloud pattern from Terra.
  * MODIS_Terra_CorrectedReflectance_Bands721   — false-color band combo;
                                                 snow appears RED, clouds
                                                 WHITE, vegetation GREEN.
                                                 Sees through thin haze.

Run:
    pip install requests
    python3 fetch_layers.py

~16 small HTTP requests (~30 s).
"""
from __future__ import annotations
import sys, time
from pathlib import Path
import requests

ROOT = Path(__file__).resolve().parent
OUT  = ROOT / "data" / "raw" / "vegetation"
OUT.mkdir(parents=True, exist_ok=True)

WMS  = "https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi"
BBOX = "-125,32,-114,42"
W, H = 1100, 1000

# Date list mirrors the existing Terra true-color filenames in the folder.
# Edit if you add new dates.
DATES = [
    "2023-01-01", "2023-04-07", "2023-07-12", "2023-10-16",
    "2024-01-01", "2024-04-06", "2024-07-11", "2024-10-15",
]

# (layer-id, output-filename-prefix)
ALT_LAYERS = [
    ("MODIS_Aqua_CorrectedReflectance_TrueColor",  "aqua_truecolor"),
    ("MODIS_Terra_CorrectedReflectance_Bands721",  "bands721"),
]


def fetch(layer: str, date_str: str) -> bytes:
    params = {
        "SERVICE": "WMS", "REQUEST": "GetMap", "VERSION": "1.1.1",
        "LAYERS": layer, "STYLES": "", "FORMAT": "image/jpeg",
        "SRS": "EPSG:4326", "BBOX": BBOX,
        "WIDTH": str(W), "HEIGHT": str(H), "TIME": date_str,
    }
    r = requests.get(WMS, params=params, timeout=60)
    r.raise_for_status()
    if "image" not in r.headers.get("Content-Type", ""):
        raise RuntimeError(f"non-image: {r.text[:200]}")
    if len(r.content) < 4_000:
        raise RuntimeError(f"placeholder ({len(r.content)} B)")
    return r.content


def main():
    print(f"Saving to: {OUT}\n", flush=True)
    saved, skipped, failed = 0, 0, 0
    for date_str in DATES:
        for layer, prefix in ALT_LAYERS:
            fname = f"california_{prefix}_{date_str}.jpg"
            path  = OUT / fname
            if path.exists() and path.stat().st_size > 4_000:
                print(f"  [skip] {fname}", flush=True)
                skipped += 1
                continue
            try:
                data = fetch(layer, date_str)
                path.write_bytes(data)
                print(f"  [ok]   {fname}  ({len(data)//1024} KB)", flush=True)
                saved += 1
            except Exception as exc:
                print(f"  [FAIL] {fname}  {exc}", flush=True)
                failed += 1
            time.sleep(0.4)
    print(f"\nDone. saved={saved} skipped={skipped} failed={failed}")
    print(f"Total JPGs in {OUT}: {len(list(OUT.glob('*.jpg')))}")
    print("\nNext: python3 artifacts/data_explorer.py")


if __name__ == "__main__":
    main()
