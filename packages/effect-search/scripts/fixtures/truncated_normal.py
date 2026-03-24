"""M4: truncated-normal edge-case fixtures derived from Optuna internals."""

from __future__ import annotations

import math
from typing import Any

import numpy as np
from optuna.samplers._tpe import _truncnorm

from ._common import metadata


def _standardized_bounds(params: dict[str, float]) -> tuple[float, float]:
    mean = float(params["mean"])
    sigma = float(params["sigma"])
    low = float(params["low"])
    high = float(params["high"])
    return ((low - mean) / sigma, (high - mean) / sigma)


def _log_gauss_mass(left: float, right: float) -> float:
    return float(
        _truncnorm._log_gauss_mass(  # pyright: ignore[reportPrivateUsage]
            np.asarray([left], dtype=np.float64),
            np.asarray([right], dtype=np.float64),
        )[0]
    )


def _cdf_for_probe(probe: float, params: dict[str, float], a: float, b: float) -> float:
    mean = float(params["mean"])
    sigma = float(params["sigma"])
    low = float(params["low"])
    high = float(params["high"])

    if probe <= low:
        return 0.0
    if probe >= high:
        return 1.0

    standardized = (probe - mean) / sigma
    numerator = _log_gauss_mass(a, standardized)
    denominator = _log_gauss_mass(a, b)
    return float(min(max(math.exp(numerator - denominator), 0.0), 1.0))


def _sample_expected(
    quantiles: list[float],
    a: float,
    b: float,
    params: dict[str, float],
) -> list[float]:
    mean = float(params["mean"])
    sigma = float(params["sigma"])
    low = float(params["low"])
    high = float(params["high"])

    standardized = _truncnorm.ppf(
        np.asarray(quantiles, dtype=np.float64),
        np.asarray([a], dtype=np.float64),
        np.asarray([b], dtype=np.float64),
    )
    samples = standardized * sigma + mean
    return np.clip(samples, low, high).astype(np.float64).tolist()


def _log_pdf_expected(probes: list[float], a: float, b: float, params: dict[str, float]) -> list[float]:
    return _truncnorm.logpdf(
        np.asarray(probes, dtype=np.float64),
        a,
        b,
        loc=float(params["mean"]),
        scale=float(params["sigma"]),
    ).astype(np.float64).tolist()


def _materialize_case(case: dict[str, Any]) -> dict[str, Any]:
    params = case["params"]
    a, b = _standardized_bounds(params)

    cdf_expected = [
        _cdf_for_probe(float(probe), params, a, b)
        for probe in case["cdfProbes"]
    ]

    return {
        "id": case["id"],
        "params": params,
        "sampleQuantiles": case["sampleQuantiles"],
        "sampleExpected": _sample_expected(case["sampleQuantiles"], a, b, params),
        "cdfProbes": case["cdfProbes"],
        "cdfExpected": cdf_expected,
        "logPdfProbes": case["logPdfProbes"],
        "logPdfExpected": _log_pdf_expected(case["logPdfProbes"], a, b, params),
    }


def generate(generated_at: str) -> list[dict[str, Any]]:
    return [
        {
            "fixture": "truncated-normal.edge-cases",
            "file": "truncated-normal/edge-cases.json",
            "metadata": metadata(generated_at),
            "payload": {
                "cases": [
                    _materialize_case(
                        {
                            "id": "centered",
                            "params": {
                                "mean": 0.5,
                                "sigma": 0.25,
                                "low": 0.0,
                                "high": 1.0,
                            },
                            "sampleQuantiles": [0.0, 0.1, 0.5, 0.9, 1.0],
                            "cdfProbes": [0.0, 0.25, 0.5, 0.75, 1.0],
                            "logPdfProbes": [0.25, 0.5, 0.75],
                        }
                    ),
                    _materialize_case(
                        {
                            "id": "narrow-interval",
                            "params": {
                                "mean": 0.0,
                                "sigma": 1.0,
                                "low": -0.001,
                                "high": 0.001,
                            },
                            "sampleQuantiles": [0.0, 0.1, 0.5, 0.9, 1.0],
                            "cdfProbes": [-0.001, -0.0005, 0.0, 0.0005, 0.001],
                            "logPdfProbes": [-0.0005, 0.0, 0.0005],
                        }
                    ),
                    _materialize_case(
                        {
                            "id": "left-tail",
                            "params": {
                                "mean": 0.0,
                                "sigma": 1.0,
                                "low": -8.0,
                                "high": -5.0,
                            },
                            "sampleQuantiles": [0.0, 0.1, 0.5, 0.9, 1.0],
                            "cdfProbes": [-8.0, -7.0, -6.0, -5.5, -5.0],
                            "logPdfProbes": [-7.0, -6.0, -5.5],
                        }
                    ),
                    _materialize_case(
                        {
                            "id": "right-tail",
                            "params": {
                                "mean": 0.0,
                                "sigma": 1.0,
                                "low": 5.0,
                                "high": 8.0,
                            },
                            "sampleQuantiles": [0.0, 0.1, 0.5, 0.9, 1.0],
                            "cdfProbes": [5.0, 5.5, 6.0, 7.0, 8.0],
                            "logPdfProbes": [5.5, 6.0, 7.0],
                        }
                    ),
                    _materialize_case(
                        {
                            "id": "ultra-left-tail",
                            "params": {
                                "mean": 0.0,
                                "sigma": 1.0,
                                "low": -12.0,
                                "high": -9.0,
                            },
                            "sampleQuantiles": [0.0, 1e-6, 0.2, 0.8, 1.0],
                            "cdfProbes": [-12.0, -11.0, -10.0, -9.5, -9.0],
                            "logPdfProbes": [-11.5, -10.5, -9.5],
                        }
                    ),
                    _materialize_case(
                        {
                            "id": "ultra-right-tail",
                            "params": {
                                "mean": 0.0,
                                "sigma": 1.0,
                                "low": 9.0,
                                "high": 12.0,
                            },
                            "sampleQuantiles": [0.0, 1e-6, 0.2, 0.8, 1.0],
                            "cdfProbes": [9.0, 9.5, 10.0, 11.0, 12.0],
                            "logPdfProbes": [9.5, 10.5, 11.5],
                        }
                    ),
                    _materialize_case(
                        {
                            "id": "skewed-support",
                            "params": {
                                "mean": 2.0,
                                "sigma": 0.3,
                                "low": 1.9,
                                "high": 3.4,
                            },
                            "sampleQuantiles": [0.0, 0.1, 0.5, 0.9, 1.0],
                            "cdfProbes": [1.9, 2.0, 2.2, 2.8, 3.4],
                            "logPdfProbes": [1.95, 2.1, 2.6, 3.2],
                        }
                    ),
                    _materialize_case(
                        {
                            "id": "tiny-sigma",
                            "params": {
                                "mean": 1.0,
                                "sigma": 1e-3,
                                "low": 0.9985,
                                "high": 1.002,
                            },
                            "sampleQuantiles": [0.0, 0.25, 0.5, 0.75, 1.0],
                            "cdfProbes": [0.9985, 0.9995, 1.0, 1.001, 1.002],
                            "logPdfProbes": [0.999, 1.0, 1.001],
                        }
                    ),
                    _materialize_case(
                        {
                            "id": "mean-outside-support",
                            "params": {
                                "mean": -2.0,
                                "sigma": 0.4,
                                "low": 0.1,
                                "high": 0.6,
                            },
                            "sampleQuantiles": [0.0, 0.05, 0.5, 0.95, 1.0],
                            "cdfProbes": [0.1, 0.2, 0.35, 0.5, 0.6],
                            "logPdfProbes": [0.15, 0.3, 0.45, 0.55],
                        }
                    ),
                    _materialize_case(
                        {
                            "id": "mean-far-right-support-left",
                            "params": {
                                "mean": 4.0,
                                "sigma": 0.8,
                                "low": -1.0,
                                "high": -0.3,
                            },
                            "sampleQuantiles": [0.0, 0.1, 0.5, 0.9, 1.0],
                            "cdfProbes": [-1.0, -0.85, -0.65, -0.45, -0.3],
                            "logPdfProbes": [-0.95, -0.75, -0.55, -0.35],
                        }
                    ),
                    _materialize_case(
                        {
                            "id": "mean-far-left-support-right",
                            "params": {
                                "mean": -4.0,
                                "sigma": 0.8,
                                "low": 0.3,
                                "high": 1.0,
                            },
                            "sampleQuantiles": [0.0, 0.1, 0.5, 0.9, 1.0],
                            "cdfProbes": [0.3, 0.45, 0.65, 0.85, 1.0],
                            "logPdfProbes": [0.35, 0.55, 0.75, 0.95],
                        }
                    ),
                    _materialize_case(
                        {
                            "id": "ultra-tight-support-far-right-mean",
                            "params": {
                                "mean": 25.0,
                                "sigma": 2.0,
                                "low": -0.02,
                                "high": 0.03,
                            },
                            "sampleQuantiles": [0.0, 0.1, 0.5, 0.9, 1.0],
                            "cdfProbes": [-0.02, -0.01, 0.0, 0.02, 0.03],
                            "logPdfProbes": [-0.015, 0.0, 0.015, 0.028],
                        }
                    ),
                    _materialize_case(
                        {
                            "id": "ultra-tight-support-far-left-mean",
                            "params": {
                                "mean": -25.0,
                                "sigma": 2.0,
                                "low": -0.03,
                                "high": 0.02,
                            },
                            "sampleQuantiles": [0.0, 0.1, 0.5, 0.9, 1.0],
                            "cdfProbes": [-0.03, -0.02, 0.0, 0.01, 0.02],
                            "logPdfProbes": [-0.028, -0.015, 0.0, 0.015],
                        }
                    ),
                    _materialize_case(
                        {
                            "id": "micro-support-far-right-mean",
                            "params": {
                                "mean": 40.0,
                                "sigma": 1.5,
                                "low": -0.005,
                                "high": 0.004,
                            },
                            "sampleQuantiles": [0.0, 1e-6, 0.5, 0.999999, 1.0],
                            "cdfProbes": [-0.005, -0.002, 0.0, 0.003, 0.004],
                            "logPdfProbes": [-0.0045, -0.001, 0.002, 0.0038],
                        }
                    ),
                    _materialize_case(
                        {
                            "id": "micro-support-far-left-mean",
                            "params": {
                                "mean": -40.0,
                                "sigma": 1.5,
                                "low": -0.004,
                                "high": 0.005,
                            },
                            "sampleQuantiles": [0.0, 1e-6, 0.5, 0.999999, 1.0],
                            "cdfProbes": [-0.004, -0.002, 0.0, 0.003, 0.005],
                            "logPdfProbes": [-0.0038, -0.002, 0.001, 0.0045],
                        }
                    ),
                    _materialize_case(
                        {
                            "id": "mean-near-low-bound-tiny-window",
                            "params": {
                                "mean": 2.00005,
                                "sigma": 2e-4,
                                "low": 2.0,
                                "high": 2.0005,
                            },
                            "sampleQuantiles": [0.0, 0.01, 0.5, 0.99, 1.0],
                            "cdfProbes": [2.0, 2.00005, 2.0002, 2.0004, 2.0005],
                            "logPdfProbes": [2.00001, 2.0001, 2.0003, 2.00045],
                        }
                    ),
                    _materialize_case(
                        {
                            "id": "mean-near-high-bound-tiny-window",
                            "params": {
                                "mean": -1.00005,
                                "sigma": 2e-4,
                                "low": -1.0005,
                                "high": -1.0,
                            },
                            "sampleQuantiles": [0.0, 0.01, 0.5, 0.99, 1.0],
                            "cdfProbes": [-1.0005, -1.0004, -1.0002, -1.00005, -1.0],
                            "logPdfProbes": [-1.00045, -1.0003, -1.0001, -1.00001],
                        }
                    ),
                    _materialize_case(
                        {
                            "id": "wide-support",
                            "params": {
                                "mean": 3.0,
                                "sigma": 2.5,
                                "low": -4.0,
                                "high": 9.0,
                            },
                            "sampleQuantiles": [0.0, 1e-6, 0.25, 0.75, 1.0],
                            "cdfProbes": [-4.0, -1.0, 3.0, 6.0, 9.0],
                            "logPdfProbes": [-2.5, 0.0, 3.0, 7.0],
                        }
                    ),
                    _materialize_case(
                        {
                            "id": "off-center-narrow",
                            "params": {
                                "mean": 1.2,
                                "sigma": 0.05,
                                "low": 1.05,
                                "high": 1.18,
                            },
                            "sampleQuantiles": [0.0, 0.1, 0.5, 0.9, 1.0],
                            "cdfProbes": [1.05, 1.08, 1.12, 1.16, 1.18],
                            "logPdfProbes": [1.06, 1.1, 1.15, 1.17],
                        }
                    ),
                ]
            },
        }
    ]
