"""FM-4..6: MOTPE split, reference point, and weights fixture generation."""

from __future__ import annotations

from typing import Any

import numpy as np
from optuna._hypervolume import compute_hypervolume  # type: ignore[import-untyped]

from ._common import metadata

EPSILON = 1e-12


def _reference_coordinate(worst: float, epsilon: float = EPSILON) -> float:
    reference = max(1.1 * worst, 0.9 * worst)
    return epsilon if reference == 0 else float(reference)


def _reference_point_from_worst(worst: list[float], epsilon: float = EPSILON) -> list[float]:
    return [_reference_coordinate(value, epsilon) for value in worst]


def _hypervolume_contributions(points: list[list[float]], reference: list[float]) -> list[float]:
    points_array = np.array(points, dtype=np.float64)
    reference_array = np.array(reference, dtype=np.float64)
    total = compute_hypervolume(points_array, reference_array)

    contributions: list[float] = []
    for index in range(len(points)):
        subset = np.delete(points_array, index, axis=0)
        contribution = max(total - compute_hypervolume(subset, reference_array), 0.0)
        contributions.append(float(contribution))

    return contributions


def _normalized_weights(contributions: list[float], epsilon: float = EPSILON) -> list[float]:
    max_contribution = max(contributions) if contributions else 0.0
    normalizer = max(max_contribution, epsilon)

    return [float(max(value / normalizer, epsilon)) for value in contributions]


def _to_loss_coordinate(value: float, direction: str) -> float:
    return -value if direction == "maximize" else value


def _to_loss_point(point: list[float], directions: list[str]) -> list[float]:
    return [
        _to_loss_coordinate(value, directions[index] if index < len(directions) else "minimize")
        for index, value in enumerate(point)
    ]


def _motpe_weight_fixture(
    generated_at: str,
    fixture: str,
    file: str,
    directions: list[str],
    points: list[list[float]],
    reference_point: list[float],
) -> dict[str, Any]:
    loss_points = [_to_loss_point(point, directions) for point in points]
    loss_reference = _to_loss_point(reference_point, directions)
    contributions = _hypervolume_contributions(loss_points, loss_reference)
    weights = _normalized_weights(contributions)

    return {
        "fixture": fixture,
        "file": file,
        "metadata": metadata(generated_at),
        "payload": {
            "directions": directions,
            "points": points,
            "referencePoint": reference_point,
            "expectedContributions": contributions,
            "expectedWeights": weights,
        },
    }


def generate(generated_at: str) -> list[dict[str, Any]]:
    return [
        *_motpe_weights(generated_at),
        _motpe_study(generated_at),
        _motpe_split(generated_at),
        _motpe_reference(generated_at),
    ]


def _motpe_weights(generated_at: str) -> list[dict[str, Any]]:
    return [
        _motpe_weight_fixture(
            generated_at,
            "motpe-weights.2obj",
            "motpe-weights.2obj.json",
            ["minimize", "minimize"],
            [
                [1, 4],
                [2, 2],
                [3, 1],
                [4, 3],
            ],
            [4.4, 4.4],
        ),
        _motpe_weight_fixture(
            generated_at,
            "motpe-weights.mixed-directions",
            "motpe-weights.mixed-directions.json",
            ["maximize", "minimize"],
            [
                [-1, 4],
                [-2, 2],
                [-3, 1],
                [-4, 3],
            ],
            [-4.4, 4.4],
        ),
        _motpe_weight_fixture(
            generated_at,
            "motpe-weights.zero-contribution",
            "motpe-weights.zero-contribution.json",
            ["minimize", "minimize"],
            [
                [1, 1],
                [1, 1],
                [1, 1],
            ],
            [2, 2],
        ),
    ]


def _motpe_study(generated_at: str) -> dict[str, Any]:
    return {
        "fixture": "motpe-study.2obj",
        "file": "motpe-study.2obj.json",
        "metadata": metadata(generated_at),
        "payload": {
            "sampler": {
                "seed": 29,
                "nStartupTrials": 6,
                "nEiCandidates": 48,
                "trials": 20,
            },
            "directions": ["minimize", "minimize"],
            "expected": {
                "paretoTrialNumbers": [0, 2, 4, 5, 6, 7, 8, 10, 12, 13, 14, 15, 16, 17, 18],
                "paretoValues": [
                    [3.2, 2.3],
                    [2.4000000000000004, 2.8],
                    [3.3, 1.9],
                    [4.5, 0.9000000000000001],
                    [2.4000000000000004, 2.8],
                    [3.3, 1.9],
                    [4.5, 0.9000000000000001],
                    [3.2, 2.3],
                    [1.7, 3.5],
                    [1.7, 3.5],
                    [2.4000000000000004, 2.8],
                    [1.4, 3.8],
                    [1.4, 3.8],
                    [3.9, 1.4],
                    [3.9, 1.4],
                ],
                "configTrace": [
                    {"instruction": "socratic", "demos": "few", "scoring": "balanced"},
                    {"instruction": "socratic", "demos": "none", "scoring": "strict"},
                    {"instruction": "rewrite", "demos": "curated", "scoring": "recall"},
                    {"instruction": "counterexample", "demos": "none", "scoring": "recall"},
                    {"instruction": "counterexample", "demos": "curated", "scoring": "balanced"},
                    {"instruction": "socratic", "demos": "curated", "scoring": "strict"},
                    {"instruction": "rewrite", "demos": "curated", "scoring": "recall"},
                    {"instruction": "counterexample", "demos": "curated", "scoring": "balanced"},
                    {"instruction": "socratic", "demos": "curated", "scoring": "strict"},
                    {"instruction": "counterexample", "demos": "none", "scoring": "recall"},
                    {"instruction": "socratic", "demos": "few", "scoring": "balanced"},
                    {"instruction": "socratic", "demos": "few", "scoring": "recall"},
                    {"instruction": "rewrite", "demos": "few", "scoring": "recall"},
                    {"instruction": "rewrite", "demos": "few", "scoring": "recall"},
                    {"instruction": "rewrite", "demos": "curated", "scoring": "recall"},
                    {"instruction": "baseline", "demos": "few", "scoring": "balanced"},
                    {"instruction": "baseline", "demos": "few", "scoring": "balanced"},
                    {"instruction": "counterexample", "demos": "curated", "scoring": "strict"},
                    {"instruction": "counterexample", "demos": "curated", "scoring": "strict"},
                    {"instruction": "rewrite", "demos": "none", "scoring": "balanced"},
                ],
            },
        },
    }


def _motpe_split(generated_at: str) -> dict[str, Any]:
    # Source: Optuna FM-4 trace for `_split_complete_trials_multi_objective`
    # captured in WP-3 research evidence. The rank + HSSP scores are fixed
    # expectations for this deterministic trial set.
    return {
        "fixture": "motpe-split.multi-rank-hssp",
        "file": "motpe-split/multi-rank-hssp.json",
        "metadata": metadata(generated_at),
        "payload": {
            "directions": ["minimize", "minimize"],
            "nBelow": 2,
            "trials": [
                {
                    "trialNumber": 30,
                    "values": [1, 4],
                    "feasible": True,
                    "rank": 0,
                    "hsspScore": 0.4,
                },
                {
                    "trialNumber": 31,
                    "values": [2, 2],
                    "feasible": True,
                    "rank": 0,
                    "hsspScore": 1,
                },
                {
                    "trialNumber": 32,
                    "values": [3, 1],
                    "feasible": True,
                    "rank": 0,
                    "hsspScore": 0.7,
                },
                {
                    "trialNumber": 33,
                    "values": [4, 3],
                    "feasible": True,
                    "rank": 1,
                    "hsspScore": 0,
                },
            ],
            "expectedBelow": [31, 32],
            "expectedAbove": [30, 33],
        },
    }


def _motpe_reference(generated_at: str) -> dict[str, Any]:
    cases = [
        {
            "id": "positive",
            "directions": ["minimize", "minimize"],
            "worstPoint": [4, 3],
        },
        {
            "id": "zero",
            "directions": ["minimize", "minimize"],
            "worstPoint": [0, 0],
        },
    ]

    return {
        "fixture": "motpe-reference.reference-point",
        "file": "motpe-reference/reference-point.json",
        "metadata": metadata(generated_at),
        "payload": {
            "epsilon": EPSILON,
            "cases": [
                {
                    "id": case["id"],
                    "directions": case["directions"],
                    "worstPoint": case["worstPoint"],
                    "expectedReferencePoint": _reference_point_from_worst(case["worstPoint"], EPSILON),
                }
                for case in cases
            ],
        },
    }
