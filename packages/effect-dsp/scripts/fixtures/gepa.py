import random
import re
from tempfile import TemporaryDirectory
from types import SimpleNamespace

import dspy
from dspy.utils import DummyLM
from gepa.api import optimize
from gepa.core.adapter import EvaluationBatch
from gepa.core.data_loader import ensure_loader
from gepa.gepa_utils import remove_dominated_programs, select_program_candidate_from_pareto_front
from gepa.proposer.merge import MergeProposer, sample_and_attempt_merge_programs_by_common_predictors
from gepa.strategies.batch_sampler import EpochShuffledBatchSampler

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
    return [{"id": "gepa-aggregate-best",
             "description": "GEPA.compile selects aggregate best, not first per-instance frontier winner; merge disabled.",
             "payload": {"seed": 0, "splits": splits(train, val), "metricCalls": calls,
                         "events": events, "maxMetricCalls": 8,
                         "totalMetricCalls": result.total_metric_calls,
                         "aggregateScores": result.val_aggregate_scores,
                         "perInstanceWinners": {str(k): sorted(v) for k, v in result.per_val_instance_best_candidates.items()},
                         "parents": result.parents, "bestIndex": result.best_idx,
                         "candidates": [state(p) for p in result.candidates],
                         "taskHistory": history(task), "reflectionHistory": history(reflection),
                         "state": state(compiled)}}] + selection_kernels() + compile_sequences() + merge_kernels() + merge_sequences()


def selection_kernels():
    cases = []
    for name, matrix in [
        ("specialists-and-generalist", [[1, 0], [0.8, 0.8]]),
        ("redundant-coverage", [[1, 1, 0, 0], [1, 0, 1, 0], [0, 1, 1, 1], [0.8, 0.8, 0.8, 0.8]]),
        ("equal-coverage", [[1, 0.25], [1, 0.25], [1, 0.25]]),
        ("unequal-frequency", [[0, 1, 0, 0], [1, 0, 1, 1], [0.9, 0.9, 0.9, 0.9]]),
    ]:
        scores = [sum(row) / len(row) for row in matrix]
        holdings = {j: {i for i, row in enumerate(matrix) if row[j] == max(col)}
                    for j, col in enumerate(zip(*matrix))}
        pruned = remove_dominated_programs(holdings, scores)
        rng = random.Random(9)
        sampler = EpochShuffledBatchSampler(minibatch_size=3, rng=rng)
        loader = ensure_loader(list(range(5)))
        calls = []
        for iteration in [0, 1, 2, 2, 4, 5, 6]:
            parent = select_program_candidate_from_pareto_front(holdings, scores, rng)
            batch = sampler.next_minibatch_ids(loader, SimpleNamespace(i=iteration))
            calls.append({"iteration": iteration, "parent": parent, "batch": batch,
                          "epoch": sampler.epoch, "shuffled": list(sampler.shuffled_ids)})
        cases.append({"name": name, "scores": matrix, "aggregates": scores,
                      "holdings": [sorted(h) for h in holdings.values()],
                      "pruned": [sorted(h) for h in pruned.values()],
                      "calls": calls, "nextRandom": rng.random()})
    return [{"id": "gepa-selection", "evidence": "upstream-kernel",
             "description": "GEPA coverage pruning, parent choice and shared epoch-shuffle stream with padding, skipped and repeated iterations.",
             "payload": {"seed": 9, "trainsetSize": 5, "minibatchSize": 3, "cases": cases}}]


def compile_sequences():
    class InstructionLM(DummyLM):
        def forward(self, prompt=None, messages=None, **kwargs):
            level = re.search(r"quality=(\d+)", messages[0]["content"]).group(1)
            self.answers = iter([{"answer": level}])
            return super().forward(prompt=prompt, messages=messages, **kwargs)

    documents = []
    for perfect in [False, True]:
        train, val = examples("train", 5), examples("val", 5)
        task = InstructionLM([])
        reflection = DummyLM([{"answer": f"```quality={i}```"} for i in range(1, 10)])
        program = dspy.Predict("question -> answer")
        program.signature = program.signature.with_instructions("quality=0")
        calls, events = [], []

        def metric(gold, pred, trace=None, pred_name=None, pred_trace=None):
            score = 1.0 if perfect else [0.2, 0.4, 0.6, 0.8][int(pred.answer)]
            calls.append({"id": gold.id, "answer": pred.answer, "score": score, "target": pred_name})
            return dspy.Prediction(score=score, feedback=f"feedback:{gold.id}:{score}")

        class Recorder:
            def on_candidate_selected(self, event):
                events.append({"event": "selected", **event})

            def on_minibatch_sampled(self, event):
                events.append({"event": "minibatch", **event})

            def on_iteration_end(self, event):
                events.append({"event": "iteration", "iteration": event["iteration"],
                               "accepted": event["proposal_accepted"],
                               "metricCalls": event["state"].total_num_evals})

        budget = 6 if perfect else 30
        with dspy.context(lm=task):
            compiled = dspy.GEPA(
                metric=metric, max_metric_calls=budget, reflection_lm=reflection,
                use_merge=False, num_threads=1, seed=9, track_stats=True,
                gepa_kwargs={"callbacks": [Recorder()]},
            ).compile(program, trainset=train, valset=val)
        result = compiled.detailed_results
        assert result.total_metric_calls == (8 if perfect else 38)
        documents.append({"id": "gepa-budget" if perfect else "gepa",
                          "description": "Real GEPA epoch-shuffled reflection, targeted feedback, iteration-boundary budget overshoot and aggregate selection; perfect batches skip reflection.",
                          "payload": {"seed": 9, "splits": splits(train, val), "metricCalls": calls,
                                      "events": events, "maxMetricCalls": budget,
                                      "totalMetricCalls": result.total_metric_calls,
                                      "feedbackMetricCalls": sum(c["target"] is not None for c in calls),
                                      "aggregateScores": result.val_aggregate_scores,
                                      "parents": result.parents, "bestIndex": result.best_idx,
                                      "candidates": [state(p) for p in result.candidates],
                                      "taskHistory": history(task), "reflectionHistory": history(reflection),
                                      "state": state(compiled)}})
    return documents


def merge_kernels():
    assert list(set(range(7)) & set(range(7))) == list(range(7))
    cases = []
    programs = [{"qa": "seed", "judge": "seed"}, {"qa": "left", "judge": "seed"},
                {"qa": "seed", "judge": "right"}]
    parents = [[None], [0], [0]]
    for name, candidates, lineage, scores, support in [
        ("complementary", programs, parents, [0.2, 0.6, 0.7], True),
        ("insufficient-overlap", programs, parents, [0.2, 0.6, 0.7], False),
        ("ancestor-parent", programs, [[None], [0], [1]], [0.2, 0.6, 0.7], True),
        ("no-desirable-component", [programs[0], {"qa": "left", "judge": "left"},
                                   {"qa": "right", "judge": "right"}], parents, [0.2, 0.6, 0.7], True),
        ("equal-score-conflict", [{**p, "conflict": str(i)} for i, p in enumerate(programs)],
         parents, [0.2, 0.6, 0.6], True),
    ]:
        rng = random.Random(9)
        performed = ([], [])
        merged = sample_and_attempt_merge_programs_by_common_predictors(
            scores, rng, [1, 2], performed, candidates, lineage,
            has_val_support_overlap=lambda i, j: support)
        subsample = []
        if merged is not None:
            performed[0].append(tuple(merged[1:]))
            proposer = MergeProposer(None, None, None, True, 5, rng=rng)
            subsample = proposer.select_eval_subsample_for_merged_program(
                dict(enumerate([0.9, 0.8, 0.7, 0.6, 0.2, 0.5, 0.5])),
                dict(enumerate([0.1, 0.2, 0.3, 0.4, 0.8, 0.5, 0.5])))
        cases.append({"name": name, "programs": candidates, "parents": lineage,
                      "scores": scores, "hasSupport": support, "merged": merged,
                      "subsample": subsample, "nextRandom": rng.random()})
    return [{"id": "gepa-merge", "evidence": "upstream-kernel",
             "description": "Pinned common-ancestor merge draws, eligibility, tied conflict and balanced validation sample.",
             "payload": {"seed": 9, "validationOrder": list(range(7)),
                         "buckets": [[0, 1, 2, 3], [4], [5, 6]], "cases": cases}}]


def merge_sequences():
    # External task/feedback/proposal doubles only; the engine, selectors,
    # sampler, acceptance, scheduling and budget hooks are upstream code.
    documents = []
    for accept in [True, False]:
        calls, proposals, iterations, selected, minibatches, merges = [], [], [], [], [], []
        vectors = {"seed/seed": [0.5, 0.5, 0.5, 0.1, 0.1, 0.1, 0.1],
                   "left/seed": [0.8, 0.8, 0.8, 0.05, 0.05, 0.05, 0.05],
                   "seed/right": [0.1, 0.1, 0.1, 0.9, 0.9, 0.9, 0.9],
                   "left/right": [0.95 if accept else 0.01] * 7}

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
                proposed = {key: "left" if key == "root.draft" else "right" for key in components_to_update}
                proposals.append({"candidate": dict(candidate), "components": components_to_update, "proposed": proposed})
                return proposed

        class Recorder:
            def on_candidate_selected(self, event):
                selected.append({"iteration": event["iteration"], "index": event["candidate_idx"]})

            def on_minibatch_sampled(self, event):
                minibatches.append({"iteration": event["iteration"], "ids": event["minibatch_ids"]})

            def on_merge_attempted(self, event):
                merges.append(dict(event))

            def on_iteration_end(self, event):
                iterations.append({"iteration": event["iteration"], "accepted": event["proposal_accepted"],
                                   "metricCalls": event["state"].total_num_evals})

        train = [{"id": f"train-{i}", "split": "train", "index": i} for i in range(5)]
        val = [{"id": f"val-{i}", "split": "val", "index": i} for i in range(7)]
        settings = dict(seed_candidate={"root.draft": "seed", "root.judge": "seed"},
                        trainset=train, valset=val, reflection_minibatch_size=3,
                        skip_perfect_score=False, use_merge=True, seed=0)
        result = optimize(**settings, adapter=Adapter(), max_metric_calls=34, callbacks=[Recorder()])
        assert len(merges) == 1, (selected, proposals, iterations)
        documents.append({"id": "gepa-merge-accepted" if accept else "gepa-merge-rejected",
                          "description": "Real GEPA engine with scripted task: complementary merge consumes a whole iteration, accepted or rejected; exact shared-stream sampling and budget ledger.",
                          "payload": {"seed": 0, "maxMetricCalls": 34, "acceptMerge": accept,
                                      "train": train, "val": val, "validationScores": vectors,
                                      "calls": calls, "proposals": proposals, "selected": selected,
                                      "minibatches": minibatches, "merges": merges, "iterations": iterations,
                                      "candidates": result.candidates, "parents": result.parents,
                                      "scoreVectors": [list(row.values()) for row in result.val_subscores],
                                      "bestIndex": result.best_idx, "totalMetricCalls": result.total_metric_calls}})
        if accept:
            # Observation only: run_dir saves state but not the live RNG/schedulers.
            # Separate lists keep the uninterrupted trace above untouched.
            calls, proposals, iterations, selected, minibatches, merges = [], [], [], [], [], []
            with TemporaryDirectory() as directory:
                prefix = optimize(**settings, adapter=Adapter(), max_metric_calls=21,
                                  callbacks=[Recorder()], run_dir=directory)
                resumed = optimize(**settings, adapter=Adapter(), max_metric_calls=34,
                                   callbacks=[Recorder()], run_dir=directory)
            assert prefix.total_metric_calls == 33
            assert (resumed.parents, resumed.total_metric_calls) != (result.parents, result.total_metric_calls)
            documents[-1]["payload"]["restartObservation"] = {
                "prefixBudget": 21, "prefixLedger": prefix.total_metric_calls,
                "resumedBudget": 34, "resumedLedger": resumed.total_metric_calls,
                "parents": resumed.parents, "candidates": resumed.candidates,
                "calls": calls, "iterations": iterations, "merges": merges,
            }
    return documents
