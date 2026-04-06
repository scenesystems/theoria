from __future__ import annotations

from ._common import metadata


BASELINE_INSTRUCTION = "Answer questions with concise facts"
IMPROVED_INSTRUCTION = "Answer questions with concise facts and verify the city against geographic knowledge."


def _progression_payload() -> dict[str, object]:
    return {
        "seed": 17,
        "numCandidates": 3,
        "maxSteps": 2,
        "baselineInstruction": BASELINE_INSTRUCTION,
        "baselineScore": 0.5,
        "seedCandidates": [
            BASELINE_INSTRUCTION,
            "Always answer Paris.",
            IMPROVED_INSTRUCTION,
        ],
        "refinementCandidates": [
            IMPROVED_INSTRUCTION,
            "Answer questions with concise facts and prefer exact country-capital matches.",
            "Always answer Paris.",
        ],
        "acceptedUpdates": [
            {
                "step": 0,
                "instruction": IMPROVED_INSTRUCTION,
                "score": 1.0,
                "changed": True,
            },
            {
                "step": 1,
                "instruction": IMPROVED_INSTRUCTION,
                "score": 1.0,
                "changed": False,
            },
        ],
        "trials": [
            {
                "trialNumber": 0,
                "step": 0,
                "candidateIndex": 0,
                "instruction": BASELINE_INSTRUCTION,
                "score": 0.5,
                "improved": False,
            },
            {
                "trialNumber": 1,
                "step": 0,
                "candidateIndex": 1,
                "instruction": "Always answer Paris.",
                "score": 0.5,
                "improved": False,
            },
            {
                "trialNumber": 2,
                "step": 0,
                "candidateIndex": 2,
                "instruction": IMPROVED_INSTRUCTION,
                "score": 1.0,
                "improved": True,
            },
            {
                "trialNumber": 3,
                "step": 1,
                "candidateIndex": 0,
                "instruction": IMPROVED_INSTRUCTION,
                "score": 1.0,
                "improved": False,
            },
            {
                "trialNumber": 4,
                "step": 1,
                "candidateIndex": 1,
                "instruction": "Answer questions with concise facts and prefer exact country-capital matches.",
                "score": 1.0,
                "improved": False,
            },
            {
                "trialNumber": 5,
                "step": 1,
                "candidateIndex": 2,
                "instruction": "Always answer Paris.",
                "score": 0.5,
                "improved": False,
            },
        ],
        "expectedBestInstruction": IMPROVED_INSTRUCTION,
        "expectedBestScore": 1.0,
    }


def _resume_payload() -> dict[str, object]:
    return {
        "seed": 17,
        "interruptionAfterStep": 0,
        "expectedNextStep": 1,
        "expectedTotalTrials": 6,
        "expectedBestInstruction": IMPROVED_INSTRUCTION,
        "expectedBestScore": 1.0,
    }


def generate(generated_at: str) -> list[dict[str, object]]:
    return [
        {
            "fixture": "dspy.copro.progression.basic",
            "file": "copro/progression.basic.json",
            "metadata": metadata(generated_at),
            "payload": _progression_payload(),
        },
        {
            "fixture": "dspy.copro.resume.seed-17",
            "file": "copro/resume.seed-17.json",
            "metadata": metadata(generated_at),
            "payload": _resume_payload(),
        },
    ]
