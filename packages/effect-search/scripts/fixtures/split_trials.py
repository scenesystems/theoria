"""FM-2: _split_trials fixture generation."""

from __future__ import annotations

from typing import Any

from ._common import metadata


def generate(generated_at: str) -> list[dict[str, Any]]:
    return [
        {
            "fixture": "split-trials.single-and-liar",
            "file": "split-trials/single-and-liar.json",
            "metadata": metadata(generated_at),
            "payload": {
                "cases": [
                    {
                        "id": "single-objective-minimize",
                        "direction": "minimize",
                        "nBelow": 2,
                        "trials": [
                            {"trialNumber": 0, "state": "complete", "value": 0.21, "intermediateValues": []},
                            {"trialNumber": 1, "state": "complete", "value": 0.74, "intermediateValues": []},
                            {
                                "trialNumber": 2,
                                "state": "pruned",
                                "value": 0.42,
                                "intermediateValues": [{"step": 0, "value": 0.9}, {"step": 1, "value": 0.42}],
                            },
                            {"trialNumber": 3, "state": "running", "liarValue": 0.5, "intermediateValues": []},
                        ],
                        "expectedBelow": [0, 2],
                        "expectedAbove": [1, 3],
                    },
                    {
                        "id": "single-objective-maximize",
                        "direction": "maximize",
                        "nBelow": 2,
                        "trials": [
                            {"trialNumber": 10, "state": "complete", "value": 0.2, "intermediateValues": []},
                            {"trialNumber": 11, "state": "complete", "value": 0.88, "intermediateValues": []},
                            {
                                "trialNumber": 12,
                                "state": "pruned",
                                "value": 0.69,
                                "intermediateValues": [{"step": 0, "value": 0.31}, {"step": 2, "value": 0.69}],
                            },
                            {"trialNumber": 13, "state": "running", "liarValue": 0.4, "intermediateValues": []},
                        ],
                        "expectedBelow": [11, 12],
                        "expectedAbove": [10, 13],
                    },
                ],
            },
        }
    ]
