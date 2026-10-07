import contextlib
import os
import platform

import dspy
from dspy.clients import base_lm

from ._common import examples, history, lm, splits, state


class TwoStage(dspy.Module):
    def __init__(self):
        super().__init__()
        self.first = dspy.Predict("question -> answer")
        self.second = dspy.Predict("question -> answer")

    def forward(self, question):
        intermediate = self.first(question=question)
        return self.second(question=intermediate.answer)


class RepeatedCall(dspy.Module):
    def __init__(self):
        super().__init__()
        self.predictor = dspy.Predict("question -> answer")

    def forward(self, question):
        self.predictor(question=f"{question}/first")
        return self.predictor(question=f"{question}/second")


@contextlib.contextmanager
def every_lm_call():
    """Record calls from every LM, including round copies made by lm.copy(rollout_id=..., temperature=1.0).

    Per-instance history omits copied LMs, so this observes DSPy's history hook with the effective kwargs.
    """
    calls, original = [], base_lm.record_history

    def record(client, entry):
        kwargs = {**client.kwargs, **entry["kwargs"]}
        calls.append({"messages": entry["messages"],
                      "kwargs": {**{k: kwargs.get(k) for k in ("temperature", "max_tokens", "rollout_id")},
                                 "model": entry["model"]},
                      "response": entry["outputs"]})
        return original(client, entry)

    base_lm.record_history = record
    try:
        yield calls
    finally:
        base_lm.record_history = original


def capture_runtime():
    return {"python": platform.python_version(), "dspy": dspy.__version__,
            "PYTHONHASHSEED": os.environ["PYTHONHASHSEED"],
            "NPY_DISABLE_CPU_FEATURES": os.environ["NPY_DISABLE_CPU_FEATURES"]}


def lettered(*ids):
    return [dspy.Example(id=i, question=i, answer=f"label-{i}").with_inputs("question") for i in ids]


def bootstrap_policy():
    """Pinned BootstrapFewShot.compile edge policies: example-major retries, default teacher demos,
    falsy threshold, and the settings.max_errors default."""
    docs = []
    model, attempts, metric_calls = lm(), {}, []

    def reject_a_once(e, p, trace=None):
        attempts[e.id] = attempts.get(e.id, 0) + 1
        metric_calls.append({"id": e.id, "attempt": attempts[e.id]})
        return not (e.id == "a" and attempts[e.id] == 1)

    train = lettered("a", "b", "c")
    with every_lm_call() as calls, dspy.context(lm=model):
        compiled = dspy.BootstrapFewShot(metric=reject_a_once, max_bootstrapped_demos=2,
                                         max_labeled_demos=0, max_rounds=2,
                                         ).compile(dspy.Predict("question -> answer"), trainset=train)
    docs.append({"id": "bootstrapfewshot-rounds-001",
                 "description": "Example-major retries: each example exhausts its rounds before the next; "
                                "round copies use rollout_id and temperature 1.0.",
                 "payload": {"runtime": capture_runtime(), "splits": splits(train), "maxBootstrappedDemos": 2,
                             "maxLabeledDemos": 0, "maxRounds": 2, "metricCalls": metric_calls,
                             "history": calls, "state": state(compiled)}})

    model, metric_calls = lm(), []
    student = dspy.Predict("question -> answer")
    student.demos = [dspy.Example(question="seed", answer="seed-answer")]

    def accept(e, p, trace=None):
        metric_calls.append({"id": e.id})
        return True

    train = lettered("a")
    with every_lm_call() as calls, dspy.context(lm=model):
        compiled = dspy.BootstrapFewShot(metric=accept, max_bootstrapped_demos=1, max_labeled_demos=0,
                                         max_rounds=1).compile(student, trainset=train)
    docs.append({"id": "bootstrapfewshot-teacher-demos-001",
                 "description": "Without labeled prewarming, the default deep-copied teacher keeps the student's demos.",
                 "payload": {"runtime": capture_runtime(), "splits": splits(train),
                             "studentDemos": [d.toDict() for d in student.demos],
                             "metricCalls": metric_calls, "history": calls, "state": state(compiled)}})

    model, metric_calls = lm(), []

    def zero_for_a(e, p, trace=None):
        metric_calls.append({"id": e.id})
        return 0.0 if e.id == "a" else 0.5

    train = lettered("a", "b")
    with every_lm_call() as calls, dspy.context(lm=model):
        compiled = dspy.BootstrapFewShot(metric=zero_for_a, metric_threshold=0, max_bootstrapped_demos=2,
                                         max_labeled_demos=0, max_rounds=1,
                                         ).compile(dspy.Predict("question -> answer"), trainset=train)
    docs.append({"id": "bootstrapfewshot-threshold-zero-001",
                 "description": "metric_threshold=0 is falsy, so the metric value's truthiness decides: 0 rejects.",
                 "payload": {"runtime": capture_runtime(), "splits": splits(train), "metricThreshold": 0,
                             "metricCalls": metric_calls, "history": calls, "state": state(compiled)}})

    model, metric_calls = lm(), []

    def always_fails(e, p, trace=None):
        metric_calls.append({"id": e.id})
        raise ValueError("scripted bootstrap failure")

    train = lettered(*[f"e{i:02d}" for i in range(12)])
    with every_lm_call() as calls, dspy.context(lm=model):
        try:
            dspy.BootstrapFewShot(metric=always_fails, max_bootstrapped_demos=2, max_labeled_demos=0,
                                  max_rounds=1).compile(dspy.Predict("question -> answer"), trainset=train)
            raise RuntimeError("expected the default error budget to raise")
        except ValueError as error:
            result = {"error": type(error).__name__, "message": str(error)}
    docs.append({"id": "bootstrapfewshot-max-errors-default-001",
                 "description": "max_errors=None inherits dspy.settings.max_errors and raises at that count.",
                 "payload": {"runtime": capture_runtime(), "splits": splits(train),
                             "settingsMaxErrors": dspy.settings.max_errors, "metricCalls": metric_calls,
                             "history": calls, **result}})
    return docs


def generate():
    train, val = examples("train", 4), examples("val", 2)
    docs = []
    labeled = dspy.LabeledFewShot(k=2).compile(dspy.Predict("question -> answer"), trainset=train)
    labeled_multi = dspy.LabeledFewShot(k=2).compile(TwoStage(), trainset=train)
    docs.append({"id": "labeledfewshot-001", "description": "Seeded upstream labeled sampling.",
                 "payload": {"splits": splits(train), "state": state(labeled),
                             "predictors": state(labeled_multi), "history": []}})
    for name, teacher, threshold, fail in [
        ("bootstrapfewshot-001", False, None, False),
        ("bootstrap-teacher-trace-001", True, None, False),
        ("bootstrapfewshot-threshold-001", True, 0.5, False),
        ("bootstrapfewshot-errors-001", True, None, True),
    ]:
        model = lm()
        program = TwoStage()
        teacher_program = TwoStage() if teacher else None
        student_model = lm("student") if teacher else model
        if teacher_program is not None:
            teacher_program.set_lm(model)
        # DSPy requires equal student/teacher signatures (including instructions).
        calls = []

        def metric(e, p, trace=None):
            calls.append({"id": e.id, "prediction": p.toDict(),
                          "trace": [{"predictor": i, "inputs": inputs, "outputs": out.toDict()}
                                    for i, (_, inputs, out) in enumerate(trace or [])]})
            if fail:
                raise ValueError("scripted bootstrap failure")
            return 0.4 if e.id == "train-0" else 0.8

        optimizer = dspy.BootstrapFewShot(metric=metric, metric_threshold=threshold,
                                        max_bootstrapped_demos=2, max_labeled_demos=0,
                                        max_rounds=1, max_errors=1)
        with dspy.context(lm=student_model):
            try:
                compiled = optimizer.compile(program, teacher=teacher_program, trainset=train)
                result = {"state": state(compiled)}
            except ValueError as error:
                if not fail:
                    raise
                result = {"error": type(error).__name__, "message": str(error)}
        docs.append({"id": name, "description": "Real two-predictor teacher traces, quotas and acceptance.",
                     "payload": {"splits": splits(train), "metricThreshold": threshold,
                                 "maxErrors": 1, "teacher": teacher, "metricCalls": calls,
                                 "history": history(model),
                                 "studentHistory": history(student_model) if teacher else [], **result}})
    model = lm()
    repeated_traces = []

    def repeated_metric(e, p, trace=None):
        repeated_traces.append({"id": e.id, "demos": [
            {**inputs, **outputs.toDict()} for _, inputs, outputs in trace]})
        return True

    with dspy.context(lm=model):
        repeated = dspy.BootstrapFewShot(
            metric=repeated_metric, max_bootstrapped_demos=2,
            max_labeled_demos=0, max_rounds=1,
        ).compile(RepeatedCall(), trainset=train)
    # Preserve the observable invariant, not the process-dependent pickle hash pick.
    retained = repeated.predictor.demos
    policy = []
    for entry in repeated_traces:
        selected = [{"question": d.question, "answer": d.answer} for d in retained
                    if d.question.startswith(entry["id"] + "/")]
        policy.append({**entry, "retainedCount": len(selected),
                       "retainedFromTrace": all(d in entry["demos"] for d in selected)})
    docs.append({"id": "bootstrap-repeated-call-001",
                 "description": "One trace-member demo per repeated predictor per example; pickle-hash pick is not serialized.",
                 "payload": {"splits": splits(train), "examples": policy, "history": history(model)}})
    model = lm()
    calls = []

    def labeled_metric(e, p, trace=None):
        calls.append({"id": e.id, "prediction": p.toDict()})
        return e.id == "train-3"

    with dspy.context(lm=model):
        compiled = dspy.BootstrapFewShot(
            metric=labeled_metric, max_bootstrapped_demos=1,
            max_labeled_demos=2, max_rounds=1,
        ).compile(dspy.Predict("question -> answer"), trainset=train)
    docs.append({"id": "bootstrapfewshot-labeled-001",
                 "description": "Default teacher labeled prewarming, leave-one-out prompts, and labeled student fill.",
                 "payload": {"splits": splits(train), "metricCalls": calls,
                             "history": history(model), "state": state(compiled)}})
    model = lm()
    with dspy.context(lm=model):
        compiled = dspy.BootstrapFewShotWithRandomSearch(
            metric=lambda e, p, trace=None: float(p.answer == "teacher"),
            max_bootstrapped_demos=2, max_labeled_demos=1, num_candidate_programs=2,
            num_threads=1, max_rounds=1,
        ).compile(dspy.Predict("question -> answer"), trainset=train, valset=val)
    candidates = [{"seed": c["seed"], "score": c["score"] / 100,
                   "subscores": c["subscores"], "state": state(c["program"]),
                   "demoCounts": [len(p.demos) for p in c["program"].predictors()]}
                  for c in compiled.candidate_programs]
    docs.append({"id": "bootstraprs-001", "description": "Full upstream random-search seed catalog and winner.",
                 "payload": {"splits": splits(train, val), "candidates": candidates,
                             "winnerSeed": compiled.candidate_programs[0]["seed"],
                             "history": history(model), "state": state(compiled)}})
    docs.extend(bootstrap_policy())
    return docs
