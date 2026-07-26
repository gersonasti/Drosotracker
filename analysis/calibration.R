# =====================================================================
# calibration.R — Base development-model calibration for DrosoTracker.
#
# Derives the thermal-summation constants of the egg->adult model
#     T_dev(theta) = DD / (theta - T0)   <=>   rate = (1/DD)*theta - T0/DD
# by linear regression of developmental RATE against temperature, over the
# linear range ~15-28 C, on the author-verified transcription of Powsner
# (1935, Physiol. Zool. 8:474-520; Tables IX corrected + X, sexes averaged).
#   DD = 1 / slope ;  T0 = -intercept / slope.
#
# Prints and self-checks the constants (stops if they drift) and draws
# Figure 1 (developmental rate vs temperature).
#
# Run from the analysis/ folder:   Rscript calibration.R
# =====================================================================

# ---- 1) Data: the verified Powsner totals (committed CSV) ------------
d <- read.csv("data/powsner1935_total_verified.csv")   # cols: temp_c, total_days, nota
d$rate <- 1 / d$total_days                              # developmental rate (1/day)

# ---- 2) Linear fit over the linear range (~15-28 C) -----------------
# Above ~28 C the rate-temperature relation reverses (Q10 falls) and is
# excluded. The 27.77 C point (pupal from females only) is kept in the fit;
# dropping it barely changes the result.
LO <- 15; HI <- 28
lin <- d$temp_c >= LO & d$temp_c <= HI
fit <- lm(rate ~ temp_c, data = d[lin, ])

b0 <- coef(fit)[1]; b1 <- coef(fit)[2]
T0 <- as.numeric(-b0 / b1)         # developmental-zero threshold (x-intercept)
DD <- as.numeric(1 / b1)           # thermal constant (degree-days)
R2 <- summary(fit)$r.squared
n  <- sum(lin)

cat(sprintf("Powsner egg->adult, ~%g-%g C (n=%d):  T0 = %.2f C   DD = %.2f degree-days   R2 = %.4f\n",
            LO, HI, n, T0, DD, R2))
print(summary(fit))

# ---- 3) Self-check: must reproduce the published values -------------
stopifnot(
  abs(T0 - 11.78)  < 0.03,
  abs(DD - 116.38) < 0.60,
  R2 > 0.995,
  n == 13
)
cat("self-check OK: reproduces T0 = 11.78 C, DD = 116.38 degree-days, n = 13.\n")

# ---- 4) Figure 1: developmental rate vs temperature -----------------
if (requireNamespace("ggplot2", quietly = TRUE)) {
  library(ggplot2)
  dir.create("figures", showWarnings = FALSE)

  d$group <- factor(ifelse(lin, "linear fit", "excluded"),
                    levels = c("linear fit", "excluded"))
  cols <- c(`linear fit` = "#2FCFA099", excluded = "#B4CDCD")

  # fitted line drawn only from T0 to the upper limit (not into the excluded zone)
  fit_line <- data.frame(temp_c = seq(T0, HI, length.out = 100))
  fit_line$rate <- b1 * fit_line$temp_c + b0

  p1 <- ggplot(d, aes(temp_c, rate)) +
    geom_hline(yintercept = 0, colour = "grey60") +
    geom_line(data = fit_line, colour = "black", linewidth = 1) +
    geom_point(aes(fill = group), shape = 21, size = 3, colour = "transparent") +
    annotate("point", x = T0, y = 0, shape = 4, colour = "black", size = 3, stroke = 1.2) +
    annotate("text",  x = T0, y = 0, label = sprintf("T0 = %.2f °C", T0),
             hjust = -0.1, vjust = -0.6, colour = "black", size = 3.5) +
    scale_fill_manual(values = cols, name = NULL) +
    labs(x = "Temperature (°C)", y = "Developmental rate (1/day)") +
    theme_minimal() +
    theme(legend.position = c(0.02, 0.98), legend.justification = c(0, 1))

  ggsave("figures/figure1_rate_vs_temp.pdf", p1, width = 90, height = 68, units = "mm")
  ggsave("figures/figure1_rate_vs_temp.png", p1, width = 90, height = 68, units = "mm", dpi = 300)
  cat("Figure 1 saved to analysis/figures/.\n")
} else {
  cat("(ggplot2 not installed; skipped Figure 1. install.packages('ggplot2') to regenerate.)\n")
}
