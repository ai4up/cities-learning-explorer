"""
04_plot_example_cities.py
-------------------------
Maps GISA-10m inside a few example urban centres. For every city two panels:

  left    impervious share at ~100 m (10 x 10 pixel blocks)
  right   impervious share in the ~1 km cells that the within-city statistics
          (gisa_cell_sd, gisa_cell_sd_norm, ...) are computed from

Only the GISA strips of the chosen cities are downloaded (and deleted again).

Input   data_raw/ucdb_polygons.parquet   (from 01_download_ucdb.py)
        output/gisa_10m_stats.csv        (from 02_compute_gisa_stats.py)
        ../../public/cities.json         (city names)
Output  output/plots/gisa_10m_example_cities.{png,pdf}              each city zoomed to its extent
        output/plots/gisa_10m_example_cities_same_scale.{png,pdf}   all cities at the same map scale

  python 04_plot_example_cities.py
  python 04_plot_example_cities.py --cities "Zurich,Paris,Los Angeles" --name three_cities
"""

import argparse
import importlib.util
import json
import math
import zipfile
from pathlib import Path

import geopandas as gpd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import rasterio
from matplotlib.colors import LinearSegmentedColormap
from rasterio.features import geometry_mask
from rasterio.transform import from_origin
from rasterio.windows import Window

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("gisa", HERE / "02_compute_gisa_stats.py")
gisa = importlib.util.module_from_spec(spec)
spec.loader.exec_module(gisa)

STATS_CSV = HERE / "output" / "gisa_10m_stats.csv"
PLOT_DIR = HERE / "output" / "plots"
DEFAULT_CITIES = "Zurich,Paris,Los Angeles,Lagos,São Paulo,Shanghai"
RES = 8.983152841195215e-05           # GISA-10m pixel size (degrees)
FINE_BLOCK = 10                       # left panel: 10 x 10 pixels (~100 m)

# One hue, light -> dark (same green as the other figures); grey = outside the polygon
CMAP = LinearSegmentedColormap.from_list(
    "impervious", ["#F4F7F5", "#B9D8CC", "#5FA58F", "#085041", "#03241D"])
CMAP.set_bad("white")
INK, MUTED = "#222222", "#666666"


def find_city(name, cities):
    """Largest urban centre whose name matches (exact match first, then 'starts with')."""
    key = name.strip().lower()
    hits = [c for c in cities if c["name"].lower() == key] or \
           [c for c in cities if c["name"].lower().startswith(key)]
    if not hits:
        raise SystemExit(f"No urban centre named '{name}' in cities.json")
    return max(hits, key=lambda c: (c.get("characteristics") or {}).get("population") or 0)


def block_mean(num, den, block_r, block_c):
    """Share num/den over blocks; NaN where a block has (almost) no pixel inside the polygon."""
    rows = np.arange(0, num.shape[0], block_r)
    cols = np.arange(0, num.shape[1], block_c)
    n = gisa.block_sums(num, rows, cols).astype(float)
    d = gisa.block_sums(den, rows, cols).astype(float)
    return np.where(d >= 0.5 * block_r * block_c, n / np.maximum(d, 1), np.nan)


def read_city(geom, tifs):
    """
    Mosaic of the GISA pixels in the city's bounding box, on the global pixel grid.
    Returns (data, inside, transform, (first global row, first global col)).
    tifs = {(tx, ty): path}; pixels of tiles that are not available count as outside.
    """
    minx, miny, maxx, maxy = geom.bounds
    c0, c1 = math.floor(minx / RES), math.ceil(maxx / RES)        # global columns
    r0, r1 = math.floor(-maxy / RES), math.ceil(-miny / RES)      # global rows (southwards)
    data = np.zeros((r1 - r0, c1 - c0), dtype=np.uint8)
    covered = np.zeros(data.shape, dtype=bool)
    for (tx, ty), path in tifs.items():
        with rasterio.open(path) as src:
            t = src.transform
            g_r, g_c = round(-t.f / RES), round(t.c / RES)        # global index of the tile origin
            n_r0, n_r1, n_c0, n_c1 = gisa.nominal_pixel_range(src, tx, ty)
            rr0, rr1 = max(r0, g_r + n_r0), min(r1, g_r + n_r1)
            cc0, cc1 = max(c0, g_c + n_c0), min(c1, g_c + n_c1)
            if rr1 <= rr0 or cc1 <= cc0:
                continue
            window = Window(cc0 - g_c, rr0 - g_r, cc1 - cc0, rr1 - rr0)
            data[rr0 - r0:rr1 - r0, cc0 - c0:cc1 - c0] = src.read(1, window=window)
            covered[rr0 - r0:rr1 - r0, cc0 - c0:cc1 - c0] = True
    transform = from_origin(c0 * RES, -r0 * RES, RES, RES)
    inside = geometry_mask([geom], out_shape=data.shape, transform=transform, invert=True)
    # water is left out, exactly as in 02_compute_gisa_stats.py
    water = gisa.water_mask(c0 * RES, -r0 * RES, data.shape[0], data.shape[1], RES)
    inside &= ~(water & (data != gisa.IMPERVIOUS_VALUE))
    return data, inside & covered, transform, (r0, c0)


def fetch_tiles(tiles, urls, work_dir):
    """Download the strips of the given tiles; returns {(tx, ty): path of the extracted tif}."""
    out = {}
    for lon in sorted({tx for tx, _ in tiles}):
        if lon not in urls:
            continue
        zip_path = work_dir / f"strip_{lon}.zip"
        print(f"Downloading GISA strip {lon} ...")
        gisa.download(urls[lon], zip_path)
        with zipfile.ZipFile(zip_path) as zf:
            for member in (m for m in zf.namelist() if m.lower().endswith(".tif")):
                path = Path(zf.extract(member, work_dir / f"strip_{lon}"))
                with rasterio.open(path) as src:
                    tile, shift = gisa.tile_of_raster(src)
                if tile in tiles and not shift:
                    out[tile] = path
                else:
                    path.unlink()
        zip_path.unlink()
    return out


KM_PER_DEG = gisa.EARTH_RADIUS_KM * math.radians(1)


def size_km(geom):
    """Width and height of the polygon's bounding box in km."""
    minx, miny, maxx, maxy = geom.bounds
    return ((maxx - minx) * KM_PER_DEG * math.cos(math.radians(geom.centroid.y)),
            (maxy - miny) * KM_PER_DEG)


def window(geom, side_km):
    """[x0, x1, y0, y1] of a side_km x side_km window centred on the polygon's bounding box."""
    minx, miny, maxx, maxy = geom.bounds
    half_x = side_km / 2 / (KM_PER_DEG * math.cos(math.radians(geom.centroid.y)))
    half_y = side_km / 2 / KM_PER_DEG
    cx, cy = (minx + maxx) / 2, (miny + maxy) / 2
    return [cx - half_x, cx + half_x, cy - half_y, cy + half_y]


def scale_bar(ax, extent, lat):
    """Scale bar in the lower left corner (extent in degrees)."""
    km_per_deg = KM_PER_DEG * math.cos(math.radians(lat))
    width_km = (extent[1] - extent[0]) * km_per_deg
    length = max(k for k in (1, 2, 5, 10, 20, 50) if k <= max(width_km / 4, 1))
    x0 = extent[0] + 0.04 * (extent[1] - extent[0])
    y0 = extent[2] + 0.03 * (extent[3] - extent[2])
    ax.plot([x0, x0 + length / km_per_deg], [y0, y0], color=INK, lw=1.5, solid_capstyle="butt")
    ax.text(x0, y0 + 0.02 * (extent[3] - extent[2]), f"{length} km", fontsize=6.5,
            color=INK, va="bottom", ha="left")


def prepare(city, geom, tifs):
    """Everything needed to draw one city: ~100 m blocks, ~1 km cells and their coordinates."""
    data, inside, transform, (r0, c0) = read_city(geom, tifs)
    imperv = inside & (data == gisa.IMPERVIOUS_VALUE)
    fine = block_mean(imperv, inside, FINE_BLOCK, FINE_BLOCK)

    # ~1 km cells exactly as in 02_compute_gisa_stats.py (blocks of the global pixel grid)
    cell_cols = gisa.cell_cols_for_lat(geom.centroid.y, RES)
    cell_r = (r0 + np.arange(data.shape[0])) // gisa.CELL_ROWS
    cell_c = (c0 + np.arange(data.shape[1])) // cell_cols
    starts_r = np.flatnonzero(np.r_[True, np.diff(cell_r) != 0])
    starts_c = np.flatnonzero(np.r_[True, np.diff(cell_c) != 0])
    num = gisa.block_sums(imperv, starts_r, starts_c).astype(float)
    den = gisa.block_sums(inside, starts_r, starts_c).astype(float)
    coarse = np.where(den >= gisa.MIN_CELL_COVERAGE * gisa.CELL_ROWS * cell_cols,
                      num / np.maximum(den, 1), np.nan)

    left, top = transform.c, transform.f
    return {
        "city": city, "geom": geom, "fine": fine, "coarse": coarse,
        "extent": [left, left + data.shape[1] * RES, top - data.shape[0] * RES, top],
        # the last block of a row / column may be partial, so the image is a bit larger than the bbox
        "fine_extent": [left, left + fine.shape[1] * FINE_BLOCK * RES,
                        top - fine.shape[0] * FINE_BLOCK * RES, top],
        "x_edges": left + np.r_[starts_c, data.shape[1]] * RES,
        "y_edges": top - np.r_[starts_r, data.shape[0]] * RES,
    }


def draw(prepared, stats, ncols, same_scale, out_name):
    """One figure; same_scale = all cities at the same map scale, otherwise zoomed per city."""
    ncols = min(ncols, len(prepared))
    nrows = math.ceil(len(prepared) / ncols)
    side_km = 1.04 * max(max(size_km(d["geom"])) for d in prepared)
    fig_h = 2.5 * nrows + 0.75
    fig = plt.figure(figsize=(3.6 * ncols, fig_h))
    outer = fig.add_gridspec(nrows, ncols, left=0.01, right=0.99, top=1 - 0.42 / fig_h,
                             bottom=0.62 / fig_h, wspace=0.06, hspace=0.26)
    im = None
    for k, d in enumerate(prepared):
        city, geom = d["city"], d["geom"]
        s = stats.loc[city["id"]]
        inner = outer[k // ncols, k % ncols].subgridspec(1, 2, wspace=0.03)
        ax1, ax2 = fig.add_subplot(inner[0]), fig.add_subplot(inner[1])
        im = ax1.imshow(np.ma.masked_invalid(d["fine"]), cmap=CMAP, vmin=0, vmax=1,
                        extent=d["fine_extent"], interpolation="nearest")
        ax2.pcolormesh(d["x_edges"], d["y_edges"], np.ma.masked_invalid(d["coarse"]), cmap=CMAP,
                       vmin=0, vmax=1, edgecolors="none", rasterized=True)
        view = window(geom, side_km) if same_scale else d["extent"]
        for ax in (ax1, ax2):
            gpd.GeoSeries([geom]).boundary.plot(ax=ax, color=INK, linewidth=0.35)
            ax.set_xlim(view[0], view[1]); ax.set_ylim(view[2], view[3])
            ax.set_aspect(1 / math.cos(math.radians(geom.centroid.y)))
            ax.set_anchor("N")
            ax.set_xlabel(""); ax.set_ylabel("")
            ax.set_xticks([]); ax.set_yticks([])
            for spine in ax.spines.values():
                spine.set_visible(False)
        if not same_scale or k == 0:
            scale_bar(ax1, view, geom.centroid.y)

        ax1.set_title(f"{city['name']}, {city['country']}", fontsize=8.5, fontweight="bold",
                      loc="left", color=INK, pad=14)
        ax1.text(0, 1.02,
                 f"{100 * s.gisa_impervious_share:.0f}% impervious · "
                 f"unevenness {s.gisa_cell_sd_norm:.2f} · "
                 f"{s.gisa_impervious_m2_per_capita:.0f} m² per person",
                 transform=ax1.transAxes, fontsize=6.8, color=MUTED, va="bottom", ha="left")

    cax = fig.add_axes([0.36, 0.40 / fig_h, 0.28, 0.07 / fig_h])
    cb = fig.colorbar(im, cax=cax, orientation="horizontal", ticks=[0, 0.25, 0.5, 0.75, 1])
    cb.ax.set_xticklabels(["0%", "25%", "50%", "75%", "100%"], fontsize=6.5, color=INK)
    cb.outline.set_visible(False)
    cb.ax.tick_params(length=2, color=MUTED)
    fig.text(0.35, 0.435 / fig_h, "Impervious share (GISA-10m, 2016)", fontsize=7, color=INK,
             ha="right", va="center")
    scale_note = ("all cities at the same map scale" if same_scale
                  else "each city zoomed to its own extent (see scale bars)")
    fig.text(0.01, 0.008,
             "Per city: left ~100 m blocks, right the ~1 km cells behind the within-city statistics; water left blank; "
             f"{scale_note}. Outline: GHS-UCDB R2024A urban centre.\n"
             "Unevenness = SD of the cell shares / maximum possible SD (0 = evenly sealed, "
             "1 = fully sealed and fully unsealed cells only). "
             "Data: GISA-10m (Huang et al. 2022, CC-BY-4.0).",
             fontsize=5.8, color=MUTED, ha="left", va="bottom")

    PLOT_DIR.mkdir(parents=True, exist_ok=True)
    for ext in ("png", "pdf"):
        fig.savefig(PLOT_DIR / f"gisa_10m_{out_name}.{ext}", dpi=300, facecolor="white")
    plt.close(fig)
    print(f"Wrote output/plots/gisa_10m_{out_name}.{{png,pdf}}")


def main():
    parser = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--cities", default=DEFAULT_CITIES, help="comma separated city names")
    parser.add_argument("--name", default="example_cities", help="suffix of the output files")
    parser.add_argument("--ncols", type=int, default=3, help="cities per row")
    args = parser.parse_args()

    with open(gisa.CITIES_JSON) as f:
        cities_json = json.load(f)
    chosen = [find_city(n, cities_json) for n in args.cities.split(",")]
    stats = pd.read_csv(STATS_CSV).set_index("id")
    for c in chosen:
        if stats.gisa_valid_px[c["id"]] == 0:
            raise SystemExit(f"GISA-10m has no data for {c['name']}; choose another city")
    gdf = gpd.read_parquet(gisa.UCDB_PATH).to_crs("EPSG:4326").set_index(gisa.ID_COL)

    geoms = {c["id"]: gdf.geometry[c["id"]] for c in chosen}
    tiles = {t for g in geoms.values() for t in gisa.tiles_for_bounds(*g.bounds)}
    work_dir = gisa.RAW_DIR / "example_tiles"
    work_dir.mkdir(parents=True, exist_ok=True)
    tifs = fetch_tiles(tiles, gisa.strip_index(), work_dir)
    prepared = [prepare(c, geoms[c["id"]], tifs) for c in chosen]

    for p in sorted(work_dir.rglob("*"), reverse=True):       # delete the downloaded tiles
        p.rmdir() if p.is_dir() else p.unlink()
    work_dir.rmdir()

    draw(prepared, stats, args.ncols, same_scale=False, out_name=args.name)
    draw(prepared, stats, args.ncols, same_scale=True, out_name=f"{args.name}_same_scale")


if __name__ == "__main__":
    main()
