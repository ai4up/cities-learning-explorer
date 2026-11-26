# ══════════════════════════════════════════════════════════════════════════════
# 03_plot_and_describe.R
# ----------------------
# Maps the GISA-10m impervious share of all urban centres and its within-city
# variability, and writes descriptive statistics (globally, by region and by
# city type).
#
# Input   output/gisa_10m_stats.csv   (from 02_compute_gisa_stats.py)
#         ../../public/cities.json    (name, country, region, type, lat/lon)
# Output  output/gisa_10m_descriptive_stats.csv
#         output/plots/gisa_10m_impervious_share_map.{png,pdf}
#         output/plots/gisa_10m_impervious_share_by_region.{png,pdf}
#         output/plots/gisa_10m_impervious_share_distribution.{png,pdf}
#
# Run from anywhere:  Rscript preprocessing/gisa-10m/03_plot_and_describe.R
# ══════════════════════════════════════════════════════════════════════════════
suppressPackageStartupMessages({
  library(dplyr)
  library(tidyr)
  library(readr)
  library(ggplot2)
  library(sf)
  library(rnaturalearth)
  library(patchwork)
  library(jsonlite)
  library(scales)
})

# ── Paths (relative to this script) ───────────────────────────────────────────
script_dir <- local({
  args <- commandArgs(trailingOnly = FALSE)
  f <- sub("^--file=", "", args[grep("^--file=", args)])
  if (length(f)) dirname(normalizePath(f)) else getwd()
})
STATS_CSV   <- file.path(script_dir, "output", "gisa_10m_stats.csv")
CITIES_JSON <- file.path(script_dir, "..", "..", "public", "cities.json")
OUT_DIR     <- file.path(script_dir, "output")
PLOT_DIR    <- file.path(OUT_DIR, "plots")
dir.create(PLOT_DIR, showWarnings = FALSE, recursive = TRUE)

# ── Style (matches the paper figures) ─────────────────────────────────────────
proj_robin   <- "+proj=robin +lon_0=0 +x_0=0 +y_0=0 +datum=WGS84 +units=m +no_defs"
region_order <- c("North America", "South America", "Europe",
                  "Africa", "Asia", "Australasia", "Small Islands")
type_order   <- c("Type 1", "Type 2", "Type 3", "Type 4", "Mixed")
MAIN_COL     <- "#085041"   # dark green (= EDGAR colour in the paper figures)
ACCENT_COL   <- "#FAC775"   # burnt orange (global median line)

THEME_F <- theme_minimal(base_size = 8) +
  theme(
    panel.grid       = element_blank(),
    panel.border     = element_rect(colour = "grey45", fill = NA, linewidth = 0.3),
    axis.ticks       = element_line(colour = "grey45", linewidth = 0.25),
    axis.ticks.length = unit(1.5, "pt"),
    strip.text       = element_text(size = 7.5, face = "bold", hjust = 0),
    axis.title       = element_text(size = 7.5),
    plot.margin      = margin(2, 4, 2, 4)
  )

# ── Data ──────────────────────────────────────────────────────────────────────
stats <- read_csv(STATS_CSV, show_col_types = FALSE)

cities_raw <- fromJSON(CITIES_JSON, simplifyVector = TRUE)
cities <- tibble(
  id                 = cities_raw$id,
  name               = cities_raw$name,
  country            = cities_raw$country,
  region             = cities_raw$region,
  type               = cities_raw$type,
  lat                = cities_raw$lat,
  lon                = cities_raw$lon,
  population         = cities_raw$characteristics$population,
  population_density = cities_raw$characteristics$population_density
)

df <- cities %>%
  left_join(stats, by = "id") %>%
  mutate(
    imperv_pct = 100 * gisa_impervious_share,
    sd_pp      = 100 * gisa_cell_sd,            # within-city SD in percentage points
    # within-city indicators only where they rest on enough cells
    sd_norm    = if_else(gisa_reliable, gisa_cell_sd_norm, NA_real_),
    region     = factor(region, levels = region_order),
    type       = factor(type, levels = type_order)
  )

cat(sprintf("\n%d cities in cities.json, %d with GISA values, %d without\n",
            nrow(df), sum(!is.na(df$imperv_pct)), sum(is.na(df$imperv_pct))))

# ── Descriptive statistics ────────────────────────────────────────────────────
describe <- function(d) {
  d %>%
    filter(!is.na(gisa_impervious_share)) %>%
    summarise(
      n_cities                 = n(),
      impervious_share_mean    = mean(gisa_impervious_share),
      impervious_share_sd      = sd(gisa_impervious_share),      # between cities
      impervious_share_min     = min(gisa_impervious_share),
      impervious_share_p10     = quantile(gisa_impervious_share, 0.10),
      impervious_share_p25     = quantile(gisa_impervious_share, 0.25),
      impervious_share_median  = median(gisa_impervious_share),
      impervious_share_p75     = quantile(gisa_impervious_share, 0.75),
      impervious_share_p90     = quantile(gisa_impervious_share, 0.90),
      impervious_share_max     = max(gisa_impervious_share),
      # area-weighted: total impervious area / total land area of the group (water excluded)
      impervious_share_pooled  = sum(gisa_impervious_km2) / sum(gisa_land_km2),
      pervious_impervious_ratio_median = median(gisa_pervious_impervious_ratio, na.rm = TRUE),
      pervious_impervious_ratio_pooled = sum(gisa_pervious_km2) / sum(gisa_impervious_km2),
      # within-city variability (SD of the impervious share across ~1 km cells)
      # all within-city statistics use reliable cities only (>= 10 cells, no missing tile)
      n_reliable               = sum(gisa_reliable),
      within_city_sd_mean      = mean(gisa_cell_sd[gisa_reliable], na.rm = TRUE),
      within_city_sd_median    = median(gisa_cell_sd[gisa_reliable], na.rm = TRUE),
      within_city_sd_p10       = quantile(gisa_cell_sd[gisa_reliable], 0.10, na.rm = TRUE),
      within_city_sd_p90       = quantile(gisa_cell_sd[gisa_reliable], 0.90, na.rm = TRUE),
      within_city_cv_median    = median(gisa_cell_cv[gisa_reliable], na.rm = TRUE),
      unevenness_median        = median(gisa_cell_sd_norm[gisa_reliable], na.rm = TRUE),
      unevenness_p10           = quantile(gisa_cell_sd_norm[gisa_reliable], 0.10, na.rm = TRUE),
      unevenness_p90           = quantile(gisa_cell_sd_norm[gisa_reliable], 0.90, na.rm = TRUE),
      sealed_area_share_median   = median(gisa_sealed_area_share[gisa_reliable], na.rm = TRUE),
      unsealed_area_share_median = median(gisa_unsealed_area_share[gisa_reliable], na.rm = TRUE),
      impervious_m2_per_capita_median = median(gisa_impervious_m2_per_capita, na.rm = TRUE),
      impervious_m2_per_capita_pooled = 1e6 * sum(gisa_impervious_km2[!is.na(population)]) /
                                        sum(population, na.rm = TRUE),
      impervious_km2_total     = sum(gisa_impervious_km2),
      pervious_km2_total       = sum(gisa_pervious_km2),
      water_km2_total          = sum(gisa_water_km2),
      water_share_pooled       = sum(gisa_water_km2) / sum(gisa_observed_km2),
      water_share_median       = median(gisa_water_share),
      .groups = "drop"
    )
}

desc <- bind_rows(
  describe(df) %>% mutate(group_by = "all", group = "All cities"),
  describe(group_by(df, region)) %>%
    mutate(group_by = "region", group = as.character(region)) %>% select(-region),
  describe(group_by(df, type)) %>%
    mutate(group_by = "type", group = as.character(type)) %>% select(-type)
) %>%
  filter(!is.na(group)) %>%
  select(group_by, group, everything())

write_csv(desc, file.path(OUT_DIR, "gisa_10m_descriptive_stats.csv"))

cat("\n── GISA-10m impervious share (impervious / observed area) ──────────────\n")
print(desc %>%
        transmute(group_by, group, n_cities,
                  median = percent(impervious_share_median, 0.1),
                  mean   = percent(impervious_share_mean, 0.1),
                  pooled = percent(impervious_share_pooled, 0.1),
                  `pervious:impervious (pooled)` = round(pervious_impervious_ratio_pooled, 2),
                  `unevenness (median)` = round(unevenness_median, 2),
                  `m2 per capita (median)` = round(impervious_m2_per_capita_median)),
      width = Inf,
      n = Inf)

rho <- with(df %>% filter(!is.na(imperv_pct), population_density > 0),
            cor(imperv_pct, population_density, method = "spearman"))
cat(sprintf("\nSpearman correlation impervious share vs population density: %.2f\n", rho))

# ── Map ───────────────────────────────────────────────────────────────────────
world <- ne_countries(scale = "medium", returnclass = "sf") %>% st_transform(proj_robin)

# Robinson frame built locally (no download needed)
bb <- st_sfc(st_polygon(list(cbind(
  c(seq(-180, 180, 1), rep(180, 181), seq(180, -180, -1), rep(-180, 181)),
  c(rep(-90, 361), seq(-90, 90, 1), rep(90, 361), seq(90, -90, -1))
))), crs = 4326) %>% st_transform(proj_robin)

pts <- df %>%
  filter(!is.na(lat), !is.na(lon)) %>%
  arrange(!is.na(imperv_pct), imperv_pct) %>%        # NA first, high values on top
  st_as_sf(coords = c("lon", "lat"), crs = 4326) %>%
  st_transform(proj_robin)

p_map <- ggplot() +
  geom_sf(data = bb, colour = "grey70", fill = "transparent", linewidth = 0.5) +
  geom_sf(data = world, fill = "grey92", colour = NA) +
  geom_sf(data = pts, aes(colour = imperv_pct), size = 0.9, alpha = 0.75) +
  scale_colour_viridis_c(
    option = "mako", direction = -1, end = 0.92,
    limits = c(0, 100), oob = squish, na.value = "#CCCCCC",
    name = "Impervious share (GISA-10m)", labels = function(x) paste0(x, "%"),
    guide = guide_colourbar(title.position = "top", barwidth = unit(9, "lines"),
                            barheight = unit(0.6, "lines"))
  ) +
  coord_sf(expand = FALSE, clip = "off") +
  THEME_F +
  theme(
    legend.position      = c(0.68, 0.03),
    legend.direction     = "horizontal",
    legend.justification = c(0.5, 0),
    legend.background    = element_rect(fill = alpha("white", 0.85),
                                        colour = "grey80", linewidth = 0.3),
    legend.text          = element_text(size = 9),
    legend.title         = element_text(size = 10, face = "bold"),
    axis.text            = element_blank(),
    axis.ticks           = element_blank(),
    panel.border         = element_blank(),
    plot.margin          = margin(0, 0, 0, 0)
  )

# ── Panel A: impervious share by region ───────────────────────────────────────
global_median    <- median(df$imperv_pct, na.rm = TRUE)
global_median_sd <- median(df$sd_pp, na.rm = TRUE)
global_median_un <- median(df$sd_norm, na.rm = TRUE)

region_box <- function(d, var, xmax, median_line, title) {
  d %>%
    filter(!is.na(.data[[var]]), !is.na(region)) %>%
    mutate(region = factor(region, levels = rev(region_order)), panel = title) %>%
    ggplot(aes(x = .data[[var]], y = region)) +
    geom_vline(xintercept = median_line, colour = ACCENT_COL,
               linetype = "dashed", linewidth = 0.4) +
    geom_boxplot(fill = alpha(MAIN_COL, 0.25), colour = MAIN_COL, width = 0.6,
                 linewidth = 0.3, outlier.size = 0.25, outlier.alpha = 0.3) +
    scale_x_continuous(limits = c(0, xmax), name = NULL) +
    facet_wrap(~ panel) +
    labs(y = NULL) +
    THEME_F +
    theme(axis.text.y = element_text(size = 8))
}

p_panel_a <- region_box(df, "imperv_pct", 100, global_median,
                        "Impervious share (%), by region")
# ── Panel B: within-city unevenness by region ─────────────────────────────────
p_panel_b <- region_box(df, "sd_norm", 1, global_median_un,
                        "Within-city unevenness (0-1), by region")

# The map is a figure of its own so that it can be shown large
fig_map <- p_map +
  labs(caption = sprintf(paste0(
    "Impervious share = GISA-10m impervious pixels / land pixels inside the GHS-UCDB R2024A polygon (water masked with ESA WorldCover 2021). ",
    "n = %s urban centres. Data: GISA-10m, 2016 (Huang et al. 2022, CC-BY-4.0)."),
    comma(sum(!is.na(df$imperv_pct))))) +
  theme(plot.caption = element_text(size = 7.5, colour = "grey35", hjust = 0))

ggsave(file.path(PLOT_DIR, "gisa_10m_impervious_share_map.png"), fig_map,
       width = 260, height = 140, units = "mm", dpi = 300, bg = "white")
ggsave(file.path(PLOT_DIR, "gisa_10m_impervious_share_map.pdf"), fig_map,
       width = 260, height = 140, units = "mm", bg = "white")

fig_region <- (p_panel_a / p_panel_b) +
  plot_annotation(
    caption = sprintf(paste0(
      "Unevenness = SD of the impervious share across ~1 km cells /\nmaximum possible SD ",
      "(cities with >= 10 cells). Dashed lines =\nglobal medians (%.0f%%, %.2f)."),
      global_median, global_median_un),
    theme = theme(plot.caption = element_text(size = 6.5, colour = "grey35", hjust = 0))
  )
ggsave(file.path(PLOT_DIR, "gisa_10m_impervious_share_by_region.png"), fig_region,
       width = 110, height = 130, units = "mm", dpi = 300, bg = "white")
ggsave(file.path(PLOT_DIR, "gisa_10m_impervious_share_by_region.pdf"), fig_region,
       width = 110, height = 130, units = "mm", bg = "white")

# ── Distribution figure ───────────────────────────────────────────────────────
p_hist <- df %>%
  filter(!is.na(imperv_pct)) %>%
  ggplot(aes(x = imperv_pct)) +
  geom_histogram(binwidth = 2.5, boundary = 0, fill = MAIN_COL, colour = "white",
                 linewidth = 0.1) +
  geom_vline(xintercept = global_median, colour = ACCENT_COL,
             linetype = "dashed", linewidth = 0.4) +
  scale_x_continuous(limits = c(0, 100), labels = function(x) paste0(x, "%")) +
  facet_wrap(~ "Impervious share") +
  labs(x = NULL, y = "Urban centres") +
  THEME_F

p_ratio <- df %>%
  filter(!is.na(gisa_pervious_impervious_ratio), gisa_pervious_impervious_ratio > 0) %>%
  ggplot(aes(x = gisa_pervious_impervious_ratio)) +
  geom_histogram(bins = 50, fill = MAIN_COL, colour = "white", linewidth = 0.1) +
  geom_vline(xintercept = 1, colour = "grey50", linetype = "dashed", linewidth = 0.35) +
  scale_x_log10(labels = label_number(drop0trailing = TRUE)) +
  facet_wrap(~ "Pervious : impervious ratio (log scale; 1 = equal area)") +
  labs(x = NULL, y = "Urban centres") +
  THEME_F

p_sd_hist <- df %>%
  filter(!is.na(sd_norm)) %>%
  ggplot(aes(x = sd_norm)) +
  geom_histogram(binwidth = 0.025, boundary = 0, fill = MAIN_COL, colour = "white",
                 linewidth = 0.1) +
  geom_vline(xintercept = global_median_un, colour = ACCENT_COL,
             linetype = "dashed", linewidth = 0.4) +
  scale_x_continuous(limits = c(0, 1)) +
  facet_wrap(~ "Within-city unevenness (SD / maximum possible SD)") +
  labs(x = NULL, y = "Urban centres") +
  THEME_F

# SD of a share is bounded by sqrt(p * (1 - p)); the grey curve shows that ceiling.
p_sd_mean <- df %>%
  filter(!is.na(sd_pp), !is.na(imperv_pct)) %>%
  ggplot(aes(x = imperv_pct, y = sd_pp)) +
  geom_point(size = 0.3, alpha = 0.25, colour = MAIN_COL) +
  geom_function(fun = function(x) 100 * sqrt(x / 100 * (1 - x / 100)),
                colour = "grey50", linetype = "dashed", linewidth = 0.35) +
  scale_x_continuous(limits = c(0, 100), labels = function(x) paste0(x, "%")) +
  coord_cartesian(ylim = c(0, 50)) +
  facet_wrap(~ "Within-city SD vs share (dashed: maximum SD)") +
  labs(x = "Impervious share", y = "Within-city SD (pp)") +
  THEME_F

p_density <- df %>%
  filter(!is.na(imperv_pct), population_density > 0) %>%
  ggplot(aes(x = population_density, y = imperv_pct)) +
  geom_point(size = 0.3, alpha = 0.25, colour = MAIN_COL) +
  geom_smooth(method = "loess", formula = y ~ x, se = FALSE,
              colour = ACCENT_COL, linewidth = 0.6) +
  scale_x_log10(labels = label_comma()) +
  scale_y_continuous(labels = function(x) paste0(x, "%")) +
  coord_cartesian(ylim = c(0, 100)) +
  facet_wrap(~ sprintf("Impervious share vs population density (Spearman's rho = %.2f)", rho)) +
  labs(x = expression(Population ~ density ~ (people/km^2) * ", log scale"), y = NULL) +
  THEME_F

fig_dist <- (p_hist | p_ratio) / (p_sd_hist | p_sd_mean) / p_density +
  plot_layout(heights = c(1, 1, 1.1))

ggsave(file.path(PLOT_DIR, "gisa_10m_impervious_share_distribution.png"), fig_dist,
       width = 180, height = 190, units = "mm", dpi = 300, bg = "white")
ggsave(file.path(PLOT_DIR, "gisa_10m_impervious_share_distribution.pdf"), fig_dist,
       width = 180, height = 190, units = "mm", bg = "white")

cat("\nWrote:\n",
    " ", file.path("output", "gisa_10m_descriptive_stats.csv"), "\n",
    " ", file.path("output", "plots", "gisa_10m_impervious_share_map.{png,pdf}"), "\n",
    " ", file.path("output", "plots", "gisa_10m_impervious_share_by_region.{png,pdf}"), "\n",
    " ", file.path("output", "plots", "gisa_10m_impervious_share_distribution.{png,pdf}"), "\n")
