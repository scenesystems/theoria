from __future__ import annotations

import math
from typing import Any

from ._common import metadata

PHASE_ORDER = ["phase1", "phase2", "phase3"]
PHASE1_ANCHOR_KINDS = ["zero-shot", "labels-only", "bootstrap-unshuffled", "bootstrap-shuffled"]
DEFAULT_TIP_VOCABULARY = ["none", "creative", "simple", "description", "high_stakes", "persona"]
PHASE3_TRIAL_BUDGET_FORMULA = "max(ceil(max(2*M*log(N), 3*N/2)), minimum)"

TRIAL_BUDGET_CASES = [
    {
        "name": "baseline-no-minimum",
        "predictorCount": 2,
        "demoCandidateCount": 4,
        "instructionCandidateCount": 3,
        "minimum": None,
    },
    {
        "name": "baseline-with-minimum",
        "predictorCount": 2,
        "demoCandidateCount": 4,
        "instructionCandidateCount": 3,
        "minimum": 8,
    },
    {
        "name": "logarithmic-dominant",
        "predictorCount": 5,
        "demoCandidateCount": 3,
        "instructionCandidateCount": 3,
        "minimum": None,
    },
    {
        "name": "exploration-dominant",
        "predictorCount": 1,
        "demoCandidateCount": 8,
        "instructionCandidateCount": 5,
        "minimum": None,
    },
    {
        "name": "zero-input-normalization",
        "predictorCount": 0,
        "demoCandidateCount": 0,
        "instructionCandidateCount": 0,
        "minimum": None,
    },
]


def _trial_budget(case: dict[str, Any]) -> int:
    predictor_count = max(1, int(case["predictorCount"]))
    candidate_count = max(1, max(int(case["demoCandidateCount"]), int(case["instructionCandidateCount"])))
    logarithmic_budget = 2 * predictor_count * math.log(candidate_count)
    exploration_budget = (3 * candidate_count) / 2
    minimum = int(case["minimum"]) if isinstance(case.get("minimum"), int) else 1

    return max(minimum, math.ceil(max(logarithmic_budget, exploration_budget)))


def _phase_config_payload() -> dict[str, Any]:
    return {
        "phaseOrder": PHASE_ORDER,
        "phase1AnchorKinds": PHASE1_ANCHOR_KINDS,
        "phase3TrialBudgetFormula": PHASE3_TRIAL_BUDGET_FORMULA,
        "phase3CadenceDefaults": {
            "seed": 1,
            "minibatchSize": 50,
            "fullEvalEvery": 5,
        },
        "phase3Sampler": {
            "kind": "tpe",
            "multivariate": True,
        },
        "phase3PriorTrialCount": 1,
    }


def _tips_payload() -> dict[str, Any]:
    return {
        "defaultTips": DEFAULT_TIP_VOCABULARY,
        "baselineTip": "baseline",
        "proposalMarkerTemplate": "[miprov2-proposal:{predictorName}:{proposalIndex}:seed:{seed}]",
        "diversityTemperatureDefault": 1,
    }


def _trial_budget_payload() -> dict[str, Any]:
    return {
        "formula": PHASE3_TRIAL_BUDGET_FORMULA,
        "cases": [
            {
                "name": case["name"],
                "predictorCount": int(case["predictorCount"]),
                "demoCandidateCount": int(case["demoCandidateCount"]),
                "instructionCandidateCount": int(case["instructionCandidateCount"]),
                "minimum": case["minimum"],
                "expectedBudget": _trial_budget(case),
            }
            for case in TRIAL_BUDGET_CASES
        ],
    }


def generate(generated_at: str) -> list[dict[str, Any]]:
    return [
        {
            "fixture": "dspy.mipro.phase-config",
            "file": "mipro/phase-config.json",
            "metadata": metadata(generated_at),
            "payload": _phase_config_payload(),
        },
        {
            "fixture": "dspy.mipro.tips-vocabulary",
            "file": "mipro/tips-vocabulary.json",
            "metadata": metadata(generated_at),
            "payload": _tips_payload(),
        },
        {
            "fixture": "dspy.mipro.trial-budget-cases",
            "file": "mipro/trial-budget-cases.json",
            "metadata": metadata(generated_at),
            "payload": _trial_budget_payload(),
        },
    ]
