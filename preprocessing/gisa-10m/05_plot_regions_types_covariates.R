# ══════════════════════════════════════════════════════════════════════════════
# 05_plot_regions_types_covariates.R
# ----------------------------------
# Further views of the GISA-10m indicators:
#   1. regional maps with the largest cities labelled (ggrepel)
#   2. summary by city type of the typology
#   3. relation to the other city characteristics shown in the explorer
#   4. Europe only: comparison with independent land-cover covariates
#
# Input   output/gisa_10m_stats.csv   (from 02_compute_gisa_stats.py)
#         ../../public/cities.json
# Output  output/plots/gisa_10m_map_<region>.{png,pdf}        (7 maps)
#         output/plots/gisa_10m_by_type.{png,pdf}
#         output/plots/gisa_10m_covariates.{png,pdf}
#         output/plots/gisa_10m_covariates_europe.{png,pdf}
#         output/gisa_10m_by_type.csv, output/gisa_10m_covariate_correlations.csv
# ══════════════════════════════════════════════════════════════════════════════
suppressPackageStartupMessages({
  library(dplyr)
  library(tidyr)
  library(readr)
  library(ggplot2)
  library(ggrepel)
  library(sf)
  library(rnaturalearth)
  library(patchwork)
  library(jsonlite)
  library(scales)
})

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

# ── Style (as in 03_plot_and_describe.R) ──────────────────────────────────────
region_order <- c("North America", "South America", "Europe",
                  "Africa", "Asia", "Australasia", "Small Islands")
type_order   <- c("Type 1", "Type 2", "Type 3", "Type 4", "Mixed")
type_labels  <- c("Type 1" = "Type 1\nsmall, low income",
                  "Type 2" = "Type 2\nfast growing, sprawling",
                  "Type 3" = "Type 3\nwealthy, low growth",
                  "Type 4" = "Type 4\nlarge and megacities",
                  "Mixed"  = "Mixed")
MAIN_COL   <- "#085041"
ACCENT_COL <- "#FAC775"
NEG_COL    <- "#B8621B"   # negative pole of the diverging scale (positive pole = MAIN_COL)
INK        <- "grey15"

THEME_F <- theme_minimal(base_size = 8) +
  theme(
    panel.grid       = element_blank(),
    panel.border     = element_rect(colour = "grey45", fill = NA, linewidth = 0.3),
    axis.ticks       = element_line(colour = "grey45", linewidth = 0.25),
    axis.ticks.length = unit(1.5, "pt"),
    strip.text       = element_text(size = 7.5, face = "bold", hjust = 0),
    axis.title       = element_text(size = 7.5),
    plot.caption     = element_text(size = 6.5, colour = "grey35", hjust = 0),
    plot.margin      = margin(2, 4, 2, 4)
  )

save_plot <- function(p, name, width, height) {
  ggsave(file.path(PLOT_DIR, paste0(name, ".png")), p, width = width, height = height,
         units = "mm", dpi = 300, bg = "white")
  ggsave(file.path(PLOT_DIR, paste0(name, ".pdf")), p, width = width, height = height,
         units = "mm", bg = "white")
  cat("  ", file.path("output", "plots", paste0(name, ".{png,pdf}")), "\n")
}

# ── Data ──────────────────────────────────────────────────────────────────────
stats <- read_csv(STATS_CSV, show_col_types = FALSE)
cities_raw <- fromJSON(CITIES_JSON, simplifyVector = TRUE)

cities <- bind_cols(
  tibble(id = cities_raw$id, name = cities_raw$name, country = cities_raw$country,
         region = cities_raw$region, type = cities_raw$type,
         lat = cities_raw$lat, lon = cities_raw$lon),
  as_tibble(cities_raw$characteristics),
  as_tibble(cities_raw$eu_characteristics) %>% rename_with(~ paste0("eu_", .x))
)

df <- cities %>%
  left_join(stats, by = "id") %>%
  mutate(
    imperv_pct   = 100 * gisa_impervious_share,
    # within-city indicators only where they rest on enough cells
    unevenness   = if_else(gisa_reliable, gisa_cell_sd_norm, NA_real_),
    sealed_pct   = if_else(gisa_reliable, 100 * gisa_sealed_area_share, NA_real_),
    unsealed_pct = if_else(gisa_reliable, 100 * gisa_unsealed_area_share, NA_real_),
    m2_cap       = gisa_impervious_m2_per_capita,
    region       = factor(region, levels = region_order),
    type         = factor(type, levels = type_order)
  )

cat("\nWrote:\n")

# ══ 1. Regional maps with labelled cities ═════════════════════════════════════
world <- ne_countries(scale = "medium", returnclass = "sf")
N_LABELS <- 25

map_windows <- list(
  north_america   = list(title = "North and Central America",
                         xlim = c(-128, -58), ylim = c(6, 56)),
  south_america   = list(title = "South America",
                         xlim = c(-84, -32),  ylim = c(-56, 14)),
  europe          = list(title = "Europe",
                         xlim = c(-12, 46),   ylim = c(34, 66)),
  africa          = list(title = "Africa",
                         xlim = c(-20, 54),   ylim = c(-36, 38)),
  west_south_asia = list(title = "West, Central and South Asia",
                         xlim = c(26, 96),    ylim = c(4, 56)),
  east_asia       = list(title = "East and Southeast Asia",
                         xlim = c(92, 150),   ylim = c(-12, 54)),
  oceania         = list(title = "Australia, New Zealand and the Pacific",
                         xlim = c(110, 180),  ylim = c(-48, -8))
)

regional_map <- function(w) {
  d <- df %>%
    filter(!is.na(imperv_pct), lon >= w$xlim[1], lon <= w$xlim[2],
           lat >= w$ylim[1], lat <= w$ylim[2]) %>%
    arrange(imperv_pct)                                   # high values drawn on top
  labelled <- d %>%
    slice_max(population, n = N_LABELS, with_ties = FALSE) %>%
    mutate(label = sprintf("%s %.0f%%", sub(" \\[.*$", "", name), imperv_pct))

  ggplot() +
    geom_sf(data = world, fill = "grey93", colour = "white", linewidth = 0.2) +
    geom_point(data = d, aes(lon, lat, colour = imperv_pct), size = 1.3, alpha = 0.8) +
    geom_point(data = labelled, aes(lon, lat, fill = imperv_pct), shape = 21, size = 2.8,
               colour = INK, stroke = 0.4) +
    geom_text_repel(data = labelled, aes(lon, lat, label = label), size = 3.4, colour = INK,
                    segment.colour = "grey40", segment.size = 0.2, min.segment.length = 0,
                    box.padding = 0.35, point.padding = 0.2, max.overlaps = Inf,
                    bg.color = "white", bg.r = 0.12, seed = 1) +
    scale_colour_viridis_c(option = "mako", direction = -1, end = 0.92, limits = c(0, 100),
                           oob = squish, name = "Impervious share (GISA-10m)",
                           labels = function(x) paste0(x, "%"), aesthetics = c("colour", "fill"),
                           guide = guide_colourbar(title.position = "top",
                                                   barwidth = unit(10, "lines"),
                                                   barheight = unit(0.6, "lines"))) +
    coord_sf(xlim = w$xlim, ylim = w$ylim, expand = FALSE) +
    labs(title = w$title, x = NULL, y = NULL,
         caption = sprintf(paste0(
           "%s urban centres (GHS-UCDB R2024A); labels: the %d most populous, with their impervious share. ",
           "Data: GISA-10m, 2016 (Huang et al. 2022, CC-BY-4.0)."), comma(nrow(d)), nrow(labelled))) +
    THEME_F +
    theme(plot.title = element_text(size = 14, face = "bold"),
          plot.caption = element_text(size = 8),
          legend.position = "bottom", legend.title = element_text(size = 10, face = "bold"),
          legend.text = element_text(size = 9), legend.margin = margin(0, 0, 0, 0),
          axis.text = element_text(size = 8, colour = "grey45"),
          panel.background = element_rect(fill = "white", colour = NA))
}

for (key in names(map_windows)) {
  w <- map_windows[[key]]
  # page height follows the window's aspect ratio at its mid latitude
  ratio <- diff(w$ylim) / (diff(w$xlim) * cos(mean(w$ylim) * pi / 180))
  save_plot(regional_map(w), paste0("gisa_10m_map_", key), width = 260,
            height = min(340, 248 * ratio + 34))
}

# ══ 2. Summary by city type ═══════════════════════════════════════════════════
by_type <- df %>%
  filter(!is.na(imperv_pct), !is.na(type)) %>%
  group_by(type) %>%
  summarise(
    n_cities                 = n(),
    impervious_share_median  = median(gisa_impervious_share),
    impervious_share_p25     = quantile(gisa_impervious_share, 0.25),
    impervious_share_p75     = quantile(gisa_impervious_share, 0.75),
    impervious_share_pooled  = sum(gisa_impervious_km2) / sum(gisa_land_km2),
    impervious_m2_per_capita_median = median(m2_cap, na.rm = TRUE),
    n_reliable               = sum(gisa_reliable),
    unevenness_median        = median(unevenness, na.rm = TRUE),
    sealed_area_share_mean   = mean(sealed_pct, na.rm = TRUE) / 100,
    unsealed_area_share_mean = mean(unsealed_pct, na.rm = TRUE) / 100,
    .groups = "drop"
  )
write_csv(by_type, file.path(OUT_DIR, "gisa_10m_by_type.csv"))

type_box <- function(var, title, x_scale) {
  med <- median(df[[var]], na.rm = TRUE)
  df %>%
    filter(!is.na(.data[[var]]), !is.na(type)) %>%
    mutate(type = factor(type, levels = rev(type_order)), panel = title) %>%
    ggplot(aes(x = .data[[var]], y = type)) +
    geom_vline(xintercept = med, colour = ACCENT_COL, linetype = "dashed", linewidth = 0.4) +
    geom_boxplot(fill = alpha(MAIN_COL, 0.25), colour = MAIN_COL, width = 0.6,
                 linewidth = 0.3, outlier.size = 0.2, outlier.alpha = 0.2) +
    x_scale +
    scale_y_discrete(labels = type_labels) +
    facet_wrap(~ panel) +
    labs(x = NULL, y = NULL) +
    THEME_F +
    theme(axis.text.y = element_text(size = 7, lineheight = 0.9))
}

p_t_share <- type_box("imperv_pct", "Impervious share",
                      scale_x_continuous(limits = c(0, 100), labels = function(x) paste0(x, "%")))
p_t_m2    <- type_box("m2_cap", "Impervious area per person (m², log scale)",
                      scale_x_log10(labels = label_comma(), limits = c(1, 1000), oob = squish, na.value = 1)) +
  theme(axis.text.y = element_blank())
p_t_unev  <- type_box("unevenness", "Within-city unevenness (0-1)",
                      scale_x_continuous(limits = c(0, 1))) +
  theme(axis.text.y = element_blank())

# How a city's area splits into mostly unsealed, mixed and heavily sealed ~1 km cells
composition <- by_type %>%
  transmute(type,
            `Mostly unsealed cells (< 20 % impervious)` = unsealed_area_share_mean,
            `Mixed cells (20-80 %)` = 1 - unsealed_area_share_mean - sealed_area_share_mean,
            `Heavily sealed cells (> 80 %)` = sealed_area_share_mean) %>%
  pivot_longer(-type, names_to = "class", values_to = "share") %>%
  mutate(class = factor(class, levels = rev(unique(class))),
         type  = factor(type, levels = rev(type_order)),
         panel = "Average split of the city area by ~1 km cell")

p_t_comp <- ggplot(composition, aes(x = share, y = type, fill = class)) +
  geom_col(width = 0.65, colour = "white", linewidth = 0.4) +
  geom_text(aes(label = ifelse(share >= 0.04, paste0(round(100 * share), "%"), ""),
                colour = class), position = position_stack(vjust = 0.5), size = 2.4,
            show.legend = FALSE) +
  scale_fill_manual(values = c("Mostly unsealed cells (< 20 % impervious)" = "#DCEBE5",
                               "Mixed cells (20-80 %)" = "#7FB5A2",
                               "Heavily sealed cells (> 80 %)" = MAIN_COL),
                    breaks = rev(levels(composition$class)), name = NULL) +
  scale_colour_manual(values = c("Mostly unsealed cells (< 20 % impervious)" = INK,
                                 "Mixed cells (20-80 %)" = INK,
                                 "Heavily sealed cells (> 80 %)" = "white")) +
  scale_x_continuous(labels = percent, expand = expansion(mult = c(0, 0.01))) +
  scale_y_discrete(labels = type_labels) +
  facet_wrap(~ panel) +
  labs(x = NULL, y = NULL) +
  THEME_F +
  theme(axis.text.y = element_text(size = 7, lineheight = 0.9), legend.position = "bottom",
        legend.text = element_text(size = 6.5), legend.key.size = unit(0.6, "lines"),
        legend.margin = margin(0, 0, 0, 0)) +
  guides(fill = guide_legend(nrow = 3))

# Median impervious share for every region x type combination
region_type <- df %>%
  filter(!is.na(imperv_pct), !is.na(type), !is.na(region)) %>%
  group_by(region, type) %>%
  summarise(median = median(imperv_pct), n = n(), .groups = "drop") %>%
  filter(n >= 10) %>%
  mutate(region = factor(region, levels = rev(region_order)),
         panel = "Median impervious share by region and type (cells with >= 10 cities)")

p_t_heat <- ggplot(region_type, aes(x = type, y = region, fill = median)) +
  geom_tile(colour = "white", linewidth = 0.8) +
  geom_text(aes(label = sprintf("%.0f%%\nn = %s", median, comma(n)),
                colour = median > 45), size = 2.2, lineheight = 0.9, show.legend = FALSE) +
  scale_fill_gradient(low = "#EAF3EF", high = MAIN_COL, limits = c(0, 70), oob = squish,
                      guide = "none") +
  scale_colour_manual(values = c(`TRUE` = "white", `FALSE` = INK)) +
  scale_x_discrete(position = "bottom") +
  facet_wrap(~ panel) +
  labs(x = NULL, y = NULL) +
  THEME_F +
  theme(axis.text = element_text(size = 7), axis.ticks = element_blank())

fig_type <- (p_t_share | p_t_m2 | p_t_unev) / (p_t_comp | p_t_heat) +
  plot_layout(heights = c(1, 1.25)) +
  plot_annotation(caption = sprintf(paste0(
    "n = %s urban centres with GISA-10m data; within-city panels use the %s centres with >= 10 cells. ",
    "Dashed lines = global medians. Boxes: quartiles; whiskers: 1.5 x IQR."),
    comma(sum(by_type$n_cities)), comma(sum(by_type$n_reliable))),
    theme = theme(plot.caption = element_text(size = 6.5, colour = "grey35", hjust = 0)))
save_plot(fig_type, "gisa_10m_by_type", width = 240, height = 150)

# ══ 3. Relation to the other city characteristics ═════════════════════════════
covariates <- c(
  population = "Population", population_growth = "Population growth",
  population_density = "Population density", population_density_growth = "Density growth",
  population_age = "Population age index", gdp_ppp = "GDP PPP per capita",
  gdp_ppp_growth = "GDP growth", hdi = "Human development index",
  critical_infrastructure = "Critical infrastructure", emissions = "GHG emissions per capita",
  hdd = "Heating degree days", cdd = "Cooling degree days",
  built_up_share = "Built-up share (WSF 2019)"
)
covariates <- covariates[names(covariates) %in% names(df)]
indicators <- c(imperv_pct = "Impervious\nshare", m2_cap = "Impervious m²\nper person",
                unevenness = "Within-city\nunevenness", sealed_pct = "Area in heavily\nsealed cells")

correlations <- expand_grid(indicator = names(indicators), covariate = names(covariates)) %>%
  rowwise() %>%
  mutate(
    n   = sum(complete.cases(df[[indicator]], df[[covariate]])),
    rho = cor(df[[indicator]], df[[covariate]], method = "spearman", use = "complete.obs")
  ) %>%
  ungroup()
write_csv(correlations, file.path(OUT_DIR, "gisa_10m_covariate_correlations.csv"))

# covariates ordered by their correlation with the impervious share
cov_order <- correlations %>% filter(indicator == "imperv_pct") %>% arrange(rho) %>% pull(covariate)

p_cor <- correlations %>%
  mutate(covariate = factor(covariates[covariate], levels = covariates[cov_order]),
         indicator = factor(indicators[indicator], levels = indicators),
         panel = "Spearman correlation with city characteristics") %>%
  ggplot(aes(x = indicator, y = covariate, fill = rho)) +
  geom_tile(colour = "white", linewidth = 0.8) +
  geom_text(aes(label = sprintf("%+.2f", rho), colour = abs(rho) > 0.5), size = 2.4,
            show.legend = FALSE) +
  scale_fill_gradient2(low = NEG_COL, mid = "grey96", high = MAIN_COL, midpoint = 0,
                       limits = c(-1, 1), name = "Spearman's rho",
                       guide = guide_colourbar(barwidth = unit(6, "lines"),
                                               barheight = unit(0.4, "lines"),
                                               title.position = "top")) +
  scale_colour_manual(values = c(`TRUE` = "white", `FALSE` = INK)) +
  scale_x_discrete(position = "top") +
  facet_wrap(~ panel) +
  labs(x = NULL, y = NULL) +
  THEME_F +
  theme(axis.ticks = element_blank(), axis.text.x = element_text(size = 6.5, lineheight = 0.9),
        axis.text.y = element_text(size = 7), legend.position = "bottom",
        legend.title = element_text(size = 7), legend.text = element_text(size = 6.5),
        legend.margin = margin(0, 0, 0, 0))

scatter <- function(xvar, yvar, title, xlab, ylab, x_log = FALSE, y_log = FALSE) {
  d <- df %>% filter(!is.na(.data[[xvar]]), !is.na(.data[[yvar]]))
  if (x_log) d <- d %>% filter(.data[[xvar]] > 0)
  if (y_log) d <- d %>% filter(.data[[yvar]] > 0)
  rho <- cor(d[[xvar]], d[[yvar]], method = "spearman")
  p <- d %>%
    mutate(panel = sprintf("%s (rho = %.2f)", title, rho)) %>%
    ggplot(aes(x = .data[[xvar]], y = .data[[yvar]])) +
    geom_point(size = 0.25, alpha = 0.2, colour = MAIN_COL) +
    geom_smooth(method = "loess", formula = y ~ x, se = FALSE, colour = ACCENT_COL,
                linewidth = 0.6) +
    facet_wrap(~ panel) +
    labs(x = xlab, y = ylab) +
    THEME_F +
    theme(axis.title = element_text(size = 6.5))
  if (x_log) p <- p + scale_x_log10(labels = label_number(drop0trailing = TRUE, big.mark = ","))
  if (y_log) p <- p + scale_y_log10(labels = label_number(drop0trailing = TRUE, big.mark = ","))
  p
}

p_s1 <- scatter("gdp_ppp", "m2_cap", "m² per person vs income",
                "GDP PPP per capita (int'l $, log)", "m² per person (log)", TRUE, TRUE)
p_s2 <- scatter("hdi", "imperv_pct", "Impervious share vs HDI",
                "Human development index", "Impervious share (%)")
p_s3 <- scatter("emissions", "m2_cap", "m² per person vs emissions",
                "GHG emissions (tCO2e per capita, log)", "m² per person (log)", TRUE, TRUE)
p_s4 <- scatter("population", "unevenness", "Unevenness vs city size",
                "Population (log)", "Within-city unevenness (0-1)", TRUE)

fig_cov <- p_cor | ((p_s1 | p_s2) / (p_s3 | p_s4))
fig_cov <- fig_cov + plot_layout(widths = c(1, 1.55)) +
  plot_annotation(caption = paste0(
    "Rank correlations across all urban centres with data (within-city indicators: centres with >= 10 cells). ",
    "Orange lines: loess fit. Covariates as shown in the explorer (GHS-UCDB R2024A and related)."),
    theme = theme(plot.caption = element_text(size = 6.5, colour = "grey35", hjust = 0)))
save_plot(fig_cov, "gisa_10m_covariates", width = 240, height = 135)

# ══ 4. Europe: comparison with independent land-cover covariates ══════════════
if (all(c("eu_greenness", "eu_built_up_area_per_capita", "eu_road_network_density") %in% names(df))) {
  p_e1 <- scatter("eu_greenness", "imperv_pct", "Impervious share vs greenness",
                  "Greenness index", "Impervious share (%)")
  p_e2 <- scatter("eu_built_up_area_per_capita", "m2_cap",
                  "GISA vs GHSL area per person",
                  "GHSL built-up area (m² per person, log)", "GISA impervious (m² per person, log)",
                  TRUE, TRUE) +
    geom_abline(slope = 1, intercept = 0, colour = "grey50", linetype = "dashed", linewidth = 0.3)
  p_e3 <- scatter("eu_road_network_density", "imperv_pct", "Impervious share vs road density",
                  "Road network density (m per m²)", "Impervious share (%)")
  n_eu <- sum(!is.na(df$eu_greenness) & !is.na(df$imperv_pct))
  fig_eu <- (p_e1 | p_e2 | p_e3) +
    plot_annotation(caption = sprintf(paste0(
      "%s European urban centres with the extended characteristics of the explorer. ",
      "Dashed line in the middle panel: equal values. Orange lines: loess fit."), comma(n_eu)),
      theme = theme(plot.caption = element_text(size = 6.5, colour = "grey35", hjust = 0)))
  save_plot(fig_eu, "gisa_10m_covariates_europe", width = 240, height = 80)
}

cat("  ", file.path("output", "gisa_10m_by_type.csv"), "\n",
    "  ", file.path("output", "gisa_10m_covariate_correlations.csv"), "\n")

cat("\n── By type ─────────────────────────────────────────────────────────────\n")
print(by_type %>% mutate(across(where(is.numeric) & !c(n_cities, n_reliable), ~ round(.x, 3))),
      width = Inf)
cat("\n── Spearman correlations ───────────────────────────────────────────────\n")
print(correlations %>% select(-n) %>% mutate(rho = round(rho, 2)) %>%
        pivot_wider(names_from = indicator, values_from = rho), n = Inf)
