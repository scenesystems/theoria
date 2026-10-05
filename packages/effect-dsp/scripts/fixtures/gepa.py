import dspy
from dspy.utils import DummyLM

from ._common import examples, history, splits, state


def generate():
    train, val = examples("train", 2), examples("val", 2)
    # Script the task LM in evaluation order: seed validation, parent reflection,
    # proposed minibatch, proposed validation. No optimizer policy is replaced.
    task = DummyLM([{"answer": a} for a in ["specialist"] * 4 + ["generalist"] * 4])
    reflection = DummyLM([{"answer": "```generalist```"}])
    program = dspy.Predict("question -> answer")
    program.signature = program.signature.with_instructions("specialist")
    calls, events = [], []

    def metric(gold, pred, trace=None, pred_name=None, pred_trace=None):
        score = (1.0 if gold.id.endswith("-0") else 0.0) if pred.answer == "specialist" else 0.8
        calls.append({"id": gold.id, "answer": pred.answer, "score": score,
                      "target": pred_name})
        return dspy.Prediction(score=score, feedback=f"{gold.id}: score={score}")

    class Recorder:
        def on_candidate_selected(self, event):
            events.append({"event": "selected", **event})

        def on_minibatch_sampled(self, event):
            events.append({"event": "minibatch", **event})

        def on_candidate_accepted(self, event):
            events.append({"event": "accepted", **event})

        def on_merge_attempted(self, event):
            events.append({"event": "merge", **event})

        def on_budget_updated(self, event):
            events.append({"event": "budget", **event})

    with dspy.context(lm=task):
        compiled = dspy.GEPA(
            metric=metric, max_metric_calls=8, reflection_minibatch_size=2,
            reflection_lm=reflection, skip_perfect_score=False, use_merge=False,
            num_threads=1, seed=0, track_stats=True,
            gepa_kwargs={"callbacks": [Recorder()]},
        ).compile(program, trainset=train, valset=val)
    result = compiled.detailed_results
    assert result.val_aggregate_scores == [0.5, 0.8]
    assert result.best_idx == 1
    return [{"id": "gepa-aggregate-best-001",
             "description": "GEPA.compile selects aggregate best, not first per-instance frontier winner; merge disabled.",
             "payload": {"seed": 0, "splits": splits(train, val), "metricCalls": calls,
                         "events": events, "maxMetricCalls": 8,
                         "totalMetricCalls": result.total_metric_calls,
                         "aggregateScores": result.val_aggregate_scores,
                         "perInstanceWinners": {str(k): sorted(v) for k, v in result.per_val_instance_best_candidates.items()},
                         "parents": result.parents, "bestIndex": result.best_idx,
                         "candidates": [state(p) for p in result.candidates],
                         "taskHistory": history(task), "reflectionHistory": history(reflection),
                         "state": state(compiled)}}]
