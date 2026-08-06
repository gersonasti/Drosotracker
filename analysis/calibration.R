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
# Prints the constants with their 95 % confidence intervals (delta method),
# self-checks them against the published values (stops if they drift) and draws
# Figure 1 (developmental rate vs temperature).
#
# Run from the analysis/ folder:   Rscript calibration.R
# =====================================================================

# ---- 1) Data: the verified Powsner totals (committed CSV) ------------
d <- read.csv("data/powsner1935_total_verified.csv")   # cols: temp_c, total_days, note
d$rate <- 1 / d$total_days                              # developmental rate (1/day)

# ---- 2) Linear fit over the linear range (~15-28 C) -----------------
# Above ~28 C the rate-temperature relation reverses (Q10 falls) and is
# excluded. The 27.77 C point (pupal from females only) is kept in the fit;
# dropping it barely changes the result.
LO <- 15; HI <- 28
lin <- d$temp_c >= LO & d$temp_c <= HI
fit <- lm(rate ~ temp_c, data = d[lin, ])

b0 <- as.numeric(coef(fit)[1]); b1 <- as.numeric(coef(fit)[2])
T0 <- -b0 / b1                     # developmental-zero threshold (x-intercept)
DD <- 1 / b1                       # thermal constant (degree-days)
R2 <- summary(fit)$r.squared
n  <- sum(lin)

# ---- 3) 95 % confidence intervals by the delta method ---------------
# Both constants are non-linear functions of the fitted coefficients, so their
# variance comes from the gradient applied to the covariance matrix of the fit.
V     <- vcov(fit)                          # cov of (b0, b1)
gT0   <- c(-1 / b1, b0 / b1^2)              # gradient of T0 = -b0/b1
seT0  <- sqrt(as.numeric(t(gT0) %*% V %*% gT0))
seDD  <- sqrt(as.numeric(V[2, 2]) / b1^4)   # DD = 1/b1  =>  dDD/db1 = -1/b1^2
tcrit <- qt(0.975, df = n - 2)
ciT0  <- T0 + c(-1, 1) * tcrit * seT0
ciDD  <- DD + c(-1, 1) * tcrit * seDD

cat(sprintf("Powsner egg->adult, ~%g-%g C (n=%d):  T0 = %.2f C   DD = %.2f degree-days   R2 = %.4f\n",
            LO, HI, n, T0, DD, R2))
cat(sprintf("95%% CI (delta method):  T0 = %.2f-%.2f C   DD = %.2f-%.2f degree-days\n",
            ciT0[1], ciT0[2], ciDD[1], ciDD[2]))
print(summary(fit))

# ---- 4) Self-check: must reproduce the published values -------------
stopifnot(
  abs(T0 - 11.78)  < 0.03,
  abs(DD - 116.38) < 0.60,
  abs(ciT0[1] - 11.39)  < 0.02,
  abs(ciT0[2] - 12.18)  < 0.02,
  abs(ciDD[1] - 112.20) < 0.10,
  abs(ciDD[2] - 120.56) < 0.10,
  R2 > 0.995,
  n == 13
)
cat("self-check OK: reproduces T0 = 11.78 C (11.39-12.18), DD = 116.38 degree-days (112.20-120.56), n = 13.\n")

# ---- 5) Figure 1: developmental rate vs temperature -----------------
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
    annotate("point", x = T0, y = 0, shape = 4, colour = "red", size = 3, stroke = 1.2) +
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
