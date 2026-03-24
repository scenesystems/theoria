"""Special-functions domain fixture generation from SciPy reference implementations."""

from __future__ import annotations

from typing import Any

from scipy import special as sp_special

from ._common import metadata


def generate(generated_at: str) -> list[dict[str, Any]]:
    return [
        {
            "fixture": "special.function-parity",
            "file": "special/function-parity.json",
            "metadata": metadata(generated_at),
            "payload": {
                "cases": [
                    # --- gamma ---
                    _gamma_case("gamma-1", 1.0),
                    _gamma_case("gamma-2", 2.0),
                    _gamma_case("gamma-5", 5.0),
                    _gamma_case("gamma-half", 0.5),
                    _gamma_case("gamma-1.5", 1.5),
                    _gamma_case("gamma-small", 0.01),
                    _gamma_case("gamma-large", 20.0),
                    _gamma_case("gamma-near-zero", 0.001),
                    # --- lnGamma ---
                    _lngamma_case("lngamma-1", 1.0),
                    _lngamma_case("lngamma-2", 2.0),
                    _lngamma_case("lngamma-half", 0.5),
                    _lngamma_case("lngamma-10", 10.0),
                    _lngamma_case("lngamma-100", 100.0),
                    _lngamma_case("lngamma-small", 0.001),
                    _lngamma_case("lngamma-large", 1000.0),
                    # --- beta ---
                    _beta_case("beta-1-1", 1.0, 1.0),
                    _beta_case("beta-2-3", 2.0, 3.0),
                    _beta_case("beta-half-half", 0.5, 0.5),
                    _beta_case("beta-symmetric-3", 3.0, 3.0),
                    _beta_case("beta-asymmetric", 0.5, 5.0),
                    _beta_case("beta-large", 10.0, 10.0),
                    # --- erf ---
                    _erf_case("erf-zero", 0.0),
                    _erf_case("erf-small", 0.01),
                    _erf_case("erf-medium", 0.5),
                    _erf_case("erf-one", 1.0),
                    _erf_case("erf-two", 2.0),
                    _erf_case("erf-large", 4.0),
                    _erf_case("erf-negative-small", -0.01),
                    _erf_case("erf-negative-one", -1.0),
                    _erf_case("erf-negative-large", -3.0),
                    # --- erfc ---
                    _erfc_case("erfc-zero", 0.0),
                    _erfc_case("erfc-small", 0.01),
                    _erfc_case("erfc-one", 1.0),
                    _erfc_case("erfc-two", 2.0),
                    _erfc_case("erfc-large", 5.0),
                    _erfc_case("erfc-negative-one", -1.0),
                    # --- digamma ---
                    _digamma_case("digamma-1", 1.0),
                    _digamma_case("digamma-2", 2.0),
                    _digamma_case("digamma-half", 0.5),
                    _digamma_case("digamma-5", 5.0),
                    _digamma_case("digamma-10", 10.0),
                    _digamma_case("digamma-small", 0.01),
                    _digamma_case("digamma-large", 100.0),
                ]
            },
        }
    ]


def _gamma_case(case_id: str, x: float) -> dict[str, Any]:
    return {
        "id": case_id,
        "operation": "gamma",
        "input": {"x": x},
        "expected": float(sp_special.gamma(x)),
    }


def _lngamma_case(case_id: str, x: float) -> dict[str, Any]:
    return {
        "id": case_id,
        "operation": "lnGamma",
        "input": {"x": x},
        "expected": float(sp_special.gammaln(x)),
    }


def _beta_case(case_id: str, a: float, b: float) -> dict[str, Any]:
    return {
        "id": case_id,
        "operation": "beta",
        "input": {"a": a, "b": b},
        "expected": float(sp_special.beta(a, b)),
    }


def _erf_case(case_id: str, x: float) -> dict[str, Any]:
    return {
        "id": case_id,
        "operation": "erf",
        "input": {"x": x},
        "expected": float(sp_special.erf(x)),
    }


def _erfc_case(case_id: str, x: float) -> dict[str, Any]:
    return {
        "id": case_id,
        "operation": "erfc",
        "input": {"x": x},
        "expected": float(sp_special.erfc(x)),
    }


def _digamma_case(case_id: str, x: float) -> dict[str, Any]:
    return {
        "id": case_id,
        "operation": "digamma",
        "input": {"x": x},
        "expected": float(sp_special.digamma(x)),
    }
