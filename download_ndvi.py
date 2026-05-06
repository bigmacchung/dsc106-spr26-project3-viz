import requests
from pathlib import Path

out_dir = Path("data/raw/vegetation")
out_dir.mkdir(parents=True, exist_ok=True)

# California bounding box: min_lon, min_lat, max_lon, max_lat
bbox = "-124.5,32.5,-114.0,42.0"

dates = [
    "2023-01-01",
    "2023-04-07",
    "2023-07-12",
    "2023-10-16",
    "2024-01-01",
    "2024-04-06",
    "2024-07-11",
    "2024-10-15",
]

layer = "MODIS_Terra_CorrectedReflectance_TrueColor"
base = "https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi"

for date in dates:
    params = {
        "SERVICE": "WMS",
        "REQUEST": "GetMap",
        "VERSION": "1.1.1",
        "LAYERS": layer,
        "STYLES": "",
        "FORMAT": "image/jpeg",
        "SRS": "EPSG:4326",
        "BBOX": bbox,
        "WIDTH": 1200,
        "HEIGHT": 1000,
        "TIME": date,
    }

    print(f"Downloading {date}...")
    r = requests.get(base, params=params, timeout=60)

    print(r.status_code, r.headers.get("content-type"))

    filename = out_dir / f"california_truecolor_{date}.jpg"
    filename.write_bytes(r.content)

print("Done.")