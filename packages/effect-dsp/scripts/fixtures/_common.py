"""Serialization and test inputs only; no optimizer policy lives here."""

import hashlib
import importlib.metadata
import json
import platform

import dspy
from dspy.utils import DummyLM

VERSIONS = {"dspy": "3.4.0", "gepa": "0.1.4", "optuna": "4.9.0"}
COMMITS = {
    "dspy": "2413b67a4d08a476e4bc6f40b9f8f42f87711ee7",
    "gepa": "8b0ce6cd99a234f6b74daf37558a2ac0ce18f975",
}


def assert_runtime_version():
    for package, version in VERSIONS.items():
        if importlib.metadata.version(package) != version:
            raise RuntimeError(f"{package}: expected {version}")
    assert dspy.__version__ == VERSIONS["dspy"]
    return {**VERSIONS, "commits": COMMITS,
            "python": platform.python_version(),
            "platform": f"{platform.system()}-{platform.machine()}"}


def render(value):
    return (json.dumps(value, indent=2, ensure_ascii=False, allow_nan=False) + "\n").encode()


def document(item, generator):
    payload = render({"fixture": item["id"], "payload": item["payload"]})
    return ({"id": item["id"], "file": f"upstream/{item['id']}.json",
             "evidence": item.get("evidence", "upstream-execution"),
             "sha256": hashlib.sha256(payload).hexdigest(), "generator": generator,
             "description": item["description"]}, payload)


def examples(split, n):
    return [dspy.Example(id=f"{split}-{i}", question=f"{split}-{i}", answer=f"label-{i}")
            .with_inputs("question") for i in range(n)]


def lm(answer="teacher", temperature=0.17, max_tokens=73):
    model = DummyLM([{"answer": answer}] * 20000)
    model.kwargs.update(temperature=temperature, max_tokens=max_tokens)
    return model


def history(model):
    # Discard only nondeterministic transport metadata (UUID, timestamp, latency).
    return [{"messages": h["messages"],
             "kwargs": {**{k: v for k, v in {**model.kwargs, **h["kwargs"]}.items()
                            if k in ("temperature", "max_tokens", "rollout_id")},
                        "model": h.get("model", model.model)},
             "response": h["outputs"]} for h in model.history]


def state(program):
    return program.dump_state()


def splits(train, val=()):
    return {"train": [e.toDict() for e in train], "val": [e.toDict() for e in val]}
