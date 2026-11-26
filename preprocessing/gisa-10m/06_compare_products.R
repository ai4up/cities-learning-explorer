# ══════════════════════════════════════════════════════════════════════════════
# 06_compare_products.R
# ---------------------
# Compares the two sets of indicators in output/gisa_10m_stats.csv:
#   GISA-10m 2016 impervious surface  (gisa_*)
#   ESA WorldCover 2021 built-up      (wc21_*)
# Both are computed on the same pixels, polygons, water mask and ~1 km cells.
#
# Output  output/plots/gisa_10m_vs_worldcover_2021.{png,pdf}
#         output/gisa_10m_vs_worldcover_2021.csv
# ══════════════════════════════════════════════════════════════════════════════
suppressPackageStartupMessages({
  library(dplyr)
  library(tidyr)
  library(readr)
  library(ggplot2)
  library(patchwork)
  library(jsonlite)
  library(scales)
})

script_dir <- local({
  args <- commandArgs(trailingOnly = FALSE)
  f <- sub("^--file=", "", args[grep("^--file=", args)])
  if (length(f)) dirname(normalizePath(f)) else getwd()
})
OUT_DIR  <- file.path(script_dir, "output")
PLOT_DIR <- file.path(OUT_DIR, "plots")

region_order <- c("North America", "South America", "Europe",
                  "Africa", "Asia", "Australasia", "Small Islands")
type_order   <- c("Type 1", "Type 2", "Type 3", "Type 4", "Mixed")
# two products = two categorical colours (checked for colour-vision deficiencies)
PRODUCTS <- c("GISA-10m 2016 (impervious)" = "#2A9D7C", "WorldCover 2021 (built-up)" = "#C96A1E")
INK <- "grey15"

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

stats <- read_csv(file.path(OUT_DIR, "gisa_10m_stats.csv"), show_col_types = FALSE)
cities_raw <- fromJSON(file.path(script_dir, "..", "..", "public", "cities.json"), simplifyVector = TRUE)
df <- tibble(id = cities_raw$id, region = cities_raw$region, type = cities_raw$type) %>%
  inner_join(stats, by = "id") %>%
  filter(gisa_valid_px > 0) %>%
  mutate(region = factor(region, levels = region_order), type = factor(type, levels = type_order),
         gisa = 100 * gisa_impervious_share, wc21 = 100 * wc21_built_share)

spearman <- function(x, y) cor(x, y, method = "spearman", use = "complete.obs")

# ── Summary table ─────────────────────────────────────────────────────────────
summarise_group <- function(d) {
  d %>% summarise(
    n_cities = n(),
    gisa_2016_share_median = median(gisa_impervious_share),
    wc_2021_share_median   = median(wc21_built_share),
    difference_median_pp   = 100 * median(wc21_built_share - gisa_impervious_share),
    rank_correlation_share = spearman(gisa_impervious_share, wc21_built_share),
    gisa_2016_unevenness_median = median(gisa_cell_sd_norm[gisa_reliable], na.rm = TRUE),
    wc_2021_unevenness_median   = median(wc21_cell_sd_norm[gisa_reliable], na.rm = TRUE),
    rank_correlation_unevenness = spearman(gisa_cell_sd_norm[gisa_reliable],
                                           wc21_cell_sd_norm[gisa_reliable]),
    .groups = "drop")
}
comparison <- bind_rows(
  summarise_group(df) %>% mutate(group_by = "all", group = "All cities"),
  summarise_group(group_by(df, region)) %>% mutate(group_by = "region", group = as.character(region)) %>% select(-region),
  summarise_group(group_by(df, type)) %>% mutate(group_by = "type", group = as.character(type)) %>% select(-type)
) %>% filter(!is.na(group)) %>% select(group_by, group, everything())
write_csv(comparison, file.path(OUT_DIR, "gisa_10m_vs_worldcover_2021.csv"))

# ── Panel 1: city by city ─────────────────────────────────────────────────────
rho <- spearman(df$gisa, df$wc21)
p_scatter <- df %>%
  mutate(panel = sprintf("City by city (rank correlation %.2f)", rho)) %>%
  ggplot(aes(gisa, wc21)) +
  geom_point(size = 0.25, alpha = 0.2, colour = "grey30") +
  geom_abline(slope = 1, intercept = 0, colour = INK, linetype = "dashed", linewidth = 0.35) +
  scale_x_continuous(limits = c(0, 100), labels = function(x) paste0(x, "%")) +
  scale_y_continuous(limits = c(0, 100), labels = function(x) paste0(x, "%")) +
  coord_equal() +
  facet_wrap(~ panel) +
  labs(x = "GISA-10m 2016, impervious share", y = "WorldCover 2021, built-up share") +
  THEME_F

# ── Panels 2 and 3: medians by region and by type ─────────────────────────────
dumbbell <- function(group_var, levels, title) {
  d <- df %>%
    filter(!is.na(.data[[group_var]])) %>%
    group_by(group = .data[[group_var]]) %>%
    summarise(`GISA-10m 2016 (impervious)` = median(gisa),
              `WorldCover 2021 (built-up)` = median(wc21), .groups = "drop") %>%
    mutate(group = factor(group, levels = rev(levels)), panel = title)
  long <- d %>% pivot_longer(c(`GISA-10m 2016 (impervious)`, `WorldCover 2021 (built-up)`),
                             names_to = "product", values_to = "share")
  ggplot(long, aes(share, group)) +
    geom_segment(data = d, aes(x = `GISA-10m 2016 (impervious)`, xend = `WorldCover 2021 (built-up)`,
                               y = group, yend = group), colour = "grey70", linewidth = 0.6) +
    geom_point(aes(colour = product), size = 2.4) +
    geom_text(data = long %>% group_by(group) %>%
                mutate(nudge = ifelse(share == max(share), 3.4, -3.4)) %>% ungroup(),
              aes(x = share + nudge, y = group, label = sprintf("%.0f", share)),
              colour = INK, size = 2.3, inherit.aes = FALSE) +
    scale_colour_manual(values = PRODUCTS, name = NULL) +
    scale_x_continuous(limits = c(10, 75), labels = function(x) paste0(x, "%")) +
    facet_wrap(~ panel) +
    labs(x = NULL, y = NULL) +
    THEME_F +
    theme(axis.text.y = element_text(size = 7.5), legend.position = "bottom",
          legend.text = element_text(size = 7), legend.margin = margin(0, 0, 0, 0))
}
p_region <- dumbbell("region", region_order, "Median share by region")
p_type   <- dumbbell("type", type_order, "Median share by city type")

fig <- p_scatter + p_region + p_type +
  plot_layout(widths = c(1.05, 1, 1), guides = "collect") +
  plot_annotation(
    caption = sprintf(paste0(
      "n = %s urban centres. Both products counted on the same land pixels (water masked) inside the ",
      "GHS-UCDB R2024A polygons. Dashed line: equal values.\nThe products differ in year and in definition ",
      "(impervious surface vs built-up land), so differences are not growth alone."),
      comma(nrow(df))),
    theme = theme(plot.caption = element_text(size = 6.5, colour = "grey35", hjust = 0),
                  legend.position = "bottom"))

ggsave(file.path(PLOT_DIR, "gisa_10m_vs_worldcover_2021.png"), fig,
       width = 240, height = 100, units = "mm", dpi = 300, bg = "white")
ggsave(file.path(PLOT_DIR, "gisa_10m_vs_worldcover_2021.pdf"), fig,
       width = 240, height = 100, units = "mm", bg = "white")

cat("\nWrote:\n  ", file.path("output", "gisa_10m_vs_worldcover_2021.csv"), "\n  ",
    file.path("output", "plots", "gisa_10m_vs_worldcover_2021.{png,pdf}"), "\n\n")
print(comparison %>% mutate(across(where(is.numeric) & !n_cities, ~ round(.x, 3))), width = Inf)
