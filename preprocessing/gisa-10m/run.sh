#!/usr/bin/env bash
# Runs the full GISA-10m pipeline and deletes all downloaded base data at the end.
#
#   ./run.sh                 full run
#   ./run.sh --keep-raw      keep data_raw/ (e.g. to re-run step 2 without re-downloading UCDB)
#
# If a step fails, data_raw/ is kept so a re-run resumes from the checkpoint.
set -euo pipefail
cd "$(dirname "$0")"

KEEP_RAW=false
[[ "${1:-}" == "--keep-raw" ]] && KEEP_RAW=true

PYTHON="${PYTHON:-python3}"

echo "── 1/6  Urban centre polygons (GHS-UCDB R2024A) ──"
"$PYTHON" 01_download_ucdb.py

echo "── 2/6  GISA-10m statistics per urban centre ──"
"$PYTHON" 02_compute_gisa_stats.py

echo "── 3/6  Plots and descriptive statistics (R) ──"
Rscript 03_plot_and_describe.R

echo "── 4/6  Example cities ──"
"$PYTHON" 04_plot_example_cities.py

echo "── 5/6  Regional maps, city types, covariates (R) ──"
Rscript 05_plot_regions_types_covariates.R

echo "── 6/6  GISA-10m 2016 against WorldCover 2021 (R) ──"
Rscript 06_compare_products.R

if [[ "$KEEP_RAW" == false ]]; then
  echo "── Cleaning up base data ──"
  rm -rf data_raw
fi

echo "Done. Outputs are in $(pwd)/output"
