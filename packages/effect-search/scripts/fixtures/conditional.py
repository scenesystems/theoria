"""FM-10..11: conditional filtering and group decomposition fixture generation."""

from __future__ import annotations

from typing import Any

import optuna
from optuna.distributions import BaseDistribution, CategoricalDistribution, FloatDistribution
from optuna.search_space.group_decomposed import _SearchSpaceGroup
from optuna.trial import TrialState, create_trial

from ._common import metadata


def _distribution_for_name(name: str) -> BaseDistribution:
    if name == "optimizer":
        return CategoricalDistribution(["adam", "sgd"])

    if name == "lr":
        return FloatDistribution(1e-5, 1.0)

    return FloatDistribution(0.0, 1.0)


def _canonical_groups(search_spaces: list[dict[str, BaseDistribution]]) -> list[dict[str, Any]]:
    groups = [
        {
            "key": "|".join(sorted(group.keys())),
            "dimensions": sorted(group.keys()),
        }
        for group in search_spaces
    ]
    return sorted(groups, key=lambda group: group["key"])


def _filtering_cases() -> list[dict[str, Any]]:
    source_cases: list[dict[str, Any]] = [
        {
            "id": "adam-branch-filtering",
            "requiredParams": ["optimizer", "beta1", "beta2"],
            "trials": [
                {
                    "trialNumber": 40,
                    "params": {"optimizer": "adam", "beta1": 0.9, "beta2": 0.999},
                },
                {
                    "trialNumber": 41,
                    "params": {"optimizer": "sgd", "momentum": 0.9},
                },
                {
                    "trialNumber": 42,
                    "params": {"optimizer": "adam", "beta1": 0.85, "beta2": 0.98},
                },
            ],
        },
        {
            "id": "sgd-branch-filtering",
            "requiredParams": ["optimizer", "momentum"],
            "trials": [
                {
                    "trialNumber": 40,
                    "params": {"optimizer": "adam", "beta1": 0.9, "beta2": 0.999},
                },
                {
                    "trialNumber": 41,
                    "params": {"optimizer": "sgd", "momentum": 0.9},
                },
                {
                    "trialNumber": 42,
                    "params": {"optimizer": "adam", "beta1": 0.85, "beta2": 0.98},
                },
            ],
        },
    ]

    sampler = optuna.samplers.TPESampler(seed=0)
    resolved_cases: list[dict[str, Any]] = []

    for case in source_cases:
        required_params = case["requiredParams"]
        search_space = {name: _distribution_for_name(name) for name in required_params}
        trials = [
            create_trial(
                state=TrialState.COMPLETE,
                value=0.0,
                params=trial["params"],
                distributions={name: _distribution_for_name(name) for name in trial["params"].keys()},
            )
            for trial in case["trials"]
        ]

        # Source reference: TPESampler._get_internal_repr keeps trials where all required params exist.
        internal = sampler._get_internal_repr(trials, search_space)  # pyright: ignore[reportPrivateUsage]
        expected_included = [
            trial["trialNumber"]
            for trial in case["trials"]
            if all(param in trial["params"] for param in required_params)
        ]
        expected_excluded = [
            trial["trialNumber"]
            for trial in case["trials"]
            if trial["trialNumber"] not in expected_included
        ]

        if search_space:
            for values in internal.values():
                assert len(values) == len(expected_included)

        resolved_cases.append(
            {
                **case,
                "expectedIncluded": expected_included,
                "expectedExcluded": expected_excluded,
            }
        )

    return resolved_cases


def generate(generated_at: str) -> list[dict[str, Any]]:
    return [
        _filtering(generated_at),
        _group_decomposition(generated_at),
    ]


def _filtering(generated_at: str) -> dict[str, Any]:
    return {
        "fixture": "conditional.filtering",
        "file": "conditional/filtering.json",
        "metadata": metadata(generated_at),
        "payload": {
            "cases": _filtering_cases(),
        },
    }


def _group_decomposition(generated_at: str) -> dict[str, Any]:
    additions = [
        ["optimizer", "lr"],
        ["optimizer", "beta1", "beta2"],
        ["optimizer", "momentum"],
    ]
    group = _SearchSpaceGroup()

    for addition in additions:
        group.add_distributions({name: _distribution_for_name(name) for name in addition})

    return {
        "fixture": "conditional.group-decomposition",
        "file": "conditional/group-decomposition.json",
        "metadata": metadata(generated_at),
        "payload": {
            "dimensions": ["optimizer", "lr", "beta1", "beta2", "momentum"],
            "additions": additions,
            "expectedGroups": _canonical_groups(group.search_spaces),
        },
    }
