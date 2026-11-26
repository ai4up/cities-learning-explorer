"""
02_compute_gisa_stats.py
------------------------
Computes impervious / pervious surface statistics from GISA-10m (Huang et al.
2022, 10 m, reference year 2016) for every GHS-UCDB urban centre:

  gisa_impervious_share            impervious pixels / land pixels inside the polygon
  gisa_pervious_share              1 - impervious share
  gisa_pervious_impervious_ratio   pervious land pixels / impervious pixels
  gisa_impervious_km2, gisa_pervious_km2, gisa_land_km2
  gisa_water_share, gisa_water_km2 water inside the polygon (ESA WorldCover 2021, class 80);
                                   water is left out of all shares, so "pervious" is unsealed land
  gisa_impervious_m2_per_capita    impervious area per inhabitant (population from cities.json)
  gisa_cell_sd, gisa_cell_cv, ...  within-city variability: the polygon is cut
                                   into ~1 km x 1 km cells and the impervious share
                                   is computed per cell; SD / CV / percentiles
                                   describe how that share varies across the cells
  gisa_cell_sd_norm                SD / its maximum sqrt(p(1-p)): 0 = evenly sealed,
                                   1 = split into fully sealed and fully unsealed cells
  gisa_sealed_area_share           share of the city in cells that are > 80 % impervious
  gisa_unsealed_area_share         share of the city in cells that are < 20 % impervious
  gisa_reliable                    False if < 10 cells or a GISA tile is missing

How it works
  * GISA-10m is published on Zenodo as one zip per 5° longitude strip, each
    holding 5° x 5° GeoTIFFs (1 = impervious, 0 = everything else, EPSG:4326).
  * Only strips that intersect an urban centre are downloaded. Each strip is
    downloaded, the needed tiles are extracted one at a time, processed and
    deleted, so at most a few hundred MB are on disk at any time.
  * Neighbouring tiles overlap by up to one pixel. Only pixels whose centre lies
    in the tile's nominal 5° x 5° cell are counted, so nothing is double counted.
  * Cells are defined on the global pixel grid (not per tile), so a cell that is
    cut by a tile border is summed correctly across both tiles.
  * Pixel areas are computed on the sphere per raster row.
  * Progress is checkpointed per strip in data_raw/checkpoint.jsonl, so an
    interrupted run can simply be restarted.

Input   data_raw/ucdb_polygons.parquet       (from 01_download_ucdb.py)
Output  output/gisa_10m_stats.csv
"""

import argparse
import json
import math
import re
import time
import warnings
import zipfile
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

import geopandas as gpd
import numpy as np
import pandas as pd
import rasterio
import requests
from rasterio.errors import NotGeoreferencedWarning, RasterioIOError
from rasterio.features import geometry_mask
from rasterio.windows import Window
from shapely.affinity import translate
from tqdm import tqdm

HERE = Path(__file__).resolve().parent
RAW_DIR = HERE / "data_raw"
TILE_DIR = RAW_DIR / "tiles"
UCDB_PATH = RAW_DIR / "ucdb_polygons.parquet"
CHECKPOINT = RAW_DIR / "checkpoint.jsonl"
OUT_PATH = HERE / "output" / "gisa_10m_stats.csv"

ZENODO_RECORD = "https://zenodo.org/api/records/6991620"   # GISA-10m v01, per-strip zips
USER_AGENT = "gisa-10m-urban-centre-stats"
TILE_SIZE_DEG = 5
IMPERVIOUS_VALUE = 1
EARTH_RADIUS_KM = 6371.0088
ID_COL = "ID_UC_G0"

# Within-city cells: CELL_ROWS pixel rows (~1 km north-south) by as many pixel
# columns as needed to be ~1 km east-west at the city's latitude.
CELL_ROWS = 100
CELL_TARGET_KM = 1.0
# Cells with less than this share of their pixels inside the polygon (slivers
# along the boundary) are left out of the within-city statistics.
MIN_CELL_COVERAGE = 0.5
# Cells above / below these impervious shares count as "sealed" / "unsealed".
SEALED_THRESHOLD = 0.8
UNSEALED_THRESHOLD = 0.2
# Within-city statistics of cities with fewer cells than this are flagged as unreliable.
MIN_RELIABLE_CELLS = 10
# Population per urban centre (for impervious area per person); optional.
CITIES_JSON = HERE.parent.parent / "public" / "cities.json"

# Water mask: ESA WorldCover 2021 v200 (10 m, class 80 = permanent water), read by window
# straight from the public cloud-optimised GeoTIFFs (3° x 3° tiles, nothing is downloaded).
WATER_BASE_URL = "https://esa-worldcover.s3.eu-central-1.amazonaws.com/v200/2021/map"
WATER_TILE_DEG = 3
WATER_PX_PER_DEG = 12000
WATER_VALUE = 80
BUILT_VALUE_2021 = 50             # WorldCover "built-up": buildings, roads and other man-made surfaces
WATER_THREADS = 6                 # parallel window reads per GISA tile
WATER_BATCH_PX = 300_000_000      # at most this many pixels of water masks in memory per tile
GDAL_HTTP = dict(GDAL_DISABLE_READDIR_ON_OPEN="EMPTY_DIR", CPL_VSIL_CURL_ALLOWED_EXTENSIONS=".tif",
                 GDAL_HTTP_MAX_RETRY="5", GDAL_HTTP_RETRY_DELAY="2", VSI_CACHE="TRUE")
_water_tiles_missing = set()      # WorldCover tiles that do not exist (open sea)

# Spurious warning from rasterio's in-memory rasterisation in geometry_mask
warnings.filterwarnings("ignore", category=NotGeoreferencedWarning)


# ── Strips and tiles ──────────────────────────────────────────────────────────

def strip_index():
    """{left longitude of strip: download url} from the Zenodo record."""
    r = requests.get(ZENODO_RECORD, timeout=120, headers={"User-Agent": USER_AGENT})
    r.raise_for_status()
    out = {}
    for f in r.json()["files"]:
        m = re.fullmatch(r"GISA-10m_v01_(\d+)([EW])\.zip", f["key"])
        if m:
            lon = int(m.group(1)) * (1 if m.group(2) == "E" else -1)
            out[lon] = f["links"]["self"]
    if not out:
        raise SystemExit("No GISA-10m strip files found in the Zenodo record")
    return out


def tiles_for_bounds(minx, miny, maxx, maxy):
    """All (tx, ty) lower-left corners of 5° tiles intersecting the bbox."""
    s = TILE_SIZE_DEG
    return [(tx, ty)
            for tx in range(math.floor(minx / s) * s, math.floor(maxx / s) * s + 1, s)
            for ty in range(math.floor(miny / s) * s, math.floor(maxy / s) * s + 1, s)]


def download(url: str, dest: Path, retries: int = 5) -> None:
    tmp = dest.with_suffix(dest.suffix + ".part")
    for attempt in range(retries):
        try:
            with requests.get(url, stream=True, timeout=300,
                              headers={"User-Agent": USER_AGENT}) as r:
                r.raise_for_status()
                with open(tmp, "wb") as f:
                    for chunk in r.iter_content(chunk_size=1 << 20):
                        f.write(chunk)
            tmp.rename(dest)
            return
        except (requests.RequestException, OSError):
            tmp.unlink(missing_ok=True)
            if attempt == retries - 1:
                raise
            time.sleep(15 * 2 ** attempt)     # Zenodo rate limits; back off generously


def tile_of_raster(src):
    """
    Nominal (tx, ty) lower-left corner of a GISA tile, read from its bounds, and the
    longitude shift of its georeferencing: the 180°W strip is stored at 180°E..185°E.
    """
    s = TILE_SIZE_DEG
    b = src.bounds
    tx, ty = round(b.left / s) * s, round(b.bottom / s) * s
    shift = 360 if tx >= 180 else 0
    return (tx - shift, ty), shift


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


def cell_cols_for_lat(lat_deg, res_deg):
    """Pixel columns per cell so that a cell is ~CELL_TARGET_KM wide at this latitude."""
    px_km = EARTH_RADIUS_KM * math.radians(res_deg) * max(math.cos(math.radians(lat_deg)), 0.05)
    return max(1, round(CELL_TARGET_KM / px_km))


def block_sums(mask, starts_r, starts_c):
    """Sum a boolean array over the blocks that start at the given rows / cols."""
    s = np.add.reduceat(mask, starts_c, axis=1, dtype=np.int32)
    return np.add.reduceat(s, starts_r, axis=0, dtype=np.int32)


def water_tile_url(lon0, lat0):
    ns, ew = ("N" if lat0 >= 0 else "S"), ("E" if lon0 >= 0 else "W")
    return f"{WATER_BASE_URL}/ESA_WorldCover_10m_2021_v200_{ns}{abs(lat0):02d}{ew}{abs(lon0):03d}_Map.tif"


def read_water_tile(lon0, lat0, row_lo, row_hi, col_lo, col_hi, retries=6):
    """Rows/cols [lo, hi) of one WorldCover tile (class codes); None if the tile does not exist."""
    url = water_tile_url(lon0, lat0)
    if url in _water_tiles_missing:
        return None
    for attempt in range(retries):
        try:
            with rasterio.Env(**GDAL_HTTP), rasterio.open(url) as wc:
                return wc.read(1, window=Window(col_lo, row_lo, col_hi - col_lo, row_hi - row_lo))
        except RasterioIOError:
            # WorldCover publishes no tile over open sea. A failed read alone does not prove
            # that: the tile counts as missing only if the bucket listing says so.
            if water_tile_exists(url) is False:
                _water_tiles_missing.add(url)
                return None
            if attempt == retries - 1:
                raise
            time.sleep(5 * 2 ** attempt)


def water_tile_exists(url):
    """True / False from the public bucket listing; None if the listing could not be read."""
    key = url.split(".amazonaws.com/", 1)[1]
    try:
        r = requests.get(url.split("/v200/")[0] + "/", params={"list-type": "2", "prefix": key},
                         timeout=60, headers={"User-Agent": USER_AGENT})
    except requests.RequestException:
        return None
    if r.status_code != 200 or "<ListBucketResult" not in r.text:
        return None
    return f"<Key>{key}</Key>" in r.text


def water_mask(left, top, n_rows, n_cols, res):
    """Boolean water mask for a block of GISA pixels (see land_cover)."""
    return land_cover(left, top, n_rows, n_cols, res) == WATER_VALUE


def land_cover(left, top, n_rows, n_cols, res):
    """
    WorldCover 2021 class of every pixel in a block of GISA pixels (left / top = outer edge of
    the block, true longitudes). Every GISA pixel takes the WorldCover class at its centre
    (nearest neighbour). Where WorldCover has no tile (open sea) the pixel counts as water.
    """
    lon = left + (np.arange(n_cols) + 0.5) * res
    lat = top - (np.arange(n_rows) + 0.5) * res
    cover = np.zeros((n_rows, n_cols), dtype=np.uint8)
    d = WATER_TILE_DEG
    for lon0 in range(math.floor(lon[0] / d) * d, math.floor(lon[-1] / d) * d + 1, d):
        cols = np.flatnonzero((lon >= lon0) & (lon < lon0 + d))
        for lat0 in range(math.floor(lat[-1] / d) * d, math.floor(lat[0] / d) * d + 1, d):
            rows = np.flatnonzero((lat >= lat0) & (lat < lat0 + d))
            if not len(rows) or not len(cols):
                continue
            n = d * WATER_PX_PER_DEG
            src_c = np.clip(np.floor((lon[cols] - lon0) * WATER_PX_PER_DEG).astype(int), 0, n - 1)
            src_r = np.clip(np.floor((lat0 + d - lat[rows]) * WATER_PX_PER_DEG).astype(int), 0, n - 1)
            arr = read_water_tile(lon0, lat0, src_r.min(), src_r.max() + 1, src_c.min(), src_c.max() + 1)
            cover[np.ix_(rows, cols)] = WATER_VALUE if arr is None else \
                arr[np.ix_(src_r - src_r.min(), src_c - src_c.min())]
    return cover


def city_window(src, geom, tx, ty):
    """(row0, row1, col0, col1) of the city's pixels in this tile's nominal cell, or None."""
    t = src.transform
    resx, resy = t.a, -t.e
    r_lo, r_hi, c_lo, c_hi = nominal_pixel_range(src, tx, ty)
    minx, miny, maxx, maxy = geom.bounds
    row0 = max(r_lo, math.floor((t.f - maxy) / resy))
    row1 = min(r_hi, math.ceil((t.f - miny) / resy))
    col0 = max(c_lo, math.floor((minx - t.c) / resx))
    col1 = min(c_hi, math.ceil((maxx - t.c) / resx))
    return None if row1 <= row0 or col1 <= col0 else (row0, row1, col0, col1)


def stats_for_window(src, geom, win, cell_cols, lon_shift, cover):
    """
    Returns ([imp_px, land_px, imp_km2, land_km2, water_px, water_km2, built21_px, built21_km2],
    cells) for one city in one tile.
    cells = [[cell_row, cell_col, imp_px, land_px, built21_px], ...] on the global cell grid.
    cover = WorldCover 2021 class per pixel. Water pixels (WorldCover water that GISA does not
    map as impervious) are left out of the land area, so all shares refer to land.
    built21 = WorldCover 2021 built-up pixels on that same land area.
    """
    t = src.transform
    resx, resy = t.a, -t.e
    row0, row1, col0, col1 = win
    window = Window(col0, row0, col1 - col0, row1 - row0)
    data = src.read(1, window=window)
    inside = geometry_mask([geom], out_shape=data.shape,
                           transform=src.window_transform(window), invert=True)
    imperv = inside & (data == IMPERVIOUS_VALUE)
    wet = inside & (cover == WATER_VALUE) & ~imperv
    land = inside & ~wet
    built21 = land & (cover == BUILT_VALUE_2021)

    areas = row_areas_km2(src, row0, data.shape[0])
    imp_rows, land_rows, wet_rows = imperv.sum(axis=1), land.sum(axis=1), wet.sum(axis=1)
    b21_rows = built21.sum(axis=1)
    totals = [int(imp_rows.sum()), int(land_rows.sum()), float(imp_rows @ areas),
              float(land_rows @ areas), int(wet_rows.sum()), float(wet_rows @ areas),
              int(b21_rows.sum()), float(b21_rows @ areas)]
    if totals[1] == 0:
        return totals, []

    # Global pixel indices (all GISA tiles share one grid anchored at lon 0 / lat 0;
    # rows count southwards). Cells are blocks of that global grid.
    g_row = round(-t.f / resy) + row0 + np.arange(data.shape[0])
    g_col = round((t.c - lon_shift) / resx) + col0 + np.arange(data.shape[1])
    cell_r = g_row // CELL_ROWS
    cell_c = g_col // cell_cols
    starts_r = np.flatnonzero(np.r_[True, np.diff(cell_r) != 0])
    starts_c = np.flatnonzero(np.r_[True, np.diff(cell_c) != 0])

    land_cells = block_sums(land, starts_r, starts_c)
    imp_cells = block_sums(imperv, starts_r, starts_c)
    b21_cells = block_sums(built21, starts_r, starts_c)
    ii, jj = np.nonzero(land_cells)
    cells = [[int(cell_r[starts_r[i]]), int(cell_c[starts_c[j]]), int(imp_cells[i, j]),
              int(land_cells[i, j]), int(b21_cells[i, j])] for i, j in zip(ii, jj)]
    return totals, cells


def stats_for_tile(src, tile, lon_shift, city_ids, geoms, cell_cols):
    """
    Statistics of all cities touching one GISA tile. The water masks are fetched in parallel
    (remote reads), a limited number of pixels at a time; the GISA reads are sequential.
    lon_shift: degrees the raster's longitudes are offset from the true ones (180°W strip).
    """
    tx, ty = tile
    t = src.transform
    out, jobs = {}, []
    for cid in city_ids:
        geom = translate(geoms[cid], xoff=lon_shift) if lon_shift else geoms[cid]
        win = city_window(src, geom, tx + lon_shift, ty)
        if win is None:
            out[str(cid)] = ([0, 0, 0.0, 0.0, 0, 0.0, 0, 0.0], [])
        else:
            jobs.append((cid, geom, win))

    def fetch(job):
        row0, row1, col0, col1 = job[2]
        return land_cover(t.c - lon_shift + col0 * t.a, t.f + row0 * t.e,
                          row1 - row0, col1 - col0, t.a)

    batches, batch, batch_px = [], [], 0
    for job in jobs:
        px = (job[2][1] - job[2][0]) * (job[2][3] - job[2][2])
        if batch and batch_px + px > WATER_BATCH_PX:
            batches.append(batch)
            batch, batch_px = [], 0
        batch.append(job)
        batch_px += px
    if batch:
        batches.append(batch)

    with ThreadPoolExecutor(max_workers=WATER_THREADS) as pool:
        for batch in batches:
            for (cid, geom, win), cover in zip(batch, list(pool.map(fetch, batch))):
                out[str(cid)] = stats_for_window(src, geom, win, cell_cols[cid], lon_shift, cover)
    return out


def process_strip(lon, url, strip_tiles, tile_to_cities, geoms, cell_cols):
    """Download one longitude strip, compute stats for all its tiles, delete it."""
    zip_path = TILE_DIR / f"strip_{lon}.zip"
    work_dir = TILE_DIR / f"strip_{lon}"
    download(url, zip_path)
    result = {}                              # "tx,ty" -> {city id: [totals, cells]} | None
    try:
        with zipfile.ZipFile(zip_path) as zf:
            for member in (m for m in zf.namelist() if m.lower().endswith(".tif")):
                path = Path(zf.extract(member, work_dir))
                try:
                    with rasterio.open(path) as src:
                        tile, lon_shift = tile_of_raster(src)
                        if tile[0] != lon:
                            raise RuntimeError(f"{member}: expected strip {lon}, found tile {tile}")
                        if tile not in strip_tiles:
                            continue
                        result[f"{tile[0]},{tile[1]}"] = stats_for_tile(
                            src, tile, lon_shift, tile_to_cities[tile], geoms, cell_cols)
                finally:
                    path.unlink(missing_ok=True)
    finally:
        zip_path.unlink(missing_ok=True)
        if work_dir.exists():
            for p in sorted(work_dir.rglob("*"), reverse=True):
                p.rmdir() if p.is_dir() else p.unlink()
            work_dir.rmdir()
    for tx, ty in strip_tiles:               # tiles not published (open sea)
        result.setdefault(f"{tx},{ty}", None)
    return lon, result


# ── Checkpointing ─────────────────────────────────────────────────────────────

def checkpoint_config(gdf):
    """
    Everything the stored per-cell counts depend on. Checkpoint records written with other
    settings (cell size, polygons) are ignored, so those strips are simply processed again.
    """
    return {"cell_rows": CELL_ROWS, "cell_target_km": CELL_TARGET_KM, "water": WATER_BASE_URL, "built_2021": BUILT_VALUE_2021,
            "n_polygons": len(gdf), "polygon_bounds": [round(v, 6) for v in gdf.total_bounds]}


def load_checkpoint(config):
    done = {}
    if CHECKPOINT.exists():
        with open(CHECKPOINT) as f:
            for line in f:
                rec = json.loads(line)
                if rec.get("config") == config:
                    done[rec["strip"]] = rec["tiles"]
    return done


# ── Within-city variability ───────────────────────────────────────────────────

def cell_stats(cells, cell_px, column=0, prefix="gisa"):
    """
    Summary of the sealed share across the ~1 km cells of one city.
    cells = {(row, col): [imp_px, land_px, built21_px]}; column 0 = GISA-10m 2016,
    column 2 = WorldCover 2021 built-up.
    """
    names = ["cell_sd", "cell_sd_norm", "cell_cv", "cell_mean", "sealed_area_share",
             "unsealed_area_share", "cell_p10", "cell_median", "cell_p90"]
    empty = {f"{prefix}_{n}": np.nan for n in names} | {f"{prefix}_n_cells": 0}
    if not cells:
        return empty
    arr = np.array(list(cells.values()), dtype=float)
    arr = arr[arr[:, 1] >= MIN_CELL_COVERAGE * cell_px]
    if len(arr) == 0:
        return empty
    share, w = arr[:, column] / arr[:, 1], arr[:, 1]
    mean = np.average(share, weights=w)                     # pixel weighted
    sd = math.sqrt(np.average((share - mean) ** 2, weights=w))
    p10, p50, p90 = np.percentile(share, [10, 50, 90])
    sd_max = math.sqrt(mean * (1 - mean))                   # SD if every cell were 0 or 1
    values = [sd, sd / sd_max if sd_max > 0 else np.nan, sd / mean if mean > 0 else np.nan, mean,
              w[share > SEALED_THRESHOLD].sum() / w.sum(),
              w[share < UNSEALED_THRESHOLD].sum() / w.sum(), p10, p50, p90]
    return {f"{prefix}_{n}": v for n, v in zip(names, values)} | {f"{prefix}_n_cells": len(arr)}


def load_population():
    """{city id: population} from public/cities.json, or {} if the file is not there."""
    if not CITIES_JSON.exists():
        print(f"{CITIES_JSON} not found: gisa_impervious_m2_per_capita left empty")
        return {}
    with open(CITIES_JSON) as f:
        return {c["id"]: (c.get("characteristics") or {}).get("population") for c in json.load(f)}


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--workers", type=int, default=2,
                        help="strips downloaded/processed in parallel (default 2; Zenodo rate limits)")
    parser.add_argument("--strips", type=str, default=None,
                        help="comma separated left longitudes, e.g. '0,5,-75' (for a quick test run)")
    args = parser.parse_args()

    TILE_DIR.mkdir(parents=True, exist_ok=True)
    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    for stale in sorted(TILE_DIR.rglob("*"), reverse=True):   # leftovers of an interrupted run
        stale.rmdir() if stale.is_dir() else stale.unlink()

    gdf = gpd.read_parquet(UCDB_PATH).to_crs("EPSG:4326")
    geoms = dict(zip(gdf[ID_COL].astype(int), gdf.geometry))
    print(f"{len(geoms)} urban centres loaded")

    urls = strip_index()
    res_deg = 8.983152841195215e-05                         # GISA-10m pixel size
    cell_cols = {cid: cell_cols_for_lat(g.centroid.y, res_deg) for cid, g in geoms.items()}

    tile_to_cities = defaultdict(list)
    city_to_tiles = defaultdict(list)
    for cid, geom in geoms.items():
        for tile in tiles_for_bounds(*geom.bounds):
            tile_to_cities[tile].append(cid)
            city_to_tiles[cid].append(tile)
    strips = defaultdict(set)
    for tx, ty in tile_to_cities:
        strips[tx].add((tx, ty))
    print(f"{len(tile_to_cities)} GISA tiles in {len(strips)} longitude strips intersect urban centres")

    if args.strips:
        wanted = {int(s) for s in args.strips.split(",")}
        strips = {lon: t for lon, t in strips.items() if lon in wanted}
        print(f"Test run: only strips {sorted(strips)}")

    config = json.loads(json.dumps(checkpoint_config(gdf)))
    done = load_checkpoint(config)
    todo = [lon for lon in sorted(strips) if lon not in done]
    print(f"{len(strips) - len(todo)} strips already processed (checkpoint), {len(todo)} to go")

    def run_strips(lons, workers, ckpt):
        """Process strips in parallel; returns the strips that failed (network errors etc.)."""
        failed = []
        with ThreadPoolExecutor(max_workers=workers) as pool:
            futures = {pool.submit(process_strip, lon, urls[lon], strips[lon],
                                   tile_to_cities, geoms, cell_cols): lon for lon in lons}
            for fut in tqdm(as_completed(futures), total=len(futures), desc="GISA strips"):
                lon = futures[fut]
                try:
                    _, rec = fut.result()
                except Exception as exc:                     # keep going, retry this strip later
                    print(f"\nStrip {lon} failed: {type(exc).__name__}: {str(exc)[:200]}", flush=True)
                    failed.append(lon)
                    continue
                ckpt.write(json.dumps({"strip": lon, "config": config, "tiles": rec}) + "\n")
                ckpt.flush()
                done[lon] = json.loads(json.dumps(rec))      # same shape as when re-loaded
        return failed

    with open(CHECKPOINT, "a") as ckpt:
        for lon in [l for l in todo if l not in urls]:       # strip not published (open sea)
            rec = {f"{tx},{ty}": None for tx, ty in strips[lon]}
            ckpt.write(json.dumps({"strip": lon, "config": config, "tiles": rec}) + "\n")
            done[lon] = rec
        failed = run_strips([l for l in todo if l in urls], args.workers, ckpt)
        for attempt in range(2):                             # failed strips again, one at a time
            if not failed:
                break
            print(f"Retrying {len(failed)} failed strips: {sorted(failed)}", flush=True)
            failed = run_strips(failed, 1, ckpt)
    if failed:
        raise SystemExit(f"{len(failed)} strips could not be processed: {sorted(failed)}. "
                         "Run again to resume from the checkpoint.")

    # ── Aggregate per city ──────────────────────────────────────────────────
    totals = defaultdict(lambda: np.zeros(8))
    cells = defaultdict(lambda: defaultdict(lambda: np.zeros(3)))
    n_missing = defaultdict(int)
    for lon in strips:
        for key, tile_stats in done[lon].items():
            tile = tuple(int(v) for v in key.split(","))
            for cid in tile_to_cities[tile]:
                if tile_stats is None:
                    n_missing[cid] += 1
                    continue
                city_totals, city_cells = tile_stats[str(cid)]
                totals[cid] += np.asarray(city_totals, dtype=float)
                for r, c, imp, valid, b21 in city_cells:
                    cells[cid][(r, c)] += (imp, valid, b21)

    population = load_population()
    rows = []
    for cid in sorted(geoms):
        city_tiles = city_to_tiles[cid]
        if not {tx for tx, _ in city_tiles} <= set(strips):   # only with --strips
            continue
        (imp_px, valid_px, imp_km2, valid_km2, water_px, water_km2,
         b21_px, b21_km2) = totals[cid]                                           # valid = land
        perv_px = valid_px - imp_px
        within = cell_stats(cells[cid], CELL_ROWS * cell_cols[cid])
        within21 = cell_stats(cells[cid], CELL_ROWS * cell_cols[cid], column=2, prefix="wc21")
        del within21["wc21_n_cells"]                         # same cells as gisa_n_cells
        pop = population.get(cid)
        rows.append({
            "id": cid,
            "gisa_impervious_share": imp_px / valid_px if valid_px else np.nan,
            "gisa_pervious_share": perv_px / valid_px if valid_px else np.nan,
            "gisa_pervious_impervious_ratio": perv_px / imp_px if imp_px else np.nan,
            "gisa_impervious_km2": imp_km2,
            "gisa_pervious_km2": valid_km2 - imp_km2,
            "gisa_land_km2": valid_km2,
            "gisa_water_km2": water_km2,
            "gisa_water_share": water_px / (valid_px + water_px) if valid_px + water_px else np.nan,
            "gisa_observed_km2": valid_km2 + water_km2,
            "gisa_impervious_m2_per_capita": imp_km2 * 1e6 / pop if pop and valid_px else np.nan,
            **within,
            # False: too few cells for a stable SD, or part of the city has no GISA tile
            "gisa_reliable": bool(within["gisa_n_cells"] >= MIN_RELIABLE_CELLS
                                  and n_missing[cid] == 0),
            # ── same indicators from ESA WorldCover 2021 built-up (newer, other definition) ──
            "wc21_built_share": b21_px / valid_px if valid_px else np.nan,
            "wc21_built_km2": b21_km2,
            "wc21_built_m2_per_capita": b21_km2 * 1e6 / pop if pop and valid_px else np.nan,
            **within21,
            "wc21_built_px": int(b21_px),
            "gisa_impervious_px": int(imp_px),
            "gisa_valid_px": int(valid_px),
            "gisa_water_px": int(water_px),
            "gisa_n_tiles": len(city_tiles),
            "gisa_n_tiles_missing": n_missing[cid],
        })

    out = pd.DataFrame(rows)
    # a test run on a few strips must not replace the full result
    out_path = OUT_PATH.with_name("gisa_10m_stats_test.csv") if args.strips else OUT_PATH
    out.to_csv(out_path, index=False, float_format="%.6g")
    print(f"\nWrote {out_path.relative_to(HERE)} ({len(out)} cities)")
    print(out[["gisa_impervious_share", "gisa_impervious_m2_per_capita", "gisa_cell_sd",
               "gisa_cell_sd_norm", "gisa_sealed_area_share", "gisa_unsealed_area_share",
               "gisa_n_cells"]]
          .describe(percentiles=[.1, .5, .9]).round(3).to_string())
    print(f"Cities without any GISA pixel: {(out['gisa_valid_px'] == 0).sum()}")
    print(f"Water share of the polygon area: median {out['gisa_water_share'].median():.3f}, "
          f"above 10 % in {(out['gisa_water_share'] > 0.10).sum()} cities")
    print(f"Cities flagged as not reliable: {(~out['gisa_reliable']).sum()}")
    print(f"WorldCover 2021 built-up share: median {out['wc21_built_share'].median():.3f} "
          f"(GISA-10m 2016: {out['gisa_impervious_share'].median():.3f})")


if __name__ == "__main__":
    main()
