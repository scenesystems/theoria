from __future__ import annotations

from typing import Any

import dspy
from dspy.utils import DummyLM

from ._common import metadata

BASIC_QUESTION = "What is the capital of France?"
CANDIDATE_RESPONSES = [
    {"reasoning": "Candidate one reasoning", "answer": "Candidate one"},
    {"reasoning": "Candidate two reasoning", "answer": "Candidate two"},
    {"reasoning": "Candidate three reasoning", "answer": "Candidate three"},
]
COMPARE_RESPONSE = {
    "rationale": "Candidate two is best because it stays concise and grounded.",
    "answer": "Candidate two",
}


class BasicQA(dspy.Signature):
    question = dspy.InputField()
    answer = dspy.OutputField(desc="often between 1 and 5 words")


def _prediction_dict(prediction: Any) -> dict[str, Any]:
    if hasattr(prediction, "toDict"):
        candidate = prediction.toDict()
        if isinstance(candidate, dict):
            return candidate

    if isinstance(prediction, dict):
        return prediction

    return {}


def _trace_entry_payloads(trace: list[Any]) -> list[dict[str, Any]]:
    payloads: list[dict[str, Any]] = []

    for entry in trace:
        if not isinstance(entry, tuple) or len(entry) != 3:
            payloads.append({"inputKeys": [], "predictionKeys": []})
            continue

        inputs = entry[1] if isinstance(entry[1], dict) else {}
        prediction = _prediction_dict(entry[2])
        payloads.append(
            {
                "inputKeys": list(inputs.keys()),
                "predictionKeys": list(prediction.keys()),
            }
        )

    return payloads


def _reasoning_attempt(candidate: dict[str, Any]) -> str:
    rationale = str(candidate.get("rationale", candidate.get("reasoning", ""))).strip().split("\n")[0].strip()
    answer = str(candidate.get("answer", "")).strip().split("\n")[0].strip()
    return f"«I'm trying to {rationale} I'm not sure but my prediction is {answer}»"


def _candidate_comparisons() -> str:
    sections = []

    for index, candidate in enumerate(CANDIDATE_RESPONSES, start=1):
        sections.append(
            f"Candidate {index}\nreasoning: {candidate['reasoning']}\nanswer: {candidate['answer']}"
        )

    return "\n\n".join(sections)


def _payload() -> dict[str, Any]:
    cot = dspy.ChainOfThought(BasicQA)
    compare = dspy.MultiChainComparison(BasicQA, M=len(CANDIDATE_RESPONSES))

    with dspy.settings.context(lm=DummyLM([*CANDIDATE_RESPONSES, COMPARE_RESPONSE]), trace=[]):
        completions = [cot(question=BASIC_QUESTION) for _ in CANDIDATE_RESPONSES]
        prediction = compare(completions=completions, question=BASIC_QUESTION)
        trace_snapshot = list(dspy.settings.trace)

    return {
        "candidateCount": len(CANDIDATE_RESPONSES),
        "sampleInput": {"question": BASIC_QUESTION},
        "candidateResponses": CANDIDATE_RESPONSES,
        "compareResponse": {
            "reasoning": COMPARE_RESPONSE["rationale"],
            "answer": COMPARE_RESPONSE["answer"],
        },
        "candidateComparisons": _candidate_comparisons(),
        "reasoningAttempts": [_reasoning_attempt(_prediction_dict(completion)) for completion in completions],
        "dspyPredictionKeys": list(_prediction_dict(prediction).keys()),
        "traceEntries": _trace_entry_payloads(trace_snapshot),
    }


def generate(generated_at: str) -> list[dict[str, Any]]:
    return [
        {
            "fixture": "dspy.multiChainComparison.basic",
            "file": "multiChainComparison/basic.json",
            "metadata": metadata(generated_at),
            "payload": _payload(),
        }
    ]
