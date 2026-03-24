"""Inverse special-functions domain fixture generation from SciPy reference implementations."""

from __future__ import annotations

from typing import Any

from scipy import special as sp_special

from ._common import metadata


def generate(generated_at: str) -> list[dict[str, Any]]:
    return [
        {
            "fixture": "special.inverse-parity",
            "file": "special/inverse-parity.json",
            "metadata": metadata(generated_at),
            "payload": {
                "cases": [
                    # --- erfinv ---
                    _erfinv_case("erfinv-zero", 0.0),
                    _erfinv_case("erfinv-0.1", 0.1),
                    _erfinv_case("erfinv-0.5", 0.5),
                    _erfinv_case("erfinv-0.8", 0.8),
                    _erfinv_case("erfinv-0.95", 0.95),
                    _erfinv_case("erfinv-0.99", 0.99),
                    _erfinv_case("erfinv-neg-0.5", -0.5),
                    # --- erfcinv ---
                    _erfcinv_case("erfcinv-0.01", 0.01),
                    _erfcinv_case("erfcinv-0.1", 0.1),
                    _erfcinv_case("erfcinv-0.5", 0.5),
                    _erfcinv_case("erfcinv-1.0", 1.0),
                    _erfcinv_case("erfcinv-1.5", 1.5),
                    _erfcinv_case("erfcinv-1.99", 1.99),
                    # --- gammainc ---
                    _gammainc_case("gammainc-half-1", 0.5, 1.0),
                    _gammainc_case("gammainc-1-1", 1.0, 1.0),
                    _gammainc_case("gammainc-2-1", 2.0, 1.0),
                    _gammainc_case("gammainc-5-5", 5.0, 5.0),
                    _gammainc_case("gammainc-half-0.1", 0.5, 0.1),
                    _gammainc_case("gammainc-10-5", 10.0, 5.0),
                    _gammainc_case("gammainc-1-10", 1.0, 10.0),
                    # --- gammaincc ---
                    _gammaincc_case("gammaincc-half-1", 0.5, 1.0),
                    _gammaincc_case("gammaincc-1-1", 1.0, 1.0),
                    _gammaincc_case("gammaincc-2-1", 2.0, 1.0),
                    _gammaincc_case("gammaincc-5-5", 5.0, 5.0),
                    _gammaincc_case("gammaincc-half-0.1", 0.5, 0.1),
                    _gammaincc_case("gammaincc-10-5", 10.0, 5.0),
                    _gammaincc_case("gammaincc-1-10", 1.0, 10.0),
                    # --- betainc ---
                    _betainc_case("betainc-1-1-0.5", 1.0, 1.0, 0.5),
                    _betainc_case("betainc-2-3-0.5", 2.0, 3.0, 0.5),
                    _betainc_case("betainc-half-half-0.5", 0.5, 0.5, 0.5),
                    _betainc_case("betainc-5-5-0.3", 5.0, 5.0, 0.3),
                    _betainc_case("betainc-half-5-0.1", 0.5, 5.0, 0.1),
                    _betainc_case("betainc-10-10-0.5", 10.0, 10.0, 0.5),
                    _betainc_case("betainc-2-5-0.8", 2.0, 5.0, 0.8),
                    # --- polygamma ---
                    _polygamma_case("polygamma-0-1", 0, 1.0),
                    _polygamma_case("polygamma-0-2", 0, 2.0),
                    _polygamma_case("polygamma-0-half", 0, 0.5),
                    _polygamma_case("polygamma-1-1", 1, 1.0),
                    _polygamma_case("polygamma-1-2", 1, 2.0),
                    _polygamma_case("polygamma-2-1", 2, 1.0),
                    _polygamma_case("polygamma-0-10", 0, 10.0),
                ]
            },
        }
    ]


def _erfinv_case(case_id: str, x: float) -> dict[str, Any]:
    return {
        "id": case_id,
        "operation": "erfinv",
        "input": {"x": x},
        "expected": float(sp_special.erfinv(x)),
    }


def _erfcinv_case(case_id: str, x: float) -> dict[str, Any]:
    return {
        "id": case_id,
        "operation": "erfcinv",
        "input": {"x": x},
        "expected": float(sp_special.erfcinv(x)),
    }


def _gammainc_case(case_id: str, a: float, x: float) -> dict[str, Any]:
    return {
        "id": case_id,
        "operation": "gammainc",
        "input": {"a": a, "x": x},
        "expected": float(sp_special.gammainc(a, x)),
    }


def _gammaincc_case(case_id: str, a: float, x: float) -> dict[str, Any]:
    return {
        "id": case_id,
        "operation": "gammaincc",
        "input": {"a": a, "x": x},
        "expected": float(sp_special.gammaincc(a, x)),
    }


def _betainc_case(case_id: str, a: float, b: float, x: float) -> dict[str, Any]:
    return {
        "id": case_id,
        "operation": "betainc",
        "input": {"a": a, "b": b, "x": x},
        "expected": float(sp_special.betainc(a, b, x)),
    }


def _polygamma_case(case_id: str, n: int, x: float) -> dict[str, Any]:
    return {
        "id": case_id,
        "operation": "polygamma",
        "input": {"n": n, "x": x},
        "expected": float(sp_special.polygamma(n, x)),
    }
