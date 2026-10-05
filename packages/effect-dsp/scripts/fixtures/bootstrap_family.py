import dspy

from ._common import examples, history, lm, splits, state


class TwoStage(dspy.Module):
    def __init__(self):
        super().__init__()
        self.first = dspy.Predict("question -> answer")
        self.second = dspy.Predict("question -> answer")

    def forward(self, question):
        intermediate = self.first(question=question)
        return self.second(question=intermediate.answer)


def generate():
    train, val = examples("train", 4), examples("val", 2)
    docs = []
    labeled = dspy.LabeledFewShot(k=2).compile(dspy.Predict("question -> answer"), trainset=train)
    docs.append({"id": "labeledfewshot-001", "description": "Seeded upstream labeled sampling.",
                 "payload": {"splits": splits(train), "state": state(labeled), "history": []}})
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
    return docs
