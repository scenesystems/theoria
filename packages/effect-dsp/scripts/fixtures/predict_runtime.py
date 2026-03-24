from __future__ import annotations

from types import SimpleNamespace
from typing import Any

import dspy

from ._common import metadata

SAMPLE_QUESTION = "What is the capital of France?"
SAMPLE_ANSWER = "Paris"
SAMPLE_REASONING = "Because Paris is the capital city of France."

ISOLATION_SEED = 0
ISOLATION_SCOPES = [
    {
        "scope": "scope-a",
        "question": "What is the capital of France?",
        "answer": "Paris",
    },
    {
        "scope": "scope-b",
        "question": "What is the capital of Japan?",
        "answer": "Tokyo",
    },
]


class FixtureLM(dspy.BaseLM):
    def __init__(self, responses: list[str]):
        super().__init__(model="fixture-lm", temperature=0.0, max_tokens=256)
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


def _cot_completion(reasoning: str, answer: str) -> str:
    return f"[[ ## reasoning ## ]]\n{reasoning}\n\n[[ ## answer ## ]]\n{answer}\n\n[[ ## completed ## ]]"


def _prediction_dict(prediction: Any) -> dict[str, Any]:
    if hasattr(prediction, "toDict"):
        candidate = prediction.toDict()
        if isinstance(candidate, dict):
            return candidate

    if isinstance(prediction, dict):
        return prediction

    return {}


def _trace_entry_payload(trace: list[Any]) -> dict[str, Any]:
    if len(trace) == 0:
        return {
            "traceEntryTupleLength": 0,
            "moduleClassName": "",
            "moduleOutputFieldOrder": [],
            "inputKeys": [],
            "predictionKeys": [],
            "sampleInput": {},
            "samplePrediction": {},
        }

    entry = trace[0]
    if not isinstance(entry, tuple) or len(entry) != 3:
        return {
            "traceEntryTupleLength": len(entry) if isinstance(entry, tuple) else 0,
            "moduleClassName": "",
            "moduleOutputFieldOrder": [],
            "inputKeys": [],
            "predictionKeys": [],
            "sampleInput": {},
            "samplePrediction": {},
        }

    module = entry[0]
    inputs = entry[1] if isinstance(entry[1], dict) else {}
    prediction = _prediction_dict(entry[2])

    signature = getattr(module, "signature", None)
    output_fields = getattr(signature, "output_fields", {})
    output_field_order = list(output_fields.keys()) if hasattr(output_fields, "keys") else []

    return {
        "traceEntryTupleLength": len(entry),
        "moduleClassName": module.__class__.__name__,
        "moduleOutputFieldOrder": output_field_order,
        "inputKeys": list(inputs.keys()),
        "predictionKeys": list(prediction.keys()),
        "sampleInput": inputs,
        "samplePrediction": prediction,
    }


def _cot_reasoning_payload() -> dict[str, Any]:
    cot = dspy.ChainOfThought(QASignature)
    reasoning_field = cot.predict.signature.output_fields["reasoning"]

    with dspy.settings.context(lm=FixtureLM([_cot_completion(SAMPLE_REASONING, SAMPLE_ANSWER)]), trace=[]):
        prediction = cot(question=SAMPLE_QUESTION)
        trace_snapshot = list(dspy.settings.trace)

    trace_projection = _trace_entry_payload(trace_snapshot)

    return {
        "reasoningFieldName": "reasoning",
        "outputFieldOrder": list(cot.predict.signature.output_fields.keys()),
        "reasoningFieldDescription": str(reasoning_field.json_schema_extra.get("desc", "")),
        "reasoningFieldPrefix": str(reasoning_field.json_schema_extra.get("prefix", "")),
        "sampleInput": {
            "question": SAMPLE_QUESTION,
        },
        "sampleOutput": _prediction_dict(prediction),
        "traceLength": len(trace_snapshot),
        "traceInputKeys": trace_projection["inputKeys"],
        "tracePredictionKeys": trace_projection["predictionKeys"],
    }


def _trace_entry_shape_payload() -> dict[str, Any]:
    predictor = dspy.Predict(QASignature)

    with dspy.settings.context(lm=FixtureLM([_qa_completion(SAMPLE_ANSWER)]), trace=[]):
        predictor(question=SAMPLE_QUESTION)
        trace_snapshot = list(dspy.settings.trace)

    return _trace_entry_payload(trace_snapshot)


def _trace_isolation_payload() -> dict[str, Any]:
    predictor = dspy.Predict(QASignature)

    runs: list[dict[str, Any]] = []
    for scope in ISOLATION_SCOPES:
        with dspy.settings.context(lm=FixtureLM([_qa_completion(scope["answer"])]), trace=[]):
            prediction = predictor(question=scope["question"])
            trace_snapshot = list(dspy.settings.trace)

        trace_projection = _trace_entry_payload(trace_snapshot)
        trace_input_question = str(trace_projection["sampleInput"].get("question", ""))

        runs.append(
            {
                "scope": scope["scope"],
                "question": scope["question"],
                "expectedAnswer": scope["answer"],
                "observedAnswer": str(_prediction_dict(prediction).get("answer", "")),
                "traceLength": len(trace_snapshot),
                "traceInputQuestion": trace_input_question,
                "tracePredictionKeys": trace_projection["predictionKeys"],
            }
        )

    cross_scope_leak = any(
        run["traceLength"] != 1 or run["traceInputQuestion"] != run["question"]
        for run in runs
    )

    return {
        "seed": ISOLATION_SEED,
        "scopeRuns": runs,
        "crossScopeTraceLeakDetected": cross_scope_leak,
    }


def generate(generated_at: str) -> list[dict[str, Any]]:
    return [
        {
            "fixture": "dspy.cot.reasoning-field.basic",
            "file": "cot/reasoning-field.basic.json",
            "metadata": metadata(generated_at),
            "payload": _cot_reasoning_payload(),
        },
        {
            "fixture": "dspy.trace.entry-shape.basic",
            "file": "trace/entry-shape.basic.json",
            "metadata": metadata(generated_at),
            "payload": _trace_entry_shape_payload(),
        },
        {
            "fixture": "dspy.trace.fiber-isolation.seed-0",
            "file": "trace/fiber-isolation.seed-0.json",
            "metadata": metadata(generated_at),
            "payload": _trace_isolation_payload(),
        },
    ]
