# GISA-10m impervious / pervious share per urban centre

Self-contained pipeline that computes, for every GHS-UCDB R2024A urban centre, how much of
its land area is impervious and how much is pervious according to **GISA-10m** (Huang et al. 2022,
10 m, reference year 2016), plus how strongly the impervious share varies inside the city.
It then maps the result in R and writes descriptive statistics.

All base data (UCDB polygons, GISA tiles) is downloaded to a temporary `data_raw/` folder and
deleted at the end. Only the outputs below are kept.

## Outputs (`output/`)

The CSV files are committed. The plots are not (about 27 MB); `run.sh` regenerates them.

| File | Content |
| --- | --- |
| `gisa_10m_stats.csv` | One row per urban centre (`id` = `ID_UC_G0` = `id` in `cities.json`) |
| `gisa_10m_descriptive_stats.csv` | Summary statistics: all cities, by region, by city type |
| `plots/gisa_10m_impervious_share_map.{png,pdf}` | World map of the impervious share |
| `plots/gisa_10m_impervious_share_by_region.{png,pdf}` | Impervious share and within-city unevenness by region |
| `plots/gisa_10m_impervious_share_distribution.{png,pdf}` | Histograms of share, ratio and unevenness; within-city SD vs share; relation to population density |
| `plots/gisa_10m_example_cities.{png,pdf}` | Maps of six example cities at ~100 m and at the ~1 km cells, each zoomed to its extent (`_same_scale`: all at one map scale) |
| `plots/gisa_10m_map_<region>.{png,pdf}` | Seven regional maps with the 25 most populous centres labelled |
| `plots/gisa_10m_by_type.{png,pdf}`, `gisa_10m_by_type.csv` | Indicators by city type of the typology, and by region × type |
| `plots/gisa_10m_covariates.{png,pdf}`, `gisa_10m_covariate_correlations.csv` | Rank correlations with the other city characteristics of the explorer |
| `plots/gisa_10m_vs_worldcover_2021.{png,pdf}`, `gisa_10m_vs_worldcover_2021.csv` | GISA-10m 2016 against WorldCover 2021: city by city, by region, by type |
| `plots/gisa_10m_covariates_europe.{png,pdf}` | Europe: comparison with greenness, GHSL built-up area per person and road density |

Columns of `gisa_10m_stats.csv`:

| Column | Meaning |
| --- | --- |
| `gisa_impervious_share` | impervious pixels / land pixels inside the polygon (0–1); water is excluded |
| `gisa_pervious_share` | 1 − impervious share |
| `gisa_pervious_impervious_ratio` | pervious / impervious pixels (empty if the city has no impervious pixel) |
| `gisa_impervious_km2`, `gisa_pervious_km2`, `gisa_land_km2` | areas in km² (spherical pixel areas); land = impervious + pervious |
| `gisa_water_km2`, `gisa_water_share` | water inside the polygon and its share of the polygon area (`gisa_observed_km2` = land + water) |
| `gisa_impervious_m2_per_capita` | impervious area per inhabitant (m²; population from `public/cities.json`) |
| `gisa_cell_sd` | **within-city variability**: SD of the impervious share across ~1 km cells (0–1, pixel weighted) |
| `gisa_cell_sd_norm` | **unevenness**: `gisa_cell_sd` / √(p·(1−p)), its maximum for a city with mean share p. 0 = sealing spread evenly, 1 = city split into fully sealed and fully unsealed cells. Comparable across cities with different shares |
| `gisa_sealed_area_share` | share of the city's area in cells that are more than 80 % impervious |
| `gisa_unsealed_area_share` | share of the city's area in cells that are less than 20 % impervious |
| `gisa_reliable` | `False` if the within-city indicators rest on fewer than 10 cells or a GISA tile is missing; treat those values with care |
| `gisa_cell_cv` | `gisa_cell_sd` / `gisa_cell_mean` (coefficient of variation) |
| `gisa_cell_mean` | pixel-weighted mean of the cell shares (≈ `gisa_impervious_share`, without boundary slivers) |
| `gisa_cell_p10`, `gisa_cell_median`, `gisa_cell_p90` | percentiles of the cell shares |
| `gisa_n_cells` | number of cells the within-city statistics are based on |
| `wc21_built_share`, `wc21_built_km2`, `wc21_built_m2_per_capita` | the same from **ESA WorldCover 2021** built-up (class 50), on the same land pixels |
| `wc21_cell_sd`, `wc21_cell_sd_norm`, `wc21_sealed_area_share`, `wc21_unsealed_area_share`, … | within-city indicators from WorldCover 2021, same cells as the GISA ones |
| `gisa_impervious_px`, `gisa_valid_px` | raw pixel counts |
| `gisa_n_tiles`, `gisa_n_tiles_missing` | GISA tiles touched by the polygon; missing = no tile published (open sea) |

## Run

Requirements: Python ≥ 3.10, R ≥ 4.1, ~1 GB free disk space, internet access.

```bash
cd preprocessing/gisa-10m

python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
Rscript install_packages.R

./run.sh
```

`run.sh` runs the six steps and then deletes `data_raw/`:

1. `01_download_ucdb.py` downloads GHS-UCDB R2024A V1-0 (~300 MB zip) from JRC and keeps
   only the polygons (the zip is deleted right away).
2. `02_compute_gisa_stats.py` downloads the GISA-10m longitude strips that contain an urban
   centre from Zenodo (66 zips, ~6 GB in total), processes each strip and deletes it
   immediately (2 strips on disk at a time). Progress is checkpointed per strip, so if it is
   interrupted just run `./run.sh` again and it resumes.
3. `03_plot_and_describe.R` writes the global map, the distributions and the descriptive statistics.
4. `04_plot_example_cities.py` maps a few example cities (downloads their strips again, ~600 MB).
   Other cities: `python 04_plot_example_cities.py --cities "Zurich,Paris,Los Angeles" --name three_cities`.
5. `05_plot_regions_types_covariates.R` writes the regional maps, the summary by city type and
   the relation to the other city characteristics.
6. `06_compare_products.R` compares the GISA-10m 2016 indicators with the WorldCover 2021 ones.

Quick test before the full run (two strips only):

```bash
python 01_download_ucdb.py && python 02_compute_gisa_stats.py --strips 0,155
rm -rf data_raw output/gisa_10m_stats_test.csv      # clean up the test
```

## Method notes

- **Polygons:** GHS-UCDB R2024A V1-0, the same release the city IDs in `cities.json` come from.
- **Pixels counted:** pixels whose centre falls inside the polygon. GISA-10m value 1 =
  impervious, 0 = everything else.
- **Water:** GISA-10m has no water class, so water is masked with **ESA WorldCover 2021 v200**
  (10 m, class 80 = permanent water bodies). Each GISA pixel takes the WorldCover class at its
  centre; a pixel counts as water if WorldCover says water and GISA does not say impervious
  (bridges and piers stay impervious). Water is left out of the land area, so **"pervious"
  means unsealed land** (vegetation, bare soil, and wetland, which WorldCover keeps as a
  separate class). The mask is from 2021 and the impervious map from 2016. WorldCover is read
  by window from its public cloud-optimised GeoTIFFs; nothing is downloaded to disk.
- **Within-city variability:** the polygon is cut into cells of 100 pixel rows (~1 km) by as
  many pixel columns as make ~1 km at the city's latitude. The impervious share is computed
  per cell, and `gisa_cell_sd` is the pixel-weighted SD of those shares. Cells with less than
  half of their pixels on land inside the polygon (boundary slivers, mostly-water cells) are left out. The SD
  depends on the cell size: smaller cells give a larger SD. It is also bounded by
  √(p·(1−p)) for a city with impervious share p, so to compare cities use `gisa_cell_sd_norm`,
  which divides the SD by that bound.
- **Data gaps:** GISA-10m publishes no tile for 17 urban centres, mostly on islands (e.g.
  Reykjavik, Port Moresby, Suva, Malé); their rows are empty and `gisa_n_tiles_missing` > 0.
- **Second product (2021):** the WorldCover tiles read for the water mask also give a 2021
  "built-up" class (buildings, roads and other man-made surfaces). The `wc21_*` columns repeat
  every indicator with it. The two products rank cities similarly (rank correlation 0.88 for
  the share, 0.89 for unevenness) but differ in level by region: WorldCover is 11 points higher
  in Africa and 6 in Asia, and lower in Australasia and North America. They differ in year
  and in definition, so the gap is not growth alone.
- **Zero shares:** 68 urban centres have tiles but not a single impervious pixel, among them
  Serrekunda (Gambia, 1.3 million inhabitants) and Santa Cruz de Tenerife. These are gaps in
  GISA-10m, not unsealed cities. The CSV keeps the 0; the explorer treats them as missing
  (see the GISA cell in `preprocess.ipynb`), as it does for Bridgetown below.
- **Known artefact:** in Bridgetown (Barbados) GISA-10m maps the whole land area as impervious
  (share 1.00), which ESA WorldCover does not support; treat that value as wrong.
- **Tile overlap:** GISA tiles are 5° × 5° and overlap their neighbours by up to one pixel.
  Only pixels inside each tile's nominal cell are counted, and the ~1 km cells are defined on
  the global pixel grid, so cities crossing tile borders are neither double counted nor split.
- **Areas:** pixels are in EPSG:4326 and get smaller towards the poles, so areas are computed
  per raster row on the sphere.
- **Checks:** for Zurich, Milan and Stuttgart the pixel counts, shares, cell counts and
  within-city statistics were recomputed with independent tools (`rasterio.mask`, a pandas
  group-by) and match exactly. The spherical areas are 0.25 % below ellipsoidal (WGS84) areas.
  Across 2,881 cells cut by a tile border no cell holds more pixels than a full cell, i.e.
  nothing is double counted.
- **Impervious area per person** divides by the population in `cities.json`, so it is tied to
  population density by construction (rank correlation −0.93); do not read that as a finding.
- **Pooled statistics** in the descriptive table are area-weighted (total impervious area /
  total area of the group); mean and median are across cities.

## Why GISA-10m, and how it compares

Zhang et al. (2026) compared eight global 10 m impervious / built-up products against one
reference dataset. Overall accuracy and block-level RMSE reported there:

| Product | Overall accuracy | Block RMSE |
| --- | --- | --- |
| Hi-GISA 2021 | 96.8 % | 0.12 |
| ESRI 2021 | 86.9 % | 0.40 |
| GHSL 2018 | 84.5 % | 0.27 |
| ESA WorldCover 2021 | 77.0 % | 0.19 |
| Dynamic World 2021 | 77.0 % | 0.38 |
| **GISA-10m 2016** | **76.4 %** | **0.18** |
| WSF 2019 | 69.0 % | 0.22 |
| FROM-GLC10 2017 | 65.8 % | 0.24 |

GISA-10m has the second-lowest block-level error (after Hi-GISA), it maps impervious
surface (including roads) rather than buildings or settlements, and it is openly downloadable.
Its reference year is 2016, so recent expansion is missing. Hi-GISA 2021 ranks first, but the
comparison shares an author with that product. WSF 2019 (see `../wsf-2019`) maps settlements
and leaves out roads, so its built-up share is systematically lower than the impervious share
here.

## Sources

- Huang, X., Yang, J., Wang, W., Liu, Z. (2022). Mapping 10 m global impervious surface area
  (GISA-10m) using multi-source geospatial data. *Earth System Science Data* 14, 3649–3672.
  doi:10.5194/essd-14-3649-2022. Data: <https://zenodo.org/records/6991620> (CC-BY-4.0).
- Zanaga, D., et al. (2022). ESA WorldCover 10 m 2021 v200. doi:10.5281/zenodo.7254221.
  Data: <https://esa-worldcover.org> (CC-BY-4.0).
- Zhang, Y., Du, W., Sun, Z., Gunasekera, D., Guo, J. (2026). A Comprehensive Assessment of
  Global 10-m Impervious Surface Products: Accuracy, Spatial Consistency, and Variability Under
  a Unified Evaluation Framework. *IEEE JSTARS* 19, 21510–21521. doi:10.1109/JSTARS.2026.3697409.
- European Commission, JRC (2024). GHSL Urban Centre Database R2024A.
  <https://human-settlement.emergency.copernicus.eu/ghs_ucdb_2024.php>
