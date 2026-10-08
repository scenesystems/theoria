import dspy

from ._common import examples, history, lm, splits, state


def generate():
    val = examples("val", 2)
    model = lm("label-0")
    program = dspy.Predict("question -> answer")

    def metric(example, prediction, trace=None):
        if example.id == "val-1":
            raise ValueError("scripted metric failure")
        return float(prediction.answer == example.answer)

    runs = []
    with dspy.context(lm=model):
        for failure_score, max_errors in [(0, 10), (0.25, 10), (0, 1)]:
            evaluator = dspy.Evaluate(devset=val, metric=metric, num_threads=1,
                                      display_progress=False, failure_score=failure_score,
                                      max_errors=max_errors)
            try:
                result = evaluator(program)
                runs.append({"failureScore": failure_score, "maxErrors": max_errors,
                             "score": result.score / 100,
                             "rows": [{"id": e.id, "prediction": p.toDict(), "score": s}
                                      for e, p, s in result.results]})
            except Exception as error:
                runs.append({"failureScore": failure_score, "maxErrors": max_errors,
                             "error": type(error).__name__, "message": str(error)})
    assert runs[0]["score"] == 0.5
    assert "error" in runs[2]
    return [{"id": "eval-failure-inclusive",
             "description": "Evaluate includes a failed row in its denominator and enforces max_errors.",
             "payload": {"splits": splits([], val), "runs": runs,
                         "history": history(model), "state": state(program)}}]
