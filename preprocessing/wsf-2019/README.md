# WSF2019 built-up share per urban centre

Self-contained pipeline that computes, for every GHS-UCDB urban centre, how much of its
area is built up according to the **World Settlement Footprint 2019** (DLR, 10 m), maps it
in R, and writes descriptive statistics. The result is merged into `public/cities.json`
by a cell in `preprocess.ipynb`.

All base data (UCDB polygons, WSF tiles) is downloaded to a temporary `data_raw/`
folder and deleted at the end. Only the outputs below are kept.

## Outputs (`output/`)

| File | Content |
| --- | --- |
| `wsf_2019_stats.csv` | One row per urban centre (`id` = `ID_UC_G0` = `id` in `cities.json`) |
| `wsf_2019_descriptive_stats.csv` | Summary statistics: all cities, by region, by city type |
| `plots/wsf_2019_built_share_map.{png,pdf}` | World map + built-up share by region and by type |
| `plots/wsf_2019_built_share_distribution.{png,pdf}` | Histograms of share and ratio, relation to population density |

Columns of `wsf_2019_stats.csv`:

| Column | Meaning |
| --- | --- |
| `wsf_built_share` | built-up pixels / all WSF pixels inside the polygon (0–1) |
| `wsf_built_nonbuilt_ratio` | built-up / non-built-up pixels (empty if the city is 100 % built up) |
| `wsf_built_km2`, `wsf_observed_km2` | built-up area and area covered by WSF pixels (km², spherical pixel areas) |
| `wsf_built_px`, `wsf_valid_px` | raw pixel counts |
| `wsf_n_tiles`, `wsf_n_tiles_missing` | WSF tiles touched by the polygon; missing = no tile published (open sea) |

## Run

Requirements: Python ≥ 3.10, R ≥ 4.1, ~1 GB free disk space, internet access.

```bash
cd preprocessing/wsf-2019

python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
Rscript install_packages.R

./run.sh
```

`run.sh` runs the three steps and then deletes `data_raw/`:

1. `01_download_ucdb.py` downloads GHS-UCDB R2024A V1-0 (~300 MB zip) from JRC and keeps
   only the polygons (the zip is deleted right away).
2. `02_compute_wsf_stats.py` downloads only the WSF tiles that intersect an urban centre,
   processes each tile and deletes it immediately (≈ 4 tiles on disk at a time).
   Expect a few hours, mostly download time. Progress is checkpointed, so if it is
   interrupted just run `./run.sh` again and it resumes.
3. `03_plot_and_describe.R` writes the plots and the descriptive statistics.

Quick test before the full run (first 5 tiles only):

```bash
python 01_download_ucdb.py && python 02_compute_wsf_stats.py --limit-tiles 5
rm -rf data_raw output      # clean up the test
```

Then, from the repository root, run the cell **"Merge WSF2019 built-up share"** in
`preprocess.ipynb`. It adds `built_up_share` (%) and `built_up_ratio` to `characteristics`
and `percentiles` in `public/cities.json`.

## Method notes

- **Polygons:** GHS-UCDB R2024A V1-0, the same release the city IDs in `cities.json` come from.
- **Pixels counted:** pixels whose centre falls inside the polygon. WSF value 255 = settlement,
  0 = no settlement.
- **Tile overlap:** WSF tiles are 2° × 2° with a 0.1° buffer, so neighbouring tiles overlap.
  Only pixels inside each tile's nominal 2° × 2° cell are counted, so cities crossing tile
  borders are not double counted.
- **Areas:** pixels are in EPSG:4326 and get smaller towards the poles, so areas are computed
  per raster row on the sphere. `wsf_built_share` (pixel based) and `built_km2 / observed_km2`
  (area based) are practically identical within a city.
- **Pooled statistics** in the descriptive table are area-weighted (total built-up area / total
  area of the group); mean and median are across cities.

## Sources

- Marconcini, M., Metz-Marconcini, A., Esch, T., Gorelick, N. (2021). Understanding Current Trends
  in Global Urbanisation – The World Settlement Footprint suite. *GI_Forum* 1, 33–38.
  doi:10.1553/giscience2021_01_s33. Data: <https://download.geoservice.dlr.de/WSF2019/> (CC-BY-4.0).
- European Commission, JRC (2024). GHSL Urban Centre Database R2024A.
  <https://human-settlement.emergency.copernicus.eu/ghs_ucdb_2024.php>
