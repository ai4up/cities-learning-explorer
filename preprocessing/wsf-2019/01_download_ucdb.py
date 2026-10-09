"""
01_download_ucdb.py
-------------------
Downloads the GHSL Urban Centre Database (GHS-UCDB R2024A, V1-0) and extracts
the urban-centre polygons (ID_UC_G0 + geometry) into a small GeoParquet file.

The IDs in GHS-UCDB R2024A V1-0 are the `id` values in public/cities.json.

Output (temporary, deleted by run.sh):  data_raw/ucdb_polygons.parquet
"""

import argparse
import sys
from pathlib import Path

import geopandas as gpd
import pyogrio
import requests
from tqdm import tqdm

HERE = Path(__file__).resolve().parent
RAW_DIR = HERE / "data_raw"
UCDB_URL = (
    "https://jeodpp.jrc.ec.europa.eu/ftp/jrc-opendata/GHSL/GHS_UCDB_GLOBE_R2024A/"
    "GHS_UCDB_GLOBE_R2024A/V1-0/GHS_UCDB_GLOBE_R2024A_V1_0.zip"
)
ZIP_PATH = RAW_DIR / "GHS_UCDB_GLOBE_R2024A_V1_0.zip"
OUT_PATH = RAW_DIR / "ucdb_polygons.parquet"
ID_COL = "ID_UC_G0"


def download(url: str, dest: Path) -> None:
    tmp = dest.with_suffix(dest.suffix + ".part")
    with requests.get(url, stream=True, timeout=120) as r:
        r.raise_for_status()
        size = int(r.headers.get("content-length", 0))
        with open(tmp, "wb") as f, tqdm(total=size, unit="B", unit_scale=True,
                                        desc=dest.name) as bar:
            for chunk in r.iter_content(chunk_size=1 << 20):
                f.write(chunk)
                bar.update(len(chunk))
    tmp.rename(dest)


def find_polygon_layer(zip_path: Path) -> tuple[str, str]:
    """Return (vsizip path of the .gpkg, name of a layer with ID_UC_G0 + polygons)."""
    import zipfile

    with zipfile.ZipFile(zip_path) as zf:
        gpkgs = [n for n in zf.namelist() if n.lower().endswith(".gpkg")]
    if not gpkgs:
        sys.exit(f"No .gpkg found inside {zip_path.name}")

    for gpkg in gpkgs:
        vsi = f"/vsizip/{zip_path}/{gpkg}"
        for layer, geom_type in pyogrio.list_layers(vsi):
            if geom_type is None or "polygon" not in str(geom_type).lower():
                continue
            fields = pyogrio.read_info(vsi, layer=layer)["fields"]
            if ID_COL in fields:
                return vsi, layer
    sys.exit(f"No polygon layer with column {ID_COL} found in {gpkgs}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--force", action="store_true", help="re-download even if present")
    args = parser.parse_args()

    RAW_DIR.mkdir(parents=True, exist_ok=True)

    if OUT_PATH.exists() and not args.force:
        print(f"UCDB polygons already extracted: {OUT_PATH}")
        return

    if not ZIP_PATH.exists() or args.force:
        print("Downloading GHS-UCDB R2024A V1-0 (~300 MB) from JRC ...")
        download(UCDB_URL, ZIP_PATH)

    vsi, layer = find_polygon_layer(ZIP_PATH)
    print(f"Reading layer '{layer}'")
    gdf = gpd.read_file(vsi, layer=layer, columns=[ID_COL])
    gdf = gdf[gdf.geometry.notna() & ~gdf.geometry.is_empty]
    gdf[ID_COL] = gdf[ID_COL].astype(int)

    if gdf[ID_COL].duplicated().any():
        sys.exit(f"Duplicate {ID_COL} values in layer '{layer}'")

    gdf.to_parquet(OUT_PATH, index=False)
    print(f"Wrote {len(gdf)} urban centre polygons (CRS {gdf.crs.to_string()}) to {OUT_PATH}")

    # The zip is no longer needed; the small parquet is enough for the next step.
    ZIP_PATH.unlink()


if __name__ == "__main__":
    main()
