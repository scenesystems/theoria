from __future__ import annotations

import json
from typing import Any

import dspy
from dspy.utils import DummyLM

from ._common import metadata

BASIC_QUESTION = "What is 1+1?"
SUCCESS_GENERATED_CODE = "```python\nresult = 1 + 1\nSUBMIT({'answer': result})\n```"
BROKEN_GENERATED_CODE = "```python\nresult = 1 + 0 / 0\nSUBMIT({'answer': result})\n```"
PARSE_ERROR_GENERATED_CODE = "```python\ninvalid=python=code\n```"

SUCCESS_PARSED_CODE = "result = 1 + 1\nSUBMIT({'answer': result})"
BROKEN_PARSED_CODE = "result = 1 + 0 / 0\nSUBMIT({'answer': result})"
EXECUTION_ERROR = "ZeroDivisionError: division by zero"
CODE_OUTPUT = json.dumps({"answer": 2})

SUCCESS_GENERATE_RESPONSE = {
    "reasoning": "Represent the arithmetic as executable Python and submit the computed answer.",
    "generated_code": SUCCESS_GENERATED_CODE,
}
SUCCESS_ANSWER_RESPONSE = {
    "reasoning": "The executed program computed the answer directly.",
    "answer": "2",
}
REPAIR_GENERATE_RESPONSE = {
    "reasoning": "The first program attempts the computation but contains a division-by-zero error.",
    "generated_code": BROKEN_GENERATED_CODE,
}
REPAIR_RESPONSE = {
    "reasoning": "Remove the failing division so the computation completes deterministically.",
    "generated_code": SUCCESS_GENERATED_CODE,
}
PARSE_ERROR_RESPONSE = {
    "reasoning": "This malformed single-line assignment should fail the ProgramOfThought parser.",
    "generated_code": PARSE_ERROR_GENERATED_CODE,
}


class BasicQA(dspy.Signature):
    question = dspy.InputField()
    answer = dspy.OutputField(desc="often between 1 and 5 words")


class StubInterpreter:
    def __init__(self, *, failures: dict[str, str], successes: dict[str, Any]):
        self._failures = failures
        self._successes = successes
        self.calls: list[str] = []

    def execute(self, code: str) -> Any:
        self.calls.append(code)

        if code in self._failures:
            raise RuntimeError(self._failures[code])

        if code in self._successes:
            return self._successes[code]

        raise RuntimeError(f"Unexpected code: {code}")

    def shutdown(self) -> None:
        return None


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


def _success_payload() -> dict[str, Any]:
    interpreter = StubInterpreter(failures={}, successes={SUCCESS_PARSED_CODE: {"answer": 2}})
    pot = dspy.ProgramOfThought(BasicQA, interpreter=interpreter)

    with dspy.settings.context(lm=DummyLM([SUCCESS_GENERATE_RESPONSE, SUCCESS_ANSWER_RESPONSE]), trace=[]):
        prediction = pot(question=BASIC_QUESTION)
        trace_snapshot = list(dspy.settings.trace)

    return {
        "maxIterations": 3,
        "sampleInput": {"question": BASIC_QUESTION},
        "responses": {
            "generate": SUCCESS_GENERATE_RESPONSE,
            "answer": SUCCESS_ANSWER_RESPONSE,
        },
        "codeOutput": CODE_OUTPUT,
        "dspyPredictionKeys": list(_prediction_dict(prediction).keys()),
        "traceEntries": _trace_entry_payloads(trace_snapshot),
    }


def _repair_payload() -> dict[str, Any]:
    interpreter = StubInterpreter(
        failures={BROKEN_PARSED_CODE: EXECUTION_ERROR},
        successes={SUCCESS_PARSED_CODE: {"answer": 2}},
    )
    pot = dspy.ProgramOfThought(BasicQA, interpreter=interpreter)

    with dspy.settings.context(
        lm=DummyLM([REPAIR_GENERATE_RESPONSE, REPAIR_RESPONSE, SUCCESS_ANSWER_RESPONSE]),
        trace=[],
    ):
        prediction = pot(question=BASIC_QUESTION)
        trace_snapshot = list(dspy.settings.trace)

    return {
        "maxIterations": 3,
        "sampleInput": {"question": BASIC_QUESTION},
        "responses": {
            "generate": REPAIR_GENERATE_RESPONSE,
            "repair": REPAIR_RESPONSE,
            "answer": SUCCESS_ANSWER_RESPONSE,
        },
        "executionError": EXECUTION_ERROR,
        "codeOutput": CODE_OUTPUT,
        "dspyPredictionKeys": list(_prediction_dict(prediction).keys()),
        "traceEntries": _trace_entry_payloads(trace_snapshot),
    }


def _parse_error_payload() -> dict[str, Any]:
    pot = dspy.ProgramOfThought(BasicQA, max_iters=3, interpreter=StubInterpreter(failures={}, successes={}))
    _code, error = pot._parse_code(PARSE_ERROR_RESPONSE)

    return {
        "maxIterations": 3,
        "responses": {
            "generate": PARSE_ERROR_RESPONSE,
        },
        "expectedError": error,
    }


def generate(generated_at: str) -> list[dict[str, Any]]:
    return [
        {
            "fixture": "dspy.pot.success.basic",
            "file": "pot/success.basic.json",
            "metadata": metadata(generated_at),
            "payload": _success_payload(),
        },
        {
            "fixture": "dspy.pot.repair-cycle.basic",
            "file": "pot/repair-cycle.basic.json",
            "metadata": metadata(generated_at),
            "payload": _repair_payload(),
        },
        {
            "fixture": "dspy.pot.parse-error.basic",
            "file": "pot/parse-error.basic.json",
            "metadata": metadata(generated_at),
            "payload": _parse_error_payload(),
        },
    ]
