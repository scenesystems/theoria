"""FM-1: default_gamma / hyperopt_default_gamma fixture generation."""

from __future__ import annotations

from typing import Any

from optuna.samplers._tpe.sampler import default_gamma, hyperopt_default_gamma

from ._common import metadata


def generate(generated_at: str) -> list[dict[str, Any]]:
    return [
        {
            "fixture": "gamma.default-gamma",
            "file": "gamma/default-gamma.json",
            "metadata": metadata(generated_at),
            "payload": {
                "cap": 25,
                "cases": [
                    {"nTrials": n, "defaultGamma": default_gamma(n), "hyperoptGamma": hyperopt_default_gamma(n)}
                    for n in (0, 1, 10, 50, 260)
                ],
            },
        }
    ]
