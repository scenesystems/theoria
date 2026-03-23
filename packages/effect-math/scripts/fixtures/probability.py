"""Probability domain fixture generation from SciPy reference implementations."""

from __future__ import annotations

from typing import Any

import numpy as np
from scipy import stats

from ._common import metadata


def generate(generated_at: str) -> list[dict[str, Any]]:
    return [
        {
            "fixture": "probability.distribution-parity",
            "file": "probability/distribution-parity.json",
            "metadata": metadata(generated_at),
            "payload": {
                "cases": [
                    _normal_pdf_case("normal-pdf-at-zero", 0.0, 0.0, 1.0),
                    _normal_pdf_case("normal-pdf-at-one", 1.0, 0.0, 1.0),
                    _normal_pdf_case("normal-pdf-at-minus-one", -1.0, 0.0, 1.0),
                    _normal_pdf_case("normal-pdf-tail-3sigma", 3.0, 0.0, 1.0),
                    _normal_pdf_case("normal-pdf-tail-6sigma", 6.0, 0.0, 1.0),
                    _normal_pdf_case("normal-pdf-shifted", 5.0, 5.0, 2.0),
                    _normal_pdf_case("normal-pdf-narrow", 0.0, 0.0, 0.01),
                    _normal_pdf_case("normal-pdf-wide", 0.0, 0.0, 100.0),
                    _normal_cdf_case("normal-cdf-at-zero", 0.0, 0.0, 1.0),
                    _normal_cdf_case("normal-cdf-at-one", 1.0, 0.0, 1.0),
                    _normal_cdf_case("normal-cdf-at-minus-one", -1.0, 0.0, 1.0),
                    _normal_cdf_case("normal-cdf-tail-3sigma", 3.0, 0.0, 1.0),
                    _normal_cdf_case("normal-cdf-tail-neg3sigma", -3.0, 0.0, 1.0),
                    _normal_cdf_case("normal-cdf-tail-6sigma", 6.0, 0.0, 1.0),
                    _normal_cdf_case("normal-cdf-shifted", 7.0, 5.0, 2.0),
                    _uniform_pdf_case("uniform-pdf-inside", 0.5, 0.0, 1.0),
                    _uniform_pdf_case("uniform-pdf-at-low", 0.0, 0.0, 1.0),
                    _uniform_pdf_case("uniform-pdf-at-high", 1.0, 0.0, 1.0),
                    _uniform_pdf_case("uniform-pdf-below", -0.1, 0.0, 1.0),
                    _uniform_pdf_case("uniform-pdf-above", 1.1, 0.0, 1.0),
                    _uniform_pdf_case("uniform-pdf-wide", 50.0, 0.0, 100.0),
                    _uniform_cdf_case("uniform-cdf-inside", 0.5, 0.0, 1.0),
                    _uniform_cdf_case("uniform-cdf-at-low", 0.0, 0.0, 1.0),
                    _uniform_cdf_case("uniform-cdf-at-high", 1.0, 0.0, 1.0),
                    _uniform_cdf_case("uniform-cdf-below", -1.0, 0.0, 1.0),
                    _uniform_cdf_case("uniform-cdf-above", 2.0, 0.0, 1.0),
                    _entropy_case("entropy-uniform-2", [0.5, 0.5]),
                    _entropy_case("entropy-uniform-4", [0.25, 0.25, 0.25, 0.25]),
                    _entropy_case("entropy-degenerate", [1.0, 0.0]),
                    _entropy_case("entropy-skewed", [0.9, 0.05, 0.05]),
                ]
            },
        }
    ]


def _normal_pdf_case(
    case_id: str, x: float, mu: float, sigma: float
) -> dict[str, Any]:
    return {
        "id": case_id,
        "operation": "normalPdf",
        "input": {"x": x, "mu": mu, "sigma": sigma},
        "expected": float(stats.norm.pdf(x, loc=mu, scale=sigma)),
    }


def _normal_cdf_case(
    case_id: str, x: float, mu: float, sigma: float
) -> dict[str, Any]:
    return {
        "id": case_id,
        "operation": "normalCdf",
        "input": {"x": x, "mu": mu, "sigma": sigma},
        "expected": float(stats.norm.cdf(x, loc=mu, scale=sigma)),
    }


def _uniform_pdf_case(
    case_id: str, x: float, low: float, high: float
) -> dict[str, Any]:
    return {
        "id": case_id,
        "operation": "uniformPdf",
        "input": {"x": x, "low": low, "high": high},
        "expected": float(stats.uniform.pdf(x, loc=low, scale=high - low)),
    }


def _uniform_cdf_case(
    case_id: str, x: float, low: float, high: float
) -> dict[str, Any]:
    return {
        "id": case_id,
        "operation": "uniformCdf",
        "input": {"x": x, "low": low, "high": high},
        "expected": float(stats.uniform.cdf(x, loc=low, scale=high - low)),
    }


def _entropy_case(case_id: str, probs: list[float]) -> dict[str, Any]:
    p = np.array(probs, dtype=np.float64)
    h = float(stats.entropy(p))
    return {
        "id": case_id,
        "operation": "entropy",
        "input": {"probabilities": probs},
        "expected": h,
    }
