"""Grounded proposer execution with observable, deterministic model responses."""

import random
import re

import dspy
from dspy.utils import DummyLM

from ._common import examples, history


class QuestionAnswering(dspy.Module):
    def __init__(self):
        super().__init__()
        self.qa = dspy.Predict("question -> answer")
        self.qa.signature = self.qa.signature.with_instructions("baseline")

    def forward(self, question):
        return self.qa(question=question)


def run(name, *, program_aware=True, data_aware=True, tip_aware=True,
        fewshot_aware=True, demos=True, complete=False, seed=9):
    calls = []

    class RecordingLM(DummyLM):
        def __call__(self, prompt=None, messages=None, **kwargs):
            field = re.search(r"starting with the field `\[\[ ## (\w+) ## \]\]`", messages[-1]["content"])[1]
            rollout = self.kwargs.get("rollout_id")
            response = ("COMPLETE" if complete and field == "observations" and calls else
                        f"instruction-{rollout}" if field == "proposed_instruction" else
                        f"{field}-{len(calls)}")
            self.answers = iter([{field: response}])
            result = super().__call__(prompt=prompt, messages=messages, **kwargs)
            user = messages[-1]["content"]
            task_demos = re.search(r"\[\[ ## task_demos ## \]\]\n(.*?)\n\n\[\[", user, re.S)
            tip = re.search(r"\[\[ ## tip ## \]\]\n(.*?)\n\n", user, re.S)
            calls.append({"field": field, "role": "proposer", "rolloutId": rollout,
                          "temperature": history(self)[-1]["kwargs"]["temperature"],
                          "response": response,
                          "demoIds": re.findall(r"Question: (demo-\w+)", task_demos[1]) if task_demos else [],
                          "dataIds": re.findall(r"'question': '(train-\d+)'", user),
                          "tip": tip[1] if tip else None,
                          "history": history(self)[-1]})
            return result

    model = RecordingLM([])
    program = QuestionAnswering()
    train = examples("train", 110 if complete else 23)
    candidate_sets = {0: [[], [dspy.Example(question="label", answer="complete")],
                           [dspy.Example(question="demo-a", answer="a", augmented=True),
                            dspy.Example(question="label", answer="complete")],
                           [dspy.Example(question="demo-b", answer="b", augmented=True),
                            dspy.Example(question="demo-c", answer="c", augmented=True)]]} if demos else None
    optimizer = dspy.MIPROv2(metric=lambda e, p, trace=None: 1, prompt_model=model, task_model=model, seed=seed)
    optimizer.rng = random.Random(seed)
    instructions = optimizer._propose_instructions(
        program, train, candidate_sets, 10, program_aware, data_aware, tip_aware, fewshot_aware, 5,
    )
    assert any(call["field"] == "proposed_instruction" for call in calls)
    if program_aware:
        assert any(call["field"] == "program_description" for call in calls)
    return {"id": name, "description": "Real grounded proposer call order, settings, tips, demo rotation and instruction identities.",
            "payload": {"seed": seed, "numInstructions": 5, "trainSize": len(train),
                        "programAware": program_aware, "dataAware": data_aware,
                        "tipAware": tip_aware, "fewshotAware": fewshot_aware,
                        "demoSets": candidate_sets, "instructions": instructions, "calls": calls,
                        "nextRandom": optimizer.rng.random()}}


def generate():
    for name, options in [
        ("miprov2-grounded-proposer", {}),
        ("miprov2-proposer-no-demos", {"demos": False, "program_aware": False, "data_aware": False, "tip_aware": False}),
        ("miprov2-proposer-summary-skips", {"complete": True, "program_aware": False, "fewshot_aware": False, "seed": 0}),
    ]:
        item = run(name, **options)
        sets = item["payload"]["demoSets"]
        if sets:
            item["payload"]["demoSets"] = {i: [[e.toDict() for e in candidates] for candidates in sets[i]] for i in sets}
        yield item
