# ══════════════════════════════════════════════════════════════════════════════
# 03_plot_and_describe.R
# ----------------------
# Maps the WSF2019 built-up share of all urban centres and writes descriptive
# statistics (globally, by region and by city type).
#
# Input   output/wsf_2019_stats.csv   (from 02_compute_wsf_stats.py)
#         ../../public/cities.json    (name, country, region, type, lat/lon)
# Output  output/wsf_2019_descriptive_stats.csv
#         output/plots/wsf_2019_built_share_map.{png,pdf}
#         output/plots/wsf_2019_built_share_distribution.{png,pdf}
#
# Run from anywhere:  Rscript preprocessing/wsf-2019/03_plot_and_describe.R
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
STATS_CSV   <- file.path(script_dir, "output", "wsf_2019_stats.csv")
CITIES_JSON <- file.path(script_dir, "..", "..", "public", "cities.json")
OUT_DIR     <- file.path(script_dir, "output")
PLOT_DIR    <- file.path(OUT_DIR, "plots")
dir.create(PLOT_DIR, showWarnings = FALSE, recursive = TRUE)

# ── Style (matches the paper figures) ─────────────────────────────────────────
proj_robin   <- "+proj=robin +lon_0=0 +x_0=0 +y_0=0 +datum=WGS84 +units=m +no_defs"
region_order <- c("North America", "South America", "Europe",
                  "Africa", "Asia", "Australasia", "Small Islands")
type_order   <- c("Type 1", "Type 2", "Type 3", "Type 4", "Mixed")
BUILT_COL    <- "#085041"   # dark green (= EDGAR colour in the paper figures)
ACCENT_COL   <- "#FAC775"   # burnt orange (global median line)

THEME_F <- theme_minimal(base_size = 8) +
  theme(
    panel.grid.minor = element_blank(),
    panel.grid.major = element_line(colour = "grey92", linewidth = 0.25),
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
    built_pct = 100 * wsf_built_share,
    region    = factor(region, levels = region_order),
    type      = factor(type, levels = type_order)
  )

n_missing <- sum(is.na(df$built_pct))
cat(sprintf("\n%d cities in cities.json, %d with WSF values, %d without\n",
            nrow(df), sum(!is.na(df$built_pct)), n_missing))

# ── Descriptive statistics ────────────────────────────────────────────────────
describe <- function(d) {
  d %>%
    filter(!is.na(wsf_built_share)) %>%
    summarise(
      n_cities                  = n(),
      built_share_mean          = mean(wsf_built_share),
      built_share_sd            = sd(wsf_built_share),
      built_share_min           = min(wsf_built_share),
      built_share_p10           = quantile(wsf_built_share, 0.10),
      built_share_p25           = quantile(wsf_built_share, 0.25),
      built_share_median        = median(wsf_built_share),
      built_share_p75           = quantile(wsf_built_share, 0.75),
      built_share_p90           = quantile(wsf_built_share, 0.90),
      built_share_max           = max(wsf_built_share),
      # area-weighted: total built-up area / total observed area of the group
      built_share_pooled        = sum(wsf_built_km2) / sum(wsf_observed_km2),
      built_nonbuilt_ratio_median = median(wsf_built_nonbuilt_ratio, na.rm = TRUE),
      built_nonbuilt_ratio_pooled = sum(wsf_built_km2) / sum(wsf_observed_km2 - wsf_built_km2),
      built_km2_total           = sum(wsf_built_km2),
      nonbuilt_km2_total        = sum(wsf_observed_km2 - wsf_built_km2),
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

write_csv(desc, file.path(OUT_DIR, "wsf_2019_descriptive_stats.csv"))

cat("\n── WSF2019 built-up share (built / observed area) ──────────────────────\n")
print(desc %>%
        transmute(group_by, group, n_cities,
                  median = percent(built_share_median, 0.1),
                  mean   = percent(built_share_mean, 0.1),
                  pooled = percent(built_share_pooled, 0.1),
                  `built:non-built (pooled)` = round(built_nonbuilt_ratio_pooled, 2)),
      n = Inf)

rho <- with(df %>% filter(!is.na(built_pct), population_density > 0),
            cor(built_pct, population_density, method = "spearman"))
cat(sprintf("\nSpearman correlation built-up share vs population density: %.2f\n", rho))

# ── Map ───────────────────────────────────────────────────────────────────────
world <- ne_countries(scale = "medium", returnclass = "sf") %>% st_transform(proj_robin)

# Robinson frame built locally (no download needed)
bb <- st_sfc(st_polygon(list(cbind(
  c(seq(-180, 180, 1), rep(180, 181), seq(180, -180, -1), rep(-180, 181)),
  c(rep(-90, 361), seq(-90, 90, 1), rep(90, 361), seq(90, -90, -1))
))), crs = 4326) %>% st_transform(proj_robin)

pts <- df %>%
  filter(!is.na(lat), !is.na(lon)) %>%
  arrange(!is.na(built_pct), built_pct) %>%          # NA first, high values on top
  st_as_sf(coords = c("lon", "lat"), crs = 4326) %>%
  st_transform(proj_robin)

p_map <- ggplot() +
  geom_sf(data = bb, colour = "grey70", fill = "transparent", linewidth = 0.5) +
  geom_sf(data = world, fill = "grey92", colour = NA) +
  geom_sf(data = pts, aes(colour = built_pct), size = 0.6, alpha = 0.75) +
  scale_colour_viridis_c(
    option = "mako", direction = -1, end = 0.92,
    limits = c(0, 100), oob = squish, na.value = "#CCCCCC",
    name = "Built-up share (WSF2019)", labels = function(x) paste0(x, "%"),
    guide = guide_colourbar(title.position = "top", barwidth = unit(6, "lines"),
                            barheight = unit(0.45, "lines"))
  ) +
  coord_sf(expand = FALSE, clip = "off") +
  THEME_F +
  theme(
    legend.position      = c(0.68, 0.03),
    legend.direction     = "horizontal",
    legend.justification = c(0.5, 0),
    legend.background    = element_rect(fill = alpha("white", 0.85),
                                        colour = "grey80", linewidth = 0.3),
    legend.text          = element_text(size = 7),
    legend.title         = element_text(size = 7.5, face = "bold"),
    axis.text            = element_blank(),
    axis.ticks           = element_blank(),
    panel.grid           = element_line(colour = "grey95"),
    plot.margin          = margin(0, 0, 0, 0)
  )

# ── Panel A: distribution by region ───────────────────────────────────────────
global_median <- median(df$built_pct, na.rm = TRUE)

p_panel_a <- df %>%
  filter(!is.na(built_pct), !is.na(region)) %>%
  mutate(region = factor(region, levels = rev(region_order))) %>%
  ggplot(aes(x = built_pct, y = region)) +
  geom_vline(xintercept = global_median, colour = ACCENT_COL,
             linetype = "dashed", linewidth = 0.4) +
  geom_boxplot(fill = alpha(BUILT_COL, 0.25), colour = BUILT_COL, width = 0.6,
               linewidth = 0.3, outlier.size = 0.25, outlier.alpha = 0.3) +
  scale_x_continuous(limits = c(0, 100), breaks = c(0, 50, 100),
                     labels = c("0", "50%", "100%"), name = NULL) +
  facet_wrap(~ "Built-up share, by region") +
  labs(y = NULL) +
  THEME_F +
  theme(axis.text.y = element_text(size = 8), panel.grid.major.y = element_blank())

# ── Panel B: median by city type ──────────────────────────────────────────────
type_summary <- df %>%
  filter(!is.na(built_pct), !is.na(type)) %>%
  group_by(type) %>%
  summarise(median = median(built_pct), n = n(), .groups = "drop") %>%
  mutate(type = factor(type, levels = rev(type_order)))

p_panel_b <- ggplot(type_summary, aes(x = median, y = type)) +
  geom_col(fill = BUILT_COL, width = 0.65, colour = "white", linewidth = 0.15) +
  geom_text(aes(label = paste0(round(median), "%")), hjust = -0.15,
            size = 2.6, fontface = "bold", colour = "grey25") +
  scale_x_continuous(limits = c(0, 100), breaks = c(0, 50, 100),
                     labels = c("0", "50%", "100%"), name = NULL,
                     expand = expansion(mult = c(0, 0.05))) +
  facet_wrap(~ "Median built-up share, by city type") +
  labs(y = NULL) +
  THEME_F +
  theme(axis.text.y = element_text(size = 8), panel.grid.major.y = element_blank())

right_panels <- p_panel_a / p_panel_b + plot_layout(heights = c(1.3, 1))
fig_map <- p_map + right_panels + plot_layout(widths = c(2.9, 1)) +
  plot_annotation(
    caption = sprintf(paste0(
      "Built-up share = WSF2019 settlement pixels / all WSF pixels inside the GHS-UCDB R2024A polygon. ",
      "n = %s urban centres; dashed line = global median (%.0f%%). ",
      "Data: World Settlement Footprint 2019 (DLR, CC-BY-4.0)."),
      comma(sum(!is.na(df$built_pct))), global_median),
    theme = theme(plot.caption = element_text(size = 6.5, colour = "grey35", hjust = 0))
  )

ggsave(file.path(PLOT_DIR, "wsf_2019_built_share_map.png"), fig_map,
       width = 240, height = 105, units = "mm", dpi = 300, bg = "white")
ggsave(file.path(PLOT_DIR, "wsf_2019_built_share_map.pdf"), fig_map,
       width = 240, height = 105, units = "mm", bg = "white")

# ── Distribution figure: histogram, ratio, relation to density ────────────────
p_hist <- df %>%
  filter(!is.na(built_pct)) %>%
  ggplot(aes(x = built_pct)) +
  geom_histogram(binwidth = 2.5, boundary = 0, fill = BUILT_COL, colour = "white",
                 linewidth = 0.1) +
  geom_vline(xintercept = global_median, colour = ACCENT_COL,
             linetype = "dashed", linewidth = 0.4) +
  scale_x_continuous(limits = c(0, 100), labels = function(x) paste0(x, "%")) +
  facet_wrap(~ "Built-up share") +
  labs(x = NULL, y = "Urban centres") +
  THEME_F

p_ratio <- df %>%
  filter(!is.na(wsf_built_nonbuilt_ratio), wsf_built_nonbuilt_ratio > 0) %>%
  ggplot(aes(x = wsf_built_nonbuilt_ratio)) +
  geom_histogram(bins = 50, fill = BUILT_COL, colour = "white", linewidth = 0.1) +
  geom_vline(xintercept = 1, colour = "grey50", linetype = "dashed", linewidth = 0.35) +
  scale_x_log10(labels = label_number(drop0trailing = TRUE)) +
  facet_wrap(~ "Built-up : non-built-up ratio (log scale; 1 = equal area)") +
  labs(x = NULL, y = "Urban centres") +
  THEME_F

p_density <- df %>%
  filter(!is.na(built_pct), population_density > 0) %>%
  ggplot(aes(x = population_density, y = built_pct)) +
  geom_point(size = 0.3, alpha = 0.25, colour = BUILT_COL) +
  geom_smooth(method = "loess", formula = y ~ x, se = FALSE,
              colour = ACCENT_COL, linewidth = 0.6) +
  scale_x_log10(labels = label_comma()) +
  scale_y_continuous(labels = function(x) paste0(x, "%")) +
  coord_cartesian(ylim = c(0, 100)) +
  facet_wrap(~ sprintf("Built-up share vs population density (Spearman's rho = %.2f)", rho)) +
  labs(x = expression(Population ~ density ~ (people/km^2) * ", log scale"), y = NULL) +
  THEME_F

fig_dist <- (p_hist | p_ratio) / p_density + plot_layout(heights = c(1, 1.1))

ggsave(file.path(PLOT_DIR, "wsf_2019_built_share_distribution.png"), fig_dist,
       width = 180, height = 130, units = "mm", dpi = 300, bg = "white")
ggsave(file.path(PLOT_DIR, "wsf_2019_built_share_distribution.pdf"), fig_dist,
       width = 180, height = 130, units = "mm", bg = "white")

cat("\nWrote:\n",
    " ", file.path("output", "wsf_2019_descriptive_stats.csv"), "\n",
    " ", file.path("output", "plots", "wsf_2019_built_share_map.{png,pdf}"), "\n",
    " ", file.path("output", "plots", "wsf_2019_built_share_distribution.{png,pdf}"), "\n")
