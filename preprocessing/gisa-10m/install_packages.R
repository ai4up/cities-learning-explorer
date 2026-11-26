# Installs the R packages needed by 03_plot_and_describe.R and 05_plot_regions_types_covariates.R
pkgs <- c("dplyr", "tidyr", "readr", "ggplot2", "sf", "rnaturalearth",
          "rnaturalearthdata", "patchwork", "jsonlite", "scales", "ggrepel")
missing <- setdiff(pkgs, rownames(installed.packages()))
if (length(missing)) install.packages(missing, repos = "https://cloud.r-project.org")
cat("All R packages available.\n")
