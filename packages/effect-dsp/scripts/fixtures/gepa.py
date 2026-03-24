from __future__ import annotations

from typing import Any

from ._common import metadata


PARETO_SCORE_MATRIX_BASIC = {
    "objectiveDirection": "maximize",
    "scores": [
        [0.9, 0.4, 0.8, 0.7],
        [0.8, 0.8, 0.4, 0.7],
        [0.3, 0.95, 0.6, 0.7],
        [0.5, 0.3, 0.5, 0.6],
        [0.2, 0.2, 0.2, 0.2],
    ],
    "expectedFrontierIndices": [0, 1, 2],
    "expectedDominatedIndices": [3, 4],
    "expectedHoldings": [
        {"exampleIndex": 0, "bestScore": 0.9, "holders": [0]},
        {"exampleIndex": 1, "bestScore": 0.95, "holders": [2]},
        {"exampleIndex": 2, "bestScore": 0.8, "holders": [0]},
        {"exampleIndex": 3, "bestScore": 0.7, "holders": [0, 1, 2]},
    ],
    "expectedSelectionWeights": [
        {"candidateIndex": 0, "weight": 3},
        {"candidateIndex": 1, "weight": 1},
        {"candidateIndex": 2, "weight": 2},
        {"candidateIndex": 3, "weight": 0},
        {"candidateIndex": 4, "weight": 0},
    ],
    "sampling": {
        "seed": 42,
        "draws": 10000,
        "tolerance": 0.02,
    },
}


PARETO_SCORE_MATRIX_TIES = {
    "objectiveDirection": "maximize",
    "scores": [
        [0.7, 0.7, 0.7],
        [0.7, 0.7, 0.7],
        [0.6, 0.8, 0.7],
    ],
    "expectedFrontierIndices": [0, 1, 2],
    "expectedDominatedIndices": [],
    "expectedHoldings": [
        {"exampleIndex": 0, "bestScore": 0.7, "holders": [0, 1]},
        {"exampleIndex": 1, "bestScore": 0.8, "holders": [2]},
        {"exampleIndex": 2, "bestScore": 0.7, "holders": [0, 1, 2]},
    ],
    "expectedSelectionWeights": [
        {"candidateIndex": 0, "weight": 2},
        {"candidateIndex": 1, "weight": 2},
        {"candidateIndex": 2, "weight": 2},
    ],
    "sampling": {
        "seed": 42,
        "draws": 10000,
        "tolerance": 0.02,
    },
}


SELECTION_WEIGHTS = {
    "seed": 42,
    "draws": 10000,
    "tolerance": 0.02,
    "weights": [
        {"candidateIndex": 0, "weight": 3},
        {"candidateIndex": 1, "weight": 1},
        {"candidateIndex": 2, "weight": 2},
        {"candidateIndex": 3, "weight": 0},
    ],
    "expectedProbabilities": [
        {"candidateIndex": 0, "probability": 0.5},
        {"candidateIndex": 1, "probability": 0.1666666667},
        {"candidateIndex": 2, "probability": 0.3333333333},
        {"candidateIndex": 3, "probability": 0.0},
    ],
}


REFLECT_DATASET_SHAPE = {
    "predictorName": "qa",
    "currentInstruction": "Answer with concise factual responses.",
    "samples": [
        {
            "exampleId": "example-0",
            "predictorName": "qa",
            "inputs": {"question": "What is the capital of France?"},
            "generatedOutputs": {"answer": "Lyon"},
            "expectedOutput": {"answer": "Paris"},
            "metricResult": {"score": 0, "feedback": "Use the canonical capital city."},
        },
        {
            "exampleId": "example-1",
            "predictorName": "qa",
            "inputs": {"question": "What is the capital of Japan?"},
            "generatedOutputs": {"answer": "Tokyo"},
            "expectedOutput": {"answer": "Tokyo"},
            "metricResult": {"score": 1, "feedback": ""},
        },
    ],
    "expectedPromptSections": [
        "## Inputs",
        "## Generated Outputs",
        "## Expected Output",
        "## Feedback",
    ],
}


REFLECT_PROMPT_TEMPLATE = {
    "predictorName": "qa",
    "currentInstruction": "Answer with concise factual responses.",
    "requiredSubstrings": [
        "I provided an assistant with the following instructions to perform a task for me:",
        "Target predictor: qa",
        "Your task is to write a new instruction for the assistant.",
        "Provide the new instructions within ``` blocks.",
    ],
    "expectedSectionOrder": [
        "## Inputs",
        "## Generated Outputs",
        "## Expected Output",
        "## Feedback",
    ],
}


FORMAT_FAILURE_FEEDBACK = {
    "structureInstruction": "[[ ## answer ## ]]",
    "expectedPrefix": "Your output failed to parse. Follow this structure:\n",
    "expectedFeedback": "Your output failed to parse. Follow this structure:\n[[ ## answer ## ]]",
}


ACCEPT_MUTATION_STRICT = {
    "cases": [
        {
            "name": "equal-minibatch-rejected",
            "previousSubsampleScores": [0.4, 0.6],
            "mutatedSubsampleScores": [0.4, 0.6],
            "fullValsetScores": [0.9, 1.0],
            "expectedGate1Passed": False,
            "expectedFullValsetEvaluated": False,
            "expectedAccepted": False,
        },
        {
            "name": "strict-greater-accepted",
            "previousSubsampleScores": [0.2, 0.3],
            "mutatedSubsampleScores": [0.4, 0.3],
            "fullValsetScores": [0.8, 0.9],
            "expectedGate1Passed": True,
            "expectedFullValsetEvaluated": True,
            "expectedAccepted": True,
        },
        {
            "name": "strict-lower-rejected",
            "previousSubsampleScores": [0.6, 0.6],
            "mutatedSubsampleScores": [0.5, 0.6],
            "fullValsetScores": [1.0, 1.0],
            "expectedGate1Passed": False,
            "expectedFullValsetEvaluated": False,
            "expectedAccepted": False,
        },
    ]
}


ACCEPT_MERGE_NON_STRICT = {
    "cases": [
        {
            "name": "merge-tie-accepted",
            "mergedSubsampleScores": [0.5, 0.4],
            "parentASubsampleScores": [0.4, 0.5],
            "parentBSubsampleScores": [0.5, 0.4],
            "expectedAccepted": True,
        },
        {
            "name": "merge-worse-rejected",
            "mergedSubsampleScores": [0.2, 0.3],
            "parentASubsampleScores": [0.4, 0.4],
            "parentBSubsampleScores": [0.3, 0.4],
            "expectedAccepted": False,
        },
        {
            "name": "merge-better-accepted",
            "mergedSubsampleScores": [0.6, 0.5],
            "parentASubsampleScores": [0.4, 0.4],
            "parentBSubsampleScores": [0.3, 0.4],
            "expectedAccepted": True,
        },
    ]
}


MERGE_COMMON_ANCESTOR_CASES = {
    "seed": 0,
    "parentAId": "parent-a",
    "parentBId": "parent-b",
    "expectedCommonAncestorId": "seed",
    "expectedBalancedSubsampleIds": ["example-0", "example-1", "example-2", "example-3", "example-4"],
    "candidates": [
        {
            "candidateId": "seed",
            "parentIds": [],
            "predictorInstructions": [
                {"predictorName": "qa", "instruction": "answer accurately"},
                {"predictorName": "judge", "instruction": "score deterministically"},
            ],
        },
        {
            "candidateId": "parent-a",
            "parentIds": ["seed"],
            "predictorInstructions": [
                {"predictorName": "qa", "instruction": "answer accurately with concise facts"},
                {"predictorName": "judge", "instruction": "score deterministically"},
            ],
        },
        {
            "candidateId": "parent-b",
            "parentIds": ["seed"],
            "predictorInstructions": [
                {"predictorName": "qa", "instruction": "answer accurately"},
                {"predictorName": "judge", "instruction": "score deterministically with strict rubric"},
            ],
        },
    ],
    "comparisons": [
        {"exampleId": "example-0", "parentAScore": 0.9, "parentBScore": 0.2},
        {"exampleId": "example-1", "parentAScore": 0.1, "parentBScore": 0.8},
        {"exampleId": "example-2", "parentAScore": 0.6, "parentBScore": 0.6},
        {"exampleId": "example-3", "parentAScore": 0.8, "parentBScore": 0.4},
        {"exampleId": "example-4", "parentAScore": 0.3, "parentBScore": 0.7},
    ],
}


MERGE_SCHEDULE = {
    "defaultMaxMergeInvocations": 5,
    "attemptDecisions": [
        {
            "name": "blocked-without-new-candidate",
            "lastIterationFoundNew": False,
            "candidateCount": 3,
            "mergeBudgetRemaining": 5,
            "expectedShouldAttempt": False,
        },
        {
            "name": "blocked-with-single-candidate",
            "lastIterationFoundNew": True,
            "candidateCount": 1,
            "mergeBudgetRemaining": 5,
            "expectedShouldAttempt": False,
        },
        {
            "name": "merge-eligible",
            "lastIterationFoundNew": True,
            "candidateCount": 3,
            "mergeBudgetRemaining": 2,
            "expectedShouldAttempt": True,
        },
        {
            "name": "budget-exhausted",
            "lastIterationFoundNew": True,
            "candidateCount": 3,
            "mergeBudgetRemaining": 0,
            "expectedShouldAttempt": False,
        },
    ],
    "acceptedMergeBudgetTransitions": [
        {"before": 2, "after": 1},
        {"before": 1, "after": 0},
    ],
}


ORCHESTRATION_EVENT_ORDER = {
    "seed": 0,
    "maxIterations": 3,
    "timeline": [
        {"_tag": "IterationStarted", "iteration": 1, "frontierSize": 1},
        {
            "_tag": "MergeChecked",
            "iteration": 1,
            "attempted": False,
            "accepted": False,
            "mergeBudgetRemaining": 5,
        },
        {
            "_tag": "MutationProposed",
            "iteration": 1,
            "parentId": "candidate-0",
            "mutatedCandidateId": "mut-1",
            "predictorName": "qa",
            "instruction": "Answer with concise factual responses. [GEPA iteration 1]",
        },
        {
            "_tag": "AcceptanceEvaluated",
            "iteration": 1,
            "accepted": True,
            "gate1Passed": True,
            "fullValsetEvaluated": True,
            "previousSubsampleSum": 0.5,
            "mutatedSubsampleSum": 0.7,
        },
        {
            "_tag": "ParetoUpdated",
            "iteration": 1,
            "frontierIndices": [0, 1],
            "dominatedIndices": [],
            "parentWeights": [
                {"candidateIndex": 0, "weight": 1},
                {"candidateIndex": 1, "weight": 1},
            ],
        },
        {"_tag": "IterationCompleted", "iteration": 1, "acceptedCandidate": True, "frontierSize": 2},
        {"_tag": "OptimizationCompleted", "iterations": 1, "bestCandidateId": "mut-1", "frontierSize": 2},
    ],
    "expectedWithinIterationOrder": [
        "IterationStarted",
        "MergeChecked",
        "MutationProposed",
        "AcceptanceEvaluated",
        "ParetoUpdated",
        "IterationCompleted",
    ],
    "expectedTerminalTag": "OptimizationCompleted",
}


ORCHESTRATION_STATE_TRANSITIONS = {
    "transitions": [
        {
            "name": "initial-state",
            "iteration": 0,
            "candidateCount": 1,
            "mergeBudgetRemaining": 5,
            "lastIterationFoundNew": False,
            "expectedShouldAttemptMerge": False,
        },
        {
            "name": "post-accepted-mutation",
            "iteration": 1,
            "candidateCount": 2,
            "mergeBudgetRemaining": 5,
            "lastIterationFoundNew": True,
            "expectedShouldAttemptMerge": True,
        },
        {
            "name": "budget-exhausted",
            "iteration": 2,
            "candidateCount": 2,
            "mergeBudgetRemaining": 0,
            "lastIterationFoundNew": True,
            "expectedShouldAttemptMerge": False,
        },
    ],
    "expectedCandidateCountProgression": [1, 2, 2],
    "expectedLastIterationFoundNew": [False, True, True],
}


REPLAY_FRONTIER_SNAPSHOTS = {
    "seed": 0,
    "snapshots": [
        {
            "iteration": 0,
            "frontierIndices": [0, 1, 2],
            "dominatedIndices": [3, 4],
            "parentWeights": [
                {"candidateIndex": 0, "weight": 3},
                {"candidateIndex": 1, "weight": 1},
                {"candidateIndex": 2, "weight": 2},
                {"candidateIndex": 3, "weight": 0},
                {"candidateIndex": 4, "weight": 0},
            ],
        },
        {
            "iteration": 1,
            "frontierIndices": [0, 1, 2],
            "dominatedIndices": [],
            "parentWeights": [
                {"candidateIndex": 0, "weight": 2},
                {"candidateIndex": 1, "weight": 2},
                {"candidateIndex": 2, "weight": 2},
            ],
        },
    ],
    "byteStableFields": ["frontierIndices", "dominatedIndices", "parentWeights"],
}


REPLAY_PARAMS = {
    "seed": 0,
    "moduleName": "qa-replay",
    "savedState": {
        "version": 1,
        "modules": [
            {
                "name": "qa-replay",
                "params": {
                    "instructions": "Answer questions with concise facts",
                    "demos": [],
                    "outputStrategy": "auto",
                },
            }
        ],
        "metadata": {
            "seed": 0,
            "maxIterations": 3,
        },
    },
    "stableJsonKeys": ["version", "modules", "metadata"],
    "expectedInstructionContains": ["Answer questions with concise facts"],
}


GOVERNANCE_PUBLIC_SEAMS = {
    "allowedEffectSearchImports": [
        "effect-search/Pareto",
        "effect-search/Sampler",
        "effect-search/Study",
    ],
    "forbiddenEffectSearchImportPrefixes": ["effect-search/internal/"],
    "allowedRuntimeImportOwners": [
        "src/contracts/DeterministicSeed.ts",
        "src/optimizers/GEPA/pareto.ts",
        "src/optimizers/GEPA/sampling.ts",
        "src/optimizers/GEPA/runtime/stream.ts",
    ],
    "expectedOptimizerIndexExports": ["./gepa.js", "./gepaStream.js"],
    "expectedOptimizerEventsExports": ["./gepa.js"],
}


GOVERNANCE_OPTIMIZER_OPTIONS = {
    "requiredOptionKeys": ["module", "trainset", "metric", "maxIterations"],
    "optionalOptionKeys": ["valset", "maxMergeInvocations", "seed"],
    "defaultMaxMergeInvocations": 5,
    "eventTags": [
        "IterationStarted",
        "MergeChecked",
        "MutationProposed",
        "AcceptanceEvaluated",
        "ParetoUpdated",
        "IterationCompleted",
        "OptimizationCompleted",
    ],
}


CONCRETE_FIXTURE_ENTRIES = [
    {"name": "dspy.gepa.pareto.score-matrix.basic", "file": "gepa/pareto/score-matrix.basic.json"},
    {"name": "dspy.gepa.pareto.score-matrix.ties", "file": "gepa/pareto/score-matrix.ties.json"},
    {"name": "dspy.gepa.selection.weights.seed-42", "file": "gepa/selection/weights.seed-42.json"},
    {"name": "dspy.gepa.reflect.dataset-shape", "file": "gepa/reflect/dataset-shape.json"},
    {"name": "dspy.gepa.reflect.prompt-template.basic", "file": "gepa/reflect/prompt-template.basic.json"},
    {
        "name": "dspy.gepa.reflect.format-failure-feedback",
        "file": "gepa/reflect/format-failure-feedback.json",
    },
    {"name": "dspy.gepa.accept.mutation-strict-greater", "file": "gepa/accept/mutation-strict-greater.json"},
    {"name": "dspy.gepa.accept.merge-non-strict", "file": "gepa/accept/merge-non-strict.json"},
    {"name": "dspy.gepa.merge.common-ancestor-cases", "file": "gepa/merge/common-ancestor-cases.json"},
    {
        "name": "dspy.gepa.merge.schedule.max-merge-invocations",
        "file": "gepa/merge/schedule.max-merge-invocations.json",
    },
    {
        "name": "dspy.gepa.orchestration.event-order.seed-0",
        "file": "gepa/orchestration/event-order.seed-0.json",
    },
    {
        "name": "dspy.gepa.orchestration.state-transitions.basic",
        "file": "gepa/orchestration/state-transitions.basic.json",
    },
    {
        "name": "dspy.gepa.replay.frontier-snapshots.seed-0",
        "file": "gepa/replay/frontier-snapshots.seed-0.json",
    },
    {"name": "dspy.gepa.replay.params.seed-0", "file": "gepa/replay/params.seed-0.json"},
    {"name": "dspy.gepa.governance.public-seams", "file": "gepa/governance/public-seams.json"},
    {
        "name": "dspy.gepa.governance.optimizer-options",
        "file": "gepa/governance/optimizer-options.json",
    },
]


def concrete_fixture_entries() -> list[dict[str, str]]:
    return [dict(entry) for entry in CONCRETE_FIXTURE_ENTRIES]


def _catalog_payload() -> dict[str, Any]:
    namespaces = sorted(
        {
            ".".join(str(entry["name"]).split(".")[:3])
            for entry in CONCRETE_FIXTURE_ENTRIES
        }
    )

    return {
        "fixtureSet": "dspy.gepa",
        "version": 2,
        "fixtures": concrete_fixture_entries(),
        "namespaces": namespaces,
        "requiredFixtureCount": len(CONCRETE_FIXTURE_ENTRIES),
    }


def _replay_contract_payload() -> dict[str, Any]:
    return {
        "seed": 0,
        "moduleName": "qa-replay",
        "maxIterations": 3,
        "trainsetSize": 3,
        "requiredManifestFixtures": [entry["name"] for entry in CONCRETE_FIXTURE_ENTRIES],
        "byteEqualityChecks": [
            "savedStateBytes",
            "frontierSnapshotBytes",
            "eventTimelineBytes",
            "paramsBytes",
        ],
    }


def _fixture_document(fixture: str, file: str, generated_at: str, payload: dict[str, Any]) -> dict[str, Any]:
    return {
        "fixture": fixture,
        "file": file,
        "metadata": metadata(generated_at),
        "payload": payload,
    }


def generate(generated_at: str) -> list[dict[str, Any]]:
    return [
        _fixture_document("dspy.gepa.pareto.score-matrix.basic", "gepa/pareto/score-matrix.basic.json", generated_at, PARETO_SCORE_MATRIX_BASIC),
        _fixture_document("dspy.gepa.pareto.score-matrix.ties", "gepa/pareto/score-matrix.ties.json", generated_at, PARETO_SCORE_MATRIX_TIES),
        _fixture_document("dspy.gepa.selection.weights.seed-42", "gepa/selection/weights.seed-42.json", generated_at, SELECTION_WEIGHTS),
        _fixture_document("dspy.gepa.reflect.dataset-shape", "gepa/reflect/dataset-shape.json", generated_at, REFLECT_DATASET_SHAPE),
        _fixture_document(
            "dspy.gepa.reflect.prompt-template.basic",
            "gepa/reflect/prompt-template.basic.json",
            generated_at,
            REFLECT_PROMPT_TEMPLATE,
        ),
        _fixture_document(
            "dspy.gepa.reflect.format-failure-feedback",
            "gepa/reflect/format-failure-feedback.json",
            generated_at,
            FORMAT_FAILURE_FEEDBACK,
        ),
        _fixture_document(
            "dspy.gepa.accept.mutation-strict-greater",
            "gepa/accept/mutation-strict-greater.json",
            generated_at,
            ACCEPT_MUTATION_STRICT,
        ),
        _fixture_document(
            "dspy.gepa.accept.merge-non-strict",
            "gepa/accept/merge-non-strict.json",
            generated_at,
            ACCEPT_MERGE_NON_STRICT,
        ),
        _fixture_document(
            "dspy.gepa.merge.common-ancestor-cases",
            "gepa/merge/common-ancestor-cases.json",
            generated_at,
            MERGE_COMMON_ANCESTOR_CASES,
        ),
        _fixture_document(
            "dspy.gepa.merge.schedule.max-merge-invocations",
            "gepa/merge/schedule.max-merge-invocations.json",
            generated_at,
            MERGE_SCHEDULE,
        ),
        _fixture_document(
            "dspy.gepa.orchestration.event-order.seed-0",
            "gepa/orchestration/event-order.seed-0.json",
            generated_at,
            ORCHESTRATION_EVENT_ORDER,
        ),
        _fixture_document(
            "dspy.gepa.orchestration.state-transitions.basic",
            "gepa/orchestration/state-transitions.basic.json",
            generated_at,
            ORCHESTRATION_STATE_TRANSITIONS,
        ),
        _fixture_document(
            "dspy.gepa.replay.frontier-snapshots.seed-0",
            "gepa/replay/frontier-snapshots.seed-0.json",
            generated_at,
            REPLAY_FRONTIER_SNAPSHOTS,
        ),
        _fixture_document(
            "dspy.gepa.replay.params.seed-0",
            "gepa/replay/params.seed-0.json",
            generated_at,
            REPLAY_PARAMS,
        ),
        _fixture_document(
            "dspy.gepa.governance.public-seams",
            "gepa/governance/public-seams.json",
            generated_at,
            GOVERNANCE_PUBLIC_SEAMS,
        ),
        _fixture_document(
            "dspy.gepa.governance.optimizer-options",
            "gepa/governance/optimizer-options.json",
            generated_at,
            GOVERNANCE_OPTIMIZER_OPTIONS,
        ),
        _fixture_document(
            "dspy.gepa.catalog.versioned-fixtures",
            "gepa/catalog/versioned-fixtures.json",
            generated_at,
            _catalog_payload(),
        ),
        _fixture_document(
            "dspy.gepa.replay.seed-0.contract",
            "gepa/replay/seed-0.contract.json",
            generated_at,
            _replay_contract_payload(),
        ),
    ]
