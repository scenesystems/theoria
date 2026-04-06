#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = [
#   "dspy-ai==3.1.3",
# ]
# [tool.uv]
# exclude-newer = "2026-03-18T00:00:00Z"
# ///
"""Verify committed DSPy fixtures against live DSPy behavior."""

from __future__ import annotations

import json
import math
import re
import sys
from pathlib import Path
from typing import Any

import dspy

from fixtures import bootstrap_family, evaluate_runtime, gepa, mipro_v2, multi_chain_comparison, predict_runtime, program_of_thought
from fixtures._common import (
    DEFAULT_GENERATED_AT,
    GENERATOR_SCRIPT,
    GENERATOR_VERSION,
    PYTHON_VERSION,
    SCHEMA_VERSION,
    UPSTREAM_NAME,
    UPSTREAM_VERSION,
)

FIXTURE_DIR = Path("test/fixtures/dspy")
MANIFEST_PATH = FIXTURE_DIR / "manifest.json"
FIELD_MARKER_RE = re.compile(r"\[\[\s*##\s*[^#\]]+\s*##\s*\]\]")
FIELD_HEADER_PATTERN = re.compile(r"\[\[\s*##\s*(\w+)\s*##\s*\]\]")

BASIC_QUERY = "What is the capital of Japan?"
BASIC_DEMO = {
    "question": "What is the capital of France?",
    "answer": "Paris",
}
PARSE_COMPLETION = "Tokyo"


class QASignature(dspy.Signature):
    """Answer questions with short factual answers"""

    question: str = dspy.InputField(desc="The question to answer")
    answer: str = dspy.OutputField(desc="A concise factual answer")


def assert_runtime_version() -> list[str]:
    runtime_version = getattr(dspy, "__version__", "unknown")
    if runtime_version == UPSTREAM_VERSION:
        return []

    return [
        (
            "dspy runtime drift detected: "
            f"expected {UPSTREAM_VERSION}, got {runtime_version}. "
            "Run `bun run fixtures:lock` and commit updated lockfiles if upgrading DSPy."
        )
    ]


def load_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def unique_markers(messages: list[dict[str, Any]]) -> list[str]:
    seen: set[str] = set()
    markers: list[str] = []

    for message in messages:
        content = str(message.get("content", ""))
        for marker in FIELD_MARKER_RE.findall(content):
            if marker in seen:
                continue

            seen.add(marker)
            markers.append(marker)

    return markers


def chat_sections(completion: str) -> list[dict[str, Any]]:
    sections: list[tuple[str | None, list[str]]] = [(None, [])]

    for line in completion.splitlines():
        match = FIELD_HEADER_PATTERN.match(line.strip())
        if match:
            header = match.group(1)
            remaining_content = line[match.end() :].strip()
            sections.append((header, [remaining_content] if remaining_content else []))
        else:
            sections[-1][1].append(line)

    return [
        {
            "header": header,
            "content": "\n".join(lines).strip(),
        }
        for header, lines in sections
    ]


def is_fallback_eligible(error_type: str, use_json_adapter_fallback: bool, is_json_adapter: bool) -> bool:
    return (
        error_type != "ContextWindowExceededError"
        and not is_json_adapter
        and use_json_adapter_fallback
    )


def render_signature_fields(fields: dict[str, Any]) -> list[dict[str, str]]:
    rendered: list[dict[str, str]] = []

    for name, info in fields.items():
        annotation = getattr(info, "annotation", str)
        type_name = getattr(annotation, "__name__", str(annotation))
        extras = getattr(info, "json_schema_extra", None)
        description = ""

        if isinstance(extras, dict):
            description = str(extras.get("desc", ""))

        rendered.append(
            {
                "name": str(name),
                "type": str(type_name),
                "description": description,
            }
        )

    return rendered


def expected_metadata(generated_at: str) -> dict[str, Any]:
    return {
        "generatedAt": generated_at,
        "upstream": {
            "name": UPSTREAM_NAME,
            "version": UPSTREAM_VERSION,
        },
        "generator": {
            "script": GENERATOR_SCRIPT,
            "version": GENERATOR_VERSION,
        },
    }


def fixture_file_path(doc: dict[str, Any]) -> str:
    if "file" in doc:
        return str(doc["file"])

    return f"{doc['fixture']}.json"


def expected_qa_payload(
    adapter: dspy.ChatAdapter,
    query: str,
    demo: dict[str, str] | None,
) -> dict[str, Any]:
    demos = [demo] if demo is not None else []
    messages = adapter.format(QASignature, demos=demos, inputs={"question": query})

    return {
        "signatureDescription": str(QASignature.instructions),
        "inputFields": render_signature_fields(QASignature.input_fields),
        "outputFields": render_signature_fields(QASignature.output_fields),
        "query": query,
        "demo": demo,
        "messages": messages,
        "fieldMarkers": unique_markers(messages),
        "outputRequirements": adapter.user_message_output_requirements(QASignature),
    }


def expected_system_message_payload(adapter: dspy.ChatAdapter) -> dict[str, Any]:
    messages = adapter.format(QASignature, demos=[], inputs={"question": BASIC_QUERY})
    system_message = str(messages[0]["content"])

    return {
        "fieldDescription": adapter.format_field_description(QASignature),
        "fieldStructure": adapter.format_field_structure(QASignature),
        "taskDescription": adapter.format_task_description(QASignature),
        "systemMessage": system_message,
        "requiredMarkers": unique_markers([{"content": system_message}]),
    }


def expected_output_requirements_payload(adapter: dspy.ChatAdapter) -> dict[str, Any]:
    messages = adapter.format(QASignature, demos=[], inputs={"question": BASIC_QUERY})

    return {
        "outputRequirements": adapter.user_message_output_requirements(QASignature),
        "finalUserMessage": str(messages[-1]["content"]),
        "requiredMarkers": [
            "[[ ## answer ## ]]",
            "[[ ## completed ## ]]",
        ],
    }


def expected_qa_output_requirements_payload(adapter: dspy.ChatAdapter) -> dict[str, Any]:
    basic = expected_qa_payload(adapter, BASIC_QUERY, None)
    with_demo = expected_qa_payload(adapter, BASIC_QUERY, BASIC_DEMO)

    return {
        "signatureDescription": basic["signatureDescription"],
        "inputFields": basic["inputFields"],
        "outputFields": basic["outputFields"],
        "fieldMarkers": basic["fieldMarkers"],
        "basic": {
            "query": basic["query"],
            "messages": basic["messages"],
            "outputRequirements": basic["outputRequirements"],
        },
        "withDemo": {
            "query": with_demo["query"],
            "demo": with_demo["demo"],
            "messages": with_demo["messages"],
            "outputRequirements": with_demo["outputRequirements"],
        },
    }


def expected_parse_sections_payload(adapter: dspy.ChatAdapter) -> dict[str, Any]:
    completion = adapter.format_assistant_message_content(
        QASignature,
        {"answer": PARSE_COMPLETION},
    )

    return {
        "fieldHeaderPattern": FIELD_HEADER_PATTERN.pattern,
        "completion": completion,
        "sections": chat_sections(completion),
        "parsed": adapter.parse(QASignature, completion),
        "expectedOutputFields": list(QASignature.output_fields.keys()),
    }


def expected_parse_fallback_payload() -> dict[str, Any]:
    fallback_cases = [
        {
            "name": "generic-exception-fallback-enabled",
            "errorType": "Exception",
            "useJsonAdapterFallback": True,
            "isJsonAdapter": False,
        },
        {
            "name": "context-window-exceeded-disables-fallback",
            "errorType": "ContextWindowExceededError",
            "useJsonAdapterFallback": True,
            "isJsonAdapter": False,
        },
        {
            "name": "json-adapter-instance-disables-fallback",
            "errorType": "Exception",
            "useJsonAdapterFallback": True,
            "isJsonAdapter": True,
        },
        {
            "name": "fallback-flag-disabled",
            "errorType": "Exception",
            "useJsonAdapterFallback": False,
            "isJsonAdapter": False,
        },
    ]

    return {
        "cases": [
            {
                "name": case["name"],
                "errorType": case["errorType"],
                "useJsonAdapterFallback": case["useJsonAdapterFallback"],
                "isJsonAdapter": case["isJsonAdapter"],
                "fallbackEligible": is_fallback_eligible(
                    case["errorType"],
                    case["useJsonAdapterFallback"],
                    case["isJsonAdapter"],
                ),
            }
            for case in fallback_cases
        ]
    }


def expected_fixtures(generated_at: str) -> dict[str, dict[str, Any]]:
    adapter = dspy.ChatAdapter()

    fixtures = {
        "dspy.chat.qa-basic": {
            "file": "chat/qa-basic.json",
            "document": {
                "fixture": "dspy.chat.qa-basic",
                "metadata": expected_metadata(generated_at),
                "payload": expected_qa_payload(adapter, BASIC_QUERY, None),
            },
        },
        "dspy.chat.qa-with-demo": {
            "file": "chat/qa-with-demo.json",
            "document": {
                "fixture": "dspy.chat.qa-with-demo",
                "metadata": expected_metadata(generated_at),
                "payload": expected_qa_payload(adapter, BASIC_QUERY, BASIC_DEMO),
            },
        },
        "dspy.chat.system-message.basic": {
            "file": "chat/system-message.basic.json",
            "document": {
                "fixture": "dspy.chat.system-message.basic",
                "metadata": expected_metadata(generated_at),
                "payload": expected_system_message_payload(adapter),
            },
        },
        "dspy.chat.output-requirements.basic": {
            "file": "chat/output-requirements.basic.json",
            "document": {
                "fixture": "dspy.chat.output-requirements.basic",
                "metadata": expected_metadata(generated_at),
                "payload": expected_output_requirements_payload(adapter),
            },
        },
        "dspy.chat.qa-output-requirements": {
            "file": "chat/qa-output-requirements.json",
            "document": {
                "fixture": "dspy.chat.qa-output-requirements",
                "metadata": expected_metadata(generated_at),
                "payload": expected_qa_output_requirements_payload(adapter),
            },
        },
        "dspy.chat.parse-sections.basic": {
            "file": "chat/parse-sections.basic.json",
            "document": {
                "fixture": "dspy.chat.parse-sections.basic",
                "metadata": expected_metadata(generated_at),
                "payload": expected_parse_sections_payload(adapter),
            },
        },
        "dspy.chat.parse-fallback.contract": {
            "file": "chat/parse-fallback.contract.json",
            "document": {
                "fixture": "dspy.chat.parse-fallback.contract",
                "metadata": expected_metadata(generated_at),
                "payload": expected_parse_fallback_payload(),
            },
        },
    }

    for doc in predict_runtime.generate(generated_at):
        fixtures[str(doc["fixture"])] = {
            "file": fixture_file_path(doc),
            "document": {k: v for k, v in doc.items() if k != "file"},
        }

    for doc in program_of_thought.generate(generated_at):
        fixtures[str(doc["fixture"])] = {
            "file": fixture_file_path(doc),
            "document": {k: v for k, v in doc.items() if k != "file"},
        }

    for doc in multi_chain_comparison.generate(generated_at):
        fixtures[str(doc["fixture"])] = {
            "file": fixture_file_path(doc),
            "document": {k: v for k, v in doc.items() if k != "file"},
        }

    for doc in evaluate_runtime.generate(generated_at):
        fixtures[str(doc["fixture"])] = {
            "file": fixture_file_path(doc),
            "document": {k: v for k, v in doc.items() if k != "file"},
        }

    for doc in bootstrap_family.generate(generated_at):
        fixtures[str(doc["fixture"])] = {
            "file": fixture_file_path(doc),
            "document": {k: v for k, v in doc.items() if k != "file"},
        }

    for doc in mipro_v2.generate(generated_at):
        fixtures[str(doc["fixture"])] = {
            "file": fixture_file_path(doc),
            "document": {k: v for k, v in doc.items() if k != "file"},
        }

    for doc in gepa.generate(generated_at):
        fixtures[str(doc["fixture"])] = {
            "file": fixture_file_path(doc),
            "document": {k: v for k, v in doc.items() if k != "file"},
        }

    return fixtures


def verify_predict_runtime_contracts(name: str, document: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    payload = document.get("payload")

    if not isinstance(payload, dict):
        return [f"{name}: payload is missing or invalid"]

    if name == "dspy.cot.reasoning-field.basic":
        output_field_order = payload.get("outputFieldOrder")
        trace_prediction_keys = payload.get("tracePredictionKeys")

        if payload.get("reasoningFieldName") != "reasoning":
            errors.append(f"{name}: reasoningFieldName must be 'reasoning'")

        if not isinstance(output_field_order, list) or len(output_field_order) == 0:
            errors.append(f"{name}: outputFieldOrder must contain reasoning + answer fields")
        elif output_field_order[0] != "reasoning":
            errors.append(f"{name}: outputFieldOrder must start with 'reasoning'")

        if not isinstance(trace_prediction_keys, list) or "reasoning" not in trace_prediction_keys:
            errors.append(f"{name}: tracePredictionKeys must include 'reasoning'")

    if name == "dspy.trace.entry-shape.basic":
        tuple_length = payload.get("traceEntryTupleLength")
        input_keys = payload.get("inputKeys")
        prediction_keys = payload.get("predictionKeys")

        if tuple_length != 3:
            errors.append(f"{name}: traceEntryTupleLength must be 3")

        if not isinstance(input_keys, list) or "question" not in input_keys:
            errors.append(f"{name}: inputKeys must include 'question'")

        if not isinstance(prediction_keys, list) or "answer" not in prediction_keys:
            errors.append(f"{name}: predictionKeys must include 'answer'")

    if name == "dspy.trace.fiber-isolation.seed-0":
        scope_runs = payload.get("scopeRuns")

        if payload.get("crossScopeTraceLeakDetected"):
            errors.append(f"{name}: crossScopeTraceLeakDetected must be false")

        if not isinstance(scope_runs, list) or len(scope_runs) == 0:
            errors.append(f"{name}: scopeRuns must include at least one scope")
            return errors

        for index, run in enumerate(scope_runs):
            if not isinstance(run, dict):
                errors.append(f"{name}: scopeRuns[{index}] must be an object")
                continue

            if run.get("traceLength") != 1:
                errors.append(f"{name}: scopeRuns[{index}] traceLength must be 1")

            if run.get("traceInputQuestion") != run.get("question"):
                errors.append(f"{name}: scopeRuns[{index}] traceInputQuestion must match question")

    return errors


def verify_program_of_thought_contracts(name: str, document: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    payload = document.get("payload")

    if not isinstance(payload, dict):
        return [f"{name}: payload is missing or invalid"]

    if name == "dspy.pot.success.basic":
        trace_entries = payload.get("traceEntries")
        prediction_keys = payload.get("dspyPredictionKeys")

        if payload.get("codeOutput") != '{"answer": 2}':
            errors.append(f"{name}: codeOutput must be the submitted answer JSON")

        if not isinstance(trace_entries, list) or len(trace_entries) != 2:
            errors.append(f"{name}: traceEntries must contain the generate and answer phases")
        elif "generated_code" not in trace_entries[0].get("predictionKeys", []):
            errors.append(f"{name}: first trace entry must expose generated_code")

        if not isinstance(prediction_keys, list) or "reasoning" not in prediction_keys or "answer" not in prediction_keys:
            errors.append(f"{name}: dspyPredictionKeys must include reasoning and answer")

    if name == "dspy.pot.repair-cycle.basic":
        trace_entries = payload.get("traceEntries")

        if payload.get("executionError") != "ZeroDivisionError: division by zero":
            errors.append(f"{name}: executionError must preserve the deterministic repair message")

        if not isinstance(trace_entries, list) or len(trace_entries) != 3:
            errors.append(f"{name}: traceEntries must contain generate, repair, and answer phases")
        elif "previous_code" not in trace_entries[1].get("inputKeys", []) or "error" not in trace_entries[1].get("inputKeys", []):
            errors.append(f"{name}: repair trace entry must include previous_code and error inputs")

    if name == "dspy.pot.parse-error.basic" and payload.get("expectedError") != "Error: Code format is not correct.":
        errors.append(f"{name}: expectedError must match DSPy parse-code diagnostics")

    return errors


def verify_multi_chain_comparison_contracts(name: str, document: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    payload = document.get("payload")

    if not isinstance(payload, dict):
        return [f"{name}: payload is missing or invalid"]

    if name == "dspy.multiChainComparison.basic":
        candidate_count = payload.get("candidateCount")
        candidate_responses = payload.get("candidateResponses")
        reasoning_attempts = payload.get("reasoningAttempts")
        trace_entries = payload.get("traceEntries")
        prediction_keys = payload.get("dspyPredictionKeys")
        candidate_comparisons = payload.get("candidateComparisons")

        if not isinstance(candidate_responses, list) or candidate_count != len(candidate_responses):
            errors.append(f"{name}: candidateCount must equal candidateResponses length")

        if not isinstance(reasoning_attempts, list) or candidate_count != len(reasoning_attempts):
            errors.append(f"{name}: reasoningAttempts must match the candidate count")

        if not isinstance(trace_entries, list) or len(trace_entries) != candidate_count + 1:
            errors.append(f"{name}: traceEntries must contain each candidate plus one final comparison pass")

        if not isinstance(prediction_keys, list) or "rationale" not in prediction_keys or "answer" not in prediction_keys:
            errors.append(f"{name}: dspyPredictionKeys must include rationale and answer")

        if not isinstance(candidate_comparisons, str) or "Candidate 1" not in candidate_comparisons:
            errors.append(f"{name}: candidateComparisons must preserve ordered candidate summaries")

    return errors


def verify_evaluate_runtime_contracts(name: str, document: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    payload = document.get("payload")

    if not isinstance(payload, dict):
        return [f"{name}: payload is missing or invalid"]

    if name == "dspy.evaluate.report-shape.basic":
        examples = payload.get("examples")
        total_examples = payload.get("totalExamples")
        success_count = payload.get("successCount")
        failure_count = payload.get("failureCount")
        score_percent = payload.get("scorePercent")
        score_fraction = payload.get("scoreFraction")
        successful_score_fraction = payload.get("successfulScoreFraction")

        if payload.get("resultTupleLength") != 3:
            errors.append(f"{name}: resultTupleLength must be 3")

        if not isinstance(examples, list):
            errors.append(f"{name}: examples must be an array")
            return errors

        if total_examples != len(examples):
            errors.append(f"{name}: totalExamples must equal examples length")

        if not isinstance(success_count, int) or not isinstance(failure_count, int) or not isinstance(total_examples, int):
            errors.append(f"{name}: successCount/failureCount/totalExamples must be integers")
        elif success_count + failure_count != total_examples:
            errors.append(f"{name}: successCount + failureCount must equal totalExamples")

        if isinstance(score_percent, (int, float)) and isinstance(score_fraction, (int, float)):
            expected_fraction = round(float(score_percent) / 100.0, 4)
            if float(score_fraction) != expected_fraction:
                errors.append(f"{name}: scoreFraction must equal rounded scorePercent/100")
        else:
            errors.append(f"{name}: scorePercent and scoreFraction must be numeric")

        if not isinstance(successful_score_fraction, (int, float)):
            errors.append(f"{name}: successfulScoreFraction must be numeric")
        else:
            successful_examples = [example for example in examples if isinstance(example, dict) and not bool(example.get("failure"))]
            successful_scores = [float(example.get("score", 0.0)) for example in successful_examples]
            expected_successful_fraction = (
                round(sum(successful_scores) / len(successful_scores), 4)
                if len(successful_scores) > 0
                else 0.0
            )

            if float(successful_score_fraction) != expected_successful_fraction:
                errors.append(f"{name}: successfulScoreFraction must equal average successful score")

        indices = [example.get("index") for example in examples if isinstance(example, dict)]
        if indices != list(range(len(indices))):
            errors.append(f"{name}: example indices must be contiguous and zero-based")

    if name == "dspy.evaluate.event-order.basic":
        events = payload.get("events")

        if not isinstance(events, list):
            errors.append(f"{name}: events must be an array")
            return errors

        if payload.get("eventCount") != len(events):
            errors.append(f"{name}: eventCount must equal events length")

        if len(events) == 0 or not isinstance(events[-1], dict) or events[-1].get("_tag") != "EvaluationCompleted":
            errors.append(f"{name}: final event must be EvaluationCompleted")

        started = [event for event in events if isinstance(event, dict) and event.get("_tag") == "ExampleStarted"]
        completed = [event for event in events if isinstance(event, dict) and event.get("_tag") == "ExampleCompleted"]
        failed = [event for event in events if isinstance(event, dict) and event.get("_tag") == "ExampleFailed"]

        if len(started) != len(completed) + len(failed):
            errors.append(f"{name}: each started example must terminate as completed or failed")

        completed_indices = [event.get("index") for event in completed]
        failed_indices = [event.get("index") for event in failed]

        if payload.get("completedIndices") != completed_indices:
            errors.append(f"{name}: completedIndices must match ExampleCompleted events")

        if payload.get("failedIndices") != failed_indices:
            errors.append(f"{name}: failedIndices must match ExampleFailed events")

        if len(events) > 0 and isinstance(events[-1], dict) and events[-1].get("_tag") == "EvaluationCompleted":
            completion_score = events[-1].get("overallScore")
            completed_scores = [float(event.get("score", 0.0)) for event in completed]
            expected_completion_score = (
                round(sum(completed_scores) / len(completed_scores), 4)
                if len(completed_scores) > 0
                else 0.0
            )

            if completion_score != expected_completion_score:
                errors.append(f"{name}: EvaluationCompleted.overallScore must equal average completed score")

    if name == "dspy.metric.score-feedback.contract":
        cases = payload.get("cases")

        if not isinstance(cases, list) or len(cases) == 0:
            errors.append(f"{name}: cases must include at least one normalization case")
            return errors

        for index, case in enumerate(cases):
            if not isinstance(case, dict):
                errors.append(f"{name}: cases[{index}] must be an object")
                continue

            raw = case.get("raw")
            normalized = case.get("normalized")

            if not isinstance(raw, dict) or not isinstance(normalized, dict):
                errors.append(f"{name}: cases[{index}] must include raw and normalized objects")
                continue

            kind = raw.get("kind")
            score = normalized.get("score")
            feedback = normalized.get("feedback")

            if kind == "boolean":
                expected_score = 1.0 if bool(raw.get("value")) else 0.0
                if score != expected_score:
                    errors.append(f"{name}: cases[{index}] boolean score normalization mismatch")
                if feedback is not None:
                    errors.append(f"{name}: cases[{index}] boolean feedback must be null")
                continue

            if kind == "number":
                expected_score = float(raw.get("value"))
                if score != expected_score:
                    errors.append(f"{name}: cases[{index}] numeric score normalization mismatch")
                if feedback is not None:
                    errors.append(f"{name}: cases[{index}] numeric feedback must be null")
                continue

            if kind == "tuple":
                raw_tuple = raw.get("value")
                if not isinstance(raw_tuple, list) or len(raw_tuple) < 2:
                    errors.append(f"{name}: cases[{index}] tuple value must include [score, feedback]")
                    continue

                expected_score = float(raw_tuple[0])
                expected_feedback = str(raw_tuple[1]).strip()

                if score != expected_score:
                    errors.append(f"{name}: cases[{index}] tuple score normalization mismatch")
                if feedback != expected_feedback:
                    errors.append(f"{name}: cases[{index}] tuple feedback normalization mismatch")
                continue

            errors.append(f"{name}: cases[{index}] has unknown raw.kind {kind}")

    return errors

def normalize_seed(seed: int) -> int:
    finite = abs(int(seed))
    return 1 if finite <= 0 else finite

def next_pseudo_seed(seed: int) -> int:
    return ((seed * 1664525) + 1013904223) % 4294967296

def expected_labeled_questions(trainset: list[dict[str, Any]], k: int, seed: int) -> list[str]:
    normalized_k = max(0, int(k))
    scored: list[dict[str, int | str]] = []
    cursor = normalize_seed(seed)

    for entry in trainset:
        cursor = next_pseudo_seed(cursor)
        scored.append(
            {
                "score": cursor,
                "question": str(entry.get("question", "")),
            }
        )

    sorted_scored = sorted(scored, key=lambda item: int(item["score"]))
    return [str(item["question"]) for item in sorted_scored[:normalized_k]]

def majority_vote_answer(answers: list[str]) -> str | None:
    if len(answers) == 0:
        return None

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

def verify_bootstrap_family_contracts(name: str, document: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    payload = document.get("payload")

    if not isinstance(payload, dict):
        return [f"{name}: payload is missing or invalid"]

    if name == "dspy.bootstrap.demo-budget.basic":
        trainset = payload.get("trainset")
        expected_questions = payload.get("expectedAcceptedQuestions")
        max_bootstrapped = payload.get("maxBootstrappedDemos")
        threshold = payload.get("threshold")
        expected_final_count = payload.get("expectedFinalDemoCount")
        expected_call_count = payload.get("expectedCallCount")

        if not isinstance(trainset, list):
            errors.append(f"{name}: trainset must be an array")
            return errors

        if not isinstance(expected_questions, list):
            errors.append(f"{name}: expectedAcceptedQuestions must be an array")
            return errors

        if not isinstance(max_bootstrapped, int):
            errors.append(f"{name}: maxBootstrappedDemos must be an integer")
            return errors

        if not isinstance(threshold, (int, float)):
            errors.append(f"{name}: threshold must be numeric")
            return errors

        accepted: list[str] = []
        for case in trainset:
            if not isinstance(case, dict):
                continue

            expected = str(case.get("expectedAnswer", "")).strip().lower()
            teacher = str(case.get("teacherAnswer", "")).strip().lower()
            if (1.0 if teacher == expected else 0.0) >= float(threshold):
                accepted.append(str(case.get("question", "")))

        bounded = accepted[:max_bootstrapped]
        if expected_questions != bounded:
            errors.append(f"{name}: expectedAcceptedQuestions must match thresholded demos capped by maxBootstrappedDemos")

        if expected_final_count != len(bounded):
            errors.append(f"{name}: expectedFinalDemoCount must equal accepted demo count after budget cap")

        if expected_call_count != len(trainset):
            errors.append(f"{name}: expectedCallCount must equal one pass over the trainset")

    if name == "dspy.bootstrap.threshold-filtering.basic":
        trainset = payload.get("trainset")
        expected_accepted = payload.get("expectedAcceptedQuestions")
        expected_rejected = payload.get("expectedRejectedQuestions")
        max_bootstrapped = payload.get("maxBootstrappedDemos")
        threshold = payload.get("threshold")
        expected_final_count = payload.get("expectedFinalDemoCount")
        expected_call_count = payload.get("expectedCallCount")

        if not isinstance(trainset, list):
            errors.append(f"{name}: trainset must be an array")
            return errors

        if not isinstance(expected_accepted, list) or not isinstance(expected_rejected, list):
            errors.append(f"{name}: expectedAcceptedQuestions and expectedRejectedQuestions must be arrays")
            return errors

        if not isinstance(max_bootstrapped, int):
            errors.append(f"{name}: maxBootstrappedDemos must be an integer")
            return errors

        if not isinstance(threshold, (int, float)):
            errors.append(f"{name}: threshold must be numeric")
            return errors

        accepted: list[str] = []
        for case in trainset:
            if not isinstance(case, dict):
                continue

            expected = str(case.get("expectedAnswer", "")).strip().lower()
            teacher = str(case.get("teacherAnswer", "")).strip().lower()
            if (1.0 if teacher == expected else 0.0) >= float(threshold):
                accepted.append(str(case.get("question", "")))

        bounded = accepted[:max_bootstrapped]
        rejected = [
            str(case.get("question", ""))
            for case in trainset
            if isinstance(case, dict) and str(case.get("question", "")) not in accepted
        ]

        if expected_accepted != bounded:
            errors.append(f"{name}: expectedAcceptedQuestions must match thresholded demos")

        if expected_rejected != rejected:
            errors.append(f"{name}: expectedRejectedQuestions must match filtered-out trainset questions")

        if expected_final_count != len(bounded):
            errors.append(f"{name}: expectedFinalDemoCount must equal accepted demo count")

        if expected_call_count != len(trainset):
            errors.append(f"{name}: expectedCallCount must equal one pass over the trainset")

    if name == "dspy.labeledfewshot.sample-k.seed-9":
        trainset = payload.get("trainset")
        seed = payload.get("seed")
        k = payload.get("k")
        expected_selected = payload.get("expectedSelectedQuestions")
        expected_call_count = payload.get("expectedCallCount")

        if not isinstance(trainset, list):
            errors.append(f"{name}: trainset must be an array")
            return errors

        if not isinstance(seed, int) or not isinstance(k, int):
            errors.append(f"{name}: seed and k must be integers")
            return errors

        if not isinstance(expected_selected, list):
            errors.append(f"{name}: expectedSelectedQuestions must be an array")
            return errors

        recomputed = expected_labeled_questions(trainset, k, seed)
        if expected_selected != recomputed:
            errors.append(f"{name}: expectedSelectedQuestions must match deterministic seeded sample")

        if expected_call_count != 0:
            errors.append(f"{name}: expectedCallCount must remain 0 for labeled few-shot")

    if name == "dspy.bootstraprs.candidate-catalog.seed-9":
        seeds = payload.get("seeds")
        num_candidates = payload.get("numCandidates")
        trainset = payload.get("trainset")
        valset = payload.get("valset")
        expected_labels = payload.get("expectedCandidateLabels")
        expected_best = payload.get("expectedBestCandidateLabel")
        expected_best_demos = payload.get("expectedBestDemoQuestions")
        expected_call_count = payload.get("expectedCallCount")

        if not isinstance(seeds, list) or not all(isinstance(seed, int) for seed in seeds):
            errors.append(f"{name}: seeds must be an array of integers")
            return errors

        if not isinstance(num_candidates, int):
            errors.append(f"{name}: numCandidates must be an integer")
            return errors

        if not isinstance(trainset, list) or not isinstance(valset, list):
            errors.append(f"{name}: trainset and valset must be arrays")
            return errors

        if not isinstance(expected_labels, list):
            errors.append(f"{name}: expectedCandidateLabels must be an array")
            return errors

        catalog_labels = ["uncompiled", "labeled-few-shot"] + [
            f"bootstrap-{seed}"
            for seed in seeds[:max(0, num_candidates)]
        ]

        if expected_labels != catalog_labels:
            errors.append(f"{name}: expectedCandidateLabels must match baseline + seeded bootstrap catalog")

        if expected_best not in catalog_labels:
            errors.append(f"{name}: expectedBestCandidateLabel must be included in expectedCandidateLabels")

        if not isinstance(expected_best_demos, list) or len(expected_best_demos) == 0:
            errors.append(f"{name}: expectedBestDemoQuestions must include at least one question")

        expected_calls = (len(seeds[:max(0, num_candidates)]) * len(trainset)) + (len(catalog_labels) * len(valset))
        if expected_call_count != expected_calls:
            errors.append(f"{name}: expectedCallCount must equal bootstrap + candidate-eval call budget")

    if name == "dspy.ensemble.majority-vote.basic":
        cases = payload.get("cases")

        if not isinstance(cases, list) or len(cases) == 0:
            errors.append(f"{name}: cases must include at least one ensemble contract")
            return errors

        for index, case in enumerate(cases):
            if not isinstance(case, dict):
                errors.append(f"{name}: cases[{index}] must be an object")
                continue

            answers = case.get("programAnswers")
            expected_answer = case.get("expectedAnswer")

            if not isinstance(answers, list) or not all(isinstance(answer, str) for answer in answers):
                errors.append(f"{name}: cases[{index}] programAnswers must be an array of strings")
                continue

            recomputed = majority_vote_answer(answers)
            if expected_answer != recomputed:
                errors.append(f"{name}: cases[{index}] expectedAnswer must match majority vote with first-observed tie-break")

    return errors



def mipro_trial_budget(
    predictor_count: int,
    demo_candidate_count: int,
    instruction_candidate_count: int,
    minimum: int | None,
) -> int:
    safe_predictor_count = max(1, int(predictor_count))
    safe_candidate_count = max(1, max(int(demo_candidate_count), int(instruction_candidate_count)))
    logarithmic_budget = 2 * safe_predictor_count * math.log(safe_candidate_count)
    exploration_budget = (3 * safe_candidate_count) / 2
    resolved_minimum = int(minimum) if isinstance(minimum, int) else 1

    return max(resolved_minimum, math.ceil(max(logarithmic_budget, exploration_budget)))


def verify_mipro_v2_contracts(name: str, document: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    payload = document.get("payload")

    if not isinstance(payload, dict):
        return [f"{name}: payload is missing or invalid"]

    if name == "dspy.chat.qa-output-requirements":
        basic = payload.get("basic")
        with_demo = payload.get("withDemo")
        markers = payload.get("fieldMarkers")

        if payload.get("signatureDescription") != str(QASignature.instructions):
            errors.append(f"{name}: signatureDescription must match QASignature instructions")

        if payload.get("inputFields") != render_signature_fields(QASignature.input_fields):
            errors.append(f"{name}: inputFields must match rendered signature fields")

        if payload.get("outputFields") != render_signature_fields(QASignature.output_fields):
            errors.append(f"{name}: outputFields must match rendered signature fields")

        expected_markers = ["[[ ## question ## ]]", "[[ ## answer ## ]]", "[[ ## completed ## ]]"]
        if markers != expected_markers:
            errors.append(f"{name}: fieldMarkers must match canonical marker order")

        expected_requirements = dspy.ChatAdapter().user_message_output_requirements(QASignature)

        if not isinstance(basic, dict):
            errors.append(f"{name}: basic block is missing")
        else:
            if basic.get("query") != BASIC_QUERY:
                errors.append(f"{name}: basic.query must equal canonical QA query")
            if basic.get("outputRequirements") != expected_requirements:
                errors.append(f"{name}: basic.outputRequirements must match ChatAdapter output requirements")
            if not isinstance(basic.get("messages"), list) or len(basic["messages"]) != 2:
                errors.append(f"{name}: basic.messages must include system and user messages")

        if not isinstance(with_demo, dict):
            errors.append(f"{name}: withDemo block is missing")
        else:
            if with_demo.get("query") != BASIC_QUERY:
                errors.append(f"{name}: withDemo.query must equal canonical QA query")
            if with_demo.get("demo") != BASIC_DEMO:
                errors.append(f"{name}: withDemo.demo must equal canonical QA demo")
            if with_demo.get("outputRequirements") != expected_requirements:
                errors.append(f"{name}: withDemo.outputRequirements must match ChatAdapter output requirements")
            if not isinstance(with_demo.get("messages"), list) or len(with_demo["messages"]) != 4:
                errors.append(f"{name}: withDemo.messages must include system/demo/user exchange")

    if name == "dspy.mipro.phase-config":
        if payload.get("phaseOrder") != mipro_v2.PHASE_ORDER:
            errors.append(f"{name}: phaseOrder must remain canonical phase1/phase2/phase3")

        if payload.get("phase1AnchorKinds") != mipro_v2.PHASE1_ANCHOR_KINDS:
            errors.append(f"{name}: phase1AnchorKinds must remain anchor-first candidate ordering")

        if payload.get("phase3TrialBudgetFormula") != mipro_v2.PHASE3_TRIAL_BUDGET_FORMULA:
            errors.append(f"{name}: phase3TrialBudgetFormula must match contract formula")

        cadence = payload.get("phase3CadenceDefaults")
        if not isinstance(cadence, dict):
            errors.append(f"{name}: phase3CadenceDefaults must be an object")
        else:
            if cadence.get("seed") != 1:
                errors.append(f"{name}: phase3CadenceDefaults.seed must be 1")
            if cadence.get("minibatchSize") != 50:
                errors.append(f"{name}: phase3CadenceDefaults.minibatchSize must be 50")
            if cadence.get("fullEvalEvery") != 5:
                errors.append(f"{name}: phase3CadenceDefaults.fullEvalEvery must be 5")

        sampler = payload.get("phase3Sampler")
        if not isinstance(sampler, dict):
            errors.append(f"{name}: phase3Sampler must be an object")
        else:
            if sampler.get("kind") != "tpe":
                errors.append(f"{name}: phase3Sampler.kind must be 'tpe'")
            if sampler.get("multivariate") is not True:
                errors.append(f"{name}: phase3Sampler.multivariate must be true")

        if payload.get("phase3PriorTrialCount") != 1:
            errors.append(f"{name}: phase3PriorTrialCount must be 1")

    if name == "dspy.mipro.tips-vocabulary":
        if payload.get("defaultTips") != mipro_v2.DEFAULT_TIP_VOCABULARY:
            errors.append(f"{name}: defaultTips must match canonical tip vocabulary")

        if payload.get("baselineTip") != "baseline":
            errors.append(f"{name}: baselineTip must be 'baseline'")

        if payload.get("diversityTemperatureDefault") != 1:
            errors.append(f"{name}: diversityTemperatureDefault must be 1")

        template = payload.get("proposalMarkerTemplate")
        if not isinstance(template, str):
            errors.append(f"{name}: proposalMarkerTemplate must be a string")
        else:
            if "{predictorName}" not in template:
                errors.append(f"{name}: proposalMarkerTemplate must include {{predictorName}} placeholder")
            if "{proposalIndex}" not in template:
                errors.append(f"{name}: proposalMarkerTemplate must include {{proposalIndex}} placeholder")
            if "{seed}" not in template:
                errors.append(f"{name}: proposalMarkerTemplate must include {{seed}} placeholder")

    if name == "dspy.mipro.trial-budget-cases":
        if payload.get("formula") != mipro_v2.PHASE3_TRIAL_BUDGET_FORMULA:
            errors.append(f"{name}: formula must match phase3 trial budget contract")

        cases = payload.get("cases")
        if not isinstance(cases, list) or len(cases) == 0:
            errors.append(f"{name}: cases must include at least one trial budget example")
            return errors

        case_names: set[str] = set()
        for index, case in enumerate(cases):
            if not isinstance(case, dict):
                errors.append(f"{name}: cases[{index}] must be an object")
                continue

            candidate_name = case.get("name")
            if not isinstance(candidate_name, str):
                errors.append(f"{name}: cases[{index}] must include a string name")
                continue

            if candidate_name in case_names:
                errors.append(f"{name}: cases[{index}] duplicates case name '{candidate_name}'")
            else:
                case_names.add(candidate_name)

            predictor_count = case.get("predictorCount")
            demo_candidate_count = case.get("demoCandidateCount")
            instruction_candidate_count = case.get("instructionCandidateCount")
            expected_budget = case.get("expectedBudget")

            if not isinstance(predictor_count, int):
                errors.append(f"{name}: cases[{index}] predictorCount must be an integer")
                continue
            if not isinstance(demo_candidate_count, int):
                errors.append(f"{name}: cases[{index}] demoCandidateCount must be an integer")
                continue
            if not isinstance(instruction_candidate_count, int):
                errors.append(f"{name}: cases[{index}] instructionCandidateCount must be an integer")
                continue
            if not isinstance(expected_budget, int):
                errors.append(f"{name}: cases[{index}] expectedBudget must be an integer")
                continue

            recomputed = mipro_trial_budget(
                predictor_count,
                demo_candidate_count,
                instruction_candidate_count,
                case.get("minimum") if isinstance(case.get("minimum"), int) else None,
            )

            if expected_budget != recomputed:
                errors.append(f"{name}: cases[{index}] expectedBudget must match recomputed formula output")

    return errors


def load_gepa_manifest() -> dict[str, Any]:
    expected = expected_fixtures(DEFAULT_GENERATED_AT)
    catalog = expected.get("dspy.gepa.catalog.versioned-fixtures")

    if not isinstance(catalog, dict):
        return {}

    document = catalog.get("document")
    if not isinstance(document, dict):
        return {}

    payload = document.get("payload")
    return payload if isinstance(payload, dict) else {}


def verify_gepa_fixture_contracts(name: str, document: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    payload = document.get("payload")

    if not isinstance(payload, dict):
        return [f"{name}: payload is missing or invalid"]

    manifest = load_gepa_manifest()
    manifest_fixtures = manifest.get("fixtures")

    if not isinstance(manifest_fixtures, list):
        return [f"{name}: GEPA manifest fixtures block is missing or invalid"]

    if name == "dspy.gepa.catalog.versioned-fixtures":
        if payload.get("fixtureSet") != manifest.get("fixtureSet"):
            errors.append(f"{name}: fixtureSet must match GEPA manifest fixtureSet")

        if payload.get("version") != manifest.get("version"):
            errors.append(f"{name}: version must match GEPA manifest version")

        if payload.get("requiredFixtureCount") != len(manifest_fixtures):
            errors.append(f"{name}: requiredFixtureCount must equal GEPA manifest fixture count")

        if payload.get("fixtures") != manifest_fixtures:
            errors.append(f"{name}: fixtures must match GEPA manifest entries exactly")

        expected_namespaces = sorted(
            {
                ".".join(str(entry.get("name", "")).split(".")[:3])
                for entry in manifest_fixtures
                if isinstance(entry, dict)
            }
        )

        if payload.get("namespaces") != expected_namespaces:
            errors.append(f"{name}: namespaces must match GEPA manifest namespace projection")

    if name == "dspy.gepa.replay.seed-0.contract":
        manifest_names = [
            str(entry.get("name", ""))
            for entry in manifest_fixtures
            if isinstance(entry, dict)
        ]

        if payload.get("seed") != 0:
            errors.append(f"{name}: seed must be 0 for deterministic replay baseline")

        if payload.get("requiredManifestFixtures") != manifest_names:
            errors.append(f"{name}: requiredManifestFixtures must match GEPA manifest fixture names")

        checks = payload.get("byteEqualityChecks")
        if checks != ["savedStateBytes", "frontierSnapshotBytes", "eventTimelineBytes", "paramsBytes"]:
            errors.append(f"{name}: byteEqualityChecks must match replay byte-comparison contract")

        if payload.get("maxIterations") != 3:
            errors.append(f"{name}: maxIterations must remain fixed at 3")

        if payload.get("trainsetSize") != 3:
            errors.append(f"{name}: trainsetSize must remain fixed at 3")

    return errors


def verify_manifest(manifest: dict[str, Any], expected: dict[str, dict[str, Any]]) -> list[str]:
    errors: list[str] = []

    schema_version = manifest.get("schemaVersion")
    if schema_version != SCHEMA_VERSION:
        errors.append(f"manifest schemaVersion mismatch: expected {SCHEMA_VERSION}, got {schema_version}")

    generator = manifest.get("generator")
    if not isinstance(generator, dict):
        return ["manifest generator block is missing or invalid"] + errors

    if generator.get("script") != GENERATOR_SCRIPT:
        errors.append(
            f"manifest generator.script mismatch: expected {GENERATOR_SCRIPT}, got {generator.get('script')}"
        )
    if generator.get("generatorVersion") != GENERATOR_VERSION:
        errors.append(
            (
                "manifest generator.generatorVersion mismatch: "
                f"expected {GENERATOR_VERSION}, got {generator.get('generatorVersion')}"
            )
        )
    if generator.get("upstream") != UPSTREAM_NAME:
        errors.append(
            f"manifest generator.upstream mismatch: expected {UPSTREAM_NAME}, got {generator.get('upstream')}"
        )
    if generator.get("upstreamVersion") != UPSTREAM_VERSION:
        errors.append(
            (
                "manifest generator.upstreamVersion mismatch: "
                f"expected {UPSTREAM_VERSION}, got {generator.get('upstreamVersion')}"
            )
        )
    if generator.get("pythonVersion") != PYTHON_VERSION:
        errors.append(
            (
                "manifest generator.pythonVersion mismatch: "
                f"expected {PYTHON_VERSION}, got {generator.get('pythonVersion')}"
            )
        )
    if generator.get("generatedAt") != DEFAULT_GENERATED_AT:
        errors.append(
            (
                "manifest generator.generatedAt mismatch: "
                f"expected {DEFAULT_GENERATED_AT}, got {generator.get('generatedAt')}"
            )
        )

    fixtures = manifest.get("fixtures")
    if not isinstance(fixtures, list):
        return ["manifest fixtures block is missing or invalid"] + errors

    expected_entries = sorted(
        [{"name": name, "file": value["file"]} for name, value in expected.items()],
        key=lambda entry: str(entry["name"]),
    )
    actual_entries = sorted(fixtures, key=lambda entry: str(entry.get("name", "")))

    if actual_entries != expected_entries:
        errors.append("manifest fixture entries do not match the expected DSPy fixture catalog")

    return errors


def verify_files(expected: dict[str, dict[str, Any]]) -> list[str]:
    errors: list[str] = []

    expected_files = sorted(data["file"] for data in expected.values())
    actual_files = sorted(path.relative_to(FIXTURE_DIR).as_posix() for path in FIXTURE_DIR.rglob("*.json") if path.name != "manifest.json")

    if actual_files != expected_files:
        errors.append("fixture file set on disk does not match manifest expectations")

    for name, data in expected.items():
        relative_file = data["file"]
        file_path = FIXTURE_DIR / relative_file
        if not file_path.exists():
            errors.append(f"{name}: fixture file does not exist at {relative_file}")
            continue

        actual = load_json(file_path)
        expected_doc = data["document"]

        if actual != expected_doc:
            errors.append(
                f"{name}: committed fixture differs from live DSPy output ({relative_file})"
            )

        errors.extend(verify_predict_runtime_contracts(name, actual))
        errors.extend(verify_program_of_thought_contracts(name, actual))
        errors.extend(verify_multi_chain_comparison_contracts(name, actual))
        errors.extend(verify_evaluate_runtime_contracts(name, actual))
        errors.extend(verify_bootstrap_family_contracts(name, actual))
        errors.extend(verify_mipro_v2_contracts(name, actual))
        errors.extend(verify_gepa_fixture_contracts(name, actual))

    return errors


def main() -> None:
    print(f"Verifying fixtures in {FIXTURE_DIR.resolve()}")
    print(f"DSPy version: {getattr(dspy, '__version__', 'unknown')}")
    print()

    if not MANIFEST_PATH.exists():
        print(f"✗ manifest missing: {MANIFEST_PATH}")
        sys.exit(1)

    manifest = load_json(MANIFEST_PATH)
    expected = expected_fixtures(DEFAULT_GENERATED_AT)

    checks = {
        "runtime-version": assert_runtime_version(),
        "manifest": verify_manifest(manifest, expected),
        "fixtures": verify_files(expected),
    }

    passed = 0
    failed = 0
    errors: list[str] = []

    for name, check_errors in checks.items():
        if check_errors:
            print(f"✗ {name}")
            for error in check_errors:
                print(f"  FAIL: {error}")
            errors.extend(check_errors)
            failed += 1
        else:
            print(f"✓ {name}")
            passed += 1

    print()
    print(f"Results: {passed} passed, {failed} failed")

    if errors:
        sys.exit(1)


if __name__ == "__main__":
    main()
