#!/usr/bin/env bash
# Runs the full WSF2019 pipeline and deletes all downloaded base data at the end.
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

echo "── 1/3  Urban centre polygons (GHS-UCDB R2024A) ──"
"$PYTHON" 01_download_ucdb.py

echo "── 2/3  WSF2019 statistics per urban centre ──"
"$PYTHON" 02_compute_wsf_stats.py

echo "── 3/3  Plots and descriptive statistics (R) ──"
Rscript 03_plot_and_describe.R

if [[ "$KEEP_RAW" == false ]]; then
  echo "── Cleaning up base data ──"
  rm -rf data_raw
fi

echo "Done. Outputs are in $(pwd)/output"
