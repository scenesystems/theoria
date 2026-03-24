"""FM-1: default_gamma / hyperopt_default_gamma fixture generation."""

from __future__ import annotations

from typing import Any

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
                    {"nTrials": 0, "defaultGamma": 0, "hyperoptGamma": 0},
                    {"nTrials": 1, "defaultGamma": 1, "hyperoptGamma": 1},
                    {"nTrials": 10, "defaultGamma": 1, "hyperoptGamma": 1},
                    {"nTrials": 50, "defaultGamma": 5, "hyperoptGamma": 2},
                    {"nTrials": 260, "defaultGamma": 25, "hyperoptGamma": 5},
                ],
            },
        }
    ]
