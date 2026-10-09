"""
02_compute_wsf_stats.py
-----------------------
Computes World Settlement Footprint 2019 (WSF2019, DLR, 10 m) statistics for
every GHS-UCDB urban centre:

  wsf_built_share          built-up pixels / all observed pixels inside the polygon
  wsf_built_nonbuilt_ratio built-up pixels / non-built-up pixels
  wsf_built_km2            built-up area (km²)
  wsf_observed_km2         area covered by WSF pixels (km²)

How it works
  * Only the 2°×2° WSF tiles that intersect an urban centre are downloaded.
  * Each tile is downloaded, processed for all cities touching it, and deleted
    straight away, so only a few tiles (≈ MAX_WORKERS) are on disk at any time.
  * WSF tiles carry a 0.1° buffer, i.e. neighbouring tiles overlap. Only pixels
    whose centre lies in the tile's nominal 2°×2° cell are counted, so cities
    spanning several tiles are not double counted.
  * Pixel areas are computed on the sphere per raster row (pixels in EPSG:4326
    shrink towards the poles).
  * Progress is checkpointed in data_raw/checkpoint.jsonl, so an interrupted
    run can simply be restarted.

Input   data_raw/ucdb_polygons.parquet       (from 01_download_ucdb.py)
Output  output/wsf_2019_stats.csv
"""

import argparse
import json
import math
import os
import time
import warnings
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

import geopandas as gpd
import numpy as np
import pandas as pd
import rasterio
import requests
from rasterio.errors import NotGeoreferencedWarning
from rasterio.features import geometry_mask
from rasterio.windows import Window
from tqdm import tqdm

HERE = Path(__file__).resolve().parent
RAW_DIR = HERE / "data_raw"
TILE_DIR = RAW_DIR / "tiles"
UCDB_PATH = RAW_DIR / "ucdb_polygons.parquet"
CHECKPOINT = RAW_DIR / "checkpoint.jsonl"
OUT_PATH = HERE / "output" / "wsf_2019_stats.csv"

WSF_BASE_URL = os.environ.get(
    "WSF_BASE_URL", "https://download.geoservice.dlr.de/WSF2019/files"
).rstrip("/")
TILE_SIZE_DEG = 2
BUILT_VALUE = 255
EARTH_RADIUS_KM = 6371.0088
ID_COL = "ID_UC_G0"

# Spurious warning from rasterio's in-memory rasterisation in geometry_mask
warnings.filterwarnings("ignore", category=NotGeoreferencedWarning)


# ── Tiles ─────────────────────────────────────────────────────────────────────

def tile_name(tx: int, ty: int) -> str:
    return f"WSF2019_v1_{tx}_{ty}.tif"


def tiles_for_bounds(minx, miny, maxx, maxy):
    """All (tx, ty) lower-left corners of 2° tiles intersecting the bbox."""
    x0 = math.floor(minx / TILE_SIZE_DEG) * TILE_SIZE_DEG
    y0 = math.floor(miny / TILE_SIZE_DEG) * TILE_SIZE_DEG
    return [(tx, ty)
            for tx in range(x0, math.floor(maxx / TILE_SIZE_DEG) * TILE_SIZE_DEG + 1, TILE_SIZE_DEG)
            for ty in range(y0, math.floor(maxy / TILE_SIZE_DEG) * TILE_SIZE_DEG + 1, TILE_SIZE_DEG)]


def download_tile(tx: int, ty: int, retries: int = 4) -> Path | None:
    """Download a tile. Returns None if the tile does not exist (e.g. ocean)."""
    name = tile_name(tx, ty)
    dest = TILE_DIR / name
    tmp = dest.with_suffix(".tif.part")
    url = f"{WSF_BASE_URL}/{name}"
    for attempt in range(retries):
        try:
            with requests.get(url, stream=True, timeout=120,
                              headers={"User-Agent": "cities-learning-explorer/wsf-2019"}) as r:
                if r.status_code == 404:
                    return None
                r.raise_for_status()
                with open(tmp, "wb") as f:
                    for chunk in r.iter_content(chunk_size=1 << 20):
                        f.write(chunk)
            tmp.rename(dest)
            return dest
        except (requests.RequestException, OSError):
            tmp.unlink(missing_ok=True)
            if attempt == retries - 1:
                raise
            time.sleep(2 ** attempt)


# ── Raster statistics ─────────────────────────────────────────────────────────

def nominal_pixel_range(src, tx, ty):
    """Row/col range (exclusive end) of pixels whose centres lie in the nominal tile cell."""
    t = src.transform
    resx, resy = t.a, -t.e
    left, top = t.c, t.f
    c_lo = math.ceil((tx - left) / resx - 0.5)
    c_hi = math.ceil((tx + TILE_SIZE_DEG - left) / resx - 0.5)
    r_lo = math.floor((top - (ty + TILE_SIZE_DEG)) / resy - 0.5) + 1
    r_hi = math.floor((top - ty) / resy - 0.5) + 1
    return (max(r_lo, 0), min(r_hi, src.height), max(c_lo, 0), min(c_hi, src.width))


def row_areas_km2(src, row_off, n_rows):
    """Spherical area (km²) of one pixel in each raster row."""
    t = src.transform
    resx_rad = math.radians(t.a)
    resy = -t.e
    lat_top = t.f - (row_off + np.arange(n_rows)) * resy
    lat_bot = lat_top - resy
    return EARTH_RADIUS_KM ** 2 * resx_rad * (np.sin(np.radians(lat_top)) - np.sin(np.radians(lat_bot)))


def stats_for_city_in_tile(src, geom, tx, ty):
    """Return (built_px, valid_px, built_km2, valid_km2) for one city in one tile."""
    t = src.transform
    resx, resy = t.a, -t.e
    r_lo, r_hi, c_lo, c_hi = nominal_pixel_range(src, tx, ty)

    minx, miny, maxx, maxy = geom.bounds
    cc_lo = math.floor((minx - t.c) / resx)
    cc_hi = math.ceil((maxx - t.c) / resx)
    cr_lo = math.floor((t.f - maxy) / resy)
    cr_hi = math.ceil((t.f - miny) / resy)

    row0, row1 = max(r_lo, cr_lo), min(r_hi, cr_hi)
    col0, col1 = max(c_lo, cc_lo), min(c_hi, cc_hi)
    if row1 <= row0 or col1 <= col0:
        return 0, 0, 0.0, 0.0

    window = Window(col0, row0, col1 - col0, row1 - row0)
    data = src.read(1, window=window)
    inside = geometry_mask([geom], out_shape=data.shape,
                           transform=src.window_transform(window), invert=True)

    nodata = src.nodata
    if nodata is not None and nodata not in (0, BUILT_VALUE):
        inside &= data != nodata

    built = inside & (data == BUILT_VALUE)
    areas = row_areas_km2(src, row0, data.shape[0])
    built_rows = built.sum(axis=1)
    valid_rows = inside.sum(axis=1)
    return (int(built_rows.sum()), int(valid_rows.sum()),
            float(built_rows @ areas), float(valid_rows @ areas))


def process_tile(tile, city_ids, geoms):
    """Download one tile, compute stats for its cities, delete it."""
    tx, ty = tile
    path = download_tile(tx, ty)
    if path is None:
        return tile, None
    try:
        out = {}
        with rasterio.open(path) as src:
            for cid in city_ids:
                out[cid] = stats_for_city_in_tile(src, geoms[cid], tx, ty)
        return tile, out
    finally:
        path.unlink(missing_ok=True)


# ── Checkpointing ─────────────────────────────────────────────────────────────

def load_checkpoint():
    done = {}
    if CHECKPOINT.exists():
        with open(CHECKPOINT) as f:
            for line in f:
                rec = json.loads(line)
                done[tuple(rec["tile"])] = rec["stats"]  # None == tile missing
    return done


def append_checkpoint(fh, tile, stats):
    payload = None if stats is None else {str(k): v for k, v in stats.items()}
    fh.write(json.dumps({"tile": list(tile), "stats": payload}) + "\n")
    fh.flush()


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--workers", type=int, default=4,
                        help="tiles downloaded/processed in parallel (default 4; be polite to DLR)")
    parser.add_argument("--limit-tiles", type=int, default=None,
                        help="only process the first N tiles (for a quick test run)")
    args = parser.parse_args()

    TILE_DIR.mkdir(parents=True, exist_ok=True)
    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    for stale in TILE_DIR.glob("*"):          # leftovers of an interrupted run
        stale.unlink()

    gdf = gpd.read_parquet(UCDB_PATH).to_crs("EPSG:4326")
    geoms = dict(zip(gdf[ID_COL].astype(int), gdf.geometry))
    print(f"{len(geoms)} urban centres loaded")

    tile_to_cities = defaultdict(list)
    city_to_tiles = defaultdict(list)
    for cid, geom in geoms.items():
        for tile in tiles_for_bounds(*geom.bounds):
            tile_to_cities[tile].append(cid)
            city_to_tiles[cid].append(tile)
    tiles = sorted(tile_to_cities)
    print(f"{len(tiles)} WSF tiles intersect urban centres")
    if args.limit_tiles:
        tiles = tiles[:args.limit_tiles]
        print(f"Test run: processing only the first {len(tiles)} tiles")

    done = load_checkpoint()
    todo = [t for t in tiles if t not in done]
    print(f"{len(done)} tiles already processed (checkpoint), {len(todo)} to go")

    with open(CHECKPOINT, "a") as ckpt, ThreadPoolExecutor(max_workers=args.workers) as pool:
        futures = [pool.submit(process_tile, t, tile_to_cities[t], geoms) for t in todo]
        for fut in tqdm(as_completed(futures), total=len(futures), desc="WSF tiles"):
            tile, stats = fut.result()
            append_checkpoint(ckpt, tile, stats)
            done[tile] = None if stats is None else {str(k): v for k, v in stats.items()}

    # ── Aggregate per city ──────────────────────────────────────────────────
    acc = defaultdict(lambda: np.zeros(4))
    n_missing = defaultdict(int)
    for tile in tiles:
        stats = done[tile]
        for cid in tile_to_cities[tile]:
            if stats is None:
                n_missing[cid] += 1
            else:
                acc[cid] += np.asarray(stats[str(cid)], dtype=float)

    processed = set(tiles)
    rows = []
    for cid in sorted(geoms):
        city_tiles = city_to_tiles[cid]
        if not set(city_tiles) <= processed:      # only with --limit-tiles
            continue
        built_px, valid_px, built_km2, valid_km2 = acc[cid]
        non_built = valid_px - built_px
        rows.append({
            "id": cid,
            "wsf_built_share": built_px / valid_px if valid_px else np.nan,
            "wsf_built_nonbuilt_ratio": built_px / non_built if non_built else np.nan,
            "wsf_built_km2": built_km2,
            "wsf_observed_km2": valid_km2,
            "wsf_built_px": int(built_px),
            "wsf_valid_px": int(valid_px),
            "wsf_n_tiles": len(city_tiles),
            "wsf_n_tiles_missing": n_missing[cid],
        })

    out = pd.DataFrame(rows)
    out.to_csv(OUT_PATH, index=False, float_format="%.6g")
    print(f"\nWrote {OUT_PATH.relative_to(HERE)} ({len(out)} cities)")
    print(out[["wsf_built_share", "wsf_built_nonbuilt_ratio", "wsf_built_km2"]]
          .describe(percentiles=[.1, .5, .9]).round(3).to_string())
    print(f"Cities without any WSF pixel: {(out['wsf_valid_px'] == 0).sum()}")


if __name__ == "__main__":
    main()
