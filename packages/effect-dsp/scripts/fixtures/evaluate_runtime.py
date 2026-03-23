from __future__ import annotations

from types import SimpleNamespace
from typing import Any

import dspy

from ._common import metadata

EVALUATION_CASES: list[dict[str, str | None]] = [
    {
        "question": "What is the capital of France?",
        "expectedAnswer": "Paris",
        "predictedAnswer": "Paris",
    },
    {
        "question": "What is the capital of Japan?",
        "expectedAnswer": "Tokyo",
        "predictedAnswer": "Kyoto",
    },
    {
        "question": "What is the capital of Canada?",
        "expectedAnswer": None,
        "predictedAnswer": "Ottawa",
    },
]

METRIC_NORMALIZATION_CASES: list[dict[str, Any]] = [
    {
        "name": "boolean-true",
        "raw": {
            "kind": "boolean",
            "value": True,
        },
    },
    {
        "name": "boolean-false",
        "raw": {
            "kind": "boolean",
            "value": False,
        },
    },
    {
        "name": "number-pass-through",
        "raw": {
            "kind": "number",
            "value": 0.75,
        },
    },
    {
        "name": "tuple-feedback-trimmed",
        "raw": {
            "kind": "tuple",
            "value": [0.4, "  Needs citation support  "],
        },
    },
    {
        "name": "tuple-empty-feedback-preserved",
        "raw": {
            "kind": "tuple",
            "value": [0.2, "   "],
        },
    },
]


class FixtureLM(dspy.BaseLM):
    def __init__(self, responses: list[str]):
        super().__init__(model="fixture-evaluate-lm", temperature=0.0, max_tokens=256)
        self._responses = responses
        self._cursor = 0

    def forward(self, prompt: str | None = None, messages: list[dict[str, Any]] | None = None, **kwargs):
        index = min(self._cursor, len(self._responses) - 1)
        self._cursor += 1
        text = self._responses[index]
        choice = SimpleNamespace(message=SimpleNamespace(content=text))

        return SimpleNamespace(choices=[choice], usage={}, model=self.model)


class QASignature(dspy.Signature):
    """Answer questions with short factual answers"""

    question: str = dspy.InputField(desc="The question to answer")
    answer: str = dspy.OutputField(desc="A concise factual answer")


def _qa_completion(answer: str) -> str:
    return f"[[ ## answer ## ]]\n{answer}\n\n[[ ## completed ## ]]"


def _prediction_dict(prediction: Any) -> dict[str, Any]:
    if hasattr(prediction, "toDict"):
        candidate = prediction.toDict()
        if isinstance(candidate, dict):
            return candidate

    if isinstance(prediction, dict):
        return prediction

    if hasattr(prediction, "items") and callable(prediction.items):
        return dict(prediction.items())

    return {}


def _normalize_metric_case(raw: dict[str, Any]) -> dict[str, Any]:
    kind = str(raw["kind"])
    value = raw["value"]

    if kind == "boolean":
        return {
            "score": 1.0 if bool(value) else 0.0,
            "feedback": None,
        }

    if kind == "number":
        return {
            "score": float(value),
            "feedback": None,
        }

    tuple_value = value if isinstance(value, list) else [0.0, ""]
    score = float(tuple_value[0]) if len(tuple_value) > 0 else 0.0
    feedback = str(tuple_value[1]).strip() if len(tuple_value) > 1 else ""

    return {
        "score": score,
        "feedback": feedback,
    }


def _metric_score_feedback_payload() -> dict[str, Any]:
    return {
        "normalizationRules": [
            "boolean metric outputs normalize to numeric {0,1} scores",
            "numeric metric outputs pass through as score values",
            "tuple metric outputs [score, feedback] preserve feedback after trim normalization",
            "empty feedback remains an empty string and is not dropped",
        ],
        "cases": [
            {
                "name": case["name"],
                "raw": case["raw"],
                "normalized": _normalize_metric_case(case["raw"]),
            }
            for case in METRIC_NORMALIZATION_CASES
        ],
    }


def _evaluation_result() -> dspy.EvaluationResult:
    predictor = dspy.Predict(QASignature)
    devset: list[dspy.Example] = []

    for case in EVALUATION_CASES:
        fields: dict[str, Any] = {"question": case["question"]}
        if case["expectedAnswer"] is not None:
            fields["answer"] = case["expectedAnswer"]
        devset.append(dspy.Example(**fields).with_inputs("question"))

    def metric(example: dspy.Example, prediction: Any) -> float:
        expected = str(example.answer).strip().lower()
        observed = str(getattr(prediction, "answer", "")).strip().lower()
        return 1.0 if observed == expected else 0.0

    evaluator = dspy.Evaluate(
        devset=devset,
        metric=metric,
        num_threads=1,
        display_progress=False,
        display_table=False,
        failure_score=0.0,
    )
    completions = [_qa_completion(str(case["predictedAnswer"] or "")) for case in EVALUATION_CASES]

    with dspy.settings.context(lm=FixtureLM(completions)):
        return evaluator(predictor)


def _report_shape_payload(result: dspy.EvaluationResult) -> dict[str, Any]:
    projected_examples: list[dict[str, Any]] = []

    for index, (example, prediction, score) in enumerate(result.results):
        prediction_payload = _prediction_dict(prediction)
        has_expected_answer = hasattr(example, "answer")
        expected_answer = str(example.answer) if has_expected_answer else None
        predicted_answer_value = prediction_payload.get("answer")
        predicted_answer = str(predicted_answer_value) if isinstance(predicted_answer_value, str) else None
        failure = (not has_expected_answer) and predicted_answer is None and float(score) == 0.0

        projected_examples.append(
            {
                "index": index,
                "question": str(example.question),
                "expectedAnswer": expected_answer,
                "predictedAnswer": predicted_answer,
                "score": float(score),
                "failure": failure,
            }
        )

    total_examples = len(projected_examples)
    success_count = sum(1 for example in projected_examples if not example["failure"])
    failure_count = total_examples - success_count
    score_percent = float(result.score)
    score_fraction = round(score_percent / 100.0, 4)
    successful_scores = [float(example["score"]) for example in projected_examples if not bool(example["failure"])]
    successful_score_fraction = (
        round(sum(successful_scores) / len(successful_scores), 4)
        if len(successful_scores) > 0
        else 0.0
    )

    return {
        "resultTupleLength": 3,
        "totalExamples": total_examples,
        "successCount": success_count,
        "failureCount": failure_count,
        "scorePercent": score_percent,
        "scoreFraction": score_fraction,
        "successfulScoreFraction": successful_score_fraction,
        "examples": projected_examples,
    }


def _event_order_payload(report: dict[str, Any]) -> dict[str, Any]:
    total_examples = int(report["totalExamples"])
    examples = report["examples"]
    events: list[dict[str, Any]] = []

    for example in examples:
        events.append(
            {
                "_tag": "ExampleStarted",
                "index": int(example["index"]),
                "total": total_examples,
            }
        )

        if bool(example["failure"]):
            events.append(
                {
                    "_tag": "ExampleFailed",
                    "index": int(example["index"]),
                }
            )
        else:
            events.append(
                {
                    "_tag": "ExampleCompleted",
                    "index": int(example["index"]),
                    "score": float(example["score"]),
                }
            )

    events.append(
        {
            "_tag": "EvaluationCompleted",
            "overallScore": float(report["successfulScoreFraction"]),
            "total": total_examples,
        }
    )

    return {
        "eventCount": len(events),
        "completedIndices": [int(example["index"]) for example in examples if not bool(example["failure"])],
        "failedIndices": [int(example["index"]) for example in examples if bool(example["failure"])],
        "events": events,
    }


def generate(generated_at: str) -> list[dict[str, Any]]:
    evaluation_result = _evaluation_result()
    report_payload = _report_shape_payload(evaluation_result)

    return [
        {
            "fixture": "dspy.evaluate.report-shape.basic",
            "file": "evaluate/report-shape.basic.json",
            "metadata": metadata(generated_at),
            "payload": report_payload,
        },
        {
            "fixture": "dspy.evaluate.event-order.basic",
            "file": "evaluate/event-order.basic.json",
            "metadata": metadata(generated_at),
            "payload": _event_order_payload(report_payload),
        },
        {
            "fixture": "dspy.metric.score-feedback.contract",
            "file": "metric/score-feedback.contract.json",
            "metadata": metadata(generated_at),
            "payload": _metric_score_feedback_payload(),
        },
    ]
