"""End-to-end TPE + MOTPE study trace fixture generation."""

from __future__ import annotations

from typing import Any

from ._common import metadata


def generate(generated_at: str) -> list[dict[str, Any]]:
    return [
        _tpe_categorical_replay(generated_at),
    ]


def _tpe_categorical_replay(generated_at: str) -> dict[str, Any]:
    return {
        "fixture": "tpe-categorical-study.replay",
        "file": "tpe-categorical-study.replay.json",
        "metadata": metadata(generated_at),
        "payload": {
            "sampler": {
                "seed": 73,
                "nStartupTrials": 8,
                "nEiCandidates": 48,
                "trials": 18,
            },
            "expected": {
                "bestValue": -0.25,
                "configTrace": [
                    {"instruction": "rewrite", "demos": "few", "scoring": "recall"},
                    {"instruction": "socratic", "demos": "none", "scoring": "strict"},
                    {"instruction": "socratic", "demos": "few", "scoring": "recall"},
                    {"instruction": "socratic", "demos": "curated", "scoring": "recall"},
                    {"instruction": "counterexample", "demos": "none", "scoring": "recall"},
                    {"instruction": "baseline", "demos": "none", "scoring": "recall"},
                    {"instruction": "counterexample", "demos": "curated", "scoring": "strict"},
                    {"instruction": "baseline", "demos": "curated", "scoring": "recall"},
                    {"instruction": "rewrite", "demos": "few", "scoring": "recall"},
                    {"instruction": "rewrite", "demos": "none", "scoring": "balanced"},
                    {"instruction": "rewrite", "demos": "few", "scoring": "recall"},
                    {"instruction": "rewrite", "demos": "few", "scoring": "recall"},
                    {"instruction": "socratic", "demos": "curated", "scoring": "balanced"},
                    {"instruction": "counterexample", "demos": "few", "scoring": "strict"},
                    {"instruction": "rewrite", "demos": "none", "scoring": "recall"},
                    {"instruction": "rewrite", "demos": "few", "scoring": "recall"},
                    {"instruction": "baseline", "demos": "curated", "scoring": "balanced"},
                    {"instruction": "rewrite", "demos": "curated", "scoring": "balanced"},
                ],
            },
        },
    }
