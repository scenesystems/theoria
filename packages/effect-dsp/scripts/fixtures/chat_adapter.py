from __future__ import annotations

import re
from typing import Any

import dspy

from ._common import metadata

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


def _unique_markers(messages: list[dict[str, Any]]) -> list[str]:
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


def _chat_sections(completion: str) -> list[dict[str, Any]]:
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


def _is_fallback_eligible(error_type: str, use_json_adapter_fallback: bool, is_json_adapter: bool) -> bool:
    return (
        error_type != "ContextWindowExceededError"
        and not is_json_adapter
        and use_json_adapter_fallback
    )


def _qa_payload(adapter: dspy.ChatAdapter, query: str, demo: dict[str, str] | None) -> dict[str, Any]:
    demos = [demo] if demo is not None else []
    messages = adapter.format(QASignature, demos=demos, inputs={"question": query})

    return {
        "signatureDescription": "Answer questions with short factual answers",
        "inputFields": [
            {
                "name": "question",
                "type": "str",
                "description": "The question to answer",
            }
        ],
        "outputFields": [
            {
                "name": "answer",
                "type": "str",
                "description": "A concise factual answer",
            }
        ],
        "query": query,
        "demo": demo,
        "messages": messages,
        "fieldMarkers": _unique_markers(messages),
        "outputRequirements": adapter.user_message_output_requirements(QASignature),
    }


def _system_message_payload(adapter: dspy.ChatAdapter) -> dict[str, Any]:
    messages = adapter.format(QASignature, demos=[], inputs={"question": BASIC_QUERY})
    system_message = str(messages[0]["content"])

    return {
        "fieldDescription": adapter.format_field_description(QASignature),
        "fieldStructure": adapter.format_field_structure(QASignature),
        "taskDescription": adapter.format_task_description(QASignature),
        "systemMessage": system_message,
        "requiredMarkers": _unique_markers([{"content": system_message}]),
    }


def _output_requirements_payload(adapter: dspy.ChatAdapter) -> dict[str, Any]:
    messages = adapter.format(QASignature, demos=[], inputs={"question": BASIC_QUERY})

    return {
        "outputRequirements": adapter.user_message_output_requirements(QASignature),
        "finalUserMessage": str(messages[-1]["content"]),
        "requiredMarkers": [
            "[[ ## answer ## ]]",
            "[[ ## completed ## ]]",
        ],
    }


def _qa_output_requirements_payload(adapter: dspy.ChatAdapter) -> dict[str, Any]:
    basic = _qa_payload(adapter, BASIC_QUERY, None)
    with_demo = _qa_payload(adapter, BASIC_QUERY, BASIC_DEMO)

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


def _parse_sections_payload(adapter: dspy.ChatAdapter) -> dict[str, Any]:
    completion = adapter.format_assistant_message_content(
        QASignature,
        {"answer": PARSE_COMPLETION},
    )

    return {
        "fieldHeaderPattern": FIELD_HEADER_PATTERN.pattern,
        "completion": completion,
        "sections": _chat_sections(completion),
        "parsed": adapter.parse(QASignature, completion),
        "expectedOutputFields": list(QASignature.output_fields.keys()),
    }


def _parse_fallback_payload() -> dict[str, Any]:
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
                "fallbackEligible": _is_fallback_eligible(
                    case["errorType"],
                    case["useJsonAdapterFallback"],
                    case["isJsonAdapter"],
                ),
            }
            for case in fallback_cases
        ]
    }


def generate(generated_at: str) -> list[dict[str, Any]]:
    adapter = dspy.ChatAdapter()

    return [
        {
            "fixture": "dspy.chat.qa-basic",
            "file": "chat/qa-basic.json",
            "metadata": metadata(generated_at),
            "payload": _qa_payload(adapter, BASIC_QUERY, None),
        },
        {
            "fixture": "dspy.chat.qa-with-demo",
            "file": "chat/qa-with-demo.json",
            "metadata": metadata(generated_at),
            "payload": _qa_payload(adapter, BASIC_QUERY, BASIC_DEMO),
        },
        {
            "fixture": "dspy.chat.system-message.basic",
            "file": "chat/system-message.basic.json",
            "metadata": metadata(generated_at),
            "payload": _system_message_payload(adapter),
        },
        {
            "fixture": "dspy.chat.output-requirements.basic",
            "file": "chat/output-requirements.basic.json",
            "metadata": metadata(generated_at),
            "payload": _output_requirements_payload(adapter),
        },
        {
            "fixture": "dspy.chat.qa-output-requirements",
            "file": "chat/qa-output-requirements.json",
            "metadata": metadata(generated_at),
            "payload": _qa_output_requirements_payload(adapter),
        },
        {
            "fixture": "dspy.chat.parse-sections.basic",
            "file": "chat/parse-sections.basic.json",
            "metadata": metadata(generated_at),
            "payload": _parse_sections_payload(adapter),
        },
        {
            "fixture": "dspy.chat.parse-fallback.contract",
            "file": "chat/parse-fallback.contract.json",
            "metadata": metadata(generated_at),
            "payload": _parse_fallback_payload(),
        },
    ]
