"""Distribution domain fixture generation from SciPy reference implementations."""

from __future__ import annotations

from typing import Any

import numpy as np
from scipy import stats

from ._common import metadata


def generate(generated_at: str) -> list[dict[str, Any]]:
    return [
        {
            "fixture": "distribution.algebra-parity",
            "file": "distribution/algebra-parity.json",
            "metadata": metadata(generated_at),
            "payload": {
                "cases": [
                    # Normal
                    _normal_pdf("normal-pdf-std-0", 0.0, 0.0, 1.0),
                    _normal_pdf("normal-pdf-std-1", 1.0, 0.0, 1.0),
                    _normal_pdf("normal-pdf-std-neg1", -1.0, 0.0, 1.0),
                    _normal_pdf("normal-pdf-shifted", 5.0, 5.0, 2.0),
                    _normal_logpdf("normal-logpdf-std-0", 0.0, 0.0, 1.0),
                    _normal_logpdf("normal-logpdf-std-3", 3.0, 0.0, 1.0),
                    _normal_logpdf("normal-logpdf-shifted", 5.0, 5.0, 2.0),
                    _normal_cdf("normal-cdf-0", 0.0, 0.0, 1.0),
                    _normal_cdf("normal-cdf-196", 1.96, 0.0, 1.0),
                    _normal_cdf("normal-cdf-neg3", -3.0, 0.0, 1.0),
                    _normal_quantile("normal-quantile-50", 0.5, 0.0, 1.0),
                    _normal_quantile("normal-quantile-025", 0.025, 0.0, 1.0),
                    _normal_quantile("normal-quantile-975", 0.975, 0.0, 1.0),
                    _normal_quantile("normal-quantile-shifted", 0.5, 5.0, 2.0),
                    _normal_mean("normal-mean-std", 0.0, 1.0),
                    _normal_mean("normal-mean-shifted", 5.0, 2.0),
                    _normal_variance("normal-variance-std", 0.0, 1.0),
                    _normal_variance("normal-variance-wide", 0.0, 3.0),
                    _normal_entropy("normal-entropy-std", 0.0, 1.0),
                    _normal_entropy("normal-entropy-wide", 0.0, 3.0),
                    # LogNormal
                    _lognormal_pdf("lognormal-pdf-1", 1.0, 0.0, 1.0),
                    _lognormal_pdf("lognormal-pdf-2", 2.0, 0.0, 1.0),
                    _lognormal_logpdf("lognormal-logpdf-1", 1.0, 0.0, 1.0),
                    _lognormal_logpdf("lognormal-logpdf-05", 0.5, 0.0, 1.0),
                    _lognormal_cdf("lognormal-cdf-1", 1.0, 0.0, 1.0),
                    _lognormal_cdf("lognormal-cdf-2", 2.0, 0.0, 1.0),
                    _lognormal_quantile("lognormal-quantile-50", 0.5, 0.0, 1.0),
                    _lognormal_quantile("lognormal-quantile-90", 0.9, 0.0, 1.0),
                    _lognormal_mean("lognormal-mean-std", 0.0, 1.0),
                    _lognormal_variance("lognormal-variance-std", 0.0, 1.0),
                    _lognormal_entropy("lognormal-entropy-std", 0.0, 1.0),
                    # Exponential
                    _exp_pdf("exp-pdf-0", 0.0, 1.0),
                    _exp_pdf("exp-pdf-1", 1.0, 1.0),
                    _exp_pdf("exp-pdf-rate2", 0.5, 2.0),
                    _exp_logpdf("exp-logpdf-0", 0.0, 1.0),
                    _exp_logpdf("exp-logpdf-2", 2.0, 1.0),
                    _exp_cdf("exp-cdf-0", 0.0, 1.0),
                    _exp_cdf("exp-cdf-1", 1.0, 1.0),
                    _exp_cdf("exp-cdf-5", 5.0, 1.0),
                    _exp_quantile("exp-quantile-50", 0.5, 1.0),
                    _exp_quantile("exp-quantile-90", 0.9, 1.0),
                    _exp_mean("exp-mean-rate1", 1.0),
                    _exp_mean("exp-mean-rate2", 2.0),
                    _exp_variance("exp-variance-rate1", 1.0),
                    _exp_entropy("exp-entropy-rate1", 1.0),
                    # Uniform
                    _unif_pdf("unif-pdf-inside", 0.5, 0.0, 1.0),
                    _unif_pdf("unif-pdf-outside", -0.1, 0.0, 1.0),
                    _unif_logpdf("unif-logpdf-inside", 0.5, 0.0, 1.0),
                    _unif_cdf("unif-cdf-mid", 0.5, 0.0, 1.0),
                    _unif_cdf("unif-cdf-below", -1.0, 0.0, 1.0),
                    _unif_cdf("unif-cdf-above", 2.0, 0.0, 1.0),
                    _unif_quantile("unif-quantile-25", 0.25, 0.0, 1.0),
                    _unif_quantile("unif-quantile-75", 0.75, 2.0, 8.0),
                    _unif_mean("unif-mean-01", 0.0, 1.0),
                    _unif_mean("unif-mean-28", 2.0, 8.0),
                    _unif_variance("unif-variance-01", 0.0, 1.0),
                    _unif_entropy("unif-entropy-01", 0.0, 1.0),
                    _unif_entropy("unif-entropy-28", 2.0, 8.0),
                    # Beta
                    _beta_pdf("beta-pdf-sym", 0.5, 2.0, 2.0),
                    _beta_pdf("beta-pdf-asym", 0.3, 2.0, 5.0),
                    _beta_pdf("beta-pdf-ushaped", 0.5, 0.5, 0.5),
                    _beta_logpdf("beta-logpdf-mid", 0.5, 2.0, 5.0),
                    _beta_cdf("beta-cdf-sym", 0.5, 2.0, 2.0),
                    _beta_cdf("beta-cdf-asym", 0.3, 2.0, 5.0),
                    _beta_quantile("beta-quantile-50", 0.5, 2.0, 5.0),
                    _beta_quantile("beta-quantile-90", 0.9, 2.0, 5.0),
                    _beta_mean("beta-mean-25", 2.0, 5.0),
                    _beta_variance("beta-variance-25", 2.0, 5.0),
                    _beta_entropy("beta-entropy-25", 2.0, 5.0),
                    # Gamma
                    _gamma_pdf("gamma-pdf-1", 1.0, 2.0, 1.0),
                    _gamma_pdf("gamma-pdf-2", 2.0, 2.0, 1.0),
                    _gamma_pdf("gamma-pdf-small", 0.5, 0.5, 2.0),
                    _gamma_logpdf("gamma-logpdf-1", 1.0, 2.0, 1.0),
                    _gamma_cdf("gamma-cdf-1", 1.0, 2.0, 1.0),
                    _gamma_cdf("gamma-cdf-5", 5.0, 2.0, 1.0),
                    _gamma_quantile("gamma-quantile-50", 0.5, 2.0, 1.0),
                    _gamma_quantile("gamma-quantile-90", 0.9, 2.0, 1.0),
                    _gamma_mean("gamma-mean-21", 2.0, 1.0),
                    _gamma_variance("gamma-variance-21", 2.0, 1.0),
                    _gamma_entropy("gamma-entropy-21", 2.0, 1.0),
                    # StudentT
                    _studentt_pdf("studentt-pdf-0", 0.0, 3.0),
                    _studentt_pdf("studentt-pdf-1", 1.0, 3.0),
                    _studentt_pdf("studentt-pdf-neg1", -1.0, 3.0),
                    _studentt_pdf("studentt-pdf-df30", 0.0, 30.0),
                    _studentt_logpdf("studentt-logpdf-0", 0.0, 3.0),
                    _studentt_logpdf("studentt-logpdf-2", 2.0, 3.0),
                    _studentt_cdf("studentt-cdf-0", 0.0, 3.0),
                    _studentt_cdf("studentt-cdf-1", 1.0, 3.0),
                    _studentt_cdf("studentt-cdf-neg2", -2.0, 3.0),
                    _studentt_cdf("studentt-cdf-df30", 1.96, 30.0),
                    _studentt_quantile("studentt-quantile-50", 0.5, 3.0),
                    _studentt_quantile("studentt-quantile-975", 0.975, 3.0),
                    _studentt_quantile("studentt-quantile-025", 0.025, 3.0),
                    _studentt_mean("studentt-mean-df3", 3.0),
                    _studentt_variance("studentt-variance-df3", 3.0),
                    _studentt_variance("studentt-variance-df30", 30.0),
                    # NoncentralT
                    _noncentralt_cdf("noncentralt-cdf-origin", 0.0, 10.0, 1.5),
                    _noncentralt_cdf("noncentralt-cdf-positive", 1.2, 5.0, 0.75),
                    _noncentralt_cdf("noncentralt-cdf-negative", -0.5, 8.0, 1.25),
                    _noncentralt_quantile("noncentralt-quantile-upper", 0.8, 10.0, 1.5),
                    _noncentralt_quantile("noncentralt-quantile-lower", 0.2, 8.0, -1.0),
                    # Categorical
                    _cat_pmf("cat-pmf-k0", 0, [0.1, 0.2, 0.3, 0.4]),
                    _cat_pmf("cat-pmf-k3", 3, [0.1, 0.2, 0.3, 0.4]),
                    _cat_pmf("cat-pmf-fair", 0, [0.5, 0.5]),
                    _cat_logpmf("cat-logpmf-k0", 0, [0.1, 0.2, 0.3, 0.4]),
                    _cat_logpmf("cat-logpmf-k3", 3, [0.1, 0.2, 0.3, 0.4]),
                    _cat_cdf("cat-cdf-k0", 0, [0.1, 0.2, 0.3, 0.4]),
                    _cat_cdf("cat-cdf-k2", 2, [0.1, 0.2, 0.3, 0.4]),
                    _cat_cdf("cat-cdf-k3", 3, [0.1, 0.2, 0.3, 0.4]),
                    _cat_mean("cat-mean-4class", [0.1, 0.2, 0.3, 0.4]),
                    _cat_variance("cat-variance-4class", [0.1, 0.2, 0.3, 0.4]),
                    _cat_entropy("cat-entropy-4class", [0.1, 0.2, 0.3, 0.4]),
                    _cat_entropy("cat-entropy-fair", [0.5, 0.5]),
                    # Binomial
                    _binom_pmf("binom-pmf-k5", 5, 10, 0.5),
                    _binom_pmf("binom-pmf-k0", 0, 10, 0.5),
                    _binom_pmf("binom-pmf-k10", 10, 10, 0.5),
                    _binom_pmf("binom-pmf-k3-p03", 3, 20, 0.3),
                    _binom_logpmf("binom-logpmf-k5", 5, 10, 0.5),
                    _binom_logpmf("binom-logpmf-k0", 0, 10, 0.5),
                    _binom_cdf("binom-cdf-k5", 5, 10, 0.5),
                    _binom_cdf("binom-cdf-k0", 0, 10, 0.5),
                    _binom_cdf("binom-cdf-k10", 10, 10, 0.5),
                    _binom_mean("binom-mean-10-05", 10, 0.5),
                    _binom_mean("binom-mean-20-03", 20, 0.3),
                    _binom_variance("binom-variance-10-05", 10, 0.5),
                    # Poisson
                    _poisson_pmf("poisson-pmf-k0", 0, 3.0),
                    _poisson_pmf("poisson-pmf-k3", 3, 3.0),
                    _poisson_pmf("poisson-pmf-k5", 5, 3.0),
                    _poisson_pmf("poisson-pmf-k1-mu05", 1, 0.5),
                    _poisson_logpmf("poisson-logpmf-k0", 0, 3.0),
                    _poisson_logpmf("poisson-logpmf-k3", 3, 3.0),
                    _poisson_cdf("poisson-cdf-k0", 0, 3.0),
                    _poisson_cdf("poisson-cdf-k3", 3, 3.0),
                    _poisson_cdf("poisson-cdf-k10", 10, 3.0),
                    _poisson_mean("poisson-mean-3", 3.0),
                    _poisson_mean("poisson-mean-05", 0.5),
                    _poisson_variance("poisson-variance-3", 3.0),
                ]
            },
        }
    ]


# --- Normal ---
def _normal_pdf(cid: str, x: float, mu: float, sigma: float) -> dict[str, Any]:
    return {"id": cid, "operation": "normalPdf", "input": {"x": x, "mu": mu, "sigma": sigma}, "expected": float(stats.norm.pdf(x, loc=mu, scale=sigma))}

def _normal_logpdf(cid: str, x: float, mu: float, sigma: float) -> dict[str, Any]:
    return {"id": cid, "operation": "normalLogpdf", "input": {"x": x, "mu": mu, "sigma": sigma}, "expected": float(stats.norm.logpdf(x, loc=mu, scale=sigma))}

def _normal_cdf(cid: str, x: float, mu: float, sigma: float) -> dict[str, Any]:
    return {"id": cid, "operation": "normalCdf", "input": {"x": x, "mu": mu, "sigma": sigma}, "expected": float(stats.norm.cdf(x, loc=mu, scale=sigma))}

def _normal_quantile(cid: str, p: float, mu: float, sigma: float) -> dict[str, Any]:
    return {"id": cid, "operation": "normalQuantile", "input": {"p": p, "mu": mu, "sigma": sigma}, "expected": float(stats.norm.ppf(p, loc=mu, scale=sigma))}

def _normal_mean(cid: str, mu: float, sigma: float) -> dict[str, Any]:
    return {"id": cid, "operation": "normalMean", "input": {"mu": mu, "sigma": sigma}, "expected": float(stats.norm.mean(loc=mu, scale=sigma))}

def _normal_variance(cid: str, mu: float, sigma: float) -> dict[str, Any]:
    return {"id": cid, "operation": "normalVariance", "input": {"mu": mu, "sigma": sigma}, "expected": float(stats.norm.var(loc=mu, scale=sigma))}

def _normal_entropy(cid: str, mu: float, sigma: float) -> dict[str, Any]:
    return {"id": cid, "operation": "normalEntropy", "input": {"mu": mu, "sigma": sigma}, "expected": float(stats.norm.entropy(loc=mu, scale=sigma))}


# --- LogNormal ---
def _lognormal_pdf(cid: str, x: float, mu: float, sigma: float) -> dict[str, Any]:
    return {"id": cid, "operation": "logNormalPdf", "input": {"x": x, "mu": mu, "sigma": sigma}, "expected": float(stats.lognorm.pdf(x, s=sigma, scale=np.exp(mu)))}

def _lognormal_logpdf(cid: str, x: float, mu: float, sigma: float) -> dict[str, Any]:
    return {"id": cid, "operation": "logNormalLogpdf", "input": {"x": x, "mu": mu, "sigma": sigma}, "expected": float(stats.lognorm.logpdf(x, s=sigma, scale=np.exp(mu)))}

def _lognormal_cdf(cid: str, x: float, mu: float, sigma: float) -> dict[str, Any]:
    return {"id": cid, "operation": "logNormalCdf", "input": {"x": x, "mu": mu, "sigma": sigma}, "expected": float(stats.lognorm.cdf(x, s=sigma, scale=np.exp(mu)))}

def _lognormal_quantile(cid: str, p: float, mu: float, sigma: float) -> dict[str, Any]:
    return {"id": cid, "operation": "logNormalQuantile", "input": {"p": p, "mu": mu, "sigma": sigma}, "expected": float(stats.lognorm.ppf(p, s=sigma, scale=np.exp(mu)))}

def _lognormal_mean(cid: str, mu: float, sigma: float) -> dict[str, Any]:
    return {"id": cid, "operation": "logNormalMean", "input": {"mu": mu, "sigma": sigma}, "expected": float(stats.lognorm.mean(s=sigma, scale=np.exp(mu)))}

def _lognormal_variance(cid: str, mu: float, sigma: float) -> dict[str, Any]:
    return {"id": cid, "operation": "logNormalVariance", "input": {"mu": mu, "sigma": sigma}, "expected": float(stats.lognorm.var(s=sigma, scale=np.exp(mu)))}

def _lognormal_entropy(cid: str, mu: float, sigma: float) -> dict[str, Any]:
    return {"id": cid, "operation": "logNormalEntropy", "input": {"mu": mu, "sigma": sigma}, "expected": float(stats.lognorm.entropy(s=sigma, scale=np.exp(mu)))}


# --- Exponential ---
def _exp_pdf(cid: str, x: float, rate: float) -> dict[str, Any]:
    return {"id": cid, "operation": "exponentialPdf", "input": {"x": x, "rate": rate}, "expected": float(stats.expon.pdf(x, scale=1.0 / rate))}

def _exp_logpdf(cid: str, x: float, rate: float) -> dict[str, Any]:
    return {"id": cid, "operation": "exponentialLogpdf", "input": {"x": x, "rate": rate}, "expected": float(stats.expon.logpdf(x, scale=1.0 / rate))}

def _exp_cdf(cid: str, x: float, rate: float) -> dict[str, Any]:
    return {"id": cid, "operation": "exponentialCdf", "input": {"x": x, "rate": rate}, "expected": float(stats.expon.cdf(x, scale=1.0 / rate))}

def _exp_quantile(cid: str, p: float, rate: float) -> dict[str, Any]:
    return {"id": cid, "operation": "exponentialQuantile", "input": {"p": p, "rate": rate}, "expected": float(stats.expon.ppf(p, scale=1.0 / rate))}

def _exp_mean(cid: str, rate: float) -> dict[str, Any]:
    return {"id": cid, "operation": "exponentialMean", "input": {"rate": rate}, "expected": float(stats.expon.mean(scale=1.0 / rate))}

def _exp_variance(cid: str, rate: float) -> dict[str, Any]:
    return {"id": cid, "operation": "exponentialVariance", "input": {"rate": rate}, "expected": float(stats.expon.var(scale=1.0 / rate))}

def _exp_entropy(cid: str, rate: float) -> dict[str, Any]:
    return {"id": cid, "operation": "exponentialEntropy", "input": {"rate": rate}, "expected": float(stats.expon.entropy(scale=1.0 / rate))}


# --- Uniform ---
def _unif_pdf(cid: str, x: float, low: float, high: float) -> dict[str, Any]:
    return {"id": cid, "operation": "uniformPdf", "input": {"x": x, "low": low, "high": high}, "expected": float(stats.uniform.pdf(x, loc=low, scale=high - low))}

def _unif_logpdf(cid: str, x: float, low: float, high: float) -> dict[str, Any]:
    return {"id": cid, "operation": "uniformLogpdf", "input": {"x": x, "low": low, "high": high}, "expected": float(stats.uniform.logpdf(x, loc=low, scale=high - low))}

def _unif_cdf(cid: str, x: float, low: float, high: float) -> dict[str, Any]:
    return {"id": cid, "operation": "uniformCdf", "input": {"x": x, "low": low, "high": high}, "expected": float(stats.uniform.cdf(x, loc=low, scale=high - low))}

def _unif_quantile(cid: str, p: float, low: float, high: float) -> dict[str, Any]:
    return {"id": cid, "operation": "uniformQuantile", "input": {"p": p, "low": low, "high": high}, "expected": float(stats.uniform.ppf(p, loc=low, scale=high - low))}

def _unif_mean(cid: str, low: float, high: float) -> dict[str, Any]:
    return {"id": cid, "operation": "uniformMean", "input": {"low": low, "high": high}, "expected": float(stats.uniform.mean(loc=low, scale=high - low))}

def _unif_variance(cid: str, low: float, high: float) -> dict[str, Any]:
    return {"id": cid, "operation": "uniformVariance", "input": {"low": low, "high": high}, "expected": float(stats.uniform.var(loc=low, scale=high - low))}

def _unif_entropy(cid: str, low: float, high: float) -> dict[str, Any]:
    return {"id": cid, "operation": "uniformEntropy", "input": {"low": low, "high": high}, "expected": float(stats.uniform.entropy(loc=low, scale=high - low))}


# --- Beta ---
def _beta_pdf(cid: str, x: float, a: float, b: float) -> dict[str, Any]:
    return {"id": cid, "operation": "betaPdf", "input": {"x": x, "alpha": a, "beta": b}, "expected": float(stats.beta.pdf(x, a, b))}

def _beta_logpdf(cid: str, x: float, a: float, b: float) -> dict[str, Any]:
    return {"id": cid, "operation": "betaLogpdf", "input": {"x": x, "alpha": a, "beta": b}, "expected": float(stats.beta.logpdf(x, a, b))}

def _beta_cdf(cid: str, x: float, a: float, b: float) -> dict[str, Any]:
    return {"id": cid, "operation": "betaCdf", "input": {"x": x, "alpha": a, "beta": b}, "expected": float(stats.beta.cdf(x, a, b))}

def _beta_quantile(cid: str, p: float, a: float, b: float) -> dict[str, Any]:
    return {"id": cid, "operation": "betaQuantile", "input": {"p": p, "alpha": a, "beta": b}, "expected": float(stats.beta.ppf(p, a, b))}

def _beta_mean(cid: str, a: float, b: float) -> dict[str, Any]:
    return {"id": cid, "operation": "betaMean", "input": {"alpha": a, "beta": b}, "expected": float(stats.beta.mean(a, b))}

def _beta_variance(cid: str, a: float, b: float) -> dict[str, Any]:
    return {"id": cid, "operation": "betaVariance", "input": {"alpha": a, "beta": b}, "expected": float(stats.beta.var(a, b))}

def _beta_entropy(cid: str, a: float, b: float) -> dict[str, Any]:
    return {"id": cid, "operation": "betaEntropy", "input": {"alpha": a, "beta": b}, "expected": float(stats.beta.entropy(a, b))}


# --- Gamma ---
def _gamma_pdf(cid: str, x: float, shape: float, scale: float) -> dict[str, Any]:
    return {"id": cid, "operation": "gammaPdf", "input": {"x": x, "shape": shape, "scale": scale}, "expected": float(stats.gamma.pdf(x, shape, scale=scale))}

def _gamma_logpdf(cid: str, x: float, shape: float, scale: float) -> dict[str, Any]:
    return {"id": cid, "operation": "gammaLogpdf", "input": {"x": x, "shape": shape, "scale": scale}, "expected": float(stats.gamma.logpdf(x, shape, scale=scale))}

def _gamma_cdf(cid: str, x: float, shape: float, scale: float) -> dict[str, Any]:
    return {"id": cid, "operation": "gammaCdf", "input": {"x": x, "shape": shape, "scale": scale}, "expected": float(stats.gamma.cdf(x, shape, scale=scale))}

def _gamma_quantile(cid: str, p: float, shape: float, scale: float) -> dict[str, Any]:
    return {"id": cid, "operation": "gammaQuantile", "input": {"p": p, "shape": shape, "scale": scale}, "expected": float(stats.gamma.ppf(p, shape, scale=scale))}

def _gamma_mean(cid: str, shape: float, scale: float) -> dict[str, Any]:
    return {"id": cid, "operation": "gammaMean", "input": {"shape": shape, "scale": scale}, "expected": float(stats.gamma.mean(shape, scale=scale))}

def _gamma_variance(cid: str, shape: float, scale: float) -> dict[str, Any]:
    return {"id": cid, "operation": "gammaVariance", "input": {"shape": shape, "scale": scale}, "expected": float(stats.gamma.var(shape, scale=scale))}

def _gamma_entropy(cid: str, shape: float, scale: float) -> dict[str, Any]:
    return {"id": cid, "operation": "gammaEntropy", "input": {"shape": shape, "scale": scale}, "expected": float(stats.gamma.entropy(shape, scale=scale))}


# --- StudentT ---
def _studentt_pdf(cid: str, x: float, df: float) -> dict[str, Any]:
    return {"id": cid, "operation": "studentTPdf", "input": {"x": x, "df": df}, "expected": float(stats.t.pdf(x, df))}

def _studentt_logpdf(cid: str, x: float, df: float) -> dict[str, Any]:
    return {"id": cid, "operation": "studentTLogpdf", "input": {"x": x, "df": df}, "expected": float(stats.t.logpdf(x, df))}

def _studentt_cdf(cid: str, x: float, df: float) -> dict[str, Any]:
    return {"id": cid, "operation": "studentTCdf", "input": {"x": x, "df": df}, "expected": float(stats.t.cdf(x, df))}

def _studentt_quantile(cid: str, p: float, df: float) -> dict[str, Any]:
    return {"id": cid, "operation": "studentTQuantile", "input": {"p": p, "df": df}, "expected": float(stats.t.ppf(p, df))}

def _studentt_mean(cid: str, df: float) -> dict[str, Any]:
    return {"id": cid, "operation": "studentTMean", "input": {"df": df}, "expected": float(stats.t.mean(df))}

def _studentt_variance(cid: str, df: float) -> dict[str, Any]:
    return {"id": cid, "operation": "studentTVariance", "input": {"df": df}, "expected": float(stats.t.var(df))}


# --- NoncentralT ---
def _noncentralt_cdf(cid: str, x: float, df: float, noncentrality: float) -> dict[str, Any]:
    return {"id": cid, "operation": "noncentralTCdf", "input": {"x": x, "df": df, "noncentrality": noncentrality}, "expected": float(stats.nct.cdf(x, df, noncentrality))}

def _noncentralt_quantile(cid: str, p: float, df: float, noncentrality: float) -> dict[str, Any]:
    return {"id": cid, "operation": "noncentralTQuantile", "input": {"p": p, "df": df, "noncentrality": noncentrality}, "expected": float(stats.nct.ppf(p, df, noncentrality))}


# --- Categorical ---
def _cat_pmf(cid: str, k: int, probs: list[float]) -> dict[str, Any]:
    return {"id": cid, "operation": "categoricalPmf", "input": {"k": k, "probs": probs}, "expected": probs[k]}

def _cat_logpmf(cid: str, k: int, probs: list[float]) -> dict[str, Any]:
    return {"id": cid, "operation": "categoricalLogpmf", "input": {"k": k, "probs": probs}, "expected": float(np.log(probs[k]))}

def _cat_cdf(cid: str, k: int, probs: list[float]) -> dict[str, Any]:
    return {"id": cid, "operation": "categoricalCdf", "input": {"k": k, "probs": probs}, "expected": float(sum(probs[: k + 1]))}

def _cat_mean(cid: str, probs: list[float]) -> dict[str, Any]:
    mu = sum(i * p for i, p in enumerate(probs))
    return {"id": cid, "operation": "categoricalMean", "input": {"probs": probs}, "expected": float(mu)}

def _cat_variance(cid: str, probs: list[float]) -> dict[str, Any]:
    mu = sum(i * p for i, p in enumerate(probs))
    e2 = sum(i * i * p for i, p in enumerate(probs))
    return {"id": cid, "operation": "categoricalVariance", "input": {"probs": probs}, "expected": float(e2 - mu * mu)}

def _cat_entropy(cid: str, probs: list[float]) -> dict[str, Any]:
    return {"id": cid, "operation": "categoricalEntropy", "input": {"probs": probs}, "expected": float(stats.entropy(probs))}


# --- Binomial ---
def _binom_pmf(cid: str, k: int, n: int, p: float) -> dict[str, Any]:
    return {"id": cid, "operation": "binomialPmf", "input": {"k": k, "n": n, "p": p}, "expected": float(stats.binom.pmf(k, n, p))}

def _binom_logpmf(cid: str, k: int, n: int, p: float) -> dict[str, Any]:
    return {"id": cid, "operation": "binomialLogpmf", "input": {"k": k, "n": n, "p": p}, "expected": float(stats.binom.logpmf(k, n, p))}

def _binom_cdf(cid: str, k: int, n: int, p: float) -> dict[str, Any]:
    return {"id": cid, "operation": "binomialCdf", "input": {"k": k, "n": n, "p": p}, "expected": float(stats.binom.cdf(k, n, p))}

def _binom_mean(cid: str, n: int, p: float) -> dict[str, Any]:
    return {"id": cid, "operation": "binomialMean", "input": {"n": n, "p": p}, "expected": float(stats.binom.mean(n, p))}

def _binom_variance(cid: str, n: int, p: float) -> dict[str, Any]:
    return {"id": cid, "operation": "binomialVariance", "input": {"n": n, "p": p}, "expected": float(stats.binom.var(n, p))}


# --- Poisson ---
def _poisson_pmf(cid: str, k: int, mu: float) -> dict[str, Any]:
    return {"id": cid, "operation": "poissonPmf", "input": {"k": k, "mu": mu}, "expected": float(stats.poisson.pmf(k, mu))}

def _poisson_logpmf(cid: str, k: int, mu: float) -> dict[str, Any]:
    return {"id": cid, "operation": "poissonLogpmf", "input": {"k": k, "mu": mu}, "expected": float(stats.poisson.logpmf(k, mu))}

def _poisson_cdf(cid: str, k: int, mu: float) -> dict[str, Any]:
    return {"id": cid, "operation": "poissonCdf", "input": {"k": k, "mu": mu}, "expected": float(stats.poisson.cdf(k, mu))}

def _poisson_mean(cid: str, mu: float) -> dict[str, Any]:
    return {"id": cid, "operation": "poissonMean", "input": {"mu": mu}, "expected": float(stats.poisson.mean(mu))}

def _poisson_variance(cid: str, mu: float) -> dict[str, Any]:
    return {"id": cid, "operation": "poissonVariance", "input": {"mu": mu}, "expected": float(stats.poisson.var(mu))}
