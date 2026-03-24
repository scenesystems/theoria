"""FM-3: _get_pruned_trial_score ordering semantics fixture generation."""

from __future__ import annotations

from typing import Any

from ._common import metadata


def generate(generated_at: str) -> list[dict[str, Any]]:
    return [
        {
            "fixture": "pruned-score.pruned-ordering",
            "file": "pruned-score/pruned-ordering.json",
            "metadata": metadata(generated_at),
            "payload": {
                "direction": "minimize",
                "cases": [
                    {
                        "id": "no-intermediate-values",
                        "trialNumber": 20,
                        "intermediateValues": [],
                        "expectedStep": -1,
                        "expectedScore": "Infinity",
                    },
                    {
                        "id": "nan-intermediate-values",
                        "trialNumber": 21,
                        "intermediateValues": [{"step": 0, "value": "NaN"}],
                        "expectedStep": 0,
                        "expectedScore": "Infinity",
                    },
                    {
                        "id": "step-tie-break",
                        "trialNumber": 22,
                        "intermediateValues": [{"step": 0, "value": 0.71}, {"step": 3, "value": 0.39}],
                        "expectedStep": 3,
                        "expectedScore": 0.39,
                    },
                ],
                "expectedOrder": [22, 20, 21],
            },
        }
    ]
