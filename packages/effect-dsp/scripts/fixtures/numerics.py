"""Pinned DSPy/GEPA numeric witnesses: builtin ``sum`` ties and Evaluate percentage rounding.

Every expected value comes from the pinned upstream functions or engine run in
this process (dspy 3.4.0, gepa 0.1.4, CPython 3.12). Test doubles only supply
metric values, task outputs and proposed texts; no reduction, rounding,
acceptance or selection policy is reimplemented here.
"""

import types

import dspy
from dspy.teleprompt.utils import get_program_with_highest_avg_score
from gepa.api import optimize
from gepa.core.adapter import EvaluationBatch
from gepa.core.result import GEPAResult
from gepa.core.state import GEPAState
from gepa.gepa_utils import idxmax, remove_dominated_programs, select_program_candidate_from_pareto_front
from gepa.strategies.acceptance import StrictImprovementAcceptance


class _Constant(dspy.Module):
    def __init__(self, answer):
        super().__init__()
        self.answer = answer

    def forward(self, question):
        return dspy.Prediction(answer=self.answer)


def _evaluate(devset, metric):
    return dspy.Evaluate(devset=devset, metric=metric, num_threads=1, display_progress=False,
                         display_table=False)(_Constant("Paris"))


def mipro_percentage():
    # dspy/evaluate/evaluate.py: round(100 * ncorrect / ntotal, 2), ncorrect = builtin sum of metric values.
    binary = [dspy.Example(question=f"q{i}", answer="Paris" if i < 23 else "Tokyo").with_inputs("question")
              for i in range(160)]
    exact = _evaluate(binary, lambda example, prediction, trace=None: example.answer == prediction.answer)
    grades = [0.2, 1.0, 0.9, 0.7, 0.6, 0.8, 0.9, 0.8, 0.3, 0.2, 0.8, 0.9, 0.1, 0.6, 0.6, 0.5]
    graded_devset = [dspy.Example(question=f"g{i}", grade=grade).with_inputs("question")
                     for i, grade in enumerate(grades)]
    graded = _evaluate(graded_devset, lambda example, prediction, trace=None: example.grade)
    return {"id": "mipro-percentage-rounding-001",
            "description": "dspy.Evaluate percentage: 100 * builtin-sum(metric) / n, then round half-even to 2 places.",
            "payload": {
                "binary": {"examples": len(binary), "correct": 23, "score": exact.score,
                           "fraction": exact.score / 100},
                "graded": {"grades": grades, "score": graded.score, "fraction": graded.score / 100},
            }}


def mipro_checkpoint():
    # Each minibatch is one example scored by dspy.Evaluate; the told values are its rounded percentages.
    values = {"A": [0.5, 0.6], "B": [0.55]}
    scores = {key: [_evaluate([dspy.Example(question="q", grade=value).with_inputs("question")],
                              lambda example, prediction, trace=None: example.grade).score
                    for value in grades]
              for key, grades in values.items()}
    selected = {}
    for order in [["A", "B"], ["B", "A"]]:
        # param_score_dict insertion order is first observation order (mipro_optimizer_v2.py).
        param_score_dict = {key: [(score, key, {}) for score in scores[key]] for key in order}
        _, mean, key, _ = get_program_with_highest_avg_score(param_score_dict, set())
        selected["".join(order)] = {"key": key, "mean": mean}
    return {"id": "mipro-checkpoint-tie-001",
            "evidence": "upstream-kernel",
            "description": "get_program_with_highest_avg_score: equal real means tie to the first inserted combination.",
            "payload": {"metricValues": values, "scores": scores, "selected": selected}}


def gepa_kernels():
    seed, child, empty = [0.3, 0.3, 0.0], [0.1, 0.2, 0.3], [0.0, 0.0, 0.0]
    state = object.__new__(GEPAState)
    state.prog_candidate_val_subscores = [dict(enumerate(seed)), dict(enumerate(child))]
    state.program_candidates = [{"qa": "seed"}, {"qa": "child"}]
    aggregates = state.program_full_scores_val_set
    result = GEPAResult(candidates=state.program_candidates, parents=[[None], [0]],
                        val_aggregate_scores=list(aggregates),
                        val_subscores=state.prog_candidate_val_subscores,
                        per_val_instance_best_candidates={}, discovery_eval_counts=[0, 0])
    proposal = types.SimpleNamespace(subsample_scores_before=seed, subsample_scores_after=child)
    # core/engine.py merge gate: sum(after) >= max(parent subsample sums), parent sums from builtin sum (merge.py).
    merge_parents = [sum(child), sum(empty)]
    merged_sum = sum(seed)
    # Pareto pruning: index 0 and 1 tie on example 3, and their aggregates tie only under builtin sum.
    vectors = [child + [0.6], seed + [0.6], [0.9, 0.9, 0.9, 0.0]]
    pruning = object.__new__(GEPAState)
    pruning.prog_candidate_val_subscores = [dict(enumerate(vector)) for vector in vectors]
    pruning_aggregates = pruning.program_full_scores_val_set
    fronts = {j: {i for i, vector in enumerate(vectors) if vector[j] == max(row[j] for row in vectors)}
              for j in range(4)}
    pruned = remove_dominated_programs(fronts, scores=pruning_aggregates)
    # A choice stub returns the frequency-expanded catalogue that GEPA samples from.
    catalogue = select_program_candidate_from_pareto_front(fronts, pruning_aggregates,
                                                           types.SimpleNamespace(choice=lambda values: values))
    return {"id": "gepa-sum-kernels-001",
            "evidence": "upstream-kernel",
            "description": "GEPA aggregates, strict mutation gate, merge gate and Pareto pruning over builtin-sum ties.",
            "payload": {
                "aggregate": {"scoreVectors": [seed, child], "aggregates": aggregates,
                              "idxmax": idxmax(aggregates), "bestIndex": result.best_idx},
                "mutation": {"before": seed, "after": child, "beforeSum": sum(seed), "afterSum": sum(child),
                             "accepted": StrictImprovementAcceptance().should_accept(proposal, None)},
                "merge": {"merged": seed, "parentA": child, "parentB": empty, "mergedSum": merged_sum,
                          "bestParentSum": max(merge_parents), "accepted": merged_sum >= max(merge_parents)},
                "pruning": {"scoreVectors": vectors, "aggregates": pruning_aggregates,
                            "frontierIndices": sorted(set().union(*pruned.values())),
                            "parentCatalogue": catalogue},
            }}


def gepa_mutation_run():
    # Real engine: one reflective iteration whose child ties its parent under builtin sum.
    table = {"seed": [0.3, 0.3, 0.0], "IMPROVED instruction": [0.1, 0.2, 0.3]}
    calls, minibatches, rejected, accepted, iterations = [], [], [], [], []

    class Adapter:
        def evaluate(self, batch, candidate, capture_traces=False):
            scores = [table[candidate["qa"]][row["index"]] for row in batch]
            calls.extend({"id": row["id"], "instruction": candidate["qa"], "score": score}
                         for row, score in zip(batch, scores))
            return EvaluationBatch(outputs=batch, scores=scores, trajectories=batch if capture_traces else None)

        def make_reflective_dataset(self, candidate, eval_batch, components_to_update):
            return {key: [{"Inputs": row, "Feedback": "fb"} for row in eval_batch.trajectories]
                    for key in components_to_update}

        def propose_new_texts(self, candidate, reflective_dataset, components_to_update):
            return {key: "IMPROVED instruction" for key in components_to_update}

    class Recorder:
        def on_minibatch_sampled(self, event):
            minibatches.append(event["minibatch_ids"])

        def on_candidate_rejected(self, event):
            rejected.append({"beforeSum": event["old_score"], "afterSum": event["new_score"]})

        def on_candidate_accepted(self, event):
            accepted.append(event["new_candidate_idx"])

        def on_iteration_end(self, event):
            iterations.append({"iteration": event["iteration"], "accepted": event["proposal_accepted"]})

    rows = [{"id": f"q{i}", "index": i} for i in range(3)]
    result = optimize(seed_candidate={"qa": "seed"}, trainset=rows, valset=rows, adapter=Adapter(),
                      reflection_minibatch_size=3, skip_perfect_score=False, use_merge=False, seed=0,
                      max_metric_calls=9, callbacks=[Recorder()])
    assert iterations and not accepted, (iterations, accepted)
    return {"id": "gepa-mutation-tie-001",
            "description": "Real GEPA engine: a child whose minibatch sum ties its parent under builtin sum is rejected.",
            "payload": {"seed": 0, "maxMetricCalls": 9, "table": table, "rows": rows, "calls": calls,
                        "minibatches": minibatches, "rejected": rejected, "iterations": iterations,
                        "candidates": result.candidates, "bestIndex": result.best_idx,
                        "valAggregateScores": result.val_aggregate_scores}}


def gepa_merge_run():
    # Real engine, same scripted task as gepa.merge_sequences; only the merged validation vector differs.
    # On the merge subsample the merged builtin sum equals the best parent's (2.5), so the >= gate accepts.
    vectors = {"seed/seed": [0.5, 0.5, 0.5, 0.1, 0.1, 0.1, 0.1],
               "left/seed": [0.8, 0.8, 0.8, 0.05, 0.05, 0.05, 0.05],
               "seed/right": [0.1, 0.1, 0.1, 0.9, 0.9, 0.9, 0.9],
               "left/right": [0.4, 0.0, 0.2, 0.95, 0.95, 0.95, 0.95]}
    calls, merges, accepted_merges, rejected_merges, iterations = [], [], [], [], []

    class Adapter:
        def evaluate(self, batch, candidate, capture_traces=False):
            scores = []
            for row in batch:
                score = (0.2 + 0.2 * sum(v != "seed" for v in candidate.values())
                         if row["split"] == "train" else vectors["/".join(candidate.values())][row["index"]])
                scores.append(score)
                calls.append({"id": row["id"], "candidate": dict(candidate), "score": score})
            return EvaluationBatch(outputs=batch, scores=scores, trajectories=batch if capture_traces else None)

        def make_reflective_dataset(self, candidate, eval_batch, components_to_update):
            return {key: [{"Inputs": row, "Feedback": "improve"} for row in eval_batch.trajectories]
                    for key in components_to_update}

        def propose_new_texts(self, candidate, reflective_dataset, components_to_update):
            return {key: "left" if key == "root.draft" else "right" for key in components_to_update}

    class Recorder:
        def on_merge_attempted(self, event):
            merges.append({"iteration": event["iteration"], "parents": list(event["parent_ids"])})

        def on_merge_accepted(self, event):
            accepted_merges.append(event["new_candidate_idx"])

        def on_merge_rejected(self, event):
            rejected_merges.append(event["reason"])

        def on_iteration_end(self, event):
            iterations.append({"iteration": event["iteration"], "accepted": event["proposal_accepted"],
                               "metricCalls": event["state"].total_num_evals})

    train = [{"id": f"train-{i}", "split": "train", "index": i} for i in range(5)]
    val = [{"id": f"val-{i}", "split": "val", "index": i} for i in range(7)]
    result = optimize(seed_candidate={"root.draft": "seed", "root.judge": "seed"}, trainset=train, valset=val,
                      adapter=Adapter(), reflection_minibatch_size=3, skip_perfect_score=False, use_merge=True,
                      seed=0, max_metric_calls=34, callbacks=[Recorder()])
    assert len(merges) == 1 and accepted_merges and not rejected_merges, (merges, accepted_merges, rejected_merges)
    return {"id": "gepa-merge-tie-001",
            "description": "Real GEPA engine: a merge whose subsample builtin sum ties the best parent is accepted.",
            "payload": {"seed": 0, "maxMetricCalls": 34, "train": train, "val": val, "validationScores": vectors,
                        "calls": calls, "merges": merges, "acceptedMerges": accepted_merges,
                        "iterations": iterations, "candidates": result.candidates,
                        "scoreVectors": [list(row.values()) for row in result.val_subscores],
                        "bestIndex": result.best_idx, "totalMetricCalls": result.total_metric_calls}}


def generate():
    return [mipro_percentage(), mipro_checkpoint(), gepa_kernels(), gepa_mutation_run(), gepa_merge_run(),
            evaluate_mean()]


def evaluate_mean():
    grades = [0.1, 0.2, 0.3]
    rows = [dspy.Example(question=f"q{i}", grade=grade).with_inputs("question")
            for i, grade in enumerate(grades)]
    evaluated = _evaluate(rows, lambda example, prediction, trace=None: example.grade)
    scored = [score for _, _, score in evaluated.results]
    composed = _evaluate([dspy.Example(question="composed").with_inputs("question")],
                         lambda example, prediction, trace=None: sum(grades) / len(grades))
    return {"id": "eval-compensated-mean-001",
            "description": "Evaluate raw-score mean and a user-composed arithmetic-mean metric use builtin float sum.",
            "payload": {"grades": grades, "scores": scored,
                        "mean": sum(scored) / len(scored), "percent": evaluated.score,
                        "composedScore": composed.results[0][2]}}
