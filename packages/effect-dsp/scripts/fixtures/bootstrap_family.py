from __future__ import annotations

from typing import Any

from ._common import metadata

BOOTSTRAP_DEMO_BUDGET_CASES: list[dict[str, str]] = [
    {
        "question": "What is the capital of France?",
        "expectedAnswer": "Paris",
        "teacherAnswer": "Paris",
    },
    {
        "question": "What is the capital of Japan?",
        "expectedAnswer": "Tokyo",
        "teacherAnswer": "Tokyo",
    },
    {
        "question": "What is the capital of Italy?",
        "expectedAnswer": "Rome",
        "teacherAnswer": "Rome",
    },
]

BOOTSTRAP_THRESHOLD_CASES: list[dict[str, str]] = [
    {
        "question": "What is the capital of France?",
        "expectedAnswer": "Paris",
        "teacherAnswer": "Paris",
    },
    {
        "question": "What is the capital of Japan?",
        "expectedAnswer": "Tokyo",
        "teacherAnswer": "Kyoto",
    },
]

LABELED_FEWSHOT_TRAINSET: list[dict[str, str]] = [
    {
        "question": "What is the capital of France?",
        "answer": "Paris",
    },
    {
        "question": "What is the capital of Japan?",
        "answer": "Tokyo",
    },
    {
        "question": "What is the capital of Italy?",
        "answer": "Rome",
    },
    {
        "question": "What is the capital of Spain?",
        "answer": "Madrid",
    },
]

BOOTSTRAP_RS_TRAINSET: list[dict[str, str]] = [
    {
        "question": "What is the capital of France?",
        "answer": "Paris",
    },
    {
        "question": "What is the capital of Japan?",
        "answer": "Tokyo",
    },
]

BOOTSTRAP_RS_VALSET: list[dict[str, str]] = [
    {
        "question": "Name the capital of Japan in one word",
        "answer": "Tokyo",
    }
]

ENSEMBLE_CASES: list[dict[str, Any]] = [
    {
        "name": "majority",
        "question": "What is the capital of France?",
        "programAnswers": ["Paris", "London", "Paris"],
    },
    {
        "name": "tie-break-first-observed",
        "question": "Which answer should win tie resolution?",
        "programAnswers": ["Paris", "London", "London", "Paris"],
    },
]

LABELED_SAMPLE_SEED = 9
LABELED_SAMPLE_K = 2

BOOTSTRAP_RS_SEEDS = [9, 10]
BOOTSTRAP_RS_NUM_CANDIDATES = 2


def _normalize_seed(seed: int) -> int:
    finite = abs(int(seed))
    return 1 if finite <= 0 else finite


def _next_pseudo_seed(seed: int) -> int:
    return ((seed * 1664525) + 1013904223) % 4294967296


def _labeled_sample_questions(trainset: list[dict[str, str]], k: int, seed: int) -> list[str]:
    normalized_k = max(0, int(k))
    scored: list[dict[str, int | str]] = []
    cursor = _normalize_seed(seed)

    for entry in trainset:
        cursor = _next_pseudo_seed(cursor)
        scored.append(
            {
                "score": cursor,
                "question": entry["question"],
            }
        )

    sorted_scored = sorted(scored, key=lambda item: int(item["score"]))
    return [str(item["question"]) for item in sorted_scored[:normalized_k]]


def _accepted_questions(cases: list[dict[str, str]], threshold: float) -> list[str]:
    accepted: list[str] = []

    for case in cases:
        score = 1.0 if case["teacherAnswer"].strip().lower() == case["expectedAnswer"].strip().lower() else 0.0
        if score >= threshold:
            accepted.append(case["question"])

    return accepted


def _candidate_labels(seeds: list[int]) -> list[str]:
    labels = ["uncompiled", "labeled-few-shot"]
    return labels + [f"bootstrap-{seed}" for seed in seeds]


def _majority_vote(answers: list[str]) -> str:
    buckets: dict[str, dict[str, int]] = {}

    for index, answer in enumerate(answers):
        if answer not in buckets:
            buckets[answer] = {
                "count": 0,
                "firstIndex": index,
            }

        buckets[answer]["count"] += 1

    ranked = sorted(
        buckets.items(),
        key=lambda entry: (-entry[1]["count"], entry[1]["firstIndex"]),
    )

    return ranked[0][0]


def _bootstrap_demo_budget_payload() -> dict[str, Any]:
    max_bootstrapped_demos = 2
    threshold = 1.0
    accepted = _accepted_questions(BOOTSTRAP_DEMO_BUDGET_CASES, threshold)

    return {
        "maxBootstrappedDemos": max_bootstrapped_demos,
        "threshold": threshold,
        "maxRounds": 4,
        "trainset": BOOTSTRAP_DEMO_BUDGET_CASES,
        "expectedAcceptedQuestions": accepted[:max_bootstrapped_demos],
        "expectedFinalDemoCount": min(len(accepted), max_bootstrapped_demos),
        "expectedCallCount": len(BOOTSTRAP_DEMO_BUDGET_CASES),
    }


def _bootstrap_threshold_filtering_payload() -> dict[str, Any]:
    max_bootstrapped_demos = 1
    threshold = 1.0
    accepted = _accepted_questions(BOOTSTRAP_THRESHOLD_CASES, threshold)
    rejected = [case["question"] for case in BOOTSTRAP_THRESHOLD_CASES if case["question"] not in accepted]

    return {
        "maxBootstrappedDemos": max_bootstrapped_demos,
        "threshold": threshold,
        "maxRounds": 3,
        "trainset": BOOTSTRAP_THRESHOLD_CASES,
        "expectedAcceptedQuestions": accepted[:max_bootstrapped_demos],
        "expectedRejectedQuestions": rejected,
        "expectedFinalDemoCount": min(len(accepted), max_bootstrapped_demos),
        "expectedCallCount": len(BOOTSTRAP_THRESHOLD_CASES),
    }


def _labeled_few_shot_sample_payload() -> dict[str, Any]:
    return {
        "seed": LABELED_SAMPLE_SEED,
        "k": LABELED_SAMPLE_K,
        "trainset": LABELED_FEWSHOT_TRAINSET,
        "expectedSelectedQuestions": _labeled_sample_questions(
            LABELED_FEWSHOT_TRAINSET,
            LABELED_SAMPLE_K,
            LABELED_SAMPLE_SEED,
        ),
        "expectedCallCount": 0,
    }


def _bootstrap_rs_candidate_catalog_payload() -> dict[str, Any]:
    candidate_labels = _candidate_labels(BOOTSTRAP_RS_SEEDS)

    return {
        "numCandidates": BOOTSTRAP_RS_NUM_CANDIDATES,
        "seeds": BOOTSTRAP_RS_SEEDS,
        "maxRounds": 1,
        "maxBootstrappedDemos": 1,
        "maxLabeledDemos": 0,
        "threshold": 1.0,
        "trainset": BOOTSTRAP_RS_TRAINSET,
        "valset": BOOTSTRAP_RS_VALSET,
        "expectedCandidateLabels": candidate_labels,
        "expectedBestCandidateLabel": "bootstrap-9",
        "expectedBestDemoQuestions": ["What is the capital of Japan?"],
        "expectedCallCount": (
            (len(BOOTSTRAP_RS_SEEDS) * len(BOOTSTRAP_RS_TRAINSET))
            + (len(candidate_labels) * len(BOOTSTRAP_RS_VALSET))
        ),
    }


def _ensemble_majority_vote_payload() -> dict[str, Any]:
    return {
        "cases": [
            {
                "name": case["name"],
                "question": case["question"],
                "programAnswers": case["programAnswers"],
                "expectedAnswer": _majority_vote(case["programAnswers"]),
            }
            for case in ENSEMBLE_CASES
        ]
    }


def generate(generated_at: str) -> list[dict[str, Any]]:
    return [
        {
            "fixture": "dspy.bootstrap.demo-budget.basic",
            "file": "bootstrap/demo-budget.basic.json",
            "metadata": metadata(generated_at),
            "payload": _bootstrap_demo_budget_payload(),
        },
        {
            "fixture": "dspy.bootstrap.threshold-filtering.basic",
            "file": "bootstrap/threshold-filtering.basic.json",
            "metadata": metadata(generated_at),
            "payload": _bootstrap_threshold_filtering_payload(),
        },
        {
            "fixture": "dspy.bootstraprs.candidate-catalog.seed-9",
            "file": "bootstraprs/candidate-catalog.seed-9.json",
            "metadata": metadata(generated_at),
            "payload": _bootstrap_rs_candidate_catalog_payload(),
        },
        {
            "fixture": "dspy.labeledfewshot.sample-k.seed-9",
            "file": "labeledfewshot/sample-k.seed-9.json",
            "metadata": metadata(generated_at),
            "payload": _labeled_few_shot_sample_payload(),
        },
        {
            "fixture": "dspy.ensemble.majority-vote.basic",
            "file": "ensemble/majority-vote.basic.json",
            "metadata": metadata(generated_at),
            "payload": _ensemble_majority_vote_payload(),
        },
    ]
