"""FM-12..13: report contract and percentile-pruner boundary fixture generation."""

from __future__ import annotations

from typing import Any

import optuna
from optuna.trial import TrialState, create_trial

from ._common import metadata


def _derive_percentile_case_expected(direction: str, case: dict[str, Any]) -> bool:
    settings = case["settings"]
    pruner = optuna.pruners.PercentilePruner(
        percentile=settings["percentile"],
        n_startup_trials=settings["startupTrials"],
        n_warmup_steps=settings["warmupSteps"],
        interval_steps=settings["intervalSteps"],
        n_min_trials=settings["nMinTrials"],
    )
    study = optuna.create_study(direction=direction, pruner=pruner)

    for history_trial in case["history"]:
        if history_trial["state"] != "complete":
            continue

        reports = {
            int(report["step"]): float(report["value"])
            for report in history_trial["reports"]
        }
        completed_trial = create_trial(
            state=TrialState.COMPLETE,
            value=float(history_trial["reports"][-1]["value"]) if history_trial["reports"] else 0.0,
            params={},
            distributions={},
            intermediate_values=reports,
        )
        study.add_trial(completed_trial)

    current_trial = create_trial(
        state=TrialState.RUNNING,
        params={},
        distributions={},
        intermediate_values={int(case["step"]): float(case["currentValue"])},
    )

    return pruner.prune(study, current_trial)


def generate(generated_at: str) -> list[dict[str, Any]]:
    return [
        _report_contract(generated_at),
        _percentile_pruner(generated_at),
    ]


def _report_contract(generated_at: str) -> dict[str, Any]:
    return {
        "fixture": "pruning.report-contract",
        "file": "pruning/report-contract.json",
        "metadata": metadata(generated_at),
        "payload": {
            "cases": [
                {
                    "id": "accepts-first-report",
                    "initialReports": [],
                    "reportAttempt": {"step": 0, "value": 0.81},
                    "expectedReports": [{"step": 0, "value": 0.81}],
                    "expectedOutcome": "accepted",
                },
                {
                    "id": "accepts-ascending-step",
                    "initialReports": [{"step": 0, "value": 0.81}],
                    "reportAttempt": {"step": 1, "value": 0.72},
                    "expectedReports": [{"step": 0, "value": 0.81}, {"step": 1, "value": 0.72}],
                    "expectedOutcome": "accepted",
                },
                {
                    "id": "rejects-duplicate-step",
                    "initialReports": [{"step": 0, "value": 0.81}],
                    "reportAttempt": {"step": 0, "value": 0.55},
                    "expectedReports": [{"step": 0, "value": 0.81}],
                    "expectedOutcome": "error",
                    "expectedErrorTag": "InvalidReportStep",
                },
                {
                    "id": "rejects-decreasing-step",
                    "initialReports": [{"step": 0, "value": 0.81}, {"step": 2, "value": 0.72}],
                    "reportAttempt": {"step": 1, "value": 0.6},
                    "expectedReports": [{"step": 0, "value": 0.81}, {"step": 2, "value": 0.72}],
                    "expectedOutcome": "error",
                    "expectedErrorTag": "InvalidReportStep",
                },
            ],
        },
    }


def _percentile_pruner(generated_at: str) -> dict[str, Any]:
    direction = "maximize"
    source_cases = [
        {
            "id": "startup-trials-disable-pruning",
            "settings": {
                "percentile": 25,
                "startupTrials": 3,
                "warmupSteps": 0,
                "intervalSteps": 1,
                "nMinTrials": 1,
            },
            "trialNumber": 2,
            "step": 0,
            "history": [
                {"trialNumber": 0, "state": "complete", "reports": [{"step": 0, "value": 0.5}]},
                {"trialNumber": 1, "state": "complete", "reports": [{"step": 0, "value": 0.9}]},
            ],
            "currentValue": 0.1,
        },
        {
            "id": "warmup-steps-disable-pruning",
            "settings": {
                "percentile": 25,
                "startupTrials": 0,
                "warmupSteps": 5,
                "intervalSteps": 1,
                "nMinTrials": 1,
            },
            "trialNumber": 5,
            "step": 3,
            "history": [
                {"trialNumber": 0, "state": "complete", "reports": [{"step": 3, "value": 0.8}]},
                {"trialNumber": 1, "state": "complete", "reports": [{"step": 3, "value": 0.7}]},
            ],
            "currentValue": 0.1,
        },
        {
            "id": "prunes-below-percentile",
            "settings": {
                "percentile": 25,
                "startupTrials": 0,
                "warmupSteps": 0,
                "intervalSteps": 1,
                "nMinTrials": 1,
            },
            "trialNumber": 5,
            "step": 0,
            "history": [
                {"trialNumber": 0, "state": "complete", "reports": [{"step": 0, "value": 0.5}]},
                {"trialNumber": 1, "state": "complete", "reports": [{"step": 0, "value": 0.7}]},
                {"trialNumber": 2, "state": "complete", "reports": [{"step": 0, "value": 0.9}]},
                {"trialNumber": 3, "state": "complete", "reports": [{"step": 0, "value": 0.8}]},
            ],
            "currentValue": 0.1,
        },
        {
            "id": "keeps-above-percentile",
            "settings": {
                "percentile": 25,
                "startupTrials": 0,
                "warmupSteps": 0,
                "intervalSteps": 1,
                "nMinTrials": 1,
            },
            "trialNumber": 5,
            "step": 0,
            "history": [
                {"trialNumber": 0, "state": "complete", "reports": [{"step": 0, "value": 0.5}]},
                {"trialNumber": 1, "state": "complete", "reports": [{"step": 0, "value": 0.7}]},
                {"trialNumber": 2, "state": "complete", "reports": [{"step": 0, "value": 0.9}]},
                {"trialNumber": 3, "state": "complete", "reports": [{"step": 0, "value": 0.8}]},
            ],
            "currentValue": 0.85,
        },
    ]
    cases = [
        {
            **case,
            "expectedShouldPrune": bool(_derive_percentile_case_expected(direction, case)),
        }
        for case in source_cases
    ]

    return {
        "fixture": "pruning.percentile-pruner",
        "file": "pruning/percentile-pruner.json",
        "metadata": metadata(generated_at),
        "payload": {
            "direction": direction,
            "cases": cases,
        },
    }
