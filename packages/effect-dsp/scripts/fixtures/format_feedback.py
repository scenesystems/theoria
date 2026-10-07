"""Format-failure reflection, instruction extraction and demo projection evidence."""

import dspy
from dspy.utils import DummyLM
from gepa.strategies.instruction_proposal import InstructionProposalSignature

from ._common import examples, history, splits, state

RAW_RESPONSE = "not a marked answer"

EXTRACTOR_CASES = [
    ("plain", "  plain instruction \n"),
    ("empty", ""),
    ("whitespace", " \t\n "),
    ("single-fence", "Here:\n```\nnew instruction\n```\nThanks"),
    ("language-tag", "```markdown\nnew instruction\n```"),
    ("punctuated-language-tag", "```text/x-instruction+v2\nnew instruction\n```"),
    ("multiple-fences", "pre ```\nfirst\n``` middle ```md\nsecond\n``` post"),
    ("same-line-tag", "```python print(1)```"),
    ("crlf-tag", "```py\r\ncode\r\n```"),
    ("empty-fenced-block", "```\n```"),
    ("incomplete-opening", "```json\n{\"instruction\": 1}  "),
    ("indented-incomplete-opening", "  ```json\nbody"),
    ("incomplete-closing", "body text\n```"),
    ("lone-fence", "```"),
    ("six-backticks", "``````"),
    ("python-whitespace", "\x1c\u00a0```\x85instruction\x1f```\u3000"),
    ("byte-order-mark", "\ufeffinstruction\ufeff"),
]


class RawLM(DummyLM):
    """Returns scripted completion text verbatim instead of adapter-formatted fields."""

    def _format_answer_fields(self, values):
        return values["raw"]


def generate():
    return [extractor_kernel(), demo_projection(), format_failure()]


def extractor_kernel():
    return {"id": "gepa-instruction-extractor-001", "evidence": "upstream-kernel",
            "description": "GEPA InstructionProposalSignature.output_extractor on fences, language tags, "
                           "incomplete blocks, empty replies and Python whitespace.",
            "payload": {"cases": [{"name": name, "response": response,
                                   "instruction": InstructionProposalSignature.output_extractor(response)["new_instruction"]}
                                  for name, response in EXTRACTOR_CASES]}}


def demo_projection():
    signature = dspy.Signature("question -> reasoning, answer")
    trainset = [
        dspy.Example(id="complete", question="q-complete", context="c-complete", reasoning="r-complete",
                     answer="a-complete", note="n-complete").with_inputs("question", "context"),
        dspy.Example(id="partial", question="q-partial", answer="a-partial", note="n-partial").with_inputs("question"),
        dspy.Example(id="no-output", question="q-no-output", note="n-no-output").with_inputs("question"),
    ]
    compiled = dspy.LabeledFewShot(k=3).compile(dspy.Predict(signature), trainset=trainset, sample=False)
    model = DummyLM([{"reasoning": "why", "answer": "new"}])
    with dspy.context(lm=model):
        prediction = compiled(question="q-next")
    return {"id": "chat-adapter-demo-projection-001",
            "description": "LabeledFewShot keeps raw dataset rows; ChatAdapter renders only signature fields, "
                           "keeps a partial demo and drops a demo without output fields.",
            "payload": {"signature": {"inputs": list(signature.input_fields), "outputs": list(signature.output_fields)},
                        "trainset": [{"row": example.toDict(), "inputKeys": sorted(example.inputs().keys())}
                                     for example in trainset],
                        "state": state(compiled), "prediction": prediction.toDict(), "history": history(model)}}


def format_failure():
    def lookup(query: str) -> str:
        """Look up a fact."""
        return "fact"

    cases = []
    for name, program in [("predict", dspy.Predict("question -> answer")),
                          ("react", dspy.ReAct("question -> answer", tools=[lookup], max_iters=2))]:
        train = examples("train", 3)
        task = RawLM([{"raw": RAW_RESPONSE}] * 200)
        proposals, metric_calls = [], []

        def proposer(candidate, reflective_dataset, components_to_update):
            proposals.append({"components": list(components_to_update),
                              "examples": {component: [dict(row) for row in rows]
                                           for component, rows in reflective_dataset.items()}})
            return {component: "improved" for component in components_to_update}

        def metric(gold, pred, trace=None, pred_name=None, pred_trace=None):
            metric_calls.append({"id": gold.id, "target": pred_name})
            return dspy.Prediction(score=0.0, feedback="metric feedback")

        with dspy.context(lm=task):
            compiled = dspy.GEPA(
                metric=metric, max_metric_calls=7, reflection_minibatch_size=3,
                reflection_lm=DummyLM([{"answer": "unused"}]), use_merge=False, num_threads=1, seed=0,
                add_format_failure_as_feedback=True, instruction_proposer=proposer, component_selector="all",
                track_stats=True,
            ).compile(program, trainset=train, valset=train)
        result = compiled.detailed_results
        assert len(proposals) == 1
        cases.append({"program": name, "predictors": [path for path, _ in program.named_predictors()],
                      "splits": splits(train, train), "proposals": proposals, "metricCalls": metric_calls,
                      "totalMetricCalls": result.total_metric_calls, "taskCalls": len(task.history)})
    return {"id": "gepa-format-failure-001",
            "description": "dspy.GEPA with add_format_failure_as_feedback and the default adapter gives the "
                           "proposer one failed-parse sample per minibatch row for Predict and ReAct.",
            "payload": {"rawResponse": RAW_RESPONSE, "maxMetricCalls": 7, "minibatchSize": 3, "seed": 0,
                        "cases": cases}}
